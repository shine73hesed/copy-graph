// frontend/components/session/Tutoring.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "@/components/chat/MessageBubble";
import InputBar from "@/components/chat/InputBar";
import TypingIndicator from "@/components/chat/TypingIndicator";
import DoneCard from "@/components/chat/DoneCard";
import ChecklistSidebar from "@/components/checklist/ChecklistSidebar";
import DebugPanel from "@/components/chat/DebugPanel";
import ReportModal from "@/components/common/ReportModal";
import { useSessionContext } from "./SessionProvider";

interface Props {
  onWiki?: () => void;
  onNotes?: () => void;
  onBack?: () => void;
}

export default function Tutoring({ onWiki, onNotes, onBack }: Props) {
  const { state, sendMessage, setPhase, setPostTestItems } =
    useSessionContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [fontSize, setFontSize] = useState(15); // 기본 15px

  const fontUp = () => setFontSize((prev) => Math.min(prev + 2, 24));
  const fontDown = () => setFontSize((prev) => Math.max(prev - 2, 12));

  // #8: 완료 여부 — 사후평가 완료(postScore 존재) 시에만 진정한 완료
  const isFullyCompleted = state.postScore != null;
  const isGateCompleted = state.gate?.completed ?? false;
  // 대화 gate 완료했지만 사후평가 아직 안 한 상태
  const needsPostTest = isGateCompleted && !isFullyCompleted;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length, state.loading]);

  const handleComplete = async () => {
    if (!state.sessionId) return;
    try {
      const { api } = await import("@/lib/api");
      if (state.postTestItems.length === 0) {
        const items = await api.loadPostTestItems(state.nodeId);
        setPostTestItems(items);
      }
      setPhase("post_test");
    } catch {
      setPhase("post_test");
    }
  };

  // #7: 나가기 시 포커싱 저장
  const handleBack = () => {
    sessionStorage.setItem("ale_show_detail", "1");
    if (state.nodeId) sessionStorage.setItem("ale_focus_node", state.nodeId);
    if (onBack) onBack();
  };

  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="tutoring-container"
      style={{ display: "flex", height: "100vh", flexDirection: "column" }}
    >
      {/* 메뉴 오버레이 */}
      {showMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 150,
            background: "rgba(0,0,0,0.08)",
          }}
          onClick={() => setShowMenu(false)}
        />
      )}
      {/* 메뉴 드롭다운 */}
      {showMenu && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 16,
            width: 260,
            background: "var(--paper)",
            border: "1px solid var(--cream)",
            zIndex: 200,
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
            padding: 8,
            animation: "slideDown 0.15s ease-out",
          }}
        >
          {onWiki && (
            <div
              onClick={() => {
                setShowMenu(false);
                onWiki();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink2)",
                cursor: "pointer",
                borderRadius: 12,
                marginBottom: 2,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-light)";
                e.currentTarget.style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "var(--ink2)";
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20 }}
              >
                menu_book
              </span>
              교재 보기
            </div>
          )}
          {onNotes && (
            <div
              onClick={() => {
                setShowMenu(false);
                onNotes();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink2)",
                cursor: "pointer",
                borderRadius: 12,
                marginBottom: 2,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary-light)";
                e.currentTarget.style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "var(--ink2)";
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20 }}
              >
                edit_note
              </span>
              노트 보기
            </div>
          )}
          <div
            onClick={() => {
              setShowMenu(false);
              handleBack();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink2)",
              cursor: "pointer",
              borderRadius: 12,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--primary-light)";
              e.currentTarget.style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "";
              e.currentTarget.style.color = "var(--ink2)";
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              logout
            </span>
            나가기
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header
        className="ale-header"
        style={{ background: "var(--paper)", borderColor: "var(--cream)" }}
      >
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            widgets
          </span>
        </button>

        <div className="h-topic">
          <span className="h-subject">{state.nodeId}</span>
          {state.totalItems > 0 && (
            <>
              <div className="h-progress-bar">
                <div
                  className="h-progress-fill"
                  style={{
                    width: `${Math.round((state.confirmedCount / state.totalItems) * 100)}%`,
                  }}
                />
              </div>
              <span className="h-progress-label">
                {state.confirmedCount}/{state.totalItems}
              </span>
            </>
          )}
        </div>

        <div className="h-right">
          {/* 글자 크기 조절 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginRight: 4,
            }}
          >
            <button
              onClick={fontDown}
              title="글자 작게"
              style={{
                background: "transparent",
                border: "1px solid var(--cream)",
                cursor: "pointer",
                color: "var(--ink3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "8px 0 0 8px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--sans)",
              }}
            >
              -A
            </button>
            <button
              onClick={fontUp}
              title="글자 크게"
              style={{
                background: "transparent",
                border: "1px solid var(--cream)",
                borderLeft: "none",
                cursor: "pointer",
                color: "var(--ink3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "0 8px 8px 0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "var(--sans)",
              }}
            >
              +A
            </button>
          </div>
          {isFullyCompleted && (
            <button
              className="icon-btn"
              onClick={() => setReportOpen(true)}
              title="보고서"
              style={{ color: "var(--teal)" }}
            >
              <span className="material-symbols-outlined">assessment</span>
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => setShowChecklist(!showChecklist)}
            title="체크리스트"
          >
            <span className="material-symbols-outlined">checklist</span>
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            title="디버그"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 12,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 20 }}
            >
              tune
            </span>
          </button>
        </div>
      </header>

      {/* 디버그 */}
      <DebugPanel
        open={showDebug}
        onClose={() => setShowDebug(false)}
        lastAnswer={state.lastAnswer}
        scoreHistory={state.scoreHistory}
        gate={state.gate}
        checklist={state.checklist}
        checklistItems={state.checklistItems}
        turn={state.turn}
      />

      {/* 대화 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="scroll" ref={scrollRef}>
            <div className="thread" style={{ fontSize }}>
              {state.messages.map((msg, i) => (
                <MessageBubble key={i} role={msg.role} content={msg.content} />
              ))}
              {state.loading && <TypingIndicator />}
              {/* gate 완료 + 사후평가 미완료: DoneCard (사후 평가로 이동) */}
              {needsPostTest && (
                <DoneCard
                  confirmedCount={state.confirmedCount}
                  totalItems={state.totalItems}
                  onComplete={handleComplete}
                />
              )}
              {/* 사후평가 완료: 완료 배너 + 보고서 접근 */}
              {isFullyCompleted && (
                <div
                  style={{
                    margin: "44px 0",
                    padding: 32,
                    textAlign: "center",
                    background: "#f0fdf4",
                    borderRadius: 16,
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 24, color: "var(--teal)" }}
                    >
                      check_circle
                    </span>
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--teal)",
                      }}
                    >
                      학습 완료
                    </h3>
                  </div>
                  <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                    체크리스트 {state.confirmedCount}/{state.totalItems} ·{" "}
                    {state.turn} turns
                  </p>
                  <button
                    onClick={() => setReportOpen(true)}
                    style={{
                      padding: "10px 24px",
                      background: "var(--teal)",
                      color: "white",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18 }}
                    >
                      assessment
                    </span>
                    보고서 보기
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* 대화 진행 중(gate 미완료)에만 입력 표시 */}
          {!isFullyCompleted && !isGateCompleted && (
            <InputBar onSend={sendMessage} disabled={state.loading} />
          )}
        </div>

        {showChecklist && (
          <div
            style={{
              width: 280,
              borderLeft: "1px solid var(--cream)",
              background: "var(--paper)",
              height: "100%",
              overflowY: "auto",
              padding: 16,
            }}
          >
            <ChecklistSidebar
              items={state.checklistItems}
              checklist={state.checklist}
            />
          </div>
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
