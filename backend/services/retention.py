"""
ALE v8 — SM-2 기반 Retention 스케줄러

SuperMemo SM-2 알고리즘으로 복습 간격을 계산.
Post-test 완료 후 retention_schedule에 첫 스케줄을 생성하고,
Retention test 결과에 따라 간격을 조정.
"""


def calculate_next_interval(
    current_interval: int,
    repetition: int,
    easiness: float,
    score: float,
) -> tuple[int, int, float]:
    """SM-2 알고리즘으로 다음 복습 간격 계산.

    Args:
        current_interval: 현재 간격 (일)
        repetition: 반복 횟수
        easiness: EF (easiness factor, 초기값 2.5)
        score: 0.0~1.0 점수 (SM-2에서는 0~5 스케일 사용, 여기서 변환)

    Returns:
        (next_interval, next_repetition, next_easiness)
    """
    # 0.0~1.0 → 0~5 스케일 변환
    q = score * 5.0

    # SM-2: q < 3이면 리셋
    if q < 3.0:
        next_interval = 1
        next_repetition = 0
    else:
        if repetition == 0:
            next_interval = 1
        elif repetition == 1:
            next_interval = 6
        else:
            next_interval = round(current_interval * easiness)
        next_repetition = repetition + 1

    # EF 업데이트: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    next_easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    next_easiness = max(1.3, next_easiness)  # 최소 1.3

    # 간격 상한 (90일)
    next_interval = min(next_interval, 90)

    return (next_interval, next_repetition, round(next_easiness, 4))
