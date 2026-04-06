"""
ALE v8 — 세션 상태 전이 (State Machine)

세션 흐름: pre_test → learning_(reading|tutoring) → post_test → completed → retention_pending → retention_test
"""

import time

VALID_TRANSITIONS = {
    "pre_test": ["learning_reading", "learning_tutoring"],
    "learning_reading": ["post_test"],
    "learning_tutoring": ["post_test"],
    "post_test": ["completed"],
    "completed": ["retention_pending"],
    "retention_pending": ["retention_test"],
    "retention_test": ["completed"],
}


def can_transition(current: str, target: str) -> bool:
    """현재 상태에서 target 상태로 전이 가능한지 확인."""
    return target in VALID_TRANSITIONS.get(current, [])


def transition(session: dict, target: str) -> dict:
    """세션 상태를 target으로 전이. 불가능하면 ValueError.

    Args:
        session: 인메모리 세션 dict (status 필드 필수)
        target: 전이할 상태

    Returns:
        업데이트된 session dict

    Raises:
        ValueError: 유효하지 않은 전이
    """
    current = session.get("status", "")
    if not can_transition(current, target):
        raise ValueError(
            f"Invalid transition: {current} → {target}. "
            f"Allowed: {VALID_TRANSITIONS.get(current, [])}"
        )

    session["status"] = target
    session["status_changed_at"] = time.time()

    # 학습 시작 시점 기록
    if target.startswith("learning_"):
        session["learning_started_at"] = time.time()

    # 학습 종료 → post_test 전이 시 학습 시간 계산
    if target == "post_test" and session.get("learning_started_at"):
        session["learning_ended_at"] = time.time()
        session["learning_duration_sec"] = int(
            session["learning_ended_at"] - session["learning_started_at"]
        )

    return session


def get_learning_target(mode: str) -> str:
    """mode에 대응하는 learning 상태 반환.

    Args:
        mode: 'reading' | 'tutoring'

    Returns:
        'learning_reading' | 'learning_tutoring'
    """
    return f"learning_{mode}"
