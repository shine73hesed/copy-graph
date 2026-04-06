// frontend/components/chat/DiagramBlock.tsx
"use client";

import { useState, useEffect } from "react";

interface Props {
  diagramId: string;
}

export default function DiagramBlock({ diagramId }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch(`/diagrams/${encodeURIComponent(diagramId)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.text();
      })
      .then(setSvg)
      .catch(() => setError(true));
  }, [diagramId]);

  if (error) return null;
  if (!svg)
    return (
      <div
        style={{
          padding: "12px 16px",
          margin: "8px 0",
          background: "#f8f8fa",
          borderRadius: 10,
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        도표 로딩 중...
      </div>
    );

  // 도표 제목: ID에서 추출
  const title = diagramId
    .replace(/^(알츠하이머병|의사소통기법|배회|치매_개요)_/, "")
    .replace(/도표\d+_/, "")
    .replace(/_/g, " ");

  return (
    <div
      style={{
        margin: "12px 0",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        background: "white",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "#f8f8fa",
          border: "none",
          borderBottom: expanded ? "1px solid #e5e7eb" : "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#334155",
        }}
      >
        <span style={{ fontSize: 16 }}>📊</span>
        {title}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          {expanded ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>
      {expanded && (
        <div
          style={{ padding: 16, display: "flex", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
