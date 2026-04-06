# backend/services/test_scorer.py
"""
ALE v8 — Binary 추출 기반 채점 서비스 (v8.2 패치: key_concepts 호환)

LLM이 점수를 직접 매기지 않고, concept별 yes/no만 판별.
점수 계산은 이 모듈의 코드가 수행.
"""

# ── Bloom 레벨 계층 (낮은 순) ──────────────────────────
BLOOM_HIERARCHY = [
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
]

BLOOM_WEIGHTS = {
    "remember": 1.0,
    "understand": 1.2,
    "apply": 1.4,
    "analyze": 1.6,
    "evaluate": 1.8,
    "create": 2.0,
}


def normalize_rubric(rubric: dict) -> dict:
    """key_concepts 형식 rubric을 criteria 형식으로 변환.
    이미 criteria가 있으면 그대로 반환.
    """
    if rubric.get("criteria"):
        return rubric

    key_concepts = rubric.get("key_concepts", [])
    if not key_concepts:
        return rubric

    criteria = []
    for i, concept in enumerate(key_concepts):
        criteria.append({
            "key": f"K{i+1}",
            "concept": concept,
            "desc": concept,
            "weight": 1.0,
        })

    return {**rubric, "criteria": criteria}


def parse_concept_results(raw: dict) -> dict[str, bool]:
    """LLM 응답의 concept_results를 bool dict로 정규화."""
    results = {}
    for key, val in raw.items():
        if key in ("bloom", "brief"):
            continue
        if isinstance(val, bool):
            results[key] = val
        elif isinstance(val, str):
            results[key] = val.strip().lower() in ("yes", "true", "1")
        else:
            results[key] = bool(val)
    return results


def calculate_turn_score(concept_results: dict, checklist_items: list) -> dict:
    """Socratic 튜터링 매 턴 점수 계산."""
    parsed = parse_concept_results(concept_results)
    bloom = concept_results.get("bloom", "remember")

    total = len(checklist_items)
    if total == 0:
        return {
            "score": 0.0, "matched_count": 0, "total_count": 0,
            "newly_confirmed": [], "bloom_level": bloom,
        }

    item_ids = [item["id"] for item in checklist_items]
    matched = [cid for cid in item_ids if parsed.get(cid, False)]
    matched_count = len(matched)
    score = matched_count / total

    return {
        "score": round(score, 4),
        "matched_count": matched_count,
        "total_count": total,
        "newly_confirmed": matched,
        "bloom_level": bloom,
    }


def score_short_answer(extraction: dict, rubric: dict) -> dict:
    """Pre/Post/Retention 서술형 문항 채점.
    v8.2: key_concepts 형식도 자동 처리.
    """
    parsed = parse_concept_results(extraction)
    bloom = extraction.get("bloom", "remember")

    # v8.2: key_concepts → criteria 자동 변환
    normalized = normalize_rubric(rubric)
    criteria = normalized.get("criteria", [])

    if not criteria:
        return {
            "score": 0.0, "matched_count": 0, "total_count": 0,
            "matched_keys": [], "bloom_level": bloom,
        }

    # 가중 점수 계산
    total_weight = 0.0
    earned_weight = 0.0
    matched_keys = []

    for c in criteria:
        key = c["key"]
        weight = c.get("weight", 1.0)
        total_weight += weight
        if parsed.get(key, False):
            earned_weight += weight
            matched_keys.append(key)

    score = earned_weight / total_weight if total_weight > 0 else 0.0

    return {
        "score": round(score, 4),
        "matched_count": len(matched_keys),
        "total_count": len(criteria),
        "matched_keys": matched_keys,
        "bloom_level": bloom,
    }


def calculate_clinical_level(concept_results: dict) -> tuple[int, float]:
    """임상 적용 수준 판별 (1~4단계)."""
    parsed = parse_concept_results(concept_results)
    total = len(parsed)
    if total == 0:
        return (1, 0.0)

    matched = sum(1 for v in parsed.values() if v)
    ratio = matched / total

    if ratio >= 0.85:
        level = 4
    elif ratio >= 0.60:
        level = 3
    elif ratio >= 0.30:
        level = 2
    else:
        level = 1

    return (level, round(ratio, 4))


def determine_bloom(concept_results: dict, question_bloom: str = "remember") -> str:
    """학습자의 응답 블룸 레벨 결정."""
    llm_bloom = concept_results.get("bloom", "remember")
    llm_idx = BLOOM_HIERARCHY.index(llm_bloom) if llm_bloom in BLOOM_HIERARCHY else 0
    q_idx = BLOOM_HIERARCHY.index(question_bloom) if question_bloom in BLOOM_HIERARCHY else 0
    effective_idx = min(llm_idx, q_idx)

    parsed = parse_concept_results(concept_results)
    total = len(parsed)
    if total > 0:
        ratio = sum(1 for v in parsed.values() if v) / total
        if ratio < 0.3:
            effective_idx = max(0, effective_idx - 2)
        elif ratio < 0.5:
            effective_idx = max(0, effective_idx - 1)

    return BLOOM_HIERARCHY[effective_idx]


def calculate_phase_score(results: list) -> float:
    """Phase 종합 점수 — 블룸 가중 평균."""
    if not results:
        return 0.0

    total_weight = 0.0
    weighted_sum = 0.0

    for r in results:
        bloom = r.get("bloom", "remember")
        weight = BLOOM_WEIGHTS.get(bloom, 1.0)
        total_weight += weight
        weighted_sum += r["auto_score"] * weight

    return round(weighted_sum / total_weight, 4) if total_weight > 0 else 0.0


def determine_phase_bloom(results: list) -> str:
    """Phase 종합 블룸 레벨 — 점수 0.5 이상 중 최고 블룸."""
    if not results:
        return "remember"

    passed = [r for r in results if r["auto_score"] >= 0.5]
    if not passed:
        return "remember"

    max_idx = 0
    for r in passed:
        bloom = r.get("bloom", "remember")
        idx = BLOOM_HIERARCHY.index(bloom) if bloom in BLOOM_HIERARCHY else 0
        max_idx = max(max_idx, idx)

    return BLOOM_HIERARCHY[max_idx]