'use client';

import SummaryClover from '@/components/report/SummaryClover';
import MetricCard from '@/components/report/MetricCard';
import StrengthsList from '@/components/report/StrengthsList';
import BloomBadge from '@/components/report/BloomBadge';
import { useSessionContext } from './SessionProvider';
import { useRouter } from 'next/navigation';
import { BLOOM_LABELS, type BloomLevel } from '@/lib/constants';

export default function Report() {
  const { state } = useSessionContext();
  const router = useRouter();
  const report = state.report;
  const postScores = state.postScores ?? [];

  const gain = state.gain ?? (state.postScore != null && state.preScore != null ? state.postScore - state.preScore : null);
  const overallPct = state.postScore != null ? Math.round(state.postScore * 100) : null;

  // Bloom 최고 수준
  const topBloom = postScores.length > 0
    ? postScores.reduce((best, s) => {
        const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
        return levels.indexOf(s.bloom) > levels.indexOf(best) ? s.bloom : best;
      }, 'remember')
    : 'remember';

  return (
    <div className="report-page">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>학습 보고서</h2>

      {/* 상단 요약 */}
      <SummaryClover
        preScore={state.preScore}
        postScore={state.postScore}
        totalTurns={state.turn}
      />

      {/* AI 종합 평가 */}
      {report && (
        <MetricCard
          icon="psychology"
          iconBg="#fce4ec"
          iconColor="#e91e63"
          title="AI 종합 평가"
          value={overallPct ?? undefined}
          unit="점"
        >
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
            {report.summary}
          </p>
        </MetricCard>
      )}

      {/* 성장폭 분석 */}
      {report?.gain_interpretation && (
        <MetricCard
          icon="trending_up"
          iconBg={gain != null && gain > 0 ? 'var(--teal-bg)' : '#fff3e0'}
          iconColor={gain != null && gain > 0 ? 'var(--teal)' : '#f57f17'}
          title="성장 분석"
          value={gain != null ? `${gain >= 0 ? '+' : ''}${Math.round(gain * 100)}` : undefined}
          unit="%p"
        >
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginTop: 8 }}>
            {report.gain_interpretation}
          </p>
        </MetricCard>
      )}

      {/* 잘한 점 */}
      {report?.strengths && report.strengths.length > 0 && (
        <MetricCard
          icon="thumb_up"
          iconBg="#e8f5e9"
          iconColor="#2e7d32"
          title="잘한 점"
          cardBg="#fafff9"
        >
          <StrengthsList items={report.strengths} />
        </MetricCard>
      )}

      {/* 보완할 점 */}
      {report?.weaknesses && report.weaknesses.length > 0 && (
        <MetricCard
          icon="lightbulb"
          iconBg="#fff3e0"
          iconColor="#e65100"
          title="보완할 점"
          cardBg="#fffcf5"
        >
          <StrengthsList items={report.weaknesses} />
        </MetricCard>
      )}

      {/* Bloom 수준 */}
      <MetricCard
        icon="school"
        iconBg="#f3e5f5"
        iconColor="#7b1fa2"
        title="인지 수준 (Bloom)"
      >
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BloomBadge level={topBloom} />
          {report?.bloom_analysis && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{report.bloom_analysis}</span>
          )}
        </div>
      </MetricCard>

      {/* 문항별 결과 */}
      {postScores.length > 0 && (
        <MetricCard
          icon="quiz"
          iconBg="var(--blue-bg)"
          iconColor="var(--blue)"
          title="문항별 결과"
        >
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {postScores.map((s, i) => {
              const pct = Math.round(s.auto_score * 100);
              const color = pct >= 80 ? '#2e7d32' : pct >= 50 ? '#f57f17' : '#ef4444';
              const bloomLabel = BLOOM_LABELS[s.bloom as BloomLevel] || s.bloom;
              return (
                <div key={s.item_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 10,
                }}>
                  <div style={{
                    minWidth: 24, height: 24, borderRadius: '50%',
                    background: color, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--white)', padding: '1px 6px', borderRadius: 4 }}>
                    {bloomLabel}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </MetricCard>
      )}

      {/* 학습 권고사항 */}
      {report?.recommendations && report.recommendations.length > 0 && (
        <MetricCard
          icon="auto_fix_high"
          iconBg="#e3f2fd"
          iconColor="#1565c0"
          title="학습 권고사항"
        >
          <ol style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }}>
            {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </MetricCard>
      )}

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <button className="btn-primary" onClick={() => router.push('/dashboard')}>
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
