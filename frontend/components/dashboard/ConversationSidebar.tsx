// frontend/components/dashboard/ConversationSidebar.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SessionListItem, Message, SessionMode } from "@/lib/types";

interface Props {
  nodeId: string;
  nodeLabel: string;
  sessions: SessionListItem[];
  onStartSession: (nodeId: string, mode: SessionMode) => void;
  onResumeSession: (
    sid: string,
    nodeId: string,
    mode: string,
    phase?: string,
  ) => void;
  onDeleteSession: (sid: string) => void;
}

export default function ConversationSidebar({
  nodeId,
  nodeLabel,
  sessions,
  onStartSession,
  onResumeSession,
  onDeleteSession,
}: Props) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [checkingItems, setCheckingItems] = useState(false);

  // 사전평가 미완료 세션은 목록에서 제외
  const nodeSessions = sessions.filter((s) => {
    if (s.node_id !== nodeId) return false;
    // 사전평가를 시작도 안 했거나 완료 안 한 세션 숨김
    if (s.pre_score == null && s.status === "pre_test") return false;
    return true;
  });

  useEffect(() => {
    console.log("[FOCUS] === useEffect 실행 ===");
    console.log("[FOCUS] nodeId:", nodeId);
    console.log(
      "[FOCUS] nodeSessions:",
      nodeSessions.map((s) => `${s.id}(${s.mode})`),
    );
    console.log("[FOCUS] sessions.length:", sessions.length);

    if (nodeSessions.length === 0) {
      console.log("[FOCUS] → nodeSessions 비어있음 → 초기화 후 return");
      setActiveSessionId(null);
      setConversation([]);
      return;
    }

    const focusSession = sessionStorage.getItem("ale_focus_session");
    const focusDone = sessionStorage.getItem("ale_focus_done");
    console.log("[FOCUS] focusSession:", focusSession);
    console.log("[FOCUS] focusDone:", focusDone);

    // focusSession이 있으면 무조건 처리 (새로 나가기한 것)
    if (focusSession) {
      const found = nodeSessions.find((s) => s.id === focusSession);
      if (found) {
        console.log(
          "[FOCUS] → ✓ focusSession 매칭:",
          focusSession,
          "→ handleClickSession",
        );
        handleClickSession(found.id);
        sessionStorage.removeItem("ale_focus_session");
        sessionStorage.setItem("ale_focus_done", nodeId);
        console.log(
          "[FOCUS] → ale_focus_session 삭제, ale_focus_done 설정:",
          nodeId,
        );
        return;
      }
      console.log(
        "[FOCUS] → ✗ focusSession이 nodeSessions에 없음, 로딩 대기 → return",
      );
      return;
    }

    // focusSession 없고, 이미 이 노드에 대해 포커스 적용 완료
    if (focusDone === nodeId) {
      console.log("[FOCUS] → focusDone === nodeId → 이미 적용 완료, return");
      return;
    }

    // 다른 노드의 focusDone이 남아있으면 제거
    if (focusDone && focusDone !== nodeId) {
      console.log("[FOCUS] → focusDone이 다른 노드:", focusDone, "→ 제거");
      sessionStorage.removeItem("ale_focus_done");
    }

    // focusSession 없으면 첫 번째 선택
    console.log(
      "[FOCUS] → focusSession 없음 → 첫 번째 세션 선택:",
      nodeSessions[0].id,
    );
    handleClickSession(nodeSessions[0].id);
    sessionStorage.setItem("ale_focus_done", nodeId);
  }, [nodeId, sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClickSession = async (sid: string) => {
    setActiveSessionId(sid);
    setLoadingConv(true);
    try {
      const data = await api.restore(sid);
      const conv = (data.conversation || [])
        .map((m) => ({
          ...m,
          content: m.content
            .replace(/\[SCORE:.*?\]/g, "")
            .replace(/\[BRIEF:.*?\]/g, "")
            .replace(/\[TOPIC_COMPLETE\]/g, "")
            .replace(/\[CHECKLIST:.*?\]/g, "")
            .replace(/\[Q\]\s*/g, "")
            .trim(),
        }))
        .filter((m) => m.content);
      setConversation(conv);
    } catch {
      setConversation([]);
    } finally {
      setLoadingConv(false);
    }
  };

  // #4: 사전/사후 문항 체크 후 시작
  const handleStartWithCheck = async (mode: SessionMode) => {
    setCheckingItems(true);
    try {
      const res = await fetch(
        `/test/items/${encodeURIComponent(nodeId)}?form=A`,
        { credentials: "same-origin" },
      );
      if (res.ok) {
        const d = await res.json();
        if (!d.items || d.items.length === 0) {
          alert(
            "사전/사후 평가 문항이 등록되지 않은 노드입니다.\n관리자에게 문의하세요.",
          );
          setCheckingItems(false);
          return;
        }
      }
    } catch {
      /* 네트워크 에러 시 일단 진행 */
    }
    setCheckingItems(false);
    onStartSession(nodeId, mode);
  };

  const handleDelete = async (sid: string) => {
    if (!confirm("이 대화를 삭제하시겠습니까?")) return;
    try {
      await api.deleteSession(sid);
    } catch {
      /* ignore */
    }
    onDeleteSession(sid);
    if (activeSessionId === sid) {
      setActiveSessionId(null);
      setConversation([]);
    }
  };

  // 세션의 현재 phase 판별
  // DB status + pre_score/post_score/completed 조합으로 정확 판별
  const getSessionPhase = (
    s: SessionListItem,
  ): { label: string; color: string } => {
    if (s.completed || s.status === "completed")
      return { label: "완료", color: "var(--teal)" };
    if (s.post_score != null) return { label: "완료", color: "var(--teal)" };
    // 사후평가 중이든 학습 중이든 모두 "학습 중"
    return { label: "학습 중", color: "var(--primary)" };
  };

  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--primary)",
            flexShrink: 0,
          }}
        />
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nodeLabel}
        </h3>
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <button
          onClick={() => handleStartWithCheck("reading")}
          disabled={checkingItems}
          style={{
            flex: 1,
            padding: "12px 8px",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            background: "var(--white)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text2)",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: checkingItems ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!checkingItems) {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.color = "var(--primary)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text2)";
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            menu_book
          </span>
          읽기 학습
        </button>
        <button
          onClick={() => handleStartWithCheck("tutoring")}
          disabled={checkingItems}
          style={{
            flex: 1,
            padding: "12px 8px",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            background: "var(--white)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text2)",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: checkingItems ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!checkingItems) {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.color = "var(--primary)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text2)";
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            chat
          </span>
          대화 학습
        </button>
      </div>

      {/* 세션 목록 */}
      {nodeSessions.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text3)",
            textAlign: "center",
            gap: 8,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 40, color: "var(--border)" }}
          >
            chat_bubble_outline
          </span>
          <p style={{ fontSize: 13 }}>아직 학습 기록이 없습니다</p>
          <p style={{ fontSize: 11 }}>위 버튼으로 학습을 시작하세요</p>
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            학습 기록
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              flexShrink: 0,
              maxHeight: "35vh",
              overflowY: "auto",
            }}
          >
            {nodeSessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const done = !!s.completed || s.status === "completed";
              const iconBg = done ? "var(--teal-bg)" : "var(--primary-light)";
              const iconColor = done ? "var(--teal)" : "var(--primary)";
              const modeIcon = s.mode === "reading" ? "menu_book" : "chat";
              const dt = s.updated_at
                ? new Date(s.updated_at).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })
                : "";
              const phaseInfo = getSessionPhase(s);

              return (
                <div key={s.id}>
                  <button
                    ref={(el) => {
                      if (isActive && el) {
                        setTimeout(
                          () =>
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "nearest",
                            }),
                          100,
                        );
                      }
                    }}
                    onClick={() => handleClickSession(s.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                      background: isActive
                        ? "var(--primary-light)"
                        : "var(--white)",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      color: isActive ? "var(--primary)" : "var(--text2)",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ color: iconColor, fontSize: 16 }}
                      >
                        {done ? "check_circle" : modeIcon}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div>
                        {s.total_turns || 0}턴 · {dt}
                      </div>
                      {/* #3: phase 표시 */}
                      <div
                        style={{
                          fontSize: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{ color: phaseInfo.color, fontWeight: 700 }}
                        >
                          {phaseInfo.label}
                        </span>
                        <span style={{ color: "var(--text3)" }}>
                          · {s.mode === "reading" ? "읽기" : "대화"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isActive && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0 6px 38px",
                      }}
                    >
                      {!done && (
                        <button
                          onClick={() =>
                            onResumeSession(s.id, nodeId, s.mode || "tutoring")
                          }
                          style={{
                            padding: "6px 14px",
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          이어 학습하기 →
                        </button>
                      )}
                      {done && (
                        <button
                          onClick={() =>
                            onResumeSession(s.id, nodeId, s.mode || "tutoring")
                          }
                          style={{
                            padding: "6px 14px",
                            background: "var(--teal)",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          학습내용 보기 →
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        title="삭제"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: "none",
                          background: "rgba(244,63,94,0.08)",
                          color: "#f43f5e",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16 }}
                        >
                          delete
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 대화 미리보기 — 읽기 세션만 숨김 */}
          <div
            style={{
              height: 1,
              background: "var(--border)",
              margin: "14px 0",
              flexShrink: 0,
            }}
          />
          {(() => {
            const activeSess = nodeSessions.find(
              (s) => s.id === activeSessionId,
            );
            const isReading = activeSess?.mode === "reading";
            if (isReading) {
              return (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text3)",
                    textAlign: "center",
                    gap: 6,
                    padding: 20,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 32, color: "var(--border)" }}
                  >
                    menu_book
                  </span>
                  <p style={{ fontSize: 12 }}>읽기 학습 세션</p>
                </div>
              );
            }
            if (conversation.length === 0) {
              return (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text3)",
                    textAlign: "center",
                    gap: 6,
                    padding: 20,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 32, color: "var(--border)" }}
                  >
                    chat_bubble_outline
                  </span>
                  <p style={{ fontSize: 12 }}>대화 기록 없음</p>
                </div>
              );
            }
            return (
              <>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                    flexShrink: 0,
                  }}
                >
                  대화 미리보기
                </div>
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minHeight: 0,
                  }}
                >
                  {loadingConv ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "var(--text3)",
                        fontSize: 12,
                      }}
                    >
                      불러오는 중...
                    </div>
                  ) : (
                    conversation.slice(0, 20).map((m, i) => {
                      const isUser = m.role === "user";
                      const text =
                        m.content.length > 300
                          ? m.content.substring(0, 300) + "…"
                          : m.content;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: "12px 16px",
                            borderRadius: 14,
                            fontSize: 13,
                            lineHeight: 1.7,
                            maxWidth: "95%",
                            wordBreak: "break-word",
                            flexShrink: 0,
                            background: isUser
                              ? "var(--text)"
                              : "var(--primary-light)",
                            color: isUser
                              ? "rgba(255,255,255,0.9)"
                              : "var(--text)",
                            alignSelf: isUser ? "flex-end" : "flex-start",
                            borderBottomLeftRadius: isUser ? 14 : 4,
                            borderBottomRightRadius: isUser ? 4 : 14,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              marginBottom: 4,
                              opacity: 0.6,
                            }}
                          >
                            {isUser ? "나" : "튜터"}
                          </div>
                          {text}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
