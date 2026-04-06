"use client";

import type { SessionListItem, KGNode } from "@/lib/types";

interface Props {
  completed: number;
  total: number;
  totalTurns: number;
  avgTime: string;
  costStr: string;
  sessions: SessionListItem[];
  nextNode: KGNode | null;
  onRestoreSession: (sid: string, nodeId: string) => void;
  onStartRecommended: () => void;
}

export default function RightSidebar({
  completed,
  total,
  totalTurns,
  avgTime,
  costStr,
  sessions,
  nextNode,
  onRestoreSession,
  onStartRecommended,
}: Props) {
  return (
    <aside
      className="dash-aside"
      style={{
        width: 360,
        borderLeft: "1px solid var(--border)",
        background: "var(--white)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "28px 24px", flex: 1, overflowY: "auto" }}>
        {/* Avatar */}
        <div
          style={{ textAlign: "center", marginBottom: 20 }}
          className="anim a2"
        >
          <img
            src="/images/avatar_m_1.svg"
            alt="avatar"
            style={{ width: 100, height: 100 }}
          />
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
          className="anim a3"
        >
          <StatBox label="완료" value={`${completed}/${total}`} />
          <StatBox label="총 턴" value={String(totalTurns)} />
          <StatBox label="평균 세션 시간" value={avgTime} />
          <StatBox label="비용" value={costStr} />
        </div>

        {/* Recent sessions */}
        <div className="anim a4">
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: 12,
            }}
          >
            최근 학습 기록
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {sessions.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--text3)",
                }}
              >
                기록 없음
              </div>
            ) : (
              sessions.slice(0, 6).map((s) => {
                const done = !!s.completed;
                const co = done ? "var(--teal)" : "var(--primary)";
                const bg = done ? "var(--teal-bg)" : "var(--primary-light)";
                return (
                  <div
                    key={s.id}
                    className="sess-row"
                    onClick={() => onRestoreSession(s.id, s.node_id)}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ color: co, fontSize: 18 }}
                      >
                        {done ? "check_circle" : "chat"}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.node_id}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>
                        {s.total_turns || 0}턴
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recommendation */}
        {nextNode && (
          <div
            onClick={onStartRecommended}
            style={{
              marginTop: 24,
              background: "linear-gradient(135deg, #ec5b13, #ff8b5a)",
              borderRadius: 20,
              padding: 22,
              color: "white",
              cursor: "pointer",
            }}
            className="anim a5"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                trending_up
              </span>
              <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
                다음 추천
              </h3>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
              {nextNode.label || nextNode.id}
            </p>
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              탭하여 학습 시작
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--primary-light)",
        borderRadius: 16,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)" }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--primary)",
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
