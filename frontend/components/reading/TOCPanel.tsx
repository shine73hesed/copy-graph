'use client';

import { useState } from 'react';
import type { WikiListItem } from '@/lib/types';

interface Props {
  docs: WikiListItem[];
  currentId: string;
  readSet: Set<string>;
  onSelect: (id: string) => void;
  onBack?: () => void;
  onComplete?: () => void;
  isCompleted?: boolean;
  loading?: boolean;
}

// Domain groups
const DOMAINS = [
  { id: 'overview', label: '질환 개론', icon: 'psychology', color: '#ec5b13', bg: '#fff4ed' },
  { id: 'symptoms', label: '증상·평가', icon: 'warning', color: '#F59E0B', bg: '#FFF8E1' },
  { id: 'medications', label: '약물 치료', icon: 'medication', color: '#14B8A6', bg: '#ECFDF5' },
  { id: 'nursing', label: '간호 중재', icon: 'health_and_safety', color: '#4F6AF6', bg: '#EEF1FE' },
  { id: 'other', label: '기타', icon: 'category', color: '#94a3b8', bg: '#f0f0f5' },
];

function categorizeTocDoc(doc: WikiListItem): string {
  if (doc.category) {
    const cat = doc.category;
    if (['질환개요', '병태생리'].includes(cat)) return 'overview';
    if (['정신병증상', '행동증상', '정서증상', '기타증상', '진단평가'].includes(cat)) return 'symptoms';
    if (['약물치료'].includes(cat)) return 'medications';
    if (['비약물치료', '간호실무'].includes(cat)) return 'nursing';
  }
  return 'other';
}

export default function TOCPanel({ docs, currentId, readSet, onSelect, onBack, onComplete, isCompleted, loading }: Props) {
  const [search, setSearch] = useState('');
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});

  const filtered = search
    ? docs.filter(d => d.label.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()))
    : docs;

  // Group by domain
  const groups: Record<string, WikiListItem[]> = {};
  DOMAINS.forEach(d => groups[d.id] = []);
  filtered.forEach(d => {
    const did = categorizeTocDoc(d);
    if (groups[did]) groups[did].push(d);
    else groups['other'].push(d);
  });

  let globalNum = 0;

  return (
    <aside style={{
      width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
      background: 'var(--white)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header + Search */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary)' }}>auto_stories</span>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>교재 목차</h2>
        </div>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', fontSize: 18,
          }}>search</span>
          <input
            type="text"
            placeholder="교재 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              border: '1.5px solid var(--border)', borderRadius: 14,
              fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* TOC list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {DOMAINS.map(domain => {
          const list = groups[domain.id];
          if (!list || !list.length) return null;
          const isOpen = folderOpen[domain.id] !== false;

          return (
            <div key={domain.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => setFolderOpen(prev => ({ ...prev, [domain.id]: !isOpen }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                  borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: domain.color }}>{domain.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, flex: 1, color: 'var(--text)' }}>{domain.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: domain.color, background: domain.bg, padding: '2px 8px', borderRadius: 6 }}>
                  {list.length}
                </span>
                <span className="material-symbols-outlined" style={{
                  fontSize: 16, color: 'var(--text3)', transition: 'transform 0.2s',
                  transform: isOpen ? '' : 'rotate(-90deg)',
                }}>expand_more</span>
              </div>

              <div style={{
                overflow: 'hidden',
                maxHeight: isOpen ? list.length * 44 : 0,
                transition: 'max-height 0.25s ease',
                paddingLeft: 6,
              }}>
                {list.map(doc => {
                  globalNum++;
                  const isActive = doc.id === currentId;
                  const isRead = readSet.has(doc.id);

                  return (
                    <div
                      key={doc.id}
                      className={`toc-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelect(doc.id)}
                      style={{ borderLeft: `2px solid ${isActive ? domain.color : 'transparent'}`, marginLeft: 8 }}
                    >
                      <div className="num" style={
                        isActive ? { background: domain.color, color: 'white' }
                        : isRead ? { background: domain.bg, color: domain.color }
                        : {}
                      }>
                        {isRead && !isActive ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: domain.color }}>check</span>
                        ) : globalNum}
                      </div>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — 나가기 + 학습완료 */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>{docs.length}개 교재</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>{readSet.size}개 읽음</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onBack && (
            <button onClick={onBack} style={{
              flex: 1, padding: '10px 0', border: '1px solid var(--border)', background: 'var(--bg)',
              borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'var(--text3)',
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              나가기
            </button>
          )}
          {onComplete && (
            isCompleted ? (
              <button disabled style={{
                flex: 1.5, padding: '10px 0', border: 'none', background: '#e5e5e5',
                borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#999',
                cursor: 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                학습 완료
              </button>
            ) : (
              <button onClick={onComplete} disabled={loading} style={{
                flex: 1.5, padding: '10px 0', border: 'none',
                background: 'var(--primary)', color: 'white',
                borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
              }}>
                학습 완료 → 사후 평가
              </button>
            )
          )}
        </div>
      </div>
    </aside>
  );
}