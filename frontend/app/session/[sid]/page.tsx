// frontend/app/session/[sid]/page.tsx
"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import SessionProvider, {
  useSessionContext,
} from "@/components/session/SessionProvider";
import PreTest from "@/components/session/PreTest";
import Tutoring from "@/components/session/Tutoring";
import Reading from "@/components/session/Reading";
import PostTest from "@/components/session/PostTest";
import Report from "@/components/session/Report";
import WikiModal from "@/components/common/WikiModal";
import NoteModal from "@/components/common/NoteModal";
import type { SessionMode } from "@/lib/types";
import { api } from "@/lib/api";

function SessionContent() {
  const { state, startSession, restoreSession } = useSessionContext();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initRef = useRef(false);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const sid = params.sid as string;
  const nodeId = searchParams.get("node") ?? "";
  const mode = (searchParams.get("mode") ?? "tutoring") as SessionMode;
  const isRestore = searchParams.get("restore") === "1";
  const isNew = sid === "new";

  useEffect(() => {
    if (initRef.current || !nodeId) return;
    initRef.current = true;

    if (isNew) {
      startSession(nodeId, mode).then((newSid) => {
        if (newSid) {
          window.history.replaceState(
            null,
            "",
            `/session/${newSid}?node=${nodeId}&mode=${mode}`,
          );
        }
      });
    } else if (isRestore) {
      restoreSession(sid, nodeId, mode);
    } else {
      restoreSession(sid, nodeId, mode).catch(() => {});
    }
  }, [sid, nodeId, mode, isNew, isRestore, startSession, restoreSession]);

  // #7: 나가기 시 포커싱 저장
  const handleBack = async () => {
    const currentSid = state.sessionId || sid;
    // 사전평가 미완료 세션은 삭제
    if (state.phase === "pre_test" && state.preScore == null && currentSid) {
      try {
        await api.deleteSession(currentSid);
      } catch {
        /* */
      }
    }
    sessionStorage.setItem("ale_show_detail", "1");
    sessionStorage.setItem("ale_view", "detail");
    if (nodeId) {
      sessionStorage.setItem("ale_focus_node", nodeId);
      sessionStorage.setItem("ale_focus_label", nodeId.replace(/_/g, " "));
    }
    if (currentSid && currentSid !== "new") {
      sessionStorage.setItem("ale_focus_session", currentSid);
    }
    router.push("/dashboard");
  };

  if (state.error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ color: "#ef4444", fontSize: 14 }}>{state.error}</div>
        <button className="btn-secondary" onClick={handleBack}>
          대시보드로
        </button>
      </div>
    );
  }

  if (!state.sessionId) {
    // 스켈레톤: mode에 따라 해당 레이아웃 미리보기
    if (mode === "reading") {
      return (
        <div
          style={{ height: "100vh", display: "flex", flexDirection: "column" }}
        >
          {/* 읽기 헤더 스켈레톤 */}
          <div
            style={{
              height: 60,
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              padding: "0 28px",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 60,
                height: 14,
                background: "var(--border)",
                borderRadius: 4,
                animation: "breathe 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                width: 100,
                height: 14,
                background: "var(--border)",
                borderRadius: 4,
                animation: "breathe 1.5s ease-in-out infinite 0.2s",
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex" }}>
            {/* TOC 스켈레톤 */}
            <div
              style={{
                width: 280,
                borderRight: "1px solid var(--border)",
                padding: 20,
              }}
            >
              <div
                style={{
                  width: "60%",
                  height: 18,
                  background: "var(--border)",
                  borderRadius: 6,
                  marginBottom: 20,
                  animation: "breathe 1.5s ease-in-out infinite",
                }}
              />
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    width: `${70 - i * 5}%`,
                    height: 14,
                    background: "var(--border)",
                    borderRadius: 4,
                    marginBottom: 12,
                    animation: `breathe 1.5s ease-in-out infinite ${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            {/* 본문 스켈레톤 */}
            <div style={{ flex: 1, padding: "40px 48px" }}>
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <div
                  style={{
                    width: "40%",
                    height: 24,
                    background: "var(--border)",
                    borderRadius: 6,
                    marginBottom: 24,
                    animation: "breathe 1.5s ease-in-out infinite",
                  }}
                />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: `${90 - i * 8}%`,
                      height: 14,
                      background: "var(--border)",
                      borderRadius: 4,
                      marginBottom: 14,
                      animation: `breathe 1.5s ease-in-out infinite ${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    // 대화 스켈레톤
    return (
      <div
        className="tutoring-container"
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        {/* 헤더 스켈레톤 */}
        <header
          style={{
            height: 56,
            borderBottom: "1px solid var(--cream, var(--border))",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            background: "var(--paper, var(--bg))",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: "var(--primary-light)",
              borderRadius: 12,
              animation: "breathe 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 80,
                height: 14,
                background: "var(--border)",
                borderRadius: 4,
                animation: "breathe 1.5s ease-in-out infinite 0.1s",
              }}
            />
            <div
              style={{
                width: 120,
                height: 8,
                background: "var(--border)",
                borderRadius: 4,
                animation: "breathe 1.5s ease-in-out infinite 0.2s",
              }}
            />
          </div>
        </header>
        {/* 대화 스켈레톤 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: "48px 28px",
          }}
        >
          <div style={{ maxWidth: 620, width: "100%" }}>
            {/* 튜터 메시지 스켈레톤 */}
            <div style={{ marginBottom: 44 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--accent, var(--primary))",
                    animation: "breathe 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: "70%",
                    height: 14,
                    background: "var(--border)",
                    borderRadius: 4,
                    animation: "breathe 1.5s ease-in-out infinite 0.1s",
                  }}
                />
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: `${85 - i * 10}%`,
                    height: 14,
                    background: "var(--border)",
                    borderRadius: 4,
                    marginBottom: 14,
                    animation: `breathe 1.5s ease-in-out infinite ${i * 0.15}s`,
                  }}
                />
              ))}
              {/* Q 스켈레톤 */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--cream, var(--border))",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--accent, var(--primary))",
                      opacity: 0.3,
                      animation: "breathe 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      width: "60%",
                      height: 14,
                      background: "var(--border)",
                      borderRadius: 4,
                      animation: "breathe 1.5s ease-in-out infinite 0.2s",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 입력 스켈레톤 */}
        <div
          style={{
            padding: "16px 28px 22px",
            borderTop: "1px solid var(--cream, var(--border))",
          }}
        >
          <div
            style={{
              maxWidth: 620,
              margin: "0 auto",
              display: "flex",
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 48,
                background: "var(--border)",
                borderRadius: 24,
                animation: "breathe 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                width: 48,
                height: 48,
                background: "var(--border)",
                borderRadius: "50%",
                animation: "breathe 1.5s ease-in-out infinite 0.2s",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {state.phase === "pre_test" && <PreTest />}
      {state.phase === "learning_tutoring" && (
        <Tutoring
          onWiki={() => setWikiOpen(true)}
          onNotes={() => setNotesOpen(true)}
          onBack={handleBack}
        />
      )}
      {state.phase === "learning_reading" && <Reading onBack={handleBack} />}
      {state.phase === "post_test" && <PostTest />}
      {/* completed: 모드에 따라 다른 뷰 */}
      {state.phase === "completed" && state.mode === "reading" && (
        <Reading onBack={handleBack} />
      )}
      {state.phase === "completed" && state.mode === "tutoring" && (
        <Tutoring
          onWiki={() => setWikiOpen(true)}
          onNotes={() => setNotesOpen(true)}
          onBack={handleBack}
        />
      )}
      {state.phase === "completed" &&
        state.mode !== "reading" &&
        state.mode !== "tutoring" && <Report />}

      {wikiOpen && (
        <WikiModal nodeId={state.nodeId} onClose={() => setWikiOpen(false)} />
      )}
      {notesOpen && (
        <NoteModal nodeId={state.nodeId} onClose={() => setNotesOpen(false)} />
      )}
    </>
  );
}

export default function SessionPage() {
  return (
    <SessionProvider>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "var(--text3)", fontSize: 14 }}>
              로딩 중...
            </div>
          </div>
        }
      >
        <SessionContent />
      </Suspense>
    </SessionProvider>
  );
}
