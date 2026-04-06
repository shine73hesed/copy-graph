// frontend/components/session/Reading.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import TOCPanel from '@/components/reading/TOCPanel';
import ArticleView from '@/components/reading/ArticleView';
import ReportModal from '@/components/common/ReportModal';
import { useSessionContext } from './SessionProvider';
import { api } from '@/lib/api';
import type { WikiListItem } from '@/lib/types';

interface Chapter {
  id: string;
  title: string;
  order: number;
  filename: string;
}

interface Props {
  onBack?: () => void;
}

export default function Reading({ onBack }: Props) {
  const { state, completeReading, setPhase, setPostTestItems } = useSessionContext();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [readPct, setReadPct] = useState(0);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [loadingContent, setLoadingContent] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [useChapterMode, setUseChapterMode] = useState(false);

  // 기존 docs (챕터 없을 때 폴백)
  const [docs, setDocs] = useState<WikiListItem[]>([]);

  const isCompleted = state.phase === 'completed' || (state.preScore != null && state.postScore != null);

  // 챕터 목록 로드 (read 폴더) → 없으면 기존 방식 폴백
  useEffect(() => {
    if (!state.nodeId) return;

    api.readingChapters(state.nodeId).then(res => {
      if (res.chapters && res.chapters.length > 0) {
        setChapters(res.chapters);
        setUseChapterMode(true);
        // 첫 번째 챕터 자동 선택
        const first = res.chapters[0];
        setCurrentChapterId(first.id);
        loadChapter(state.nodeId, first.id);
      } else {
        // read 폴더에 챕터 없음 → 기존 방식
        setUseChapterMode(false);
        loadLegacyContent();
      }
    }).catch(() => {
      setUseChapterMode(false);
      loadLegacyContent();
    });
  }, [state.nodeId]);

  // 기존 방식: wiki-list + readingContent
  const loadLegacyContent = useCallback(() => {
    api.wikiList().then(list => setDocs(Array.isArray(list) ? list : [])).catch(() => setDocs([]));
    if (state.nodeId) {
      api.readingContent(state.nodeId).then(res => {
        setMarkdown(res.markdown);
        setLoadingContent(false);
      }).catch(() => setLoadingContent(false));
    }
  }, [state.nodeId]);

  // 챕터 내용 로드
  const loadChapter = useCallback(async (nodeId: string, chapterId: string) => {
    setLoadingContent(true);
    try {
      const res = await api.readingChapter(nodeId, chapterId);
      setMarkdown(res.markdown);
      setReadSet(prev => {
        const next = new Set(prev); next.add(chapterId);
        return next;
      });
    } catch {
      setMarkdown('');
    }
    setLoadingContent(false);
  }, []);

  // 챕터 선택
  const handleSelectChapter = useCallback((chapterId: string) => {
    setCurrentChapterId(chapterId);
    if (state.nodeId) loadChapter(state.nodeId, chapterId);
  }, [state.nodeId, loadChapter]);

  // 기존 문서 선택 (폴백)
  const handleSelectDoc = useCallback(async (docId: string) => {
    try {
      const data = await api.wiki(docId);
      setMarkdown(data.content);
      setReadSet(prev => {
        const next = new Set(prev); next.add(docId);
        return next;
      });
    } catch { setMarkdown(''); }
  }, []);

  // 읽기 완료 → 사후평가
  const handleReadingComplete = useCallback(async () => {
    try {
      const res = await completeReading();
      if ((res as any)?.allowed) {
        if (state.nodeId) {
          try {
            const items = await api.loadPostTestItems(state.nodeId);
            setPostTestItems(items);
          } catch { /* */ }
        }
        setPhase('post_test');
      }
    } catch (e) {
      console.error('[READING] complete failed:', e);
    }
  }, [completeReading, state.nodeId, setPhase, setPostTestItems]);

  // 챕터 목록 → WikiListItem 형태로 변환 (TOCPanel 호환)
  const chapterDocs: WikiListItem[] = chapters.map(ch => ({
    id: ch.id,
    label: ch.title,
    category: state.nodeId || '읽기',
  }));

  // 현재 챕터 인덱스
  const currentIdx = chapters.findIndex(c => c.id === currentChapterId);
  const totalChapters = chapters.length;

  const handlePrev = () => {
    if (currentIdx > 0) handleSelectChapter(chapters[currentIdx - 1].id);
  };
  const handleNext = () => {
    if (currentIdx < totalChapters - 1) handleSelectChapter(chapters[currentIdx + 1].id);
  };

  // 현재 제목
  const currentTitle = useChapterMode
    ? (chapters.find(c => c.id === currentChapterId)?.title || state.nodeId)
    : state.nodeId;

  // 다른 강좌 목록 (헤더 드롭다운용)
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    api.readingSubjects().then(r => setAllSubjects(r.subjects || [])).catch(() => {});
  }, []);

  const handleSwitchSubject = useCallback((subjectId: string) => {
    // 해당 과목의 대시보드 디테일뷰로 이동
    sessionStorage.setItem('ale_show_detail', '1');
    sessionStorage.setItem('ale_view', 'detail');
    sessionStorage.setItem('ale_focus_node', subjectId);
    sessionStorage.setItem('ale_focus_label', subjectId.replace(/_/g, ' '));
    window.location.href = '/dashboard';
  }, []);

  // 노트
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // 노트 로드 (세션별)
  useEffect(() => {
    if (!state.sessionId) return;
    api.sessionNote(state.sessionId).then(r => {
      if (r.memo) setNoteText(r.memo);
    }).catch(() => {});
  }, [state.sessionId]);

  const handleSaveNote = async () => {
    if (!state.sessionId) return;
    setNoteSaving(true);
    try {
      await api.saveSessionNote(state.sessionId, noteText);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch { /* */ }
    setNoteSaving(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* TOC */}
        <TOCPanel
          docs={useChapterMode ? chapterDocs : docs}
          currentId={useChapterMode ? (currentChapterId || '') : state.nodeId}
          readSet={readSet}
          onSelect={useChapterMode ? handleSelectChapter : handleSelectDoc}
          onBack={onBack}
          onComplete={handleReadingComplete}
          isCompleted={isCompleted}
          loading={loadingContent}
        />

        {/* Article */}
        <ArticleView
          title={currentTitle}
          markdown={loadingContent ? '' : markdown}
          index={useChapterMode ? currentIdx : 0}
          total={useChapterMode ? totalChapters : 1}
          minSec={0}
          elapsed={0}
          onPrev={handlePrev}
          onNext={handleNext}
          onComplete={handleReadingComplete}
          canComplete={!isCompleted}
          loading={loadingContent}
          onScroll={(pct) => setReadPct(pct)}
          onBack={onBack}
          showReport={isCompleted}
          onReport={() => setReportOpen(true)}
          subjects={allSubjects}
          currentSubjectId={state.nodeId}
          onSelectSubject={handleSwitchSubject}
          onNote={() => setNoteOpen(!noteOpen)}
        />

        {/* 노트 사이드 패널 */}
        {noteOpen && (
          <aside style={{
            width: 340, flexShrink: 0, borderLeft: '1px solid var(--border)',
            background: 'var(--white, #fff)', display: 'flex', flexDirection: 'column',
            animation: 'slideDown 0.2s ease-out',
          }}>
            {/* 노트 헤더 */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--blue, #4f6af6)' }}>edit_note</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>학습 노트</span>
              </div>
              <button onClick={() => setNoteOpen(false)} style={{
                width: 28, height: 28, border: 'none', background: 'var(--bg)',
                borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>

            {/* 노트 텍스트 */}
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="학습하면서 메모를 작성하세요..."
                style={{
                  flex: 1, width: '100%', padding: 16, border: '1.5px solid var(--border)',
                  borderRadius: 12, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8,
                  resize: 'none', outline: 'none', color: 'var(--text)',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue, #4f6af6)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 저장 버튼 */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button onClick={handleSaveNote} disabled={noteSaving} style={{
                flex: 1, padding: '10px 0', background: 'var(--blue, #4f6af6)', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: noteSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: noteSaving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                {noteSaving ? '저장 중...' : noteSaved ? '저장 완료 ✓' : '저장'}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 보고서 모달 */}
      {reportOpen && state.sessionId && (
        <ReportModal
          sessionId={state.sessionId}
          preScore={state.preScore}
          postScore={state.postScore}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}