'use client';

import { BLOOM_LEVELS, BLOOM_LABELS, type BloomLevel } from '@/lib/constants';

interface BloomScore {
  level: string;
  pre: number;
  post: number;
}

interface Props {
  scores: BloomScore[];
}

export default function BloomChart({ scores }: Props) {
  const scoreMap = new Map(scores.map(s => [s.level, s]));

  return (
    <div className="report-section">
      <h3>Bloom 수준별 분석</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {BLOOM_LEVELS.map(level => {
          const s = scoreMap.get(level);
          if (!s) return null;
          const label = BLOOM_LABELS[level as BloomLevel] || level;
          return (
            <div key={level}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                <span style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
                  {s.pre.toFixed(1)} → {s.post.toFixed(1)}
                </span>
              </div>
              <div className="score-bar" style={{ position: 'relative' }}>
                <div className="score-bar-fill pre" style={{ width: `${s.pre * 100}%`, position: 'absolute' }} />
                <div className="score-bar-fill post" style={{ width: `${s.post * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
