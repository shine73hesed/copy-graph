"""
ALE Phase 1 — 연속 보간 BKT 엔진
binary correct/incorrect 대신 0.0~1.0 연속 score로 mastery 업데이트
"""

# ── BKT 기본 파라미터 ──
P_INIT = 0.05       # 초기 mastery (첫 턴 전)
P_TRANSIT = 0.08    # 학습 전이 확률
P_SLIP = 0.10       # 알면서 틀릴 확률
P_GUESS = 0.25      # 모르면서 맞출 확률


def update_continuous(prev_mastery: float, score: float,
                      p_transit: float = None, p_slip: float = None,
                      p_guess: float = None) -> dict:
    """연속 보간 BKT 업데이트 — score(0.0~1.0)를 correct 가중치로 사용

    기존 binary BKT:
      P(L|correct)  = P(L) * (1-slip) / P(correct)
      P(L|incorrect) = P(L) * slip / P(incorrect)

    연속 보간:
      posterior = score * P(L|correct) + (1-score) * P(L|incorrect)
      new_mastery = posterior + (1-posterior) * transit

    p_transit, p_slip, p_guess: 노드별 파라미터. None이면 모듈 기본값 사용.
    """
    # 노드별 파라미터 또는 기본값
    t = p_transit if p_transit is not None else P_TRANSIT
    s = p_slip if p_slip is not None else P_SLIP
    g = p_guess if p_guess is not None else P_GUESS

    p_l = prev_mastery

    # 관찰 확률 계산
    p_correct = p_l * (1 - s) + (1 - p_l) * g
    p_incorrect = p_l * s + (1 - p_l) * (1 - g)

    # 사후 확률 — correct/incorrect 양쪽을 score로 보간
    posterior_correct = p_l * (1 - s) / p_correct if p_correct > 0 else p_l
    posterior_incorrect = p_l * s / p_incorrect if p_incorrect > 0 else p_l
    posterior = score * posterior_correct + (1 - score) * posterior_incorrect

    # 학습 전이 적용
    new_mastery = posterior + (1 - posterior) * t

    return {
        "mastery": round(new_mastery, 4),
        "p_correct": round(p_correct, 4),
        "p_posterior": round(posterior, 4),
    }


def smoothed_mastery(mastery_history: list, window: int = 3) -> float:
    """최근 window개 mastery의 이동 평균"""
    if not mastery_history:
        return 0.0
    recent = mastery_history[-window:]
    return round(sum(recent) / len(recent), 4)


def is_node_ready_to_complete(smoothed: float, streak: int, turns: int) -> bool:
    """Gate A 완료 판정: 세 조건 모두 충족해야 통과
    - smoothed mastery >= 0.80
    - 연속 고득점 streak >= 3
    - 최소 턴 수 >= 4
    """
    return smoothed >= 0.80 and streak >= 3 and turns >= 4
