// frontend/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import NavSidebar from '@/components/dashboard/NavSidebar';
import CourseCard from '@/components/dashboard/CourseCard';
import RightSidebar from '@/components/dashboard/RightSidebar';
import CourseDetail from '@/components/dashboard/CourseDetail';
import ConversationSidebar from '@/components/dashboard/ConversationSidebar';
import type { KGResponse, SessionListItem, SessionMode } from '@/lib/types';

type View = 'main' | 'course';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [kg, setKg] = useState<KGResponse | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('main');
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string } | null>(null);
  const [costStr, setCostStr] = useState('$0');

  useEffect(() => {
    Promise.all([
      api.me().catch(() => null),
      api.kg().catch(() => null),
      api.sessions().catch(() => []),
      api.cost().catch(() => ({ total_cost: 0 })),
      api.readingSubjects().catch(() => ({ subjects: [] })),
    ]).then(([me, kgData, sessData, costData, subjectsData]) => {
      if (!me) { router.push('/login'); return; }
      setUser(me.user_id);

      // v8.2: read 폴더 기반 과목을 KG 노드 형태로 변환
      const subs = (subjectsData as { subjects: Array<{ id: string; label: string; chapter_count: number }> }).subjects || [];
      if (subs.length > 0) {
        // read 폴더에 과목이 있으면 그걸 사용
        const fakeKg = {
          nodes: subs.map(s => ({
            id: s.id,
            label: s.label,
            category: '교재',
            depth: 0,
          })),
          description: '치매 케어 간호 교육 — 읽기 교재 기반',
        };
        setKg(fakeKg as any);
      } else if (kgData) {
        // read 폴더가 비어있으면 기존 KG 사용
        setKg(kgData);
      }

      setSessions(sessData as SessionListItem[]);
      const c = costData as { total_cost: number };
      setCostStr(`$${(c.total_cost || 0).toFixed(2)}`);
      setLoading(false);

      const savedView = sessionStorage.getItem('ale_view');
      const savedNode = sessionStorage.getItem('ale_focus_node');
      const savedLabel = sessionStorage.getItem('ale_focus_label');
      if (savedView === 'detail' || sessionStorage.getItem('ale_show_detail')) {
        setView('course');
        const currentNodes = subs.length > 0
          ? subs.map(s => ({ id: s.id, label: s.label }))
          : (kgData?.nodes || []);
        if (savedNode) {
          const found = currentNodes.find((n: { id: string; label?: string }) => n.id === savedNode);
          setSelectedNode({ id: savedNode, label: savedLabel || found?.label || savedNode });
        }
        sessionStorage.removeItem('ale_show_detail');
      }
    });
  }, [router]);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    router.push('/login');
  };

  const nodes = kg?.nodes || [];
  // sessions 기반 완료 노드 카운트 (같은 노드의 완료 세션이 하나라도 있으면)
  const completedNodeIds = new Set(
    sessions.filter(s => s.completed || s.post_score != null).map(s => s.node_id)
  );
  const completedNodes = completedNodeIds.size;
  const totalTurns = nodes.reduce((sum, n) => sum + (n.progress?.turns || 0), 0);
  const lastSession = sessions.find(s => !s.completed) || sessions[0] || null;
  const nextNode = nodes.find(n => !completedNodeIds.has(n.id)) || null;

  const calcAvgTime = (): string => {
    const valid = sessions.filter(s => {
      if (!s.created_at || !s.updated_at) return false;
      const d = new Date(s.updated_at).getTime() / 1000 - new Date(s.created_at).getTime() / 1000;
      return d > 0 && d < 7200;
    });
    if (!valid.length) return '—';
    const avg = valid.reduce((sum, s) => sum + (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / 1000, 0) / valid.length;
    return avg < 60 ? `${Math.round(avg)}초` : `${Math.round(avg / 60)}분`;
  };

  // #6: 노드 선택 시 sessionStorage 저장
  const handleSelectNode = useCallback((nodeId: string, label: string) => {
    setSelectedNode({ id: nodeId, label });
    sessionStorage.setItem('ale_focus_node', nodeId);
    sessionStorage.setItem('ale_focus_label', label);
    sessionStorage.setItem('ale_view', 'detail');
  }, []);

  const handleStartSession = (nodeId: string, mode: SessionMode) => {
    router.push(`/session/new?node=${nodeId}&mode=${mode}`);
  };

  const handleResumeSession = (sid: string, nodeId: string, mode: string, phase?: string) => {
    // #3: phase 전달로 해당 구간부터 시작
    const url = `/session/${sid}?node=${nodeId}&mode=${mode}&restore=1${phase ? `&phase=${phase}` : ''}`;
    router.push(url);
  };

  const handleRestoreFromSidebar = (sid: string, nodeId: string) => {
    const s = sessions.find(ss => ss.id === sid);
    handleResumeSession(sid, nodeId, s?.mode || 'tutoring');
  };

  const handleDeleteSession = (sid: string) => {
    setSessions(prev => prev.filter(s => s.id !== sid));
  };

  const handleContinueLearning = () => {
    if (lastSession) handleResumeSession(lastSession.id, lastSession.node_id, lastSession.mode || 'tutoring');
  };

  const handleStartRecommended = () => {
    if (nextNode) {
      setView('course');
      sessionStorage.setItem('ale_view', 'detail');
      setTimeout(() => handleSelectNode(nextNode.id, nextNode.label || nextNode.id), 100);
    }
  };

  // #1: 디테일 뷰에서 뒤로가기 시 사이드바 복원
  const handleBackToMain = () => {
    setView('main');
    setSelectedNode(null);
    sessionStorage.removeItem('ale_view');
    sessionStorage.removeItem('ale_focus_node');
    sessionStorage.removeItem('ale_focus_label');
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
        {/* Nav 스켈레톤 */}
        <div style={{ width: 240, borderRight: '1px solid var(--border)', padding: 20, flexShrink: 0 }}>
          <div style={{ width: 120, height: 20, background: 'var(--border)', borderRadius: 6, marginBottom: 32, animation: 'breathe 1.5s ease-in-out infinite' }} />
          <div style={{ width: '80%', height: 14, background: 'var(--border)', borderRadius: 4, marginBottom: 16, animation: 'breathe 1.5s ease-in-out infinite 0.1s' }} />
          <div style={{ width: '60%', height: 14, background: 'var(--border)', borderRadius: 4, marginBottom: 16, animation: 'breathe 1.5s ease-in-out infinite 0.2s' }} />
        </div>
        {/* Main 스켈레톤 */}
        <div style={{ flex: 1, padding: '36px 48px' }}>
          <div style={{ width: 200, height: 28, background: 'var(--border)', borderRadius: 8, marginBottom: 8, animation: 'breathe 1.5s ease-in-out infinite' }} />
          <div style={{ width: 320, height: 14, background: 'var(--border)', borderRadius: 4, marginBottom: 32, animation: 'breathe 1.5s ease-in-out infinite 0.1s' }} />
          <div style={{ width: '100%', maxWidth: 480, height: 200, background: 'var(--border)', borderRadius: 24, marginBottom: 28, animation: 'breathe 1.5s ease-in-out infinite 0.2s' }} />
          <div style={{ width: 100, height: 18, background: 'var(--border)', borderRadius: 4, marginBottom: 16, animation: 'breathe 1.5s ease-in-out infinite 0.3s' }} />
          {[1,2,3,4].map(i => (
            <div key={i} style={{ width: '100%', height: 56, background: 'var(--border)', borderRadius: 16, marginBottom: 12, animation: `breathe 1.5s ease-in-out infinite ${0.3 + i * 0.1}s` }} />
          ))}
        </div>
        {/* Aside 스켈레톤 */}
        <div style={{ width: 360, borderLeft: '1px solid var(--border)', padding: 24, flexShrink: 0 }}>
          <div style={{ width: 80, height: 80, background: 'var(--border)', borderRadius: '50%', margin: '0 auto 20px', animation: 'breathe 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 70, background: 'var(--border)', borderRadius: 16, animation: `breathe 1.5s ease-in-out infinite ${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <NavSidebar userId={user} onLogout={handleLogout} />

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <section className="dash-main" style={{ flex: 1, padding: '36px 48px', overflowY: 'auto' }}>
          {view === 'main' ? (
            <>
              <div style={{ marginBottom: 36 }} className="anim a1">
                <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.3 }}>안녕하세요 👋</h1>
                <p style={{ fontSize: 15, color: 'var(--text2)', marginTop: 6 }}>학습할 코스를 선택하고 AI 튜터와 함께 공부해보세요.</p>
              </div>
              <div className="anim a2">
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>학습 영역</h2>
                <div style={{ maxWidth: 480 }}>
                  <CourseCard completed={completedNodes} total={nodes.length} onClick={() => { setView('course'); sessionStorage.setItem('ale_view', 'detail'); }} />
                </div>
              </div>
              <div className="anim a3" style={{ marginTop: 36 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>학습한 개념</h2>
                <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--border)', marginBottom: 12, display: 'block' }}>menu_book</span>
                  <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>학습을 시작하면 완료한 개념이 여기에 표시됩니다</p>
                </div>
              </div>
            </>
          ) : (
            <CourseDetail
              nodes={nodes} sessions={sessions} lastSession={lastSession}
              selectedNodeId={selectedNode?.id || null}
              onSelectNode={handleSelectNode}
              onBack={handleBackToMain}
              onContinueLearning={handleContinueLearning}
              description={kg?.description}
            />
          )}
        </section>

        {/* main뷰에서만 RightSidebar(아바타+통계), 디테일뷰에서는 노드 선택 시 ConversationSidebar만 */}
        {view === 'main' && (
          <RightSidebar
            completed={completedNodes} total={nodes.length} totalTurns={totalTurns}
            avgTime={calcAvgTime()} costStr={costStr} sessions={sessions}
            nextNode={nextNode}
            onRestoreSession={handleRestoreFromSidebar}
            onStartRecommended={handleStartRecommended}
          />
        )}
        {view === 'course' && selectedNode && (
          <aside className="dash-aside" style={{
            width: 360, borderLeft: '1px solid var(--border)', background: 'var(--white)',
            display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative',
          }}>
            <ConversationSidebar
              nodeId={selectedNode.id} nodeLabel={selectedNode.label}
              sessions={sessions}
              onStartSession={handleStartSession}
              onResumeSession={handleResumeSession}
              onDeleteSession={handleDeleteSession}
            />
          </aside>
        )}
      </main>
    </div>
  );
}