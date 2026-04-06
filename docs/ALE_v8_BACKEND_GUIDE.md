# ALE v8 — 백엔드 개발 가이드 (FastAPI)

> **기반**: v7 코드 분석 결과  
> **원칙**: FastAPI 유지, v7 코드 리팩토링 + v8 신규 모듈 추가  
> **Claude Code 작업용 문서**

---

## 1. v7 → v8 백엔드 구조 변경 맵

### v7 현재 구조

```
main.py                          (90L)  — FastAPI 앱, 라우팅, 미들웨어
database.py                      (537L) — DB 스키마 + CRUD 헬퍼
routes/
  auth.py                        (149L) — PIN 로그인/회원가입
  test_session.py                (1423L) — 세션/대화/KG/노트 전부 한 파일
services/
  claude_client.py               (580L) — Analyst + Tutor 프롬프트 + API 호출
  scorer.py                      (101L) — should_update, quick_score
  bkt_service.py                 (68L)  — BKT 엔진
  zpd_tracker.py                 (64L)  — ZPD/struggle
  content_loader.py              (198L) — 마크다운/plan 로딩
  kg_service.py                  (63L)  — KG JSON 로딩
  logger.py                      — 로깅
```

### v8 목표 구조

```
main.py                          — FastAPI 앱 (v7 기반, 라우트 추가)
database.py                      — v7 + v8 테이블/헬퍼 추가
config.py                        — 환경 설정

routes/
  auth.py                        — v7 유지
  session.py                     ★ 신규: 세션 생성/상태전이/복원 (test_session.py에서 분리)
  tutor.py                       ★ 신규: Socratic 대화 (test_session.py의 handle_answer 분리)
  reading.py                     ★ 신규: Reading 모드 콘텐츠 + 행동 로그
  test.py                        ★ 신규: Pre/Post/Retention 평가 + binary 추출 채점
  report.py                      ★ 신규: 성적표
  admin.py                       ★ 신규: DB 조회/CSV 내보내기 (test_session.py의 /db/* 분리)
  kg.py                          ★ 신규: KG API (test_session.py의 /test/kg 분리)
  wiki.py                        ★ 신규: Wiki/노트 API (test_session.py의 /test/wiki* 분리)

services/
  claude_client.py               — v7 기반 + binary 추출 채점 프롬프트 추가
  test_scorer.py                 ★ 신규: binary 추출 파싱 + matched/total 점수 계산
  bkt_service.py                 — v7 유지
  zpd_tracker.py                 — v7 유지
  content_loader.py              — v7 유지
  kg_service.py                  — v7 유지
  state_machine.py               ★ 신규: 세션 상태 전이 로직
  retention.py                   ★ 신규: SM-2 스케줄러
  logger.py                      — v7 유지
```

---

## 2. test_session.py 분리 맵

v7의 `test_session.py` (1423L)가 모든 라우트를 담고 있음. 이걸 기능별로 분리:

| v7 test_session.py 라인 | 함수/라우트 | v8 이동 위치 |
|------------------------|-----------|-------------|
| L42-115 | `get_next_nodes()`, `get_connected_nodes()` | `routes/kg.py` |
| L135-388 | `POST /test/start` | `routes/session.py` → `POST /session/start` |
| L390-793 | `POST /test/answer` (handle_answer) | `routes/tutor.py` → `POST /tutor/message` |
| L794-825 | `GET /test/status` | `routes/session.py` → `GET /session/{sid}` |
| L826-845 | `GET /test/sessions` | `routes/session.py` → `GET /sessions` |
| L846-917 | `GET /test/restore` | `routes/session.py` → `GET /session/{sid}/restore` |
| L918-986 | `GET /test/kg` | `routes/kg.py` |
| L987-1006 | `GET /test/cost` | `routes/admin.py` |
| L1007-1094 | `GET /test/node-history` | `routes/report.py` |
| L1095-1175 | `/db/*` 엔드포인트들 | `routes/admin.py` |
| L1176-1286 | `POST /test/resume` | `routes/session.py` → `POST /session/resume` |
| L1287-1309 | `GET /test/summary/{node_id}` | `routes/wiki.py` |
| L1310-1377 | `GET /test/wiki/{node_id}`, `GET /test/wiki-list` | `routes/wiki.py` |
| L1378-1430 | 노트 API들 | `routes/wiki.py` |

### 인메모리 sessions dict

v7에서 `sessions = {}` (인메모리 dict)로 세션 상태를 관리. v8에서도 유지하되, `routes/session.py`에서 import하여 사용:

```python
# routes/session.py
sessions: dict[str, dict] = {}  # 인메모리 세션 저장소
```

---

## 3. 신규 라우트 상세

### 3.1 routes/session.py

v7의 `/test/start`를 확장하여 v8 상태머신 적용.

```python
# POST /session/start
# 변경점: mode 파라미터 추가, 상태를 'pre_test'로 시작, pre_test 문항 반환

async def start_session(request: Request):
    data = await request.json()
    node_id = data["node_id"]
    mode = data.get("mode", "tutoring")  # 'reading' | 'tutoring' | 'random'
    
    # v7 기존 로직: learner_id 추출, wiki_doc 로딩, 체크리스트 생성
    # ... (test_session.py L135-388 로직 재사용)
    
    # v8 추가: mode 배정
    if mode == "random":
        mode = assign_mode(learner_id, node_id)
    
    # v8 추가: DB에 mode, status='pre_test' 저장
    session_id = await create_session_v8(learner_id, node_id, mode)
    
    # v8 추가: pre_test 문항 로딩
    pre_items = await load_test_items(node_id, form='A', phase='pre_test')
    
    # 인메모리 세션에 v8 필드 추가
    sessions[session_id] = {
        # ... v7 필드 전부 유지 ...
        "mode": mode,
        "status": "pre_test",
        "pre_items": pre_items,
        "learning_started_at": None,
    }
    
    return {
        "session_id": session_id,
        "mode": mode,
        "status": "pre_test",
        "pre_test_items": pre_items,
        # v7 필드도 유지 (checklist_items, first_message 등은 learning 단계에서 사용)
    }
```

### 3.2 routes/tutor.py

v7의 `handle_answer` (L390-793) 를 거의 그대로 이동. 변경점:

```python
# POST /tutor/message
# 변경점:
# 1. EVAL 태그 파싱을 binary 추출 방식으로 변경
# 2. score를 LLM이 아닌 코드가 계산
# 3. 보조 지표(word_count, info_density) 추가
# 4. elapsed_sec를 프론트엔드에서 받아 저장

async def handle_message(request: Request):
    data = await request.json()
    session_id = data["session_id"]
    answer = data["message"]
    elapsed_sec = data.get("elapsed_sec")  # v8: 프론트에서 측정
    
    # ... v7 handle_answer 로직 (L390-793) 대부분 재사용 ...
    
    # v8 변경: Analyst 결과에서 binary 추출
    analyst_result = await analyze_answer_v8(...)  # binary 추출 방식
    concept_results = analyst_result["concept_results"]  # {"C1": true, "C2": false, ...}
    
    # v8: 코드가 점수 계산
    from services.test_scorer import calculate_turn_score
    score_data = calculate_turn_score(concept_results, session["checklist_items"])
    score = score_data["score"]
    
    # v8: 보조 지표
    word_count_learner = len(answer)
    word_count_tutor = len(tutor_message)
    word_ratio = word_count_learner / max(word_count_tutor, 1)
    info_density = score_data["matched_count"] / max(word_count_learner, 1) * 100
    
    # interaction_logs 저장 시 v8 필드 추가
    await save_interaction({
        # ... v7 필드 전부 ...
        "elapsed_sec": elapsed_sec,
        "bloom_level": score_data["bloom_level"],
        "clinical_score": clinical_score,
        "clinical_level": clinical_level,
        "concept_results": json.dumps(concept_results),
        "matched_count": score_data["matched_count"],
        "total_count": score_data["total_count"],
        "newly_confirmed": json.dumps(score_data["newly_confirmed"]),
        "word_count_learner": word_count_learner,
        "word_count_tutor": word_count_tutor,
        "word_ratio": round(word_ratio, 4),
        "info_density": round(info_density, 2),
    })
```

### 3.3 routes/test.py

완전 신규. Pre/Post/Retention 평가.

```python
# POST /test/submit
async def submit_test(request: Request):
    data = await request.json()
    session_id = data["session_id"]
    test_phase = data["test_phase"]  # 'pre_test' | 'post_test' | 'retention'
    responses = data["responses"]     # [{item_id, response, elapsed_sec}, ...]
    
    session = sessions[session_id]
    results = []
    
    for resp in responses:
        item = await get_test_item(resp["item_id"])
        
        if item["item_type"] == "mcq":
            # MCQ: 코드가 정답 매칭
            score = 1.0 if resp["response"] == item["correct"] else 0.0
            concept_results = None
        else:
            # 서술형: LLM binary 추출 → 코드가 점수 계산
            extraction = await extract_concepts(resp["response"], item["rubric"])
            score_data = score_short_answer(extraction, item["rubric"])
            score = score_data["score"]
            concept_results = extraction
        
        # DB 저장
        await save_test_response({
            "session_id": session_id,
            "item_id": resp["item_id"],
            "test_phase": test_phase,
            "response": resp["response"],
            "concept_results": json.dumps(concept_results) if concept_results else None,
            "matched_count": score_data.get("matched_count"),
            "total_count": score_data.get("total_count"),
            "auto_score": score,
            "bloom_level": item["bloom_level"],
            "elapsed_sec": resp.get("elapsed_sec"),
        })
        results.append({"item_id": resp["item_id"], "auto_score": score, "bloom": item["bloom_level"]})
    
    # 종합 점수 계산 (가중 평균)
    phase_score = calculate_phase_score(results)
    phase_bloom = determine_phase_bloom(results)
    
    # 세션 상태 전이
    if test_phase == "pre_test":
        session["pre_score"] = phase_score
        session["pre_bloom"] = phase_bloom
        session["status"] = f"learning_{session['mode']}"
        session["learning_started_at"] = time.time()
        # DB 업데이트
        await update_session_pre_score(session_id, phase_score, phase_bloom)
    
    elif test_phase == "post_test":
        pre_score = session.get("pre_score", 0)
        gain = phase_score - pre_score
        session["post_score"] = phase_score
        session["post_bloom"] = phase_bloom
        session["gain"] = gain
        session["status"] = "completed"
        # DB 업데이트
        await update_session_post_score(session_id, phase_score, phase_bloom, gain)
    
    # 다음 상태 + 필요 데이터 반환
    next_data = {}
    if test_phase == "pre_test" and session["mode"] == "tutoring":
        next_data["first_message"] = session.get("first_message")
        next_data["checklist_items"] = session.get("checklist_items")
    elif test_phase == "pre_test" and session["mode"] == "reading":
        next_data["content_url"] = f"/reading/{session['node_id']}/content"
    elif test_phase == "post_test":
        next_data["report"] = build_report(session)
    
    return {
        "test_phase": test_phase,
        "scores": results,
        "phase_score": phase_score,
        "phase_bloom": phase_bloom,
        "next_status": session["status"],
        **next_data,
    }
```

### 3.4 routes/reading.py

완전 신규.

```python
# GET /reading/{node_id}/content
async def get_reading_content(node_id: str):
    """노드 마크다운 + 동영상 URL 반환"""
    wiki_doc = load_wiki_doc(node_id)
    # content_loader.py의 load_unified_content 재사용
    unified = load_unified_content(node_id)
    return {
        "node_id": node_id,
        "markdown": unified.get("core", wiki_doc),
        "mermaid_diagrams": unified.get("mermaid", []),
        "video_urls": [],  # 추후 추가
        "min_reading_sec": calculate_min_reading_time(wiki_doc),
    }

# POST /reading/log
async def log_reading_event(request: Request):
    """Reading 모드 행동 로그 저장"""
    data = await request.json()
    await save_reading_log(data["session_id"], data["event_type"], data.get("event_data"))

# POST /reading/complete
async def complete_reading(request: Request):
    """Reading 완료 → post_test 전이"""
    data = await request.json()
    session = sessions[data["session_id"]]
    
    elapsed = time.time() - session["learning_started_at"]
    min_required = session.get("min_reading_sec", 300)
    
    if elapsed < min_required:
        return {"allowed": False, "elapsed_sec": elapsed, "required_sec": min_required}
    
    session["status"] = "post_test"
    session["learning_duration_sec"] = int(elapsed)
    post_items = await load_test_items(session["node_id"], form='B', phase='post_test')
    
    return {"allowed": True, "next_status": "post_test", "post_test_items": post_items}
```

---

## 4. claude_client.py 변경

### 4.1 Analyst 프롬프트 변경 (binary 추출)

v7의 `ANALYST_SYSTEM`에서 score 직접 산출 부분을 제거하고, binary 추출만 요청:

```python
# 기존 v7 (제거)
# "## 판별 2: 이번 턴 답변의 이해 수준 (score)
#  0.8~1.0: 개념을 자기 말로 재구성 + 개념 간 연결 ..."

# v8 교체
ANALYST_SYSTEM_V8 = """당신은 치매 돌봄 교육의 학습 분석가입니다.
학습자의 답변에서 각 체크리스트 항목이 언급되었는지 yes/no로만 판별하세요.
점수를 매기지 마세요.

## 판별 기준
{v7의 기존 confirmed/not_yet 기준 그대로 유지}

## 출력 형식 (반드시 이 JSON만 출력)
{"C1":"yes","C2":"no","C3":"yes","C4":"no","C5":"no","bloom":"understand","brief":"후천적 개념 이해했으나 ADL 미언급"}
"""
```

### 4.2 Pre/Post 채점용 새 함수

```python
async def extract_concepts(response: str, rubric: dict) -> dict:
    """서술형 답변에서 핵심 개념 유무를 binary 추출"""
    concepts_desc = "\n".join([
        f"{i+1}. {c['concept']} — {c['desc']}" 
        for i, c in enumerate(rubric["criteria"])
    ])
    
    prompt = f"""당신은 간호학 답변 분석기입니다. 점수를 매기지 마세요.
학습자의 답변에서 아래 핵심 개념이 언급되었는지 각각 yes/no로만 판별하세요.
간접적 표현도 의미가 통하면 yes로 판별합니다.

문항: {{question}}
학습자 답변: {response}

핵심 개념:
{concepts_desc}

JSON으로만 응답:
{{{", ".join([f'"{c["key"]}": "yes/no"' for c in rubric["criteria"]])},"brief":"한줄 요약"}}"""
    
    # Claude API 호출 (기존 analyze_answer와 동일한 패턴)
    ...
```

### 4.3 하브루타 규칙 추가

`TUTOR_SYSTEM_V2`에 규칙 9 추가:

```python
# 기존 규칙 8 뒤에 추가
"""
9. 체크리스트 항목이 confirmed 되었을 때, 2~3번에 1번 정도
"제가 잘 이해가 안 가는데, 다시 한번 설명해 주시겠어요?"라고 요청하세요.
학습자가 확인된 개념을 자기 말로 재설명하게 하여 깊은 이해를 확인합니다.
"""
```

---

## 5. database.py 변경

### 5.1 sessions 테이블 ALTER

```python
v8_session_migrations = [
    ("sessions", "mode", "TEXT DEFAULT 'tutoring'"),
    ("sessions", "pre_score", "REAL"),
    ("sessions", "pre_bloom", "TEXT"),
    ("sessions", "post_score", "REAL"),
    ("sessions", "post_bloom", "TEXT"),
    ("sessions", "post_clinical", "REAL"),
    ("sessions", "gain", "REAL"),
    ("sessions", "learning_started_at", "REAL"),
    ("sessions", "learning_ended_at", "REAL"),
    ("sessions", "learning_duration_sec", "INTEGER"),
]
```

### 5.2 interaction_logs ALTER

```python
v8_interaction_migrations = [
    ("interaction_logs", "bloom_level", "TEXT"),
    ("interaction_logs", "clinical_score", "REAL"),
    ("interaction_logs", "clinical_level", "INTEGER"),
    ("interaction_logs", "concept_results", "TEXT"),
    ("interaction_logs", "matched_count", "INTEGER"),
    ("interaction_logs", "total_count", "INTEGER"),
    ("interaction_logs", "newly_confirmed", "TEXT"),
    ("interaction_logs", "word_count_learner", "INTEGER"),
    ("interaction_logs", "word_count_tutor", "INTEGER"),
    ("interaction_logs", "word_ratio", "REAL"),
    ("interaction_logs", "info_density", "REAL"),
]
```

### 5.3 신규 CREATE TABLE

DEV_SPEC의 3.3~3.6 그대로: `test_items`, `test_responses`, `retention_schedule`, `reading_logs`.

### 5.4 신규 헬퍼 함수

```python
async def create_session_v8(learner_id, node_id, mode) -> str
async def update_session_pre_score(session_id, pre_score, pre_bloom)
async def update_session_post_score(session_id, post_score, post_bloom, gain)
async def save_test_response(data: dict) -> str
async def get_test_item(item_id: str) -> dict
async def load_test_items(node_id, form, phase) -> list
async def save_reading_log(session_id, event_type, event_data)
async def save_retention_schedule(session_id, learner_id, node_id, interval_days)
```

---

## 6. 신규 서비스

### 6.1 services/test_scorer.py

```python
def calculate_turn_score(concept_results: dict, checklist_items: list) -> dict
def score_short_answer(extraction: dict, rubric: dict) -> dict
def calculate_clinical_level(concept_results: dict) -> tuple[int, float]
def determine_bloom(concept_results: dict, question_bloom: str) -> str
def calculate_phase_score(results: list) -> float  # 가중 평균
```

### 6.2 services/state_machine.py

```python
VALID_TRANSITIONS = {
    "pre_test": ["learning_reading", "learning_tutoring"],
    "learning_reading": ["post_test"],
    "learning_tutoring": ["post_test"],
    "post_test": ["completed"],
    "completed": ["retention_pending"],
    "retention_pending": ["retention_test"],
}

def can_transition(current: str, target: str) -> bool
def transition(session: dict, target: str) -> dict
```

### 6.3 services/retention.py

```python
def calculate_next_interval(current_interval: int, score: float) -> int
def get_pending_retentions(learner_id: str) -> list
```

---

## 7. main.py 변경

```python
# v8: 라우터 분리 반영
from routes.session import router as session_router
from routes.tutor import router as tutor_router
from routes.reading import router as reading_router
from routes.test import router as test_router
from routes.report import router as report_router
from routes.admin import router as admin_router
from routes.kg import router as kg_router
from routes.wiki import router as wiki_router

app.include_router(session_router)
app.include_router(tutor_router)
app.include_router(reading_router)
app.include_router(test_router)
app.include_router(report_router)
app.include_router(admin_router)
app.include_router(kg_router)
app.include_router(wiki_router)
app.include_router(auth_router)  # v7 유지

# v8: Next.js 프론트는 별도 서빙이므로 templates 라우트는 /test, /student만 유지 (개발 중 호환용)
```

---

## 8. API 경로 마이그레이션 (v7 → v8)

| v7 경로 | v8 경로 | 비고 |
|---------|---------|------|
| `POST /test/start` | `POST /session/start` | mode 파라미터 추가, pre_test 문항 반환 |
| `POST /test/answer` | `POST /tutor/message` | binary 추출 채점, elapsed_sec 수신 |
| `GET /test/status` | `GET /session/{sid}` | 상태머신 status 포함 |
| `GET /test/restore` | `GET /session/{sid}/restore` | v7과 동일 |
| `GET /test/sessions` | `GET /sessions` | v7과 동일 |
| `POST /test/resume` | `POST /session/resume` | v7과 동일 |
| `GET /test/kg` | `GET /kg` | v7과 동일 |
| `GET /test/wiki/*` | `GET /wiki/*` | v7과 동일 |
| `GET /test/note/*` | `GET /wiki/note/*` | v7과 동일 |
| — (신규) | `POST /test/submit` | Pre/Post/Retention 평가 |
| — (신규) | `GET /reading/{node_id}/content` | Reading 모드 |
| — (신규) | `POST /reading/log` | 행동 로그 |
| — (신규) | `POST /reading/complete` | Reading 완료 |
| — (신규) | `GET /report/{sid}` | 성적표 |

---

## 9. 문항 풀 파일

```
content/
  test_items/
    치매_개요.json          ← EVAL_FRAMEWORK의 7.1, 7.2 문항을 JSON으로 저장
    알츠하이머병.json        ← 추후 추가
    ...
```

서버 시작 시 `test_items/*.json`을 읽어 `test_items` 테이블에 upsert.

---

## 10. 작업 순서 (Claude Code용)

```
Phase 1: 골격
  1. database.py — v8 테이블 추가 + 마이그레이션 + 헬퍼 함수
  2. services/test_scorer.py — binary 추출 파싱 + 점수 계산
  3. services/state_machine.py — 상태 전이
  4. routes/session.py — test_session.py에서 세션 관련 코드 분리 + v8 상태머신
  5. routes/tutor.py — test_session.py에서 handle_answer 분리 + binary 채점
  6. routes/test.py — Pre/Post 평가 API
  7. routes/reading.py — Reading 모드
  8. main.py — 라우터 등록

Phase 2: 채점
  9. claude_client.py — ANALYST_SYSTEM을 binary 추출로 변경
  10. claude_client.py — extract_concepts 함수 추가
  11. 치매_개요.json 문항 풀 작성

Phase 3: 나머지 분리
  12. routes/admin.py — /db/* 분리
  13. routes/kg.py — KG API 분리
  14. routes/wiki.py — Wiki/노트 API 분리
  15. routes/report.py — 성적표 API
```
