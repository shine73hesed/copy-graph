import type {
  StartSessionResponse,
  AnswerResponse,
  SubmitTestResponse,
  ReadingContentResponse,
  ReadingCompleteResponse,
  RestoreResponse,
  KGResponse,
  WikiDocResponse,
  WikiListItem,
  NoteResponse,
  NoteListItem,
  SessionListItem,
  SessionMode,
  TestResponse,
  TestItem,
  TestDebugLog,
  CostResponse,
  Message,
} from './types';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // ── Auth ──
  login(user_id: string, pin: string) {
    return fetchApi<{ user_id: string; display_name: string; is_new: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_id, pin }),
    });
  },

  logout() {
    return fetchApi<{ status: string }>('/auth/logout', { method: 'POST' });
  },

  me() {
    return fetchApi<{ user_id: string; display_name: string; role: string }>('/auth/me');
  },

  // ── Session lifecycle ──
  startSession(node_id: string, mode: SessionMode) {
    return fetchApi<StartSessionResponse>('/test/start', {
      method: 'POST',
      body: JSON.stringify({ node_id, mode }),
    });
  },

  answer(session_id: string, answer: string) {
    return fetchApi<AnswerResponse>('/test/answer', {
      method: 'POST',
      body: JSON.stringify({ session_id, answer }),
    });
  },

  submitTest(session_id: string, test_phase: string, responses: TestResponse[]) {
    return fetchApi<SubmitTestResponse>('/test/submit', {
      method: 'POST',
      body: JSON.stringify({ session_id, test_phase, responses }),
    });
  },

  status(session_id: string) {
    return fetchApi<{ status: string; session_id: string; node_id: string; turn: number; completed?: boolean; pre_score?: number | null; post_score?: number | null; mode?: string }>(`/test/status?session_id=${encodeURIComponent(session_id)}`);
  },

  async sessions() {
    const res = await fetchApi<{ sessions: SessionListItem[] }>('/test/sessions');
    return res.sessions;
  },

  restore(session_id: string) {
    return fetchApi<RestoreResponse>(`/test/restore?session_id=${encodeURIComponent(session_id)}`);
  },

  resume(session_id: string, node_id: string, restore_history: Message[], restore_checklist: Record<string, string>) {
    return fetchApi<{ session_id: string; resumed: boolean; checklist_items: Array<{ id: string; label: string }> }>('/test/resume', {
      method: 'POST',
      body: JSON.stringify({ session_id, node_id, restore_history, restore_checklist }),
    });
  },

  // v8.2: 세션 삭제
  deleteSession(session_id: string) {
    return fetchApi<{ ok: boolean }>(`/test/delete-session?session_id=${encodeURIComponent(session_id)}`, {
      method: 'DELETE',
    });
  },

  // ── Reading ──
  readingContent(node_id: string) {
    return fetchApi<ReadingContentResponse>(`/reading/${encodeURIComponent(node_id)}/content`);
  },

  // v8.2: 챕터 기반 읽기 교재
  readingChapters(node_id: string) {
    return fetchApi<{ node_id: string; chapters: Array<{ id: string; title: string; order: number; filename: string }> }>(`/reading/${encodeURIComponent(node_id)}/chapters`);
  },

  readingChapter(node_id: string, chapter_id: string) {
    return fetchApi<{ node_id: string; chapter_id: string; markdown: string }>(`/reading/${encodeURIComponent(node_id)}/chapter/${encodeURIComponent(chapter_id)}`);
  },

  readingLog(session_id: string, event_type: string, event_data: Record<string, unknown>) {
    return fetchApi<{ ok: boolean }>('/reading/log', {
      method: 'POST',
      body: JSON.stringify({ session_id, event_type, event_data }),
    });
  },

  readingComplete(session_id: string) {
    return fetchApi<ReadingCompleteResponse>('/reading/complete', {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    });
  },

  // ── Test Items ──
  async loadPostTestItems(node_id: string) {
    const res = await fetchApi<{ items: TestItem[] }>(`/test/items/${encodeURIComponent(node_id)}?form=B`);
    return res.items;
  },

  // ── Knowledge Graph ──
  kg() {
    return fetchApi<KGResponse>('/test/kg');
  },

  // v8.2: read 폴더 기반 과목 목록
  readingSubjects() {
    return fetchApi<{ subjects: Array<{ id: string; label: string; chapter_count: number }> }>('/reading/subjects');
  },

  // ── Wiki ──
  wiki(node_id: string) {
    return fetchApi<WikiDocResponse>(`/test/wiki/${encodeURIComponent(node_id)}`);
  },

  // v8.2: 확장 — category 포함
  async wikiList() {
    return fetchApi<WikiListItem[]>('/test/wiki-list');
  },

  // ── Notes ──
  note(node_id: string) {
    return fetchApi<NoteResponse>(`/test/note/${encodeURIComponent(node_id)}`);
  },

  updateMemo(node_id: string, memo: string) {
    return fetchApi<{ ok: boolean }>(`/test/note/${encodeURIComponent(node_id)}/memo`, {
      method: 'PUT',
      body: JSON.stringify({ memo }),
    });
  },

  // v8.2: 세션별 노트
  sessionNote(session_id: string) {
    return fetchApi<{ memo: string; session_id: string }>(`/test/session-note/${encodeURIComponent(session_id)}`);
  },

  saveSessionNote(session_id: string, memo: string) {
    return fetchApi<{ ok: boolean }>(`/test/session-note/${encodeURIComponent(session_id)}`, {
      method: 'PUT',
      body: JSON.stringify({ memo }),
    });
  },

  // v8.2: 전체 노트 목록 (아이콘 표시용)
  async allNotes() {
    return fetchApi<{ notes: NoteListItem[] }>('/test/notes');
  },

  // ── History ──
  nodeHistory(node_id: string) {
    return fetchApi<unknown>(`/test/node-history?node_id=${encodeURIComponent(node_id)}`);
  },

  // ── Report ──
  sessionReport(session_id: string) {
    return fetchApi<unknown>(`/test/session-report?session_id=${encodeURIComponent(session_id)}`);
  },

  // v8.2: 비용 조회
  cost() {
    return fetchApi<CostResponse>('/test/cost');
  },

  // v8.2: 채점 디버그 로그 조회 (개발용)
  async debugLogs(session_id: string) {
    return fetchApi<{ logs: TestDebugLog[] }>(`/test/debug-logs/${encodeURIComponent(session_id)}`);
  },
};