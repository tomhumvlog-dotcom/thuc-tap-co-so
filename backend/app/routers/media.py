import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.image_authenticity import (
    ImageAuthenticityUnavailableError,
    InvalidImageError,
    classify_image,
)
from app.models import Media, User
from app.schemas import MediaOut, Message

router = APIRouter(prefix="/media", tags=["Media"])

IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm"}
ALLOWED_TYPES = IMAGE_TYPES | VIDEO_TYPES


@router.post("", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Định dạng tệp không được hỗ trợ")

    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Tệp vượt quá {settings.max_upload_mb} MB")

    is_ai_generated = None
    if content_type in IMAGE_TYPES:
        try:
            result = await run_in_threadpool(classify_image, content)
            is_ai_generated = result.is_ai_generated
        except InvalidImageError as exc:
            raise HTTPException(status_code=415, detail="Tệp tải lên không phải là ảnh hợp lệ") from exc
        except ImageAuthenticityUnavailableError:
            # Let uploads continue if the detector is temporarily unavailable;
            # null means this image has not been classified.
            is_ai_generated = None

    suffix = ALLOWED_TYPES[content_type]
    filename = f"{uuid.uuid4().hex}{suffix}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / filename
    path.write_bytes(content)

    media = Media(
        owner_id=user.id,
        url=str(request.base_url).rstrip("/") + f"/uploads/{filename}",
        storage_path=str(path),
        mime_type=content_type,
        size_bytes=len(content),
        is_ai_generated=is_ai_generated,
    )
    try:
        db.add(media)
        db.commit()
        db.refresh(media)
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    return media


@router.get("/{media_id}", response_model=MediaOut)
def get_media(media_id: uuid.UUID, db: Session = Depends(get_db)):
    media = db.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return media


@router.delete("/{media_id}", response_model=Message)
def delete_media(
    media_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media = db.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    if media.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own media")
    if media.post_id:
        raise HTTPException(status_code=409, detail="Delete the post that uses this media")
    path = Path(media.storage_path).resolve()
    root = Path(settings.upload_dir).resolve()
    if root in path.parents and path.exists():
        os.remove(path)
    db.delete(media)
    db.commit()
    return Message(message="Media deleted")
