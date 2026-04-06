// frontend/app/admin/test-items/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface TestItem {
  item_id: string;
  node_id: string;
  form: string;
  item_type: string;
  bloom_level: string;
  question: string;
  rubric?: any;
  correct?: string;
  options?: string[];
}

interface NodeInfo {
  node_id: string;
  form_A: number;
  form_B: number;
}

const BLOOM_KR: Record<string, string> = {
  remember: "기억",
  understand: "이해",
  apply: "적용",
  analyze: "분석",
  evaluate: "평가",
  create: "창조",
};

const API = (path: string, opts?: RequestInit) =>
  fetch(path.replace("/admin/", "/api/admin/"), {
    credentials: "same-origin",
    ...opts,
  }).then((r) => r.json());

export default function AdminTestItems() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedForm, setSelectedForm] = useState("A");
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<TestItem>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);

  // 노드 목록
  useEffect(() => {
    API("/admin/nodes").then((r) => setNodes(r.nodes || []));
  }, []);

  // 문항 로드
  const loadItems = useCallback(async () => {
    if (!selectedNode) return;
    setLoading(true);
    const r = await API(
      `/admin/test-items?node_id=${encodeURIComponent(selectedNode)}&form=${selectedForm}`,
    );
    setItems(r.items || []);
    setLoading(false);
  }, [selectedNode, selectedForm]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 수정
  const startEdit = (item: TestItem) => {
    setEditingId(item.item_id);
    let opts = item.options;
    if (typeof opts === "string") {
      try {
        opts = JSON.parse(opts);
      } catch {}
    }
    setEditData({ ...item, options: opts as any, _existing: true } as any);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    // 새 문항(DB에 없는)이면 POST, 기존이면 PUT
    const isNew = !editData._existing;
    if (isNew) {
      await API("/admin/test-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editData,
          item_id: editingId,
          node_id: selectedNode,
          form: selectedForm,
        }),
      });
    } else {
      await API(`/admin/test-items/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
    }
    setEditingId(null);
    setMessage("저장 완료");
    loadItems();
    API("/admin/nodes").then((r) => setNodes(r.nodes || []));
    setTimeout(() => setMessage(""), 2000);
  };

  // 삭제
  const deleteItem = async (itemId: string) => {
    if (!confirm(`"${itemId}" 문항을 삭제하시겠습니까?`)) return;
    await API(`/admin/test-items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    setMessage("삭제 완료");
    loadItems();
    setTimeout(() => setMessage(""), 2000);
  };

  // 재생성
  const regenerate = async () => {
    if (!selectedNode) return;
    if (
      !confirm(
        `${selectedNode} form=${selectedForm}의 기존 문항을 모두 삭제하고 LLM으로 새로 생성합니다.\n계속하시겠습니까?`,
      )
    )
      return;
    setRegenerating(true);
    const r = await API("/admin/test-items/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: selectedNode, form: selectedForm }),
    });
    setRegenerating(false);
    setMessage(`재생성 완료: ${r.deleted}개 삭제 → ${r.generated}개 생성`);
    loadItems();
    API("/admin/nodes").then((r) => setNodes(r.nodes || []));
    setTimeout(() => setMessage(""), 3000);
  };

  // JSON 일괄 등록
  const handleImport = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      const r = await API("/admin/test-items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setMessage(
        `등록 완료: 사전 ${r.pre_test}문항, 사후 ${r.post_test}문항${r.errors?.length ? ` (오류 ${r.errors.length}건)` : ""}`,
      );
      setImportJson("");
      setShowImport(false);
      API("/admin/nodes").then((r) => setNodes(r.nodes || []));
      if (r.node_id) {
        setSelectedNode(r.node_id);
      }
      loadItems();
    } catch (e: any) {
      setMessage(`오류: ${e.message}`);
    }
    setImporting(false);
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f8fa",
        fontFamily: "var(--sans, sans-serif)",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/dashboard"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ← 대시보드
          </a>
          <span style={{ color: "#e5e7eb" }}>|</span>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            평가 문항 관리
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {message && (
            <div
              style={{
                padding: "6px 16px",
                background: "#ecfdf5",
                color: "#059669",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}
          <button
            onClick={() => setShowImport(true)}
            style={{
              padding: "8px 16px",
              background: "#4f6af6",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            📋 JSON 등록
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          maxWidth: 1200,
          margin: "0 auto",
          padding: 20,
          gap: 20,
        }}
      >
        {/* 좌측: 노드 목록 */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#64748b",
                marginBottom: 12,
              }}
            >
              노드 목록
            </h3>
            {nodes.length === 0 && (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>등록된 문항 없음</p>
            )}
            {nodes.map((n) => (
              <div
                key={n.node_id}
                onClick={() => setSelectedNode(n.node_id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  marginBottom: 4,
                  background:
                    n.node_id === selectedNode ? "#fff4ed" : "transparent",
                  border:
                    n.node_id === selectedNode
                      ? "1px solid #ec5b13"
                      : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.node_id}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#b0b0b0",
                    fontFamily: "monospace",
                    marginTop: 1,
                    cursor: "copy",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(n.node_id);
                    setMessage(`"${n.node_id}" 복사됨`);
                    setTimeout(() => setMessage(""), 1500);
                  }}
                  title="클릭하여 node_id 복사"
                >
                  node_id: {n.node_id}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  A: {n.form_A}문항 · B: {n.form_B}문항
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 문항 목록 */}
        <div style={{ flex: 1 }}>
          {!selectedNode ? (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 60,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              좌측에서 노드를 선택하세요
            </div>
          ) : (
            <>
              {/* 도구 모음 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                    {selectedNode}
                  </h2>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#b0b0b0",
                      fontFamily: "monospace",
                      cursor: "copy",
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(selectedNode);
                      setMessage(`"${selectedNode}" 복사됨`);
                      setTimeout(() => setMessage(""), 1500);
                    }}
                    title="클릭하여 복사"
                  >
                    node_id: {selectedNode}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    background: "#f0f0f5",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {["A", "B"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setSelectedForm(f)}
                      style={{
                        padding: "8px 20px",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        background:
                          selectedForm === f ? "#ec5b13" : "transparent",
                        color: selectedForm === f ? "white" : "#64748b",
                        transition: "all 0.15s",
                      }}
                    >
                      Form {f} ({f === "A" ? "사전" : "사후"})
                    </button>
                  ))}
                </div>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  style={{
                    padding: "8px 16px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: regenerating ? 0.5 : 1,
                  }}
                >
                  {regenerating ? "생성 중..." : "🔄 재생성"}
                </button>
                <button
                  onClick={() => {
                    const newId = `${selectedNode}_${selectedForm}_${String(items.length + 1).padStart(2, "0")}`;
                    const newItem: TestItem = {
                      item_id: newId,
                      node_id: selectedNode,
                      form: selectedForm,
                      item_type: "mcq",
                      bloom_level: "remember",
                      question: "",
                      correct: "",
                      options: ["A. ", "B. ", "C. ", "D. "],
                    };
                    setItems((prev) => [...prev, newItem]);
                    setEditingId(newId);
                    setEditData(newItem);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + 문항 추가
                </button>
              </div>

              {/* 문항 카드들 */}
              {loading ? (
                <div
                  style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}
                >
                  로딩 중...
                </div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 40,
                    textAlign: "center",
                  }}
                >
                  <p style={{ color: "#94a3b8", marginBottom: 12 }}>
                    문항이 없습니다
                  </p>
                  <button
                    onClick={regenerate}
                    style={{
                      padding: "10px 20px",
                      background: "#ec5b13",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    교재 기반 자동 생성
                  </button>
                </div>
              ) : (
                items.map((item, idx) => {
                  const isEditing = editingId === item.item_id;
                  return (
                    <div
                      key={item.item_id}
                      style={{
                        background: "white",
                        borderRadius: 12,
                        padding: 20,
                        marginBottom: 12,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        border: isEditing
                          ? "2px solid #ec5b13"
                          : "1px solid #f0f0f5",
                      }}
                    >
                      {/* 헤더 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: "white",
                            background: "#ec5b13",
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#f0f0f5",
                            color: "#64748b",
                          }}
                        >
                          {BLOOM_KR[item.bloom_level] || item.bloom_level}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {item.item_type}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#c4c4c4",
                            fontFamily: "monospace",
                          }}
                        >
                          {item.item_id}
                        </span>
                        <div style={{ flex: 1 }} />
                        {!isEditing ? (
                          <>
                            <button
                              disabled={idx === 0}
                              onClick={() => {
                                const newItems = [...items];
                                [newItems[idx - 1], newItems[idx]] = [
                                  newItems[idx],
                                  newItems[idx - 1],
                                ];
                                setItems(newItems);
                              }}
                              title="위로"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: idx === 0 ? "not-allowed" : "pointer",
                                color: idx === 0 ? "#d1d5db" : "#94a3b8",
                                fontSize: 18,
                                padding: "0 2px",
                                lineHeight: 1,
                              }}
                            >
                              ↑
                            </button>
                            <button
                              disabled={idx === items.length - 1}
                              onClick={() => {
                                const newItems = [...items];
                                [newItems[idx], newItems[idx + 1]] = [
                                  newItems[idx + 1],
                                  newItems[idx],
                                ];
                                setItems(newItems);
                              }}
                              title="아래로"
                              style={{
                                background: "none",
                                border: "none",
                                cursor:
                                  idx === items.length - 1
                                    ? "not-allowed"
                                    : "pointer",
                                color:
                                  idx === items.length - 1
                                    ? "#d1d5db"
                                    : "#94a3b8",
                                fontSize: 18,
                                padding: "0 2px",
                                lineHeight: 1,
                              }}
                            >
                              ↓
                            </button>
                            <span
                              style={{
                                width: 1,
                                height: 16,
                                background: "#e5e7eb",
                                margin: "0 4px",
                              }}
                            />
                            <button
                              onClick={() => startEdit(item)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#3b82f6",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => deleteItem(item.item_id)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              삭제
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={saveEdit}
                              style={{
                                background: "#22c55e",
                                color: "white",
                                border: "none",
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              저장
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{
                                background: "#94a3b8",
                                color: "white",
                                border: "none",
                                padding: "4px 12px",
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              취소
                            </button>
                          </>
                        )}
                      </div>

                      {/* 문항 내용 */}
                      {isEditing ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <label
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#64748b",
                            }}
                          >
                            문항
                          </label>
                          <textarea
                            value={editData.question || ""}
                            onChange={(e) =>
                              setEditData((p) => ({
                                ...p,
                                question: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              minHeight: 80,
                              padding: 12,
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              fontSize: 13,
                              fontFamily: "inherit",
                              resize: "vertical",
                            }}
                          />
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <label
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#64748b",
                                }}
                              >
                                Bloom
                              </label>
                              <select
                                value={editData.bloom_level || "remember"}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    bloom_level: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "100%",
                                  padding: 8,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  fontSize: 13,
                                }}
                              >
                                {Object.entries(BLOOM_KR).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v} ({k})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#64748b",
                                }}
                              >
                                유형
                              </label>
                              <select
                                value={editData.item_type || "short_answer"}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    item_type: e.target.value,
                                  }))
                                }
                                style={{
                                  width: "100%",
                                  padding: 8,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  fontSize: 13,
                                }}
                              >
                                <option value="mcq">MCQ</option>
                                <option value="short_answer">서술형</option>
                              </select>
                            </div>
                          </div>
                          {editData.item_type === "mcq" && (
                            <div>
                              <label
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#64748b",
                                  marginBottom: 6,
                                  display: "block",
                                }}
                              >
                                선택지 (정답 클릭)
                              </label>
                              {(() => {
                                let opts: string[] = [];
                                if (Array.isArray(editData.options))
                                  opts = editData.options;
                                else if (typeof editData.options === "string") {
                                  try {
                                    opts = JSON.parse(editData.options);
                                  } catch {}
                                }
                                return (
                                  <>
                                    {opts.map((opt, oi) => (
                                      <div
                                        key={oi}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          marginBottom: 4,
                                        }}
                                      >
                                        <button
                                          onClick={() =>
                                            setEditData((p) => ({
                                              ...p,
                                              correct: opt,
                                            }))
                                          }
                                          style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: "50%",
                                            border:
                                              opt === editData.correct
                                                ? "2px solid #14b8a6"
                                                : "2px solid #d1d5db",
                                            background:
                                              opt === editData.correct
                                                ? "#14b8a6"
                                                : "white",
                                            cursor: "pointer",
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "white",
                                            fontSize: 11,
                                          }}
                                        >
                                          {opt === editData.correct ? "✓" : ""}
                                        </button>
                                        <input
                                          value={opt}
                                          onChange={(e) => {
                                            const newOpts = [...opts];
                                            const wasCorrect =
                                              newOpts[oi] === editData.correct;
                                            newOpts[oi] = e.target.value;
                                            setEditData((p) => ({
                                              ...p,
                                              options: newOpts,
                                              ...(wasCorrect
                                                ? { correct: e.target.value }
                                                : {}),
                                            }));
                                          }}
                                          style={{
                                            flex: 1,
                                            padding: "6px 10px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: 6,
                                            fontSize: 13,
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            const newOpts = opts.filter(
                                              (_, i) => i !== oi,
                                            );
                                            setEditData((p) => ({
                                              ...p,
                                              options: newOpts,
                                            }));
                                          }}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            color: "#ef4444",
                                            cursor: "pointer",
                                            fontSize: 16,
                                            padding: 0,
                                          }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() =>
                                        setEditData((p) => ({
                                          ...p,
                                          options: [
                                            ...opts,
                                            `${String.fromCharCode(65 + opts.length)}. `,
                                          ],
                                        }))
                                      }
                                      style={{
                                        marginTop: 4,
                                        padding: "4px 12px",
                                        background: "#f0f0f5",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "#64748b",
                                        cursor: "pointer",
                                      }}
                                    >
                                      + 선택지 추가
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          <div>
                            <label
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#64748b",
                              }}
                            >
                              Rubric (JSON)
                            </label>
                            <textarea
                              value={
                                typeof editData.rubric === "string"
                                  ? editData.rubric
                                  : JSON.stringify(editData.rubric, null, 2) ||
                                    ""
                              }
                              onChange={(e) => {
                                try {
                                  setEditData((p) => ({
                                    ...p,
                                    rubric: JSON.parse(e.target.value),
                                  }));
                                } catch {
                                  setEditData((p) => ({
                                    ...p,
                                    rubric: e.target.value,
                                  }));
                                }
                              }}
                              style={{
                                width: "100%",
                                minHeight: 100,
                                padding: 12,
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                fontSize: 11,
                                fontFamily: "monospace",
                                resize: "vertical",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            style={{
                              fontSize: 14,
                              lineHeight: 1.7,
                              color: "#1a1a2e",
                              marginBottom: 8,
                            }}
                          >
                            {item.question}
                          </p>
                          {item.item_type === "mcq" && (
                            <div style={{ marginBottom: 8 }}>
                              {(() => {
                                let opts: string[] = [];
                                if (Array.isArray(item.options))
                                  opts = item.options;
                                else if (typeof item.options === "string") {
                                  try {
                                    opts = JSON.parse(item.options);
                                  } catch {}
                                }
                                return opts.map((opt, oi) => (
                                  <div
                                    key={oi}
                                    style={{
                                      padding: "8px 12px",
                                      marginBottom: 4,
                                      borderRadius: 8,
                                      fontSize: 13,
                                      background:
                                        opt === item.correct
                                          ? "#ecfdf5"
                                          : "#f8f8fa",
                                      border:
                                        opt === item.correct
                                          ? "1px solid #14b8a6"
                                          : "1px solid #f0f0f5",
                                      color:
                                        opt === item.correct
                                          ? "#065f46"
                                          : "#334155",
                                      fontWeight:
                                        opt === item.correct ? 600 : 400,
                                    }}
                                  >
                                    {opt === item.correct && "✓ "}
                                    {opt}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                          {item.rubric && (
                            <details style={{ marginTop: 8 }}>
                              <summary
                                style={{
                                  fontSize: 11,
                                  color: "#94a3b8",
                                  cursor: "pointer",
                                }}
                              >
                                Rubric 보기
                              </summary>
                              <pre
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  background: "#f8f8fa",
                                  padding: 10,
                                  borderRadius: 6,
                                  marginTop: 6,
                                  overflow: "auto",
                                  maxHeight: 200,
                                }}
                              >
                                {JSON.stringify(item.rubric, null, 2)}
                              </pre>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* JSON Import 모달 */}
      {showImport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              width: "90%",
              maxWidth: 700,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                JSON 문항 일괄 등록
              </h2>
              <button
                onClick={() => setShowImport(false)}
                style={{
                  width: 32,
                  height: 32,
                  border: "none",
                  background: "#f0f0f5",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 20, flex: 1, overflow: "auto" }}>
              <p
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 12,
                  lineHeight: 1.6,
                }}
              >
                사전/사후 평가 문항을 JSON으로 한번에 등록합니다.{" "}
                <code>node_id</code> 필드로 과목을 지정하세요.
                <br />
                <code>pre_test.items</code>는 form=A,{" "}
                <code>post_test.items</code>는 form=B로 저장됩니다.
              </p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"node_id": "치매_개요", "pre_test": {"items": [...]}, "post_test": {"items": [...]}}'
                style={{
                  width: "100%",
                  minHeight: 350,
                  padding: 14,
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: "monospace",
                  lineHeight: 1.5,
                  resize: "vertical",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4f6af6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowImport(false)}
                style={{
                  padding: "10px 20px",
                  background: "#f0f0f5",
                  color: "#64748b",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importJson.trim()}
                style={{
                  padding: "10px 24px",
                  background: "#4f6af6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: importing ? "not-allowed" : "pointer",
                  opacity: importing || !importJson.trim() ? 0.5 : 1,
                }}
              >
                {importing ? "등록 중..." : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
