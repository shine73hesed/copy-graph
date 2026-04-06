'use client';

interface Props {
  preScore: number | null;
  postScore: number | null;
  totalTurns?: number;
  date?: string;
}

export default function SummaryClover({ preScore, postScore, totalTurns = 0, date }: Props) {
  const pre = Math.round((preScore ?? 0) * 100);
  const post = Math.round((postScore ?? 0) * 100);
  const gain = post - pre;
  const dateStr = date || new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', year: 'numeric' });

  return (
    <div className="report-summary-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{dateStr}</div>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text3)' }}>info</span>
      </div>

      <div className="report-metrics">
        {/* 사전 */}
        <div className="report-metric">
          <div className="report-metric-label" style={{ color: '#f59e0b' }}>
            <span style={{ display: 'inline-block', width: 3, height: 12, background: '#f59e0b', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
            사전
          </div>
          <div className="report-metric-value" style={{ color: '#92400e' }}>{pre}</div>
          <div className="report-metric-sub">/100</div>
        </div>

        {/* 장식 아이콘 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fed7aa', opacity: 0.8 }} />
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fca5a5', opacity: 0.6, marginTop: -8 }} />
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#93c5fd', opacity: 0.5, marginTop: 4 }} />
        </div>

        {/* 사후 */}
        <div className="report-metric">
          <div className="report-metric-label" style={{ color: '#ef4444' }}>
            <span style={{ display: 'inline-block', width: 3, height: 12, background: '#ef4444', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
            사후
          </div>
          <div className="report-metric-value" style={{ color: '#991b1b' }}>{post}</div>
          <div className="report-metric-sub">/100</div>
        </div>
      </div>

      {/* 성장 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div className="report-metric" style={{ textAlign: 'left' }}>
          <div className="report-metric-label" style={{ color: 'var(--teal)' }}>
            <span style={{ display: 'inline-block', width: 3, height: 12, background: 'var(--teal)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />
            성장
          </div>
          <div className="report-metric-value" style={{ color: gain >= 0 ? 'var(--teal)' : 'var(--rose)' }}>
            {gain >= 0 ? '+' : ''}{gain}
          </div>
          <div className="report-metric-sub">point</div>
        </div>
      </div>

      {/* 턴수 프로그레스 */}
      {totalTurns > 0 && (
        <div style={{
          marginTop: 16,
          padding: '10px 16px',
          background: 'var(--primary-light)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'var(--primary)',
          fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>forum</span>
          학습 턴수 <strong>{totalTurns}</strong>
        </div>
      )}
    </div>
  );
}
