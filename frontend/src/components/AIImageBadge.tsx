import { CircleHelp, Sparkles } from 'lucide-react';

export function AIImageBadge({ result, compact = false }: { result: boolean | null | undefined; compact?: boolean }) {
  const label = result === true
    ? compact ? 'Ảnh AI' : 'Có dấu hiệu ảnh do AI tạo'
    : result === false
      ? compact ? 'Không phát hiện AI' : 'Không phát hiện dấu hiệu ảnh AI'
      : compact ? 'Chưa nhận diện' : 'Chưa nhận diện được ảnh';

  return (
    <span
      className={`ai-image-label ${result === true ? 'ai-detected' : result === false ? 'ai-not-detected' : 'ai-unknown'} ${compact ? 'compact' : ''}`}
      title="Kết quả do mô hình nhận diện ảnh AI đưa ra"
    >
      {result === true ? <Sparkles size={14} /> : <CircleHelp size={14} />}
      {label}
    </span>
  );
}
