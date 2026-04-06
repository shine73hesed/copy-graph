'use client';

import { useState, useEffect, useRef } from 'react';
import type { TestItem } from '@/lib/types';

interface Props {
  item: TestItem;
  index: number;
  total: number;
  phaseLabel: string;
  value: string;
  onChange: (value: string) => void;
}

export default function TestCard({ item, index, total, phaseLabel, value, onChange }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [item.item_id]);

  return (
    <div className="test-card">
      <h4>{phaseLabel} ({index + 1}/{total})</h4>
      <div className="question">{item.question}</div>

      {item.item_type === 'mcq' && item.options ? (
        <div>
          {item.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i);
            const selected = value === opt;
            return (
              <div
                key={i}
                className={`mcq-option ${selected ? 'selected' : ''}`}
                onClick={() => onChange(opt)}
              >
                <div className="mcq-radio" />
                <span>{label}) {opt}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <textarea
          className="short-answer-input"
          placeholder="답변을 작성하세요..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}

      <div style={{ marginTop: 16, fontSize: 13, color: 'var(--ink3)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>timer</span>
        응답 시간: {elapsed}초
      </div>
    </div>
  );
}
