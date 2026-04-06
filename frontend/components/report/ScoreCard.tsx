'use client';

interface Props {
  preScore: number | null;
  postScore: number | null;
}

export default function ScoreCard({ preScore, postScore }: Props) {
  const pre = preScore ?? 0;
  const post = postScore ?? 0;
  const gain = post - pre;

  return (
    <div className="report-section">
      <h3>평가 결과</h3>
      <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 4 }}>사전</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{(pre * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 4 }}>사후</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{(post * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="score-bar">
        <div className="score-bar-fill pre" style={{ width: `${pre * 100}%` }} />
      </div>
      <div className="score-bar">
        <div className="score-bar-fill post" style={{ width: `${post * 100}%` }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <span className={`gain-badge ${gain >= 0 ? 'positive' : 'negative'}`}>
          {gain >= 0 ? '▲' : '▼'} 성장폭: {gain >= 0 ? '+' : ''}{(gain * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
