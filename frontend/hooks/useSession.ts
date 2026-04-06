// frontend/hooks/useSession.ts
"use client";

import { useReducer, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  SessionPhase,
  SessionMode,
  Message,
  ChecklistItem,
  TestItem,
  TestResponse,
  ConnectedNode,
  Gate,
  AnswerResponse,
  SubmitTestResponse,
  LearningReport,
} from "@/lib/types";

/* ── State ── */

export interface SessionState {
  sessionId: string | null;
  nodeId: string;
  mode: SessionMode;
  phase: SessionPhase;
  loading: boolean;
  error: string | null;
  preTestItems: TestItem[];
  postTestItems: TestItem[];
  preScore: number | null;
  postScore: number | null;
  messages: Message[];
  checklist: Record<string, string>;
  checklistItems: ChecklistItem[];
  confirmedCount: number;
  totalItems: number;
  turn: number;
  gate: Gate | null;
  scoreHistory: number[];
  nextNodes: ConnectedNode[];
  readingMinSec: number;
  lastAnswer: AnswerResponse | null;
  gain: number | null;
  report: LearningReport | null;
  postScores: Array<{ item_id: string; auto_score: number; bloom: string }>;
}

const initialState: SessionState = {
  sessionId: null,
  nodeId: "",
  mode: "tutoring",
  phase: "pre_test",
  loading: false,
  error: null,
  preTestItems: [],
  postTestItems: [],
  preScore: null,
  postScore: null,
  messages: [],
  checklist: {},
  checklistItems: [],
  confirmedCount: 0,
  totalItems: 0,
  turn: 0,
  gate: null,
  scoreHistory: [],
  nextNodes: [],
  readingMinSec: 300,
  lastAnswer: null,
  gain: null,
  report: null,
  postScores: [],
};

/* ── Actions ── */

type Action =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | {
      type: "SESSION_STARTED";
      payload: {
        sessionId: string;
        mode: SessionMode;
        phase: SessionPhase;
        nodeId: string;
        firstMessage: string;
        checklistItems: ChecklistItem[];
        preTestItems: TestItem[];
        connectedNodes: ConnectedNode[];
      };
    }
  | {
      type: "SESSION_RESTORED";
      payload: {
        sessionId: string;
        nodeId: string;
        mode: SessionMode;
        phase: SessionPhase;
        messages: Message[];
        checklistItems: ChecklistItem[];
        checklist: Record<string, string>;
        turn: number;
        scoreHistory: number[];
        confirmedCount: number;
        totalItems: number;
        preTestItems?: TestItem[];
        postTestItems?: TestItem[];
        preScore?: number | null;
        postScore?: number | null;
        gate?: Gate | null;
      };
    }
  | { type: "TEST_SUBMITTED"; payload: SubmitTestResponse }
  | { type: "MESSAGE_SENT"; message: string }
  | { type: "ANSWER_RECEIVED"; payload: AnswerResponse }
  | { type: "READING_COMPLETE"; postTestItems: TestItem[] }
  | { type: "SET_PHASE"; phase: SessionPhase }
  | { type: "SET_POST_TEST_ITEMS"; items: TestItem[] };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "SESSION_STARTED": {
      const p = action.payload;
      const msgs: Message[] = p.firstMessage
        ? [{ role: "assistant", content: p.firstMessage }]
        : [];
      // #4: preTestItems가 없으면 pre_test 스킵
      const hasPreTest = p.preTestItems && p.preTestItems.length > 0;
      const phase: SessionPhase = hasPreTest
        ? p.phase
        : p.mode === "reading"
          ? "learning_reading"
          : "learning_tutoring";
      return {
        ...state,
        sessionId: p.sessionId,
        mode: p.mode,
        phase,
        nodeId: p.nodeId,
        checklistItems: p.checklistItems,
        preTestItems: p.preTestItems,
        nextNodes: p.connectedNodes,
        messages: msgs,
        loading: false,
        checklist: {},
        confirmedCount: 0,
        totalItems: p.checklistItems.length,
        turn: 0,
        gate: null,
        scoreHistory: [],
        lastAnswer: null,
      };
    }
    case "SESSION_RESTORED": {
      const p = action.payload;
      return {
        ...state,
        sessionId: p.sessionId,
        nodeId: p.nodeId,
        mode: p.mode,
        phase: p.phase,
        messages: p.messages,
        checklistItems: p.checklistItems,
        checklist: p.checklist,
        turn: p.turn,
        scoreHistory: p.scoreHistory,
        confirmedCount: p.confirmedCount,
        totalItems: p.totalItems,
        preTestItems: p.preTestItems ?? state.preTestItems,
        postTestItems: p.postTestItems ?? state.postTestItems,
        preScore: p.preScore ?? state.preScore,
        postScore: p.postScore ?? state.postScore,
        gate: p.gate ?? state.gate,
        loading: false,
      };
    }
    case "TEST_SUBMITTED": {
      const p = action.payload;
      const isPreTest = p.test_phase === "pre_test";
      const newMsgs = p.first_message
        ? [{ role: "assistant" as const, content: p.first_message }]
        : state.messages;
      return {
        ...state,
        phase: p.next_status,
        ...(isPreTest
          ? { preScore: p.phase_score }
          : { postScore: p.phase_score }),
        ...(p.checklist_items
          ? {
              checklistItems: p.checklist_items,
              totalItems: p.checklist_items.length,
            }
          : {}),
        messages: isPreTest ? newMsgs : state.messages,
        postTestItems: isPreTest ? [] : state.postTestItems,
        loading: false,
        ...(!isPreTest
          ? {
              gain: p.gain ?? null,
              report: p.report ?? null,
              postScores: p.scores ?? [],
            }
          : {}),
      };
    }
    case "MESSAGE_SENT":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", content: action.message },
        ],
        loading: true,
      };
    case "ANSWER_RECEIVED": {
      const a = action.payload;
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "assistant", content: a.tutor_message },
        ],
        checklist: a.checklist,
        confirmedCount: a.confirmed_count,
        totalItems: a.total_items,
        turn: a.turn,
        gate: a.gate,
        scoreHistory: a.score_history,
        nextNodes: a.next_nodes ?? state.nextNodes,
        lastAnswer: a,
        loading: false,
        // gate.completed 시 DoneCard에서 수동 전이 (자동 전이 X)
      };
    }
    case "READING_COMPLETE":
      return {
        ...state,
        phase: "post_test",
        postTestItems: action.postTestItems,
        loading: false,
      };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_POST_TEST_ITEMS":
      return { ...state, postTestItems: action.items };
    default:
      return state;
  }
}

/* ── Hook ── */

export function useSession() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startSession = useCallback(
    async (nodeId: string, mode: SessionMode) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const res = await api.startSession(nodeId, mode);

        // #4: 백엔드가 pre_test_items 안 줬으면 직접 로드
        let preItems = res.pre_test_items ?? [];
        if (preItems.length === 0) {
          try {
            const itemsRes = await fetch(
              `/test/items/${encodeURIComponent(nodeId)}?form=A`,
              { credentials: "same-origin" },
            );
            if (itemsRes.ok) {
              const d = await itemsRes.json();
              preItems = d.items ?? [];
            }
          } catch {
            /* ignore */
          }
        }

        // #4: 사전/사후 문항 둘 다 없으면 에러
        if (preItems.length === 0) {
          dispatch({
            type: "SET_ERROR",
            error:
              "사전/사후 평가 문항이 없어 학습을 시작할 수 없습니다.\n관리자에게 문의하세요.",
          });
          return null;
        }

        dispatch({
          type: "SESSION_STARTED",
          payload: {
            sessionId: res.session_id,
            mode: res.mode,
            phase: res.status,
            nodeId,
            firstMessage: res.first_message,
            checklistItems: res.checklist_items,
            preTestItems: preItems,
            connectedNodes: res.connected_nodes,
          },
        });
        return res.session_id;
      } catch (e: any) {
        dispatch({ type: "SET_ERROR", error: e.message });
        return null;
      }
    },
    [],
  );

  const restoreSession = useCallback(
    async (sid: string, nodeId: string, mode: SessionMode) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        // 1단계: DB에서 세션 상태 먼저 확인
        const statusRes = await api.status(sid).catch(() => null);
        const dbStatus = statusRes?.status;
        // 사후평가 완료(post_score 있음)만 진정한 completed
        const dbCompleted = statusRes?.post_score != null;
        // gate만 완료된 상태 (사후평가 아직 안 함)
        const dbGateDone = statusRes?.gate?.completed || statusRes?.gate_done;

        // 2단계: 대화/체크리스트 복원
        const restore = await api.restore(sid);
        let checklist: Record<string, string> = {};
        const rawCl = restore.last_state?.checklist_state;
        if (typeof rawCl === "string") {
          try {
            checklist = JSON.parse(rawCl);
          } catch {
            checklist = {};
          }
        } else if (rawCl && typeof rawCl === "object") {
          checklist = rawCl as Record<string, string>;
        }
        const confirmed = Object.values(checklist).filter(
          (v) => v === "confirmed",
        ).length;

        if (dbCompleted) {
          // 완료 세션 → resume 안 함, 읽기 전용
          dispatch({
            type: "SESSION_RESTORED",
            payload: {
              sessionId: sid,
              nodeId,
              mode,
              phase: "completed",
              messages: restore.conversation,
              checklistItems: restore.checklist_items,
              checklist: checklist as Record<string, string>,
              turn: restore.last_state?.turn ?? 0,
              scoreHistory: restore.score_history,
              confirmedCount: confirmed,
              totalItems: restore.checklist_items.length,
              preScore: statusRes?.pre_score ?? null,
              postScore: statusRes?.post_score ?? null,
              gate: { gate_a: true, gate_b: true, completed: true },
            },
          });
          return;
        }

        // 3단계: 미완료 → resume 호출
        try {
          await api.resume(
            sid,
            nodeId,
            restore.conversation,
            checklist as Record<string, string>,
          );
        } catch (e) {
          console.warn("[RESTORE] resume failed:", e);
        }

        // 4단계: resume 후 status 재확인 (인메모리 반영)
        const statusAfter = await api.status(sid).catch(() => null);
        let phase: SessionPhase;
        if (statusAfter?.status) {
          phase = statusAfter.status as SessionPhase;
          // 읽기 모드인데 learning_tutoring으로 잡히면 보정
          if (mode === "reading" && phase === "learning_tutoring") {
            phase = "learning_reading";
          }
          // 대화 모드인데 learning_reading으로 잡히면 보정
          if (mode === "tutoring" && phase === "learning_reading") {
            phase = "learning_tutoring";
          }
        } else if (restore.conversation.length > 0) {
          phase = mode === "reading" ? "learning_reading" : "learning_tutoring";
        } else {
          phase = "pre_test";
        }

        // 5단계: phase별 items 로드
        let preTestItems: TestItem[] = [];
        let postTestItems: TestItem[] = [];
        if (phase === "pre_test") {
          try {
            const r = await fetch(
              `/test/items/${encodeURIComponent(nodeId)}?form=A`,
              { credentials: "same-origin" },
            );
            if (r.ok) {
              const d = await r.json();
              preTestItems = d.items ?? [];
            }
          } catch {}
        } else if (phase === "post_test") {
          try {
            postTestItems = await api.loadPostTestItems(nodeId);
          } catch {}
        }

        dispatch({
          type: "SESSION_RESTORED",
          payload: {
            sessionId: sid,
            nodeId,
            mode,
            phase,
            messages: restore.conversation,
            checklistItems: restore.checklist_items,
            checklist: checklist as Record<string, string>,
            turn: restore.last_state?.turn ?? 0,
            scoreHistory: restore.score_history,
            confirmedCount: confirmed,
            totalItems: restore.checklist_items.length,
            preTestItems,
            postTestItems,
            preScore: statusAfter?.pre_score ?? statusRes?.pre_score ?? null,
            postScore: statusAfter?.post_score ?? statusRes?.post_score ?? null,
            gate: statusAfter?.gate ?? null,
          },
        });
      } catch (e: any) {
        dispatch({ type: "SET_ERROR", error: e.message });
      }
    },
    [],
  );

  const submitTest = useCallback(
    async (testPhase: string, responses: TestResponse[]) => {
      if (!state.sessionId) return;
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const res = await api.submitTest(state.sessionId, testPhase, responses);
        dispatch({ type: "TEST_SUBMITTED", payload: res });
      } catch (e: any) {
        dispatch({ type: "SET_ERROR", error: e.message });
      }
    },
    [state.sessionId],
  );

  const sendMessage = useCallback(
    async (answer: string) => {
      if (!state.sessionId) return;
      dispatch({ type: "MESSAGE_SENT", message: answer });
      try {
        const res = await api.answer(state.sessionId, answer);
        dispatch({ type: "ANSWER_RECEIVED", payload: res });

        if (res.gate?.completed) {
          const postItems = await api.loadPostTestItems(state.nodeId);
          if (postItems.length > 0) {
            dispatch({ type: "SET_POST_TEST_ITEMS", items: postItems });
          }
        }
      } catch (e: any) {
        dispatch({ type: "SET_ERROR", error: e.message });
      }
    },
    [state.sessionId, state.nodeId],
  );

  const completeReading = useCallback(async () => {
    if (!state.sessionId) return;
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const res = await api.readingComplete(state.sessionId);
      if (res.allowed) {
        let postItems = res.post_test_items ?? [];
        if (postItems.length === 0) {
          postItems = await api.loadPostTestItems(state.nodeId);
        }
        dispatch({ type: "READING_COMPLETE", postTestItems: postItems });
      } else {
        dispatch({
          type: "SET_ERROR",
          error: `최소 ${res.required_sec}초 이상 학습해야 합니다.`,
        });
      }
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", error: e.message });
    }
  }, [state.sessionId, state.nodeId]);

  const setPhase = useCallback((phase: SessionPhase) => {
    dispatch({ type: "SET_PHASE", phase });
  }, []);

  const setPostTestItems = useCallback((items: TestItem[]) => {
    dispatch({ type: "SET_POST_TEST_ITEMS", items });
  }, []);

  return {
    state,
    startSession,
    restoreSession,
    submitTest,
    sendMessage,
    completeReading,
    setPhase,
    setPostTestItems,
  };
}
