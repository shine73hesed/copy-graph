# backend/services/claude_client.py
"""
ALE Phase 1 — Claude API 클라이언트
채점(Analyst)과 튜터(Tutor) 두 가지 역할로 Claude 호출
"""

import os
import json
import anthropic

from services.logger import log_tutor_context

# Anthropic 비동기 클라이언트 초기화
client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def _ensure_dict(obj) -> dict:
    """str이면 json.loads, 이미 dict면 그대로, 기타는 빈 dict 반환."""
    if isinstance(obj, dict):
        return obj
    if isinstance(obj, str):
        try:
            parsed = json.loads(obj)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}

TUTOR_MODEL = "claude-sonnet-4-20250514"
SCORER_MODEL = "claude-sonnet-4-20250514"

# ── Analyst 시스템 프롬프트 — 체크리스트 판별 + score ──
ANALYST_SYSTEM = """당신은 치매 돌봄 교육의 학습 분석가입니다.
학습자의 답변을 분석하여 두 가지를 판별합니다.

## 판별 1: 체크리스트 커버리지

각 항목에 대해 confirmed 또는 not_yet을 판별하세요.
- confirmed: 학습자가 해당 개념을 자기 말로 표현했음
- not_yet: 아직 다루지 않았거나 교재 문장을 그대로 반복

판별 기준 (매우 엄격 — 반드시 준수):
- 당신에게는 학습자의 발화만 제공됩니다. 튜터가 뭘 설명했는지는 보이지 않습니다.
- 학습자의 발화만으로 해당 개념을 이해하고 있는지 판별하세요.

confirmed 조건:
  1. 학습자가 해당 개념의 핵심을 자기 말로 능동적으로 표현했음
  2. 한 턴에서 완벽하게 말할 필요 없음 — 여러 턴에 걸쳐 누적으로 판단하세요
     예: T1 "기억상실로 일상생활이 어려운 상태" + T2 "후천적으로 나빠진거야"
     → C1(후천적 인지기능 저하) 충족
  3. 튜터가 먼저 알려준 개념을 따라 말한 것은 제외

절대 confirmed가 될 수 없는 경우:
  * 단순 동의: "네", "ㅇㅇ", "맞아요", "그렇죠", "아~", "응"
  * 키워드만 언급하고 의미 설명 없음: "기억력이요", "없애다"
  * 튜터가 설명한 직후 따라 말한 것 (앵무새 반복)
  * 튜터 퀴즈에 단어 하나 맞춘 것
  * 오개념이 포함된 경우 (예: "기억력만" → 다영역인데 하나만 언급)
  * 학습자가 해당 개념을 아직 한 번도 언급하지 않은 경우

핵심 원칙:
  의심스러우면 not_yet으로 판별하세요.
  confirmed는 확실한 경우에만 부여합니다.
  이전 턴에서 이미 confirmed된 항목은 유지합니다.

## 판별 2: 이번 턴 답변의 이해 수준 (score)

0.8~1.0: 개념을 자기 말로 재구성 + 개념 간 연결
0.6~0.79: 핵심을 맞추었으나 연결 부족
0.3~0.59: 키워드만 언급, 의미 설명 못함
0.0~0.29: 오개념이거나 핵심 누락
- 튜터가 복수 질문을 했는데 학습자가 일부만 답했으면, 답한 부분만 기준으로 채점하세요.

## 중요 제약
- 체크리스트 키는 반드시 제공된 항목의 id를 그대로 사용하세요 (C1, C2, C3, C4, C5)
- 항목의 라벨이나 설명을 임의로 수정하지 마세요
- 제공된 항목 외에 새 항목을 추가하지 마세요

## 출력 형식 (반드시 이 JSON만 출력 — 다른 텍스트 금지)
체크리스트 키는 반드시 제공된 id(C1, C2, ... 등)를 그대로 사용하세요.
라벨을 수정하거나 새 키를 만들지 마세요.

{"checklist":{"C1":"confirmed","C2":"not_yet","C3":"not_yet","C4":"not_yet","C5":"not_yet"},"score":0.25,"brief":"퇴행성만 언급"}"""

# ── v8 Analyst 시스템 프롬프트 — binary 추출 (점수 없음) ──
ANALYST_SYSTEM_V8 = """당신은 치매 돌봄 교육의 학습 분석가입니다.
학습자의 답변에서 각 체크리스트 항목이 언급되었는지 yes/no로만 판별하세요.
점수를 매기지 마세요.

## 판별 기준

각 항목에 대해 yes 또는 no를 판별하세요.
- yes: 학습자가 해당 개념을 자기 말로 표현했음
- no: 아직 다루지 않았거나 교재 문장을 그대로 반복

판별 기준 (매우 엄격 — 반드시 준수):
- 당신에게는 학습자의 발화만 제공됩니다. 튜터가 뭘 설명했는지는 보이지 않습니다.
- 학습자의 발화만으로 해당 개념을 이해하고 있는지 판별하세요.

yes 조건:
  1. 학습자가 해당 개념의 핵심을 자기 말로 능동적으로 표현했음
  2. 한 턴에서 완벽하게 말할 필요 없음 — 여러 턴에 걸쳐 누적으로 판단하세요
  3. 튜터가 먼저 알려준 개념을 따라 말한 것은 제외

절대 yes가 될 수 없는 경우:
  * 단순 동의: "네", "ㅇㅇ", "맞아요", "그렇죠", "아~", "응"
  * 키워드만 언급하고 의미 설명 없음: "기억력이요", "없애다"
  * 튜터가 설명한 직후 따라 말한 것 (앵무새 반복)
  * 튜터 퀴즈에 단어 하나 맞춘 것
  * 오개념이 포함된 경우
  * 학습자가 해당 개념을 아직 한 번도 언급하지 않은 경우

핵심 원칙:
  의심스러우면 no로 판별하세요.
  yes는 확실한 경우에만 부여합니다.

## 중요 제약
- 체크리스트 키는 반드시 제공된 항목의 id를 그대로 사용하세요 (C1, C2, C3, C4, C5)
- 항목의 라벨이나 설명을 임의로 수정하지 마세요
- 제공된 항목 외에 새 항목을 추가하지 마세요

## 출력 형식 (반드시 이 JSON만 출력 — 다른 텍스트 금지)
{"C1":"yes","C2":"no","C3":"yes","C4":"no","C5":"no","bloom":"understand","brief":"후천적 개념 이해했으나 ADL 미언급"}"""

# 소크라테스식 문답 튜터 시스템 프롬프트
TUTOR_SYSTEM_V2 = """당신은 치매 케어 간호 교육의 소크라테스식 문답 튜터입니다.

규칙:
1. 절대 먼저 설명하지 않는다 — 질문으로 이끈다
2. "모르겠어요" → 힌트/비유 제공, 바로 답을 주지 않는다
3. 3번 이상 답 못하면 핵심 하나만 간단히 설명 후 다음 질문으로
4. 한 턴에 개념 하나, 질문 1개만. 학습자가 부분적으로만 답했으면 답 안 한 부분만 다시 물으세요
5. 학습자의 답변에 직접 반응하세요. 체크리스트 순서(C1→C2→...)를 강제하지 말고, 학습자 반응에 따라 자유롭게 진행
6. 친근하고 격려하는 톤, 한국어, 2-4문장
7. 응답 끝에 학습자가 답할 질문을 던지세요. 그 질문 앞에 [Q]를 붙이세요. [Q]는 응답에서 딱 한 번만 사용
8. [문답 가이드]의 자료를 활용하세요:
   - ```clinical, ```tip 블록: 학습자가 해당 개념을 이해한 후 정리 목적으로 응답에 포함
   - [DIAGRAM:id] 태그: 도표를 보여줄 때 태그를 그대로 응답에 포함 (프론트엔드가 자동 렌더링)
   - ![제목](경로) 이미지: 교재 삽화를 보여줄 때 그대로 응답에 포함
   - 같은 자료는 대화에서 한 번만 사용. ## 시각 자료 섹션에 체크리스트 항목별 사용할 자료가 명시되어 있으니 참고
9. 오타/무의미/불완전 입력 처리:
   - 자음/모음만 나열, 의미 없는 문자열, 주제와 무관한 입력 → "입력이 잘 안 된 것 같아요!" 등 짧게 안내 후 **직전 질문을 그대로** 다시 물으세요.
   - 학습자가 용어를 대충 말한 경우(예: "알츠 머시기", "그 뭐냐 혈관 어쩌고") → 절대 "맞아요!"라고 하지 마세요. "혹시 '알츠하이머병'을 말씀하시는 건가요? 정확한 이름을 한번 말해보세요!" 처럼 **정확한 용어를 스스로 말하도록 유도**하세요. 학습자가 정확히 말하기 전까지 confirmed 처리하지 마세요.
   - 핵심 원칙: 학습자가 핵심 용어를 정확히 말하지 않았는데 튜터가 대신 알려주면 학습 효과가 없습니다.

주제 완료: 핵심 개념을 학생이 자기 말로 설명할 수 있으면
응답 마지막에 [TOPIC_COMPLETE]

[문답 가이드 — 반드시 이 가이드의 PS-I 사례와 교수 전략을 따르세요]
{plan_guide}

[참고 교재]
{wiki_doc}

학습자 직군: {role}"""


async def analyze_answer(
    node_id: str,
    answer: str,
    checklist_items: list,
    wiki_summary: str,
    conversation_history: list,
    prev_checklist: dict,
) -> dict:
    """Analyst Claude — 체크리스트 판별 + score"""
    prev_checklist = _ensure_dict(prev_checklist)
    checklist_desc = "\n".join([f"- {it['id']}: {it['label']}" for it in checklist_items])
    prev_state = "\n".join([f"- {k}: {v}" for k, v in prev_checklist.items()]) if prev_checklist else "전부 not_yet"

    # 학습자 발화만 추출 — Analyst가 튜터 설명에 오염되지 않도록
    learner_utterances = []
    for msg in conversation_history:
        if msg["role"] == "user" and not msg["content"].startswith("[시스템:"):
            learner_utterances.append(msg["content"])
    learner_only = "\n".join([f"T{i+1}: {u}" for i, u in enumerate(learner_utterances)])

    user_msg = (
        f"[체크리스트 항목 — 아래 id를 그대로 키로 사용할 것]\n{checklist_desc}\n\n"
        f"[현재 체크리스트 상태]\n{prev_state}\n\n"
        f"[교재 핵심]\n{wiki_summary}\n\n"
        f"[학습자 발화만 (튜터 발화 제외)]\n{learner_only}\n\n"
        f"[이번 턴 답변]\n{answer}"
    )

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=256,
            system=ANALYST_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()
        text = raw
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        result = json.loads(text)
        return {
            "checklist": result.get("checklist", {}),
            "score": float(result.get("score", 0.4)),
            "brief": result.get("brief", ""),
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
    except Exception:
        return {"checklist": prev_checklist or {}, "score": 0.4, "brief": "분석 파싱 실패", "input_tokens": 0, "output_tokens": 0}


async def analyze_answer_v8(
    node_id: str,
    answer: str,
    checklist_items: list,
    wiki_summary: str,
    conversation_history: list,
    prev_checklist: dict,
) -> dict:
    """v8 Analyst — binary 추출만 수행, 점수는 코드에서 계산.
    반환: concept_results ({"C1": True/False, ...}), bloom, brief, 토큰 사용량
    """
    prev_checklist = _ensure_dict(prev_checklist)
    checklist_desc = "\n".join([f"- {it['id']}: {it['label']}" for it in checklist_items])
    prev_state = "\n".join([f"- {k}: {'yes' if v == 'confirmed' else 'no'}" for k, v in prev_checklist.items()]) if prev_checklist else "전부 no"

    # 학습자 발화만 추출 — Analyst가 튜터 설명에 오염되지 않도록
    learner_utterances = []
    for msg in conversation_history:
        if msg["role"] == "user" and not msg["content"].startswith("[시스템:"):
            learner_utterances.append(msg["content"])
    learner_only = "\n".join([f"T{i+1}: {u}" for i, u in enumerate(learner_utterances)])

    user_msg = (
        f"[체크리스트 항목 — 아래 id를 그대로 키로 사용할 것]\n{checklist_desc}\n\n"
        f"[이전 판별 상태]\n{prev_state}\n\n"
        f"[교재 핵심]\n{wiki_summary}\n\n"
        f"[학습자 발화만 (튜터 발화 제외)]\n{learner_only}\n\n"
        f"[이번 턴 답변]\n{answer}"
    )

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=256,
            system=ANALYST_SYSTEM_V8,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = response.content[0].text.strip()
        text = raw
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        result = json.loads(text)

        # yes/no → True/False 변환
        concept_results = {}
        valid_ids = {it["id"] for it in checklist_items}
        for k, v in result.items():
            if k in valid_ids:
                concept_results[k] = (v == "yes")

        # 이전에 confirmed(yes)였던 항목은 유지
        for k, v in prev_checklist.items():
            if v == "confirmed" and k in valid_ids:
                concept_results[k] = True

        return {
            "concept_results": concept_results,
            "bloom": result.get("bloom", ""),
            "brief": result.get("brief", ""),
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
    except Exception as e:
        print(f"[ANALYST_V8] parse failed: {e}")
        # 폴백: 이전 상태 유지
        fallback = {}
        for it in checklist_items:
            fallback[it["id"]] = (prev_checklist.get(it["id"]) == "confirmed")
        return {
            "concept_results": fallback,
            "bloom": "",
            "brief": "분석 파싱 실패",
            "input_tokens": 0,
            "output_tokens": 0,
        }


# backend/services/claude_client_extract_patch.py
"""
ALE v8.2 — claude_client.py extract_concepts 패치

═══ services/claude_client.py line 272~329 교체 ═══

아래 함수로 통째로 교체하세요.
변경점: normalize_rubric 호출로 key_concepts → criteria 자동 변환
"""


async def extract_concepts(response: str, rubric: dict) -> dict:
    """서술형 답변에서 핵심 개념 유무를 binary 추출 — Pre/Post/Retention 테스트용.

    v8.2: key_concepts 형식 rubric도 자동 처리.

    Args:
        response: 학습자의 서술형 답변
        rubric: {"key_concepts": [...]} 또는 {"criteria": [{...}, ...]}

    Returns:
        {"K1": True/False, ..., "brief": "한줄 요약"}
    """
    # v8.2: key_concepts → criteria 자동 변환
    from services.test_scorer import normalize_rubric
    normalized = normalize_rubric(rubric)

    question = normalized.get("question", "")
    criteria = normalized.get("criteria", [])

    if not criteria:
        return {"brief": "채점 기준 없음"}

    concepts_desc = "\n".join([
        f"{i+1}. {c['concept']} — {c.get('desc', c['concept'])}" for i, c in enumerate(criteria)
    ])
    keys_format = ", ".join([f'"{c["key"]}": "yes/no"' for c in criteria])

    prompt = f"""당신은 간호학 답변 분석기입니다. 점수를 매기지 마세요.
학습자의 답변에서 아래 핵심 개념이 언급되었는지 각각 yes/no로만 판별하세요.
간접적 표현도 의미가 통하면 yes로 판별합니다.

문항: {question}
학습자 답변: {response}

핵심 개념:
{concepts_desc}

JSON으로만 응답:
{{{keys_format},"brief":"한줄 요약"}}"""

    try:
        api_response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = api_response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)

        # yes/no → True/False 변환
        extracted = {}
        for c in criteria:
            key = c["key"]
            val = result.get(key, "no")
            if isinstance(val, bool):
                extracted[key] = val
            else:
                extracted[key] = str(val).strip().lower() in ("yes", "true", "1")
        extracted["brief"] = result.get("brief", "")
        extracted["bloom"] = result.get("bloom", "remember")

        return extracted
    except Exception as e:
        print(f"[EXTRACT_CONCEPTS] failed: {e}")
        fallback = {c["key"]: False for c in criteria}
        fallback["brief"] = "개념 추출 실패"
        return fallback


async def generate_checklist(node_id: str, wiki_doc: str) -> list:
    """체크리스트 파일이 없는 노드용 — Claude가 wiki_doc에서 핵심 항목 5개 생성"""
    prompt = f"""아래 교재 내용을 바탕으로 학습 체크리스트 항목 5개를 생성하세요.

[교재]
{wiki_doc[:2000]}

출력 형식 (반드시 이 JSON만 출력):
[
  {{"id": "C1", "label": "항목 설명 (학습자가 자기 말로 설명해야 할 내용)"}},
  {{"id": "C2", "label": "..."}},
  {{"id": "C3", "label": "..."}},
  {{"id": "C4", "label": "..."}},
  {{"id": "C5", "label": "임상 적용 — 위 개념을 사례에 적용"}}
]

규칙:
- C1~C4는 핵심 개념 이해, C5는 반드시 임상 적용(사례에 개념 적용)
- 각 label은 20자 이내로 핵심만
- id는 C1~C5 고정"""

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        items = json.loads(raw)
        return [{"id": it["id"], "label": it["label"], "done": False} for it in items]
    except Exception:
        return [
            {"id": "C1", "label": f"{node_id} 핵심 개념 정의", "done": False},
            {"id": "C2", "label": "관련 하위 개념 구분", "done": False},
            {"id": "C3", "label": "유사 개념과의 차이", "done": False},
            {"id": "C4", "label": "원인 또는 기전", "done": False},
            {"id": "C5", "label": "임상 적용 — 사례에 적용", "done": False},
        ]


async def generate_unified_node(node_id: str, wiki_doc: str) -> str:
    """통합 노드 파일(체크리스트+교수전략+자료) 자동 생성 — Claude가 wiki_doc 기반으로 작성"""
    prompt = f"""아래 교재 내용을 바탕으로 간호 교육용 통합 학습 파일을 만드세요.

[교재 — {node_id}]
{wiki_doc[:3000]}

아래 형식을 정확히 따르세요. 마크다운으로 출력하세요.

## 체크리스트

□ C1: (핵심 개념 1 — 학습자가 자기 말로 설명해야 할 내용, 20자 이내)
□ C2: (핵심 개념 2)
□ C3: (핵심 개념 3 — 유사 개념과의 차이 또는 감별)
□ C4: (핵심 개념 4 — 원인/기전/분류)
□ C5: 임상 적용 — "이 환자에게 위 개념을 적용하여 판단/설명"

체크 규칙:
- 학습자가 해당 개념을 "자기 말로" 표현하면 체크
- 교재 문장을 그대로 반복하는 것은 체크 안 함
- 한 턴에 여러 항목이 동시에 체크될 수 있음

## 교수 전략

### PS-I 첫 사례

> (실제 간호 현장에서 만날 수 있는 구체적 임상 사례를 만드세요. 환자 이름, 나이, 증상, 가족 호소 포함. 3-5줄.)

이 사례를 제시하고 학습자에게 물어보세요:
- "(사례와 관련된 핵심 질문)"

### 체크리스트별 교수 힌트

**C1 유도:**
- "(C1 개념을 유도할 질문)"

**C2 유도:**
- "(C2 개념을 유도할 질문)"

**C3 유도:**
- "(C3 개념을 유도할 질문)"

**C4 유도:**
- "(C4 개념을 유도할 질문)"

**C5 (임상 적용):**
- C1~C4를 배운 후: "(종합 적용 질문)"

## 자료

(교재 내용을 바탕으로 mermaid 개념도 1개를 만드세요)

```mermaid
graph TD
    A["주제"] --> B["하위개념1"]
    A --> C["하위개념2"]
    style A fill:#c0582e,color:#fff,stroke:none
```

```tip
(핵심 요약 3줄)
```"""

    try:
        response = await client.messages.create(
            model=TUTOR_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        generated = response.content[0].text.strip()
        # 헤더에 핵심 내용 섹션 + 원본 wiki_doc 결합
        full = f"# {node_id}\n\n## 핵심 내용\n\n{wiki_doc}\n\n{generated}\n"
        print(f"[AUTO_GEN] unified node generated: {node_id}, len={len(full)}, cost_tokens=in:{response.usage.input_tokens}/out:{response.usage.output_tokens}")
        return full
    except Exception as e:
        print(f"[AUTO_GEN] ERROR generating unified node for {node_id}: {e}")
        # 최소한의 폴백
        checklist = (
            f"## 체크리스트\n\n"
            f"□ C1: {node_id} 핵심 개념 정의\n"
            f"□ C2: 관련 하위 개념 구분\n"
            f"□ C3: 유사 개념과의 차이\n"
            f"□ C4: 원인 또는 기전\n"
            f"□ C5: 임상 적용 — 사례에 적용\n\n"
            f"## 교수 전략\n\n"
            f"### PS-I 첫 사례\n\n"
            f"> 이 주제와 관련된 임상 사례를 생각해보세요.\n\n"
            f"## 자료\n\n"
        )
        return f"# {node_id}\n\n## 핵심 내용\n\n{wiki_doc}\n\n{checklist}"


async def generate_tutor_response(
    node_id: str,
    role: str,
    mastery: float,
    wiki_doc: str,
    plan_guide: str,
    conversation_history: list,
    learning_state: str = "",
    handoff: dict = None,
) -> dict:
    """튜터 Claude 응답 생성. handoff가 있으면 이전 Sprint 요약을 시스템 프롬프트에 삽입."""
    system_prompt = TUTOR_SYSTEM_V2.format(
        wiki_doc=wiki_doc,
        plan_guide=plan_guide,
        role=role,
    )

    # Sprint handoff가 있으면 시스템 프롬프트에 추가
    if handoff:
        summary = handoff.get("summary", {})
        cl_state = _ensure_dict(handoff.get("checklist_state", {}))
        cl_text = ", ".join([f"{k}={v}" for k, v in cl_state.items()])
        handoff_block = (
            f"\n\n[이전 학습 요약 — Sprint {handoff.get('sprint', '?')} 종료 시점]\n"
            f"- 이해한 것: {summary.get('understood', '없음')}\n"
            f"- 미진한 것: {summary.get('not_yet', '없음')}\n"
            f"- 부분적으로 언급된 항목: {summary.get('partially_mentioned', '없음')}\n"
            f"- 마지막 흐름: {summary.get('last_topic', '없음')}\n"
            f"- 마지막 질문: {summary.get('last_question', '없음')}\n"
            f"- 학습자 특성: {summary.get('learner_style', '알 수 없음')}\n"
            f"- 체크리스트: {cl_text}\n"
            f"- 이동평균: {handoff.get('moving_avg', 0)}\n\n"
            f"이전 대화는 위 요약으로 대체되었습니다. '부분적으로 언급된 항목'은 아직 confirmed가 아니지만 학습자가 일부 언급한 개념이므로, 자연스럽게 이어서 더 깊이 다뤄주세요. 아래 대화는 이어서 진행합니다."
        )
        system_prompt += handoff_block

    response = await client.messages.create(
        model=TUTOR_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=conversation_history,
    )
    return {
        "text": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }


SPRINT_SIZE = 10

async def generate_handoff(conversation_history: list, checklist_state: dict,
                            checklist_items: list, score_history: list,
                            moving_avg: float, sprint_num: int) -> dict:
    """Sprint 종료 시 대화 요약 handoff artifact 생성"""
    checklist_state = _ensure_dict(checklist_state)
    # 대화 텍스트 구성
    conv_text = ""
    for msg in conversation_history:
        if "[시스템:" in msg.get("content", ""):
            continue
        role_label = "학습자" if msg["role"] == "user" else "튜터"
        conv_text += f"{role_label}: {msg['content'][:200]}\n"

    cl_text = "\n".join([f"- {k}: {v}" for k, v in checklist_state.items()])

    # 체크리스트 항목 라벨 포함
    cl_items_text = ""
    for it in checklist_items:
        cid = it.get("id", "")
        label = it.get("label", "")
        status = checklist_state.get(cid, "not_yet")
        cl_items_text += f"- {cid} ({status}): {label}\n"

    prompt = f"""아래 학습 대화를 분석하여 다음 Sprint를 위한 인수인계 요약을 작성하세요.

[체크리스트 현재 상태]
{cl_items_text}

[이동평균] {moving_avg:.2f}
[score 히스토리] {score_history}

[대화 내용]
{conv_text[:3000]}

출력 형식 (반드시 이 JSON만 출력, 다른 텍스트 없이):
{{
  "understood": "학습자가 확실히 이해한 개념 (2-3문장)",
  "not_yet": "아직 다루지 못했거나 이해 부족한 개념 (2-3문장)",
  "partially_mentioned": "confirmed는 아니지만 대화에서 언급되거나 부분적으로 다뤄진 체크리스트 항목 ID와 어느 정도 다뤘는지 (예: C3 - 용어는 언급했으나 구체적 설명 부족)",
  "last_topic": "마지막으로 다루던 주제 (1문장)",
  "last_question": "튜터가 마지막으로 던진 질문 (원문 그대로)",
  "learner_style": "학습자의 답변 스타일/특성 (1문장)"
}}"""

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        print(f"[SPRINT] handoff raw response: {raw[:300]}")
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        summary = json.loads(raw)
    except Exception as e:
        print(f"[SPRINT] handoff generation failed: {e}")
        try:
            print(f"[SPRINT] handoff raw (for debug): {raw[:500] if 'raw' in dir() else 'no raw'}")
        except:
            pass
        # fallback: 대화에서 정보 추출
        last_tutor = ""
        learner_texts = []
        for msg in reversed(conversation_history):
            if msg["role"] == "assistant" and not last_tutor:
                last_tutor = msg["content"][:200]
            if msg["role"] == "user" and not msg["content"].startswith("[시스템:"):
                learner_texts.append(msg["content"][:100])
        learner_texts.reverse()

        # not_yet 체크리스트 항목과 학습자 발화 대조 → partially_mentioned 추출
        partial_items = []
        for it in checklist_items:
            cid = it.get("id", "")
            label = it.get("label", "")
            status = checklist_state.get(cid, "not_yet")
            if status == "confirmed":
                continue
            # 라벨의 핵심 키워드가 학습자 발화에 있는지 체크
            keywords = [w for w in label.replace("—", " ").replace("·", " ").split() if len(w) >= 2]
            mentioned = any(kw in " ".join(learner_texts) for kw in keywords)
            if mentioned:
                partial_items.append(f"{cid} - '{label}' 관련 용어 언급됨")

        summary = {
            "understood": "이전 대화에서 학습 진행됨 (API 요약 실패, 키워드 기반 fallback)",
            "not_yet": "체크리스트 미확인 항목: " + ", ".join([k for k, v in checklist_state.items() if v != "confirmed"]),
            "partially_mentioned": "; ".join(partial_items) if partial_items else "없음",
            "last_topic": "이전 Sprint에서 다루던 주제",
            "last_question": last_tutor[:100] if last_tutor else "",
            "learner_style": "알 수 없음 (API 실패)",
        }

    handoff = {
        "sprint": sprint_num,
        "turns_covered": [
            (sprint_num - 1) * SPRINT_SIZE + 1,
            sprint_num * SPRINT_SIZE,
        ],
        "checklist_state": dict(checklist_state),
        "summary": summary,
        "score_history": list(score_history),
        "moving_avg": round(moving_avg, 3),
    }

    # ── 디버깅 로그 ──
    confirmed = [k for k, v in checklist_state.items() if v == "confirmed"]
    not_yet = [k for k, v in checklist_state.items() if v != "confirmed"]
    print(f"\n{'='*60}")
    print(f"[SPRINT] ── Sprint {sprint_num} 완료 → Sprint {sprint_num+1} 전환 ──")
    print(f"[SPRINT] turns: {(sprint_num-1)*SPRINT_SIZE+1}~{sprint_num*SPRINT_SIZE}")
    print(f"[SPRINT] checklist confirmed: {confirmed}")
    print(f"[SPRINT] checklist not_yet: {not_yet}")
    print(f"[SPRINT] moving_avg: {moving_avg:.3f}")
    print(f"[SPRINT] score_history: {score_history}")
    print(f"[SPRINT] summary.understood: {summary.get('understood', '')}")
    print(f"[SPRINT] summary.not_yet: {summary.get('not_yet', '')}")
    print(f"[SPRINT] summary.partially_mentioned: {summary.get('partially_mentioned', '')}")
    print(f"[SPRINT] summary.last_topic: {summary.get('last_topic', '')}")
    print(f"[SPRINT] summary.learner_style: {summary.get('learner_style', '')}")
    print(f"{'='*60}\n")

    return handoff


async def generate_note_content(node_id: str, wiki_doc: str,
                                 conversation: list, interactions: list) -> dict:
    """학습 완료 시 노트 자동 생성 — 개인화된 취약점 분석 + 용어 단어장

    취약점: "이 개념을 몰랐다 → 정답은 이것이다 → 학습자는 이렇게 말했다"
    용어: "모르거나 부정확하게 사용한 용어 → 정확한 정의"
    """

    # 대화 텍스트 구성
    conv_text = ""
    for msg in conversation:
        role = "학습자" if msg.get("role") == "user" else "튜터"
        conv_text += f"{role}: {msg.get('content', '')[:300]}\n"

    # score 정보 포함
    score_info = ""
    for ix in interactions:
        t = ix.get("turn", 0)
        s = ix.get("score")
        ans = ix.get("student_answer", "")[:100]
        if s is not None:
            score_info += f"T{t} (score:{s:.2f}): {ans}\n"

    note_prompt = f"""아래 학습 대화를 분석하여 학습자 개인에 맞는 학습 노트를 작성하세요.

[교재 — {node_id}]
{wiki_doc[:2500]}

[대화 내용]
{conv_text[:3000]}

[턴별 채점]
{score_info[:1500]}

출력 형식 (반드시 이 JSON만 출력, 다른 텍스트 없이):
{{
  "gaps": [
    {{
      "concept": "학습자가 몰랐거나 부정확했던 개념 (한 줄)",
      "correct": "교재 기준 정확한 설명 (2~3문장)",
      "learner_said": "학습자가 실제로 말한 표현 (원문 인용, 없으면 '언급하지 않음')",
      "tip": "이 개념을 기억하기 위한 핵심 포인트 (1문장)"
    }}
  ],
  "vocabulary": [
    {{
      "term": "핵심 용어",
      "definition": "정의 (20자 이내)",
      "learner_confused": "학습자가 이 용어를 어떻게 잘못 이해하거나 표현했는지 (정확했으면 '정확히 이해함')"
    }}
  ],
  "strengths": "학습자가 잘 이해한 부분 (1~2문장)",
  "next_focus": "다음 학습 시 집중할 포인트 (1~2문장)"
}}

규칙:
- gaps: 학습자가 실제로 틀리거나 모른다고 한 개념만 포함 (3~6개). score 0.4 미만 턴을 중심으로.
- vocabulary: 대화에서 학습자가 모르거나 부정확하게 사용한 용어 위주 (5~8개). 학습자가 정확히 알고 있는 용어는 learner_confused에 '정확히 이해함'으로 표기.
- learner_said는 학습자의 실제 발화를 최대한 원문 그대로 인용
- correct는 교재 내용을 기반으로 정확한 정보 제공"""

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": note_prompt}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)

        return {
            "weak_points": result.get("gaps", []),
            "vocabulary": result.get("vocabulary", []),
            "strengths": result.get("strengths", ""),
            "next_focus": result.get("next_focus", ""),
        }
    except Exception as e:
        print(f"[NOTE_GEN] failed: {e}")
        # 폴백: 기본 추출
        weak_points = []
        for ix in interactions:
            score = ix.get("score")
            if score is not None and score < 0.4:
                weak_points.append({
                    "concept": f"T{ix.get('turn', 0)}에서 부족했던 개념",
                    "correct": ix.get("tutor_response", "")[:200],
                    "learner_said": ix.get("student_answer", "")[:100],
                    "tip": "",
                })

        import re as _re
        bold_terms = _re.findall(r'\*\*(.+?)\*\*', wiki_doc[:3000])
        seen = set()
        vocabulary = []
        for term in bold_terms:
            if term not in seen and len(term) < 30:
                seen.add(term)
                vocabulary.append({"term": term, "definition": "", "learner_confused": ""})
            if len(vocabulary) >= 8:
                break

        return {
            "weak_points": weak_points,
            "vocabulary": vocabulary,
            "strengths": "",
            "next_focus": "",
        }


async def generate_post_test_items(node_id: str, wiki_doc: str, checklist_items: list = None) -> list:
    """사후평가 문항 자동 생성 — wiki_doc + 체크리스트 기반으로 MCQ 2개 + 서술형 3개.

    form="B" 문항을 생성하여 반환. DB 저장은 호출부에서 수행.

    Returns:
        [{"item_id", "node_id", "form", "item_type", "bloom_level", "question", "rubric", "correct", "options"}, ...]
    """
    checklist_desc = ""
    if checklist_items:
        checklist_desc = "\n".join([f"- {it['id']}: {it['label']}" for it in checklist_items])

    prompt = f"""당신은 간호학 교육 평가 문항 출제 전문가입니다.
아래 교재 내용을 바탕으로 사후 평가(post-test) 문항 5개를 만드세요.

[교재 — {node_id}]
{wiki_doc[:3000]}

{f"[학습 체크리스트]{chr(10)}{checklist_desc}" if checklist_desc else ""}

## 출제 규칙

1. MCQ 2개 (4지선다) + 서술형 3개
2. Bloom 수준을 골고루 분배:
   - MCQ 1: remember (기억/재인)
   - MCQ 2: understand (이해)
   - 서술형 1: apply (적용)
   - 서술형 2: analyze (분석)
   - 서술형 3: evaluate 또는 create (평가/종합) — 임상 사례 적용
3. 서술형은 반드시 rubric(채점 기준)을 포함
4. 문항은 교재 핵심 내용을 고르게 커버
5. 임상 사례 기반 문항을 1개 이상 포함

## 출력 형식 (반드시 이 JSON 배열만 출력)

[
  {{
    "item_id": "{node_id}_B1",
    "item_type": "mcq",
    "bloom_level": "remember",
    "question": "문항 내용",
    "options": ["①선택지1", "②선택지2", "③선택지3", "④선택지4"],
    "correct": "①선택지1",
    "rubric": null
  }},
  {{
    "item_id": "{node_id}_B2",
    "item_type": "mcq",
    "bloom_level": "understand",
    "question": "문항 내용",
    "options": ["①선택지1", "②선택지2", "③선택지3", "④선택지4"],
    "correct": "②선택지2",
    "rubric": null
  }},
  {{
    "item_id": "{node_id}_B3",
    "item_type": "short_answer",
    "bloom_level": "apply",
    "question": "서술형 문항 내용",
    "options": null,
    "correct": null,
    "rubric": {{
      "question": "문항 내용 (question과 동일)",
      "criteria": [
        {{"key": "K1", "concept": "핵심개념1", "desc": "이 개념을 언급했는지", "weight": 1.0}},
        {{"key": "K2", "concept": "핵심개념2", "desc": "이 개념을 언급했는지", "weight": 1.0}},
        {{"key": "K3", "concept": "핵심개념3", "desc": "이 개념을 언급했는지", "weight": 1.0}}
      ]
    }}
  }},
  {{
    "item_id": "{node_id}_B4",
    "item_type": "short_answer",
    "bloom_level": "analyze",
    "question": "서술형 문항",
    "options": null,
    "correct": null,
    "rubric": {{
      "question": "문항 내용",
      "criteria": [
        {{"key": "K1", "concept": "개념1", "desc": "설명", "weight": 1.0}},
        {{"key": "K2", "concept": "개념2", "desc": "설명", "weight": 1.0}},
        {{"key": "K3", "concept": "개념3", "desc": "설명", "weight": 1.5}}
      ]
    }}
  }},
  {{
    "item_id": "{node_id}_B5",
    "item_type": "short_answer",
    "bloom_level": "evaluate",
    "question": "임상 사례 기반 종합 문항",
    "options": null,
    "correct": null,
    "rubric": {{
      "question": "문항 내용",
      "criteria": [
        {{"key": "K1", "concept": "개념1", "desc": "설명", "weight": 1.0}},
        {{"key": "K2", "concept": "개념2", "desc": "설명", "weight": 1.0}},
        {{"key": "K3", "concept": "개념3", "desc": "설명", "weight": 1.5}},
        {{"key": "K4", "concept": "개념4", "desc": "설명", "weight": 2.0}}
      ]
    }}
  }}
]"""

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        items = json.loads(raw)

        # node_id, form 필드 보정
        for item in items:
            item["node_id"] = node_id
            item["form"] = "B"
            if not item.get("item_id"):
                item["item_id"] = f"{node_id}_B{items.index(item)+1}"

        print(f"[GEN_POST_TEST] {node_id}: {len(items)}개 문항 생성 완료, cost=in:{response.usage.input_tokens}/out:{response.usage.output_tokens}")
        return items

    except Exception as e:
        print(f"[GEN_POST_TEST] {node_id} 문항 생성 실패: {e}")
        # 폴백: 기본 문항 5개
        fallback = [
            {
                "item_id": f"{node_id}_B1", "node_id": node_id, "form": "B",
                "item_type": "mcq", "bloom_level": "remember",
                "question": f"{node_id}의 정의로 가장 올바른 것은?",
                "options": ["①정확한 정의", "②부분적 정의", "③관련없는 정의", "④오개념"],
                "correct": "①정확한 정의", "rubric": None,
            },
            {
                "item_id": f"{node_id}_B2", "node_id": node_id, "form": "B",
                "item_type": "mcq", "bloom_level": "understand",
                "question": f"{node_id}에서 가장 중요한 간호 고려사항은?",
                "options": ["①핵심 고려사항", "②부분적 고려사항", "③관련없는 사항", "④오개념"],
                "correct": "①핵심 고려사항", "rubric": None,
            },
            {
                "item_id": f"{node_id}_B3", "node_id": node_id, "form": "B",
                "item_type": "short_answer", "bloom_level": "apply",
                "question": f"{node_id}의 핵심 개념을 설명하고 간호 현장에서 어떻게 적용할 수 있는지 서술하세요.",
                "options": None, "correct": None,
                "rubric": {"question": f"{node_id} 적용", "criteria": [
                    {"key": "K1", "concept": "핵심 정의", "desc": "정의를 정확히 설명", "weight": 1.0},
                    {"key": "K2", "concept": "적용 방법", "desc": "간호 적용을 구체적으로 설명", "weight": 1.0},
                    {"key": "K3", "concept": "근거", "desc": "근거를 제시", "weight": 1.0},
                ]},
            },
            {
                "item_id": f"{node_id}_B4", "node_id": node_id, "form": "B",
                "item_type": "short_answer", "bloom_level": "analyze",
                "question": f"{node_id} 관련 증상들의 차이점을 비교·분석하세요.",
                "options": None, "correct": None,
                "rubric": {"question": f"{node_id} 분석", "criteria": [
                    {"key": "K1", "concept": "차이점 인식", "desc": "주요 차이점을 인식", "weight": 1.0},
                    {"key": "K2", "concept": "비교 근거", "desc": "비교의 근거를 제시", "weight": 1.0},
                    {"key": "K3", "concept": "임상 의의", "desc": "임상적 의의를 설명", "weight": 1.5},
                ]},
            },
            {
                "item_id": f"{node_id}_B5", "node_id": node_id, "form": "B",
                "item_type": "short_answer", "bloom_level": "evaluate",
                "question": f"치매 환자 사례에서 {node_id} 관련 간호 중재를 종합적으로 평가하고 우선순위를 제시하세요.",
                "options": None, "correct": None,
                "rubric": {"question": f"{node_id} 종합 평가", "criteria": [
                    {"key": "K1", "concept": "사례 이해", "desc": "사례 상황을 정확히 파악", "weight": 1.0},
                    {"key": "K2", "concept": "중재 제안", "desc": "적절한 간호 중재를 제안", "weight": 1.0},
                    {"key": "K3", "concept": "우선순위", "desc": "우선순위 근거를 제시", "weight": 1.5},
                    {"key": "K4", "concept": "종합 판단", "desc": "종합적 판단을 제시", "weight": 2.0},
                ]},
            },
        ]
        return fallback


async def generate_learning_report(
    node_id: str, wiki_doc: str,
    pre_responses: list, post_responses: list,
    pre_score: float, post_score: float,
    learning_duration_sec: int = 0,
    mode: str = "reading",
) -> dict:
    """학습 리포트 자동 생성 — pre/post 비교 분석 + 개선점 + 권고사항.

    Returns:
        {
            "summary": str,          # 종합 평가 (3~4문장)
            "strengths": [str],       # 잘한 점 (2~3개)
            "weaknesses": [str],      # 부족한 점 (2~3개)
            "recommendations": [str], # 학습 권고사항 (2~3개)
            "bloom_analysis": str,    # 블룸 분류 기반 분석
            "gain_interpretation": str, # gain 해석
        }
    """
    gain = post_score - pre_score

    # pre/post 응답 요약
    pre_summary = ""
    for r in pre_responses:
        q = r.get("question", r.get("item_id", ""))
        score = r.get("auto_score", 0)
        bloom = r.get("bloom_level", "")
        pre_summary += f"- [{bloom}] {q[:60]}... → 점수: {score:.1f}\n"

    post_summary = ""
    for r in post_responses:
        q = r.get("question", r.get("item_id", ""))
        score = r.get("auto_score", 0)
        bloom = r.get("bloom_level", "")
        post_summary += f"- [{bloom}] {q[:60]}... → 점수: {score:.1f}\n"

    duration_min = learning_duration_sec // 60 if learning_duration_sec else 0

    prompt = f"""당신은 간호학 교육 평가 전문가입니다. 학습자의 사전-사후 평가 결과를 분석하여 학습 리포트를 작성하세요.

[주제] {node_id}
[학습 모드] {"읽기 학습" if mode == "reading" else "소크라틱 튜터링"}
[학습 시간] {duration_min}분

[사전 평가 결과] 총점: {pre_score:.2f}
{pre_summary if pre_summary else "문항 없음"}

[사후 평가 결과] 총점: {post_score:.2f}
{post_summary if post_summary else "문항 없음"}

[학습 이득(gain)] {gain:+.2f}

[교재 핵심]
{wiki_doc[:1500]}

출력 형식 (반드시 이 JSON만 출력):
{{
  "summary": "종합 평가 (3~4문장, 학습자에게 격려하는 톤)",
  "strengths": ["잘한 점1", "잘한 점2"],
  "weaknesses": ["부족한 점1", "부족한 점2"],
  "recommendations": ["구체적 학습 권고1", "구체적 학습 권고2", "구체적 학습 권고3"],
  "bloom_analysis": "블룸 분류 기반 분석 (어떤 수준까지 도달했는지, 1~2문장)",
  "gain_interpretation": "gain 해석 (향상/유지/하락에 대한 의미, 1~2문장)"
}}

규칙:
- 학습자를 격려하되 객관적으로 평가
- 구체적인 개념명을 언급하여 무엇이 부족한지 명확히
- recommendations는 실행 가능한 구체적 행동 제안"""

    try:
        response = await client.messages.create(
            model=SCORER_MODEL,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        print(f"[REPORT_GEN] {node_id}: 리포트 생성 완료")
        return result

    except Exception as e:
        print(f"[REPORT_GEN] {node_id} 리포트 생성 실패: {e}")
        # 폴백
        if gain > 0.1:
            gain_text = f"사전 대비 {gain:.0%} 향상되었습니다. 학습 효과가 있었습니다."
        elif gain > -0.05:
            gain_text = "사전과 비슷한 수준을 유지했습니다."
        else:
            gain_text = "사전보다 점수가 낮아졌습니다. 다시 복습이 필요합니다."

        return {
            "summary": f"{node_id} 학습을 완료했습니다. 사전 {pre_score:.0%} → 사후 {post_score:.0%}로 변화했습니다.",
            "strengths": ["학습을 끝까지 완료함"],
            "weaknesses": ["세부 분석을 위해 리포트 생성 API 확인 필요"],
            "recommendations": ["해당 주제를 다시 복습하세요", "관련 임상 사례를 찾아 적용해보세요"],
            "bloom_analysis": "자동 분석 실패",
            "gain_interpretation": gain_text,
        }
