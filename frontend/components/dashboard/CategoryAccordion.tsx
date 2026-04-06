// frontend/components/dashboard/CategoryAccordion.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { CAT_COLORS } from "@/lib/constants";
import type { KGNode } from "@/lib/types";

interface Props {
  category: string;
  nodes: KGNode[];
  completedNodeIds: Set<string>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string, label: string) => void;
}

export default function CategoryAccordion({
  category,
  nodes,
  completedNodeIds,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const hasSelected = selectedNodeId
    ? nodes.some((n) => n.id === selectedNodeId)
    : false;
  const [open, setOpen] = useState(hasSelected);
  const color = CAT_COLORS[category] || "var(--text3)";
  // sessions 기반 완료 카운트
  const doneCount = nodes.filter((n) => completedNodeIds.has(n.id)).length;

  // selectedNodeId가 이 카테고리에 속하면 자동 열림
  useEffect(() => {
    if (selectedNodeId && nodes.some((n) => n.id === selectedNodeId)) {
      setOpen(true);
    }
  }, [selectedNodeId, nodes]);

  return (
    <div className="cat-section">
      <div
        className={`cat-header ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{category}</span>
          <span
            style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}
          >
            {doneCount}/{nodes.length}
          </span>
        </div>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: "var(--text3)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "",
          }}
        >
          expand_more
        </span>
      </div>

      <div className={`cat-nodes ${open ? "open" : ""}`}>
        {nodes.map((n) => {
          const isDone = completedNodeIds.has(n.id);
          const isSelected = n.id === selectedNodeId;
          const dotCls = isDone ? "done" : isSelected ? "progress" : "pending";

          return (
            <div
              key={n.id}
              ref={(el) => {
                if (isSelected && el) {
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
              className={`node-row ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectNode(n.id, n.label || n.id)}
            >
              <span className={`node-dot ${dotCls}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {n.label || n.id}
                </div>
                {n.depth !== undefined && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      marginTop: 2,
                    }}
                  >
                    depth {n.depth}
                  </div>
                )}
              </div>
              {isDone && (
                <span
                  className="node-badge"
                  style={{ background: "var(--teal-bg)", color: "var(--teal)" }}
                >
                  완료
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
