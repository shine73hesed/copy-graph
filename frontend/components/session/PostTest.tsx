// frontend/components/session/PostTest.tsx
"use client";

import { useState, useRef } from "react";
import SegmentProgress from "@/components/test/SegmentProgress";
import QuizCard from "@/components/test/QuizCard";
import { useSessionContext } from "./SessionProvider";
import type { TestResponse } from "@/lib/types";

export default function PostTest() {
  const { state, submitTest, setPhase } = useSessionContext();
  const items = state.postTestItems;
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const startTimes = useRef<Record<string, number>>({});

  // #5: 종료 → 대화 화면으로 돌아감 (gate 완료 상태 유지, DoneCard 다시 표시)
  const handleExit = () => {
    if (
      confirm("사후 평가를 중단하시겠습니까?\n대화 학습 화면으로 돌아갑니다.")
    ) {
      setPhase("learning_tutoring");
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
            사후 평가 문항이 없습니다.
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12 }}>
            잠시 후 보고서로 이동합니다.
          </div>
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
      await submitTest("post_test", testResponses);
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
        phaseLabel="사후 평가"
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
