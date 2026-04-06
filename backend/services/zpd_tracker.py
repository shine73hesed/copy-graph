"""
ALE Phase 1 — BKT score 기반 ZPD 위치 추정 + Struggle 패턴 감지
추가 AI 호출 없음. score 데이터만 사용.
"""


def determine_initial_mastery(first_score: float) -> float:
    """첫 턴 응답 score로 BKT 시작점 결정"""
    if first_score >= 0.75:
        return 0.60
    elif first_score >= 0.50:
        return 0.30
    elif first_score >= 0.25:
        return 0.10
    else:
        return 0.05


def estimate_zpd_position(mastery: float, recent_scores: list) -> str:
    """ZPD 위치 추정: below_zpd | in_zpd | above_zpd"""
    # 최소 3턴 데이터 필요
    if len(recent_scores) < 3:
        return "unknown"

    last_5 = recent_scores[-5:]
    avg = sum(last_5) / len(last_5)
    var = sum((s - avg) ** 2 for s in last_5) / len(last_5)

    # mastery·평균 모두 높으면 → 이미 숙달 (ZPD 아래)
    if mastery >= 0.7 and avg >= 0.7:
        return "below_zpd"
    # mastery·평균 모두 낮고 분산도 작으면 → 선수지식 부족 (ZPD 위)
    if mastery < 0.2 and avg < 0.3 and var < 0.02:
        return "above_zpd"
    return "in_zpd"


def detect_struggle_pattern(recent_scores: list) -> str:
    """Struggle 패턴 감지: productive | unproductive | comfort | breakthrough"""
    # 최소 3턴 데이터 필요
    if len(recent_scores) < 3:
        return "too_early"

    last_3 = recent_scores[-3:]
    trend = last_3[-1] - last_3[0]
    avg = sum(last_3) / 3

    # 급격한 점수 상승 → 돌파
    if len(recent_scores) >= 2:
        jump = recent_scores[-1] - recent_scores[-2]
        if jump >= 0.25:
            return "breakthrough"

    # 평균 높으면 → 편안한 영역
    if avg >= 0.65:
        return "comfort"
    # 평균 낮고 하락/정체 → 비생산적 고전
    if avg < 0.35 and trend <= 0:
        return "unproductive"
    # 평균 중간 이하이나 상승 추세 → 생산적 고전
    if avg < 0.5 and trend > 0.05:
        return "productive"

    return "in_progress"
