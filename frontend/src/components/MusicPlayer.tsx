import { useEffect, useRef, useState } from 'react';
import { ListMusic, Music2, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Volume2, X } from 'lucide-react';

type Track = { id: string; name: string; blob: Blob };
const DB_NAME = 'kma-local-music';
const STORE = 'tracks';

function openMusicDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadTracks() {
  const db = await openMusicDb();
  return new Promise<Track[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Track[]);
    request.onerror = () => reject(request.error);
  });
}

async function saveTracks(tracks: Track[]) {
  const db = await openMusicDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear(); tracks.forEach((track) => store.put(track));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

export function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('music-volume') ?? '0.7'));
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef('');
  const currentIndex = tracks.findIndex((track) => track.id === currentId);
  const current = tracks[currentIndex];

  useEffect(() => { loadTracks().then(setTracks).catch(() => setError('Không thể đọc danh sách nhạc trên thiết bị.')); }, []);
  useEffect(() => {
    const open = () => setExpanded(true);
    window.addEventListener('kma:music-open', open);
    return () => window.removeEventListener('kma:music-open', open);
  }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; localStorage.setItem('music-volume', String(volume)); }, [volume]);
  useEffect(() => () => { if (sourceRef.current) URL.revokeObjectURL(sourceRef.current); }, []);

  const selectTrack = (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
    sourceRef.current = URL.createObjectURL(track.blob);
    audio.src = sourceRef.current;
    audio.volume = volume;
    setCurrentId(track.id);
    audio.play().then(() => setPlaying(true)).catch(() => { setPlaying(false); setError('Không phát được file âm thanh này.'); });
  };
  const togglePlayback = () => {
    if (!current && tracks.length) selectTrack(tracks[0]);
    else if (!current) fileRef.current?.click();
    else if (playing) { audioRef.current?.pause(); setPlaying(false); }
    else { audioRef.current?.play().then(() => setPlaying(true)).catch(() => setError('Định dạng nhạc này không phát được trên trình duyệt.')); }
  };
  const stepTrack = (direction: number) => {
    if (!tracks.length) return;
    const next = currentIndex < 0
      ? (direction > 0 ? 0 : tracks.length - 1)
      : (currentIndex + direction + tracks.length) % tracks.length;
    selectTrack(tracks[next]);
  };
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added = Array.from(files).filter((file) => file.type.startsWith('audio/')).map((file) => ({ id: crypto.randomUUID(), name: file.name, blob: file }));
    if (!added.length) { setError('Chỉ chọn được file âm thanh.'); return; }
    const updated = [...tracks, ...added];
    try { await saveTracks(updated); setTracks(updated); setError(''); if (!currentId) selectTrack(added[0]); }
    catch { setError('Không lưu được file. Thử file nhỏ hơn hoặc giải phóng dung lượng trình duyệt.'); }
  };
  const reorder = async (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    const updated = [...tracks]; [updated[index], updated[target]] = [updated[target], updated[index]];
    setTracks(updated); await saveTracks(updated).catch(() => setError('Không lưu được thứ tự phát.'));
  };
  const removeTrack = async (id: string) => {
    const updated = tracks.filter((track) => track.id !== id);
    await saveTracks(updated).catch(() => setError('Không xóa được file khỏi danh sách.'));
    setTracks(updated);
    if (currentId === id) {
      audioRef.current?.pause(); audioRef.current?.removeAttribute('src'); audioRef.current?.load();
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
      sourceRef.current = ''; setPlaying(false); setCurrentId('');
    }
  };

  return <>
    <audio ref={audioRef} onEnded={() => tracks.length > 1 ? stepTrack(1) : setPlaying(false)} onError={() => { if (current) setError('Không phát được file âm thanh này.'); }} />
    <section className={`music-dock ${expanded ? 'expanded' : ''}`} aria-label="Trình phát nhạc">
      <div className="music-main">
        <button className="music-library-toggle" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Thu gọn trình phát' : 'Mở danh sách nhạc'}><Music2 /></button>
        <button className="music-current" onClick={() => setExpanded((value) => !value)} title={current?.name || 'Nhạc của tôi'}><b>{current?.name || 'Nhạc của tôi'}</b><small>{current ? 'Tệp trên thiết bị' : `${tracks.length} bài trong danh sách`}</small></button>
        <button className="music-control" onClick={() => stepTrack(-1)} disabled={!tracks.length} aria-label="Bài trước"><SkipBack /></button>
        <button className="music-play" onClick={togglePlayback} aria-label={playing ? 'Tạm dừng' : 'Phát'}>{playing ? <Pause /> : <Play />}</button>
        <button className="music-control" onClick={() => stepTrack(1)} disabled={!tracks.length} aria-label="Bài tiếp theo"><SkipForward /></button>
        <label className="music-volume" title={`Âm lượng ${Math.round(volume * 100)}%`}><Volume2 /><input aria-label="Âm lượng" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
        <button className="music-control music-close" onClick={() => setExpanded(false)} aria-label="Thu gọn"><X /></button>
      </div>
      {expanded && <div className="music-library">
        <div className="music-library-head"><div><b>Danh sách phát</b><small>{tracks.length} bài · chỉ lưu trên thiết bị này</small></div><button className="secondary-btn" onClick={() => fileRef.current?.click()}><Plus /> Tải nhạc</button></div>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" multiple hidden onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ''; }} />
        {error && <p className="music-error">{error}</p>}
        {!tracks.length ? <div className="music-empty"><ListMusic /><span>Thêm file nhạc để bắt đầu nghe.</span></div> : <ol>{tracks.map((track, index) => <li key={track.id} className={track.id === currentId ? 'selected' : ''}>
          <button className="music-track-name" onClick={() => selectTrack(track)}><span>{String(index + 1).padStart(2, '0')}</span><b>{track.name}</b></button>
          <button className="music-small-control" onClick={() => void reorder(index, -1)} disabled={index === 0} aria-label="Chuyển lên">↑</button><button className="music-small-control" onClick={() => void reorder(index, 1)} disabled={index === tracks.length - 1} aria-label="Chuyển xuống">↓</button>
          <button className="music-small-control remove" onClick={() => void removeTrack(track.id)} aria-label={`Xóa ${track.name}`}><Trash2 /></button>
        </li>)}</ol>}
        <p className="music-footnote">Phát tuần tự theo thứ tự danh sách. File không được tải lên máy chủ.</p>
      </div>}
    </section>
  </>;
}
