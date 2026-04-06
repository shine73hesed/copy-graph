// frontend/components/chat/DebugPanel.tsx
'use client';

import type { AnswerResponse, Gate } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  lastAnswer: AnswerResponse | null;
  scoreHistory: number[];
  gate: Gate | null;
  checklist: Record<string, string>;
  checklistItems: Array<{ id: string; label: string }>;
  turn: number;
}

export default function DebugPanel({
  open, onClose, lastAnswer, scoreHistory, gate, checklist, checklistItems, turn,
}: Props) {
  if (!open) return null;

  const a = lastAnswer;
  const struggleBadge = (s: string) => {
    if (s === 'upper_struggle') return { cls: 'up', label: '상위 어려움' };
    if (s === 'productive') return { cls: 'pr', label: '생산적' };
    if (s === 'breakthrough') return { cls: 'bt', label: '돌파구' };
    if (s === 'consolidating') return { cls: 'co', label: '강화 중' };
    return { cls: 'te', label: s || '대기' };
  };
  const sb = struggleBadge(a?.struggle || '');

  // Usage parsing
  const usage = a?.usage as Record<string, unknown> | undefined;
  const cost = usage?.total_cost ?? usage?.cost ?? '—';
  const tokens = usage?.total_tokens ?? usage?.input_tokens ? `${usage?.input_tokens ?? 0}+${usage?.output_tokens ?? 0}` : '—';

  return (
    <div style={{
      position: 'fixed', top: 56, right: 0, width: 340,
      height: 'calc(100vh - 56px)', background: 'var(--paper, #fbfaf8)',
      borderLeft: '1px solid var(--cream, var(--border))',
      zIndex: 100, overflowY: 'auto', padding: 16, fontSize: 12,
      animation: 'slideDown 0.15s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink3, var(--text3))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Debug Panel
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3, var(--text3))', fontSize: 16 }}>
          ✕
        </button>
      </div>

      {/* Analyst */}
      <Section title="Analyst">
        <Row k="score" v={a?.score?.toFixed(4) ?? '—'} />
        <Row k="brief" v={a?.brief ?? '—'} />
        <Row k="moving_avg" v={a?.moving_avg?.toFixed(4) ?? '—'} />
        <Row k="trend" v={a?.trend?.toFixed(4) ?? '—'} />
        <Row k="turn" v={String(turn)} />
        <Row k="struggle" v={a?.struggle ?? '—'} />
      </Section>

      {/* Checklist */}
      <Section title="Checklist">
        {checklistItems.length === 0 ? (
          <span style={{ color: 'var(--ink3, var(--text3))' }}>—</span>
        ) : (
          checklistItems.map(item => {
            const st = checklist[item.id];
            const done = st === 'confirmed';
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: done ? '#14b8a6' : 'var(--cream, var(--border))',
                }} />
                <span style={{ color: done ? 'var(--ink, var(--text))' : 'var(--ink3, var(--text3))' }}>
                  {item.label}
                </span>
              </div>
            );
          })
        )}
      </Section>

      {/* Score History */}
      <Section title="Score History">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, marginTop: 6 }}>
          {scoreHistory.map((s, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 6, borderRadius: 2,
              height: `${Math.max(4, s * 40)}px`,
              background: s >= 0.7 ? '#14b8a6' : s >= 0.4 ? '#f59e0b' : '#ef4444',
              transition: 'height 0.3s',
            }} />
          ))}
          {scoreHistory.length === 0 && <span style={{ fontSize: 10, color: 'var(--ink3, var(--text3))' }}>—</span>}
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink3, var(--text3))', lineHeight: 1.5 }}>
          {scoreHistory.map((s, i) => `T${i + 1}:${(s * 100).toFixed(0)}%`).join(' · ')}
        </div>
      </Section>

      {/* Struggle */}
      <Section title="Struggle">
        <Row k="상태" vNode={
          <span className={`str-badge ${sb.cls}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            background: sb.cls === 'up' ? '#fff1f2' : sb.cls === 'pr' ? '#eef1fe' : sb.cls === 'bt' ? '#ecfdf5' : sb.cls === 'co' ? '#f3efff' : 'var(--paper2, var(--bg))',
            color: sb.cls === 'up' ? '#f43f5e' : sb.cls === 'pr' ? '#4f6af6' : sb.cls === 'bt' ? '#14b8a6' : sb.cls === 'co' ? '#7c5cfc' : 'var(--ink3, var(--text3))',
          }}>
            {sb.label}
          </span>
        } />
        <Row k="moving_avg" v={a?.moving_avg?.toFixed(4) ?? '—'} />
        <Row k="trend" v={a?.trend?.toFixed(4) ?? '—'} />
      </Section>

      {/* Gate */}
      <Section title="Gate">
        <Row k="gate_a" v={gate?.gate_a ? '✓' : '✗'} />
        <Row k="gate_b" v={gate?.gate_b ? '✓' : '✗'} />
        <Row k="completed" v={gate?.completed ? '✓' : '✗'} />
      </Section>

      {/* BKT */}
      <Section title="BKT">
        <Row k="mastery" v={a?.bkt_mastery?.toFixed(4) ?? '—'} />
      </Section>

      {/* Usage */}
      <Section title="Usage">
        <Row k="cost" v={String(cost)} />
        <Row k="tokens" v={String(tokens)} />
      </Section>

      {/* Raw JSON */}
      <Section title="Raw JSON">
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.6,
          color: 'var(--ink3, var(--text3))', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 200, overflowY: 'auto', padding: 8,
          background: 'var(--paper, var(--bg))',
          border: '1px solid var(--cream, var(--border))', borderRadius: 8,
        }}>
          {a ? JSON.stringify(a, null, 2) : '{}'}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 16, padding: 12,
      border: '1px solid var(--cream, var(--border))',
      background: 'var(--paper, var(--bg))', borderRadius: 10,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--ink3, var(--text3))', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, vNode }: { k: string; v?: string; vNode?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
      <span style={{ color: 'var(--ink3, var(--text3))' }}>{k}:</span>
      {vNode || <span style={{ fontWeight: 700, color: 'var(--ink, var(--text))', fontFamily: 'var(--mono)' }}>{v}</span>}
    </div>
  );
}
