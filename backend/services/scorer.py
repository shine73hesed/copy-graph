"""
ALE Phase 1 — Analyst Claude 경량 채점
매 턴 호출, scoring_rubric + wiki_doc 기반, score + brief만 반환
"""

import json

# 채점 AI 시스템 프롬프트
SCORER_SYSTEM = """학습 채점 AI입니다.
학생의 답변이 개념을 얼마나 깊이 이해하고 있는지 판단하세요.

판단 기준 (중요도 순):
1. 자기 말로 재구성했는가 (교재 문장을 그대로 옮긴 것은 낮은 점수)
2. 개념 간 연결을 만들었는가 ("A이다"만 말한 것 vs "A이기 때문에 B가 된다")
3. 핵심 개념을 포함하는가 (필요조건이지 충분조건이 아님)

주의: 교재의 키워드를 많이 언급했다고 높은 점수를 주지 마세요.
키워드 없이도 자기 말로 본질을 설명하면 높은 점수입니다.
키워드를 나열했지만 "왜"를 설명 못 하면 중간 점수입니다.

점수 기준:
0.85~1.0 — 개념을 자기 말로 재구성하여 설명할 수 있음
  학습자가 교재 용어를 그대로 쓰지 않더라도,
  "왜 그런지"를 자기 논리로 연결하여 설명함.
  예: "기억만 문제가 아니라 판단도 못 하게 되니까
  혼자 일상생활을 못 하게 되는 거잖아요.
  그래서 단순 건망증과는 다른 거죠"

0.6~0.84 — 핵심 개념을 맞추었으나 연결이 부족함
  개별 사실은 알지만, 사실 간의 관계를 설명하지 못함.
  예: "인지기능이 떨어지고 일상생활이 어려워지는 거예요"
  (맞지만, 왜 일상생활이 어려워지는지의 연결이 없음)

0.35~0.59 — 관련 내용을 언급하나 피상적 이해
  키워드를 말하지만 그 의미를 설명하지 못함.
  예: "뇌가 퇴행해서 인지기능이 떨어지는 거예요"
  (교재 문장 재현. "퇴행"이 뭔지, "인지기능"이 구체적으로
  뭔지를 물으면 답하지 못할 가능성 높음)

0.1~0.34 — 오개념 또는 단편적 언급
  예: "기억력이 안 좋아지는 병이요"
  (치매의 일부만 언급, 핵심 누락)

반환 형식 (JSON만):
{"score": 0.00, "brief": "한 줄 판정 근거"}"""


def should_update(answer: str) -> bool:
    """BKT 업데이트 대상인지 판단 — 메타 응답 필터링"""
    stripped = answer.strip()
    # 너무 짧은 응답은 채점 대상 아님
    if len(stripped) <= 2:
        return False
    # 메타 응답 패턴 — 짧으면서 의미 없는 반응
    meta = ["ㅋㅋ", "ㅎㅎ", "음...", "글쎄요", "잠깐만", "패스", "skip", "ㅇㅇ"]
    if any(p in stripped for p in meta) and len(stripped) < 10:
        return False
    return True


def quick_score(answer: str) -> tuple:
    """명백한 케이스 빠른 분류. (type, score|None) 반환"""
    text = answer.strip()
    # "모르겠" 계열 — 낮은 점수 즉시 부여
    dk = ["모르겠", "모름", "잘 모르", "이해가 안", "어려워", "헷갈"]
    if any(kw in text for kw in dk):
        return ("dont_know", 0.15)
    # 너무 짧은 실질 응답
    if len(text) < 8:
        return ("too_short", 0.25)
    # Claude 채점 필요
    return ("substantive", None)


async def score_with_claude(
    client,
    model: str,
    node_id: str,
    kc_id: str,
    mastery: float,
    turn: int,
    answer: str,
    rubric: str,
    wiki_summary: str,
    recent_history: list,
) -> dict:
    """Analyst Claude 경량 채점 — max_tokens=128
    TODO: Anthropic API 연동 후 실제 채점으로 교체
    """
    # 채점 요청 메시지 구성 (API 연동 시 그대로 사용)
    msg = (
        f"노드: {node_id} | mastery: {mastery:.2f} | 턴: {turn}\n\n"
        f"[채점 기준]\n{rubric}\n\n"
        f"[교재 핵심]\n{wiki_summary}\n\n"
        f"[학생 답변]\n{answer}\n\n"
        f"[최근 맥락]\n{json.dumps(recent_history[-4:], ensure_ascii=False)}"
    )
    _ = msg  # API 호출 시 사용 예정

    # 임시 목업 점수 반환
    return {"score": 0.50, "brief": "목업 채점 (API 미연동)"}
