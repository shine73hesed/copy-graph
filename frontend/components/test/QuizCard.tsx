'use client';

import type { TestItem } from '@/lib/types';

interface Props {
  item: TestItem;
  index: number;
  total: number;
  phaseLabel: string;
  value: string;
  onChange: (value: string) => void;
}

export default function QuizCard({ item, index, total, phaseLabel, value, onChange }: Props) {
  return (
    <div className="quiz-body">
      <div className="quiz-label">
        {phaseLabel} {index + 1} / {total}
      </div>
      <div className="quiz-question">{item.question}</div>

      {item.item_type === 'mcq' && item.options ? (
        <div className="quiz-options">
          {item.options.map((opt, i) => {
            const selected = value === opt;
            return (
              <div
                key={i}
                className={`quiz-option ${selected ? 'selected' : ''}`}
                onClick={() => onChange(opt)}
              >
                <div className="quiz-radio" />
                <span>{opt}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <textarea
          className="quiz-textarea"
          placeholder="답변을 작성하세요..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
