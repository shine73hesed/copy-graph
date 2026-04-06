'use client';

interface Props {
  total: number;
  current: number;
}

export default function SegmentProgress({ total, current }: Props) {
  return (
    <div className="quiz-segment-bar">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`quiz-segment ${i < current ? 'done' : i === current ? 'current' : ''}`}
        />
      ))}
    </div>
  );
}
