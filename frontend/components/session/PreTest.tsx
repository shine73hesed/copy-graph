// frontend/components/session/PreTest.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SegmentProgress from "@/components/test/SegmentProgress";
import QuizCard from "@/components/test/QuizCard";
import { useSessionContext } from "./SessionProvider";
import type { TestResponse } from "@/lib/types";

export default function PreTest() {
  const { state, submitTest } = useSessionContext();
  const router = useRouter();
  const items = state.preTestItems;
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const startTimes = useRef<Record<string, number>>({});

  // #5: 나가기 → 디테일 페이지로
  const handleExit = () => {
    if (
      confirm("사전 평가를 중단하시겠습니까?\n진행 상황이 저장되지 않습니다.")
    ) {
      // 디테일 페이지 포커싱 복원
      sessionStorage.setItem("ale_show_detail", "1");
      if (state.nodeId) sessionStorage.setItem("ale_focus_node", state.nodeId);
      router.push("/dashboard");
    }
  };

  if (items.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "var(--text3)", fontSize: 14, marginBottom: 8 }}>
            사전 평가 문항이 없습니다.
          </div>
          <div
            style={{ color: "var(--text3)", fontSize: 12, marginBottom: 20 }}
          >
            이 노드에 등록된 평가 문항이 아직 없습니다.
          </div>
          <button
            className="btn-secondary"
            onClick={() => router.push("/dashboard")}
          >
            대시보드로
          </button>
        </div>
      </div>
    );
  }

  const item = items[current];
  if (!startTimes.current[item.item_id])
    startTimes.current[item.item_id] = Date.now();

  const handleChange = (value: string) =>
    setResponses((prev) => ({ ...prev, [item.item_id]: value }));
  const isLast = current === items.length - 1;

  const handleNext = async () => {
    if (isLast) {
      const testResponses: TestResponse[] = items.map((it) => ({
        item_id: it.item_id,
        response: responses[it.item_id] ?? "",
        elapsed_sec: startTimes.current[it.item_id]
          ? (Date.now() - startTimes.current[it.item_id]) / 1000
          : undefined,
      }));
      await submitTest("pre_test", testResponses);
    } else {
      setCurrent((prev) => prev + 1);
    }
  };

  const answered = !!(responses[item.item_id] ?? "").trim();

  return (
    <div className="quiz-layout">
      <SegmentProgress total={items.length} current={current} />

      <div className="quiz-nav" style={{ padding: "16px 28px 0" }}>
        {current > 0 ? (
          <button
            className="quiz-prev"
            onClick={() => setCurrent((prev) => prev - 1)}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18 }}
            >
              arrow_back
            </span>
            이전
          </button>
        ) : (
          <button className="quiz-prev" onClick={handleExit}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18 }}
            >
              close
            </span>
            나가기
          </button>
        )}
        <div />
      </div>

      <QuizCard
        item={item}
        index={current}
        total={items.length}
        phaseLabel="사전 평가"
        value={responses[item.item_id] ?? ""}
        onChange={handleChange}
      />

      <div className="quiz-footer">
        <button
          className="quiz-next"
          onClick={handleNext}
          disabled={!answered || state.loading}
        >
          {isLast ? "제출" : "다음 문항"}
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
