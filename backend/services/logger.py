"""
ALE Phase 1 — 로깅 모듈
컬러 콘솔 출력 + 구조화된 헬퍼 함수
"""

import os
import logging
import traceback

# ── ANSI 컬러 코드 ──
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
RESET = "\033[0m"

LEVEL_COLORS = {
    logging.DEBUG: CYAN,
    logging.INFO: GREEN,
    logging.WARNING: YELLOW,
    logging.ERROR: RED,
}


class ColorFormatter(logging.Formatter):
    """레벨별 ANSI 컬러 포맷터"""

    def format(self, record):
        color = LEVEL_COLORS.get(record.levelno, RESET)
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        return (
            f"{color}[{timestamp}] {record.levelname:<7} | "
            f"{record.module} | {record.getMessage()}{RESET}"
        )


# ── 로거 초기화 ──
log_level_raw = os.environ.get("ALE_LOG_LEVEL", "DEBUG").upper()

# PRODUCTION 또는 OFF → WARNING (디버그 로그 억제)
if log_level_raw in ("PRODUCTION", "OFF"):
    log_level = logging.WARNING
else:
    log_level = getattr(logging, log_level_raw, logging.DEBUG)

logger = logging.getLogger("ale")
logger.setLevel(log_level)
logger.propagate = False

# 중복 핸들러 방지
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(ColorFormatter())
    logger.addHandler(handler)


# ── 헬퍼 함수 ──────────────────────────────────────────


def log_request(endpoint: str, data: dict):
    """수신 요청 로깅"""
    logger.info(f"→ {endpoint} | payload: {data}")


def log_response(endpoint: str, data: dict):
    """응답 로깅 — 큰 필드는 요약"""
    summary = {k: v for k, v in data.items() if k != "tutor_message"}
    if "tutor_message" in data:
        msg = data["tutor_message"]
        summary["tutor_message"] = f"{msg[:80]}..." if len(msg) > 80 else msg
    logger.info(f"← {endpoint} | response: {summary}")


def log_bkt(turn: int, score: float, mastery_before: float,
            mastery_after: float, smoothed: float, streak: int):
    """BKT 상태 로깅"""
    logger.debug(
        f"BKT T{turn} | score={score:.2f} | "
        f"mastery: {mastery_before:.3f}→{mastery_after:.3f} | "
        f"smoothed={smoothed:.3f} | streak={streak}"
    )


def log_zpd(zpd_position: str, struggle: str, score_history: list):
    """ZPD/Struggle 상태 로깅"""
    recent = score_history[-5:] if score_history else []
    recent_str = ", ".join(f"{s:.2f}" for s in recent)
    logger.debug(f"ZPD {zpd_position} | struggle={struggle} | recent=[{recent_str}]")


def log_gate(gate_a: bool, gate_b: bool, completed: bool):
    """완료 게이트 상태 로깅"""
    status = "COMPLETE" if completed else "진행중"
    a = "✓" if gate_a else "✗"
    b = "✓" if gate_b else "✗"
    logger.debug(f"GATE A={a} B={b} | {status}")


def log_score(answer_preview: str, score: float, score_source: str, brief: str):
    """채점 결과 로깅"""
    preview = answer_preview[:60] + "..." if len(answer_preview) > 60 else answer_preview
    logger.debug(f"SCORE [{score_source}] {score:.2f} | \"{preview}\" | {brief}")


def log_tutor(response_preview: str):
    """튜터 응답 미리보기 (100자)"""
    preview = response_preview[:100] + "..." if len(response_preview) > 100 else response_preview
    logger.debug(f"TUTOR | {preview}")


def log_error(context: str, error: Exception):
    """에러 로깅 + 트레이스백"""
    logger.error(f"ERROR in {context}: {error}\n{traceback.format_exc()}")


# ── 상세 수학/추론 로깅 ──────────────────────────────────


def log_bkt_math(turn: int, score: float, prev_mastery: float,
                 p_transit: float, p_slip: float, p_guess: float):
    """BKT 4단계 수식 전체를 로그로 출력"""
    p_l = prev_mastery
    s = p_slip
    g = p_guess
    t = p_transit

    # Step 1: 총 확률
    p_correct = p_l * (1 - s) + (1 - p_l) * g
    p_incorrect = p_l * s + (1 - p_l) * (1 - g)

    # Step 2: 베이즈 업데이트
    post_correct = p_l * (1 - s) / p_correct if p_correct > 0 else p_l
    post_incorrect = p_l * s / p_incorrect if p_incorrect > 0 else p_l

    # Step 3: 연속 보간
    posterior = score * post_correct + (1 - score) * post_incorrect

    # Step 4: 학습 전이
    new_mastery = posterior + (1 - posterior) * t
    diff = new_mastery - p_l
    sign = "+" if diff >= 0 else ""

    logger.debug(
        f"\n══ BKT MATH T{turn} ══\n"
        f"input: prev_mastery={p_l:.4f}, score={score:.2f}\n"
        f"params: p_transit={t}, p_slip={s}, p_guess={g}\n"
        f"\n"
        f"[Step 1] Total probability\n"
        f"p(correct)   = {p_l:.4f}×{1-s:.2f} + {1-p_l:.4f}×{g:.2f} = {p_correct:.4f}\n"
        f"p(incorrect) = {p_l:.4f}×{s:.2f} + {1-p_l:.4f}×{1-g:.2f} = {p_incorrect:.4f}\n"
        f"\n"
        f"[Step 2] Bayes update\n"
        f"post_correct   = {p_l:.4f}×{1-s:.2f} / {p_correct:.4f} = {post_correct:.4f}\n"
        f"post_incorrect = {p_l:.4f}×{s:.2f} / {p_incorrect:.4f} = {post_incorrect:.4f}\n"
        f"\n"
        f"[Step 3] Continuous interpolation\n"
        f"posterior = {score:.2f}×{post_correct:.4f} + {1-score:.2f}×{post_incorrect:.4f} = {posterior:.4f}\n"
        f"\n"
        f"[Step 4] Learning transition\n"
        f"new_mastery = {posterior:.4f} + {1-posterior:.4f}×{t} = {new_mastery:.4f}\n"
        f"\n"
        f"result: mastery {p_l:.4f} → {new_mastery:.4f} ({sign}{diff:.4f})\n"
        f"══════════════════"
    )


def log_scorer_input(node_id: str, mastery: float, answer: str,
                     rubric_preview: str, wiki_preview: str):
    """Claude 채점에 들어가는 입력을 로그로 출력"""
    logger.debug(
        f"\n── SCORER INPUT ──\n"
        f"node: {node_id} | mastery: {mastery:.2f}\n"
        f"answer: \"{answer}\"\n"
        f"rubric (first 200 chars): \"{rubric_preview[:200]}\"\n"
        f"wiki (first 200 chars): \"{wiki_preview[:200]}\"\n"
        f"──────────────────"
    )


def log_scorer_output(score: float, brief: str, raw_response: str):
    """Claude 채점 결과와 원본 응답을 로그로 출력"""
    logger.debug(
        f"\n── SCORER OUTPUT ──\n"
        f"score: {score} | brief: \"{brief}\"\n"
        f"raw claude response: \"{raw_response}\"\n"
        f"───────────────────"
    )


def log_tutor_context(node_id: str, role: str, mastery: float,
                      learning_state: str, wiki_length: int,
                      plan_length: int, history_length: int):
    """튜터 호출 시 어떤 컨텍스트가 들어가는지 로그"""
    logger.debug(
        f"\n── TUTOR CONTEXT ──\n"
        f"node: {node_id} | role: {role} | mastery: {mastery:.2f}\n"
        f"wiki_doc: {wiki_length} chars\n"
        f"plan_guide: {plan_length} chars\n"
        f"conversation_history: {history_length} messages\n"
        f"learning_state:\n{learning_state}\n"
        f"───────────────────"
    )


def log_zpd_math(mastery: float, recent_scores: list, zpd: str, struggle: str):
    """ZPD 판별 과정을 상세히 로그"""
    length = len(recent_scores)
    last_5 = recent_scores[-5:] if recent_scores else []
    last_5_str = ", ".join(f"{s:.2f}" for s in last_5)

    if length >= 3:
        avg = sum(last_5) / len(last_5)
        var = sum((s - avg) ** 2 for s in last_5) / len(last_5)
    else:
        avg = 0.0
        var = 0.0

    # ZPD 조건 판별
    below_check = mastery >= 0.7 and avg >= 0.7
    above_check = mastery < 0.2 and avg < 0.3 and var < 0.02

    # Struggle 계산
    last_3 = recent_scores[-3:] if length >= 3 else []
    last_3_str = ", ".join(f"{s:.2f}" for s in last_3)
    if length >= 3:
        s_trend = last_3[-1] - last_3[0]
        s_avg = sum(last_3) / 3
    else:
        s_trend = 0.0
        s_avg = 0.0

    jump = (recent_scores[-1] - recent_scores[-2]) if length >= 2 else 0.0

    logger.debug(
        f"\n── ZPD MATH ──\n"
        f"scores: {recent_scores}\n"
        f"len={length} (need >=3 for detection)\n"
        f"last_5: [{last_5_str}]\n"
        f"avg: {avg:.4f}, var: {var:.4f}\n"
        f"\n"
        f"ZPD check:\n"
        f"  mastery({mastery:.3f}) >= 0.7 AND avg({avg:.3f}) >= 0.7? → {below_check} (below_zpd)\n"
        f"  mastery({mastery:.3f}) < 0.2 AND avg({avg:.3f}) < 0.3 AND var({var:.4f}) < 0.02? → {above_check} (above_zpd)\n"
        f"  else → in_zpd\n"
        f"→ zpd: {zpd}\n"
        f"\n"
        f"Struggle check:\n"
        f"  last_3: [{last_3_str}]\n"
        f"  trend: {s_trend:.2f}, avg: {s_avg:.2f}\n"
        f"  jump: {jump:.2f}\n"
        f"→ struggle: {struggle}\n"
        f"──────────────"
    )


def log_gate_detail(smoothed: float, streak: int, turns: int,
                    gate_a: bool, tutor_has_complete: bool,
                    gate_b: bool, completed: bool):
    """게이트 판정 과정 상세"""
    cond_smooth = smoothed >= 0.80
    cond_streak = streak >= 3
    cond_turns = turns >= 4
    met_count = sum([cond_smooth, cond_streak, cond_turns])

    logger.debug(
        f"\n── GATE DETAIL ──\n"
        f"Gate A conditions:\n"
        f"  smoothed({smoothed:.3f}) >= 0.80? {'yes' if cond_smooth else 'no'}\n"
        f"  streak({streak}) >= 3? {'yes' if cond_streak else 'no'}\n"
        f"  turns({turns}) >= 4? {'yes' if cond_turns else 'no'}\n"
        f"→ gate_a: {gate_a} ({met_count}/3 met)\n"
        f"\n"
        f"Gate B:\n"
        f"  [TOPIC_COMPLETE] in response? {'yes' if tutor_has_complete else 'no'}\n"
        f"→ gate_b: {gate_b}\n"
        f"\n"
        f"completed = A AND B = {completed}\n"
        f"─────────────────"
    )
