// frontend/components/reading/ArticleView.tsx
'use client';

import { useRef, useState } from 'react';
import MarkdownViewer from '@/components/reading/MarkdownViewer';

interface SubjectItem {
  id: string;
  label: string;
}

interface Props {
  title: string;
  markdown: string;
  index: number;
  total: number;
  minSec: number;
  elapsed: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  canComplete: boolean;
  loading: boolean;
  onScroll: (pct: number) => void;
  onBack?: () => void;
  showReport?: boolean;
  onReport?: () => void;
  subjects?: SubjectItem[];
  currentSubjectId?: string;
  onSelectSubject?: (id: string) => void;
  onNote?: () => void;
}

export default function ArticleView({
  title, markdown, index, total,
  onPrev, onNext, onComplete, canComplete, loading, onScroll,
  onBack, showReport, onReport,
  subjects, currentSubjectId, onSelectSubject, onNote,
}: Props) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(15.5);
  const [showSubjects, setShowSubjects] = useState(false);

  const handleScroll = () => {
    const el = articleRef.current;
    if (!el) return;
    const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100;
    onScroll(Math.min(100, pct || 0));
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top header */}
      <header style={{
        height: 60, flexShrink: 0, background: 'var(--white)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text3)', position: 'relative' }}>
          <span
            onClick={() => subjects && subjects.length > 0 && setShowSubjects(!showSubjects)}
            style={{ fontWeight: 600, cursor: subjects?.length ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.15s' }}
            onMouseEnter={e => { if (subjects?.length) e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
          >
            교재
            {subjects && subjects.length > 0 && (
              <span className="material-symbols-outlined" style={{ fontSize: 16, transform: showSubjects ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>expand_more</span>
            )}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</span>

          {/* 강좌 드롭다운 */}
          {showSubjects && subjects && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setShowSubjects(false)} />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 8,
                background: 'var(--white, #fff)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                padding: 6, minWidth: 220, maxHeight: 320, overflowY: 'auto', zIndex: 200,
                animation: 'slideDown 0.15s ease-out',
              }}>
                <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>강좌 목록</div>
                {subjects.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setShowSubjects(false); onSelectSubject?.(s.id); }}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 13, fontWeight: s.id === currentSubjectId ? 700 : 500,
                      color: s.id === currentSubjectId ? 'var(--primary)' : 'var(--text)',
                      background: s.id === currentSubjectId ? 'var(--primary-light, #fff4ed)' : 'transparent',
                      transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => { if (s.id !== currentSubjectId) e.currentTarget.style.background = 'rgba(0,0,0,0.025)'; }}
                    onMouseLeave={e => { if (s.id !== currentSubjectId) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: s.id === currentSubjectId ? 'var(--primary)' : 'var(--text3)' }}>
                      {s.id === currentSubjectId ? 'menu_book' : 'article'}
                    </span>
                    {s.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onPrev} disabled={index <= 0} style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)',
            cursor: index > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', opacity: index <= 0 ? 0.4 : 1,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{index + 1}/{total}</span>
          <button onClick={onNext} disabled={index >= total - 1} style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)',
            cursor: index < total - 1 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', opacity: index >= total - 1 ? 0.4 : 1,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          <button onClick={() => setFontSize(f => Math.max(12, f - 1))} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--text2)',
          }}>A-</button>
          <button onClick={() => setFontSize(f => Math.min(22, f + 1))} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontSize: 15, fontWeight: 800, color: 'var(--text2)',
          }}>A+</button>

          {/* #8: 완료 시 보고서 버튼 (A+ 옆) */}
          {showReport && onReport && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
              <button onClick={onReport} title="보고서" style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: 'var(--teal-bg)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--teal)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>assessment</span>
              </button>
            </>
          )}

          {/* 노트 */}
          {onNote && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
              <button onClick={onNote} title="노트" style={{
                width: 36, height: 36, borderRadius: 10, border: 'none',
                background: 'var(--blue-bg, #eef1fe)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--blue, #4f6af6)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit_note</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Article body */}
      <article ref={articleRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 80px' }}>
        {markdown ? (
          <div style={{ maxWidth: 720, margin: '0 auto', fontSize: `${fontSize}px` }}>
            <MarkdownViewer markdown={markdown} className="reading-prose" style={{ fontSize: `${fontSize}px` }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--primary)' }}>menu_book</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>교재를 선택하세요</h3>
            <p style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 300, lineHeight: 1.6 }}>왼쪽 목차에서 읽고 싶은 교재를 선택하면 여기에 내용이 표시됩니다.</p>
          </div>
        )}
      </article>
    </div>
  );
}