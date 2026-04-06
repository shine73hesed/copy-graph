// frontend/components/common/WikiModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import MarkdownViewer from '@/components/reading/MarkdownViewer';

interface Props {
  nodeId: string;
  onClose: () => void;
  onNavigate?: (nodeId: string) => void;
}

export default function WikiModal({ nodeId, onClose, onNavigate }: Props) {
  const [content, setContent] = useState('');
  const [label, setLabel] = useState('');
  const [related, setRelated] = useState<Array<{ id: string; label: string; relation?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentNode, setCurrentNode] = useState(nodeId);

  useEffect(() => {
    setLoading(true);
    api.wiki(currentNode).then(res => {
      setContent(res.content);
      setLabel(res.label);
      setRelated(res.related ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentNode]);

  const handleNavigate = (id: string) => {
    setCurrentNode(id);
    if (onNavigate) onNavigate(id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease-out',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: 720, maxHeight: '85vh',
        background: 'var(--white, #fff)', borderRadius: 20,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 22 }}>menu_book</span>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{loading ? '로딩 중...' : label}</span>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, border: 'none',
            background: 'var(--bg)', borderRadius: 8,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* 본문 — MarkdownViewer로 SVG/Mermaid 포함 렌더링 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>교재를 불러오는 중...</div>
          ) : content ? (
            <MarkdownViewer markdown={content} className="reading-prose" />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>교재를 찾을 수 없습니다.</div>
          )}
        </div>

        {/* 관련 문서 */}
        {related.length > 0 && (
          <div style={{
            padding: '14px 24px', borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>관련 개념</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {related.map(r => (
                <span
                  key={r.id}
                  onClick={() => handleNavigate(r.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 10,
                    fontSize: 11, fontWeight: 600,
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
                >
                  {r.label || r.id}{r.relation ? ` · ${r.relation}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}