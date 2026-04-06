"use client";

import CategoryAccordion from "./CategoryAccordion";
import type { KGNode, SessionListItem } from "@/lib/types";

interface Props {
  nodes: KGNode[];
  sessions: SessionListItem[];
  lastSession: SessionListItem | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, label: string) => void;
  onBack: () => void;
  onContinueLearning: () => void;
  description?: string;
}

export default function CourseDetail({
  nodes,
  sessions,
  lastSession,
  selectedNodeId,
  onSelectNode,
  onBack,
  onContinueLearning,
  description,
}: Props) {
  // Group by category
  const cats: Record<string, KGNode[]> = {};
  nodes.forEach((n) => {
    const c = n.category || "기타";
    if (!cats[c]) cats[c] = [];
    cats[c].push(n);
  });

  // 완료된 노드 ID set (sessions 기반)
  const completedNodeIds = new Set(
    sessions
      .filter((s) => s.completed || s.post_score != null)
      .map((s) => s.node_id),
  );

  return (
    <div>
      {/* Back button */}
      <div
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text3)",
          cursor: "pointer",
          marginBottom: 20,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          arrow_back
        </span>
        돌아가기
      </div>

      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          치매 케어 간호 교육
        </h1>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
          {description ||
            "치매의 정의, 분류, 병태생리, 임상증상, 진단, 약물/비약물 치료, 간호 중재를 포괄하는 통합 교육과정"}
        </p>
      </div>

      {/* Continue learning card */}
      {lastSession && !lastSession.completed && (
        <div className="continue-card" onClick={onContinueLearning}>
          <div
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              background: "rgba(255,255,255,0.08)",
              borderRadius: "50%",
              right: -60,
              top: -60,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.8,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              이어서 학습하기
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
              {lastSession.node_id}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.25)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    background: "white",
                    width: "0%",
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {lastSession.total_turns || 0} turns
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Category list */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>과목 목록</h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)" }}>
          {nodes.length}개 과목
        </span>
      </div>

      {Object.keys(cats)
        .sort()
        .map((cat) => (
          <CategoryAccordion
            key={cat}
            category={cat}
            nodes={cats[cat]}
            completedNodeIds={completedNodeIds}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
    </div>
  );
}
