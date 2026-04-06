// frontend/components/chat/DoneCard.tsx
"use client";

interface Props {
  confirmedCount: number;
  totalItems: number;
  onComplete: () => void;
}

export default function DoneCard({
  confirmedCount,
  totalItems,
  onComplete,
}: Props) {
  return (
    <div className="done-card">
      <h3>학습 완료!</h3>
      <div className="done-stats">
        체크리스트 {confirmedCount}/{totalItems} 달성
      </div>
      <div className="done-btns">
        <button className="done-btn primary" onClick={onComplete}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            quiz
          </span>
          사후 평가로
        </button>
      </div>
    </div>
  );
}
