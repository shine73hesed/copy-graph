# ALE v8 — 개발 스펙 (Development Specification)

> **버전**: v8.0  
> **작성일**: 2026-03-30  
> **목적**: v7의 Socratic 대화 엔진 위에 실험 평가 체계(Pre/Post/Retention)와 Reading Mode를 추가하여, 교수법 비교 실험 수행이 가능한 플랫폼으로 재설계

---

## 1. 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────┐
│                        ALE v8 Architecture                    │
│                                                               │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐ │
│  │ student  │    │  FastAPI  │    │  Claude  │    │ SQLite  │ │
│  │  .html   │◄──►│  Routes   │◄──►│   API    │    │   DB    │ │
│  │ (SPA)    │    │          │    │          │    │         │ │
│  └─────────┘    └──────────┘    └──────────┘    └─────────┘ │
│       │              │                               │       │
│       │         ┌────┴────┐                          │       │
│       │         │ Routes  │                          │       │
│       │         ├─────────┤                          │       │
│       │         │ auth    │──────────────────────────┤       │
│       │         │ session │──────────────────────────┤       │
│       │         │ tutor   │──┐                       │       │
│       │         │ reading │  │ Claude API             │       │
│       │         │ test    │  │                        │       │
│       │         │ report  │──┘                       │       │
│       │         └─────────┘                          │       │
│       │                                              │       │
│  ┌────┴──────────────────────────────────────────────┴───┐   │
│  │              Session State Machine                     │   │
│  │  PRE_TEST → LEARNING(A|B) → POST_TEST → COMPLETE      │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 세션 상태 머신

### 2.1 상태 정의

| 상태 | 코드 | 설명 |
|------|------|------|
| 사전 평가 | `pre_test` | 학습 전 Bloom별 문항으로 기존 수준 측정 |
| 학습 (읽기) | `learning_reading` | Mode A — 콘텐츠 자율 읽기, 대화 없음 |
| 학습 (대화) | `learning_tutoring` | Mode B — Socratic 대화 학습 (v7 엔진) |
| 사후 평가 | `post_test` | 독립 문항 응답, 튜터 없음 |
| 완료 | `completed` | gain 계산, 성적표 생성 |
| 복습 대기 | `retention_pending` | SM-2 간격에 따라 복습 예정 |
| 복습 중 | `retention_test` | 복습 퀴즈 진행 |

### 2.2 상태 전이도

```
                    ┌─────────────────────────────────────┐
                    │           Session Start               │
                    │     (mode 배정: reading / tutoring)   │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │   PRE_TEST     │
                          │  Bloom별 문항   │
                          │  pre_score 산출 │
                          └───────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐       ┌─────────────────────┐
          │ LEARNING_READING│       │ LEARNING_TUTORING   │
          │                 │       │                     │
          │ • 마크다운 읽기   │       │ • 마크다운 + 동영상  │
          │ • 동영상 시청    │       │ • Socratic 대화     │
          │ • 대화 없음      │       │ • 체크리스트 추적    │
          │ • 최소 시간 충족  │       │ • Bloom 태깅        │
          │   후 완료 버튼   │       │ • [TOPIC_COMPLETE]  │
          └────────┬────────┘       └──────────┬──────────┘
                   │                           │
                   └─────────────┬─────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │   POST_TEST    │
                        │  독립 문항 응답  │
                        │  Bloom별 분리   │
                        │  임상 사례 서술  │
                        │  post_score    │
                        └───────┬────────┘
                                │
                                ▼
                        ┌────────────────┐
                        │   COMPLETED    │
                        │  gain 계산     │
                        │  성적표 생성    │
                        └───────┬────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  RETENTION_PENDING  │
                     │  1일→3일→7일→14일   │
                     │  → 30일 간격        │
                     └──────────┬──────────┘
                                │ (N일 경과)
                                ▼
                     ┌─────────────────────┐
                     │   RETENTION_TEST    │
                     │   2~3문항 퀴즈       │
                     │   정답률→간격 조정    │
                     └─────────────────────┘
```

### 2.3 전이 조건

| From | To | 조건 |
|------|----|------|
| `pre_test` | `learning_*` | pre_test 문항 전부 응답 완료 |
| `learning_reading` | `post_test` | 최소 체류 시간 충족 + 완료 버튼 |
| `learning_tutoring` | `post_test` | Gate A(체크리스트 완료) && Gate B([TOPIC_COMPLETE]) |
| `post_test` | `completed` | post_test 문항 전부 응답 완료 |
| `completed` | `retention_pending` | 자동 (retention 스케줄 등록) |
| `retention_pending` | `retention_test` | 예정일 도달 + 사용자 접속 |

---

## 3. DB 스키마

### 3.1 learners (변경 없음)

```sql
CREATE TABLE IF NOT EXISTS learners (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    pin         TEXT NOT NULL,
    role        TEXT DEFAULT 'nurse',
    created_at  REAL NOT NULL
);
```

### 3.2 sessions (v8 재설계)

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id                   TEXT PRIMARY KEY,
    learner_id           TEXT NOT NULL,
    node_id              TEXT NOT NULL,
    mode                 TEXT NOT NULL DEFAULT 'tutoring',   -- 'reading' | 'tutoring'
    status               TEXT NOT NULL DEFAULT 'pre_test',    -- 상태머신 상태값
    -- pre_test
    pre_score            REAL,           -- 사전 평가 종합 점수 (0~1)
    pre_bloom            TEXT,           -- 사전 Bloom 도달 수준
    -- learning (tutoring 모드)
    total_turns          INTEGER DEFAULT 0,
    final_mastery        REAL,
    final_moving_avg     REAL,
    -- post_test
    post_score           REAL,           -- 사후 평가 종합 점수 (0~1)
    post_bloom           TEXT,           -- 사후 Bloom 도달 수준
    post_clinical        REAL,           -- 임상 적용 루브릭 점수 (0~1)
    -- 계산
    gain                 REAL,           -- post_score - pre_score
    -- 시간
    learning_started_at  REAL,
    learning_ended_at    REAL,
    learning_duration_sec INTEGER,
    -- 메타
    completed            INTEGER DEFAULT 0,
    created_at           REAL NOT NULL,
    updated_at           REAL NOT NULL,
    FOREIGN KEY (learner_id) REFERENCES learners(id)
);
```

### 3.3 test_items (v8 신규)

```sql
CREATE TABLE IF NOT EXISTS test_items (
    id          TEXT PRIMARY KEY,          -- "dementia_overview_R1"
    node_id     TEXT NOT NULL,
    bloom_level TEXT NOT NULL,             -- 'remember'|'understand'|'apply'|'analyze'
    item_type   TEXT NOT NULL,             -- 'mcq'|'short_answer'|'case_study'
    form        TEXT NOT NULL DEFAULT 'A', -- 'A'|'B' (동형검사 구분)
    question    TEXT NOT NULL,
    options     TEXT,                       -- MCQ: JSON 배열
    correct     TEXT,                       -- MCQ 정답 키 또는 서술형 모범답안
    rubric      TEXT,                       -- 채점 루브릭 (JSON)
    max_score   REAL NOT NULL DEFAULT 1.0,
    created_at  REAL NOT NULL
);
```

### 3.4 test_responses (v8 신규)

```sql
CREATE TABLE IF NOT EXISTS test_responses (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    learner_id      TEXT NOT NULL,
    item_id         TEXT NOT NULL,
    test_phase      TEXT NOT NULL,      -- 'pre_test'|'post_test'|'retention'
    response        TEXT NOT NULL,
    -- 채점 (binary 추출 기반)
    concept_results TEXT,               -- JSON: {"후천적_인지_저하": "yes", "ADL_장애": "no", ...}
    matched_count   INTEGER,            -- 언급된 핵심 개념 수
    total_count     INTEGER,            -- 필요 핵심 개념 수
    auto_score      REAL,               -- matched/total (코드 계산)
    human_score     REAL,               -- 인간 채점 (추후 입력)
    bloom_level     TEXT,
    scoring_brief   TEXT,
    -- 메타
    elapsed_sec     REAL,
    submitted_at    REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (item_id) REFERENCES test_items(id)
);
```

### 3.5 retention_schedule (v8 신규)

```sql
CREATE TABLE IF NOT EXISTS retention_schedule (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    learner_id      TEXT NOT NULL,
    node_id         TEXT NOT NULL,
    interval_days   INTEGER NOT NULL,     -- 1, 3, 7, 14, 30
    scheduled_date  TEXT NOT NULL,         -- YYYY-MM-DD
    status          TEXT DEFAULT 'pending', -- 'pending'|'completed'|'overdue'
    retention_score REAL,
    completed_at    REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 3.6 reading_logs (v8 신규)

```sql
CREATE TABLE IF NOT EXISTS reading_logs (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    event_type  TEXT NOT NULL,     -- 'scroll'|'video_play'|'video_pause'|'section_view'|'complete_click'
    event_data  TEXT,              -- JSON
    timestamp   REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 3.7 interaction_logs (v7 유지 + v8 컬럼 추가)

```sql
-- 기존 v7 컬럼 전부 유지, 아래 추가
ALTER TABLE interaction_logs ADD COLUMN bloom_level TEXT;
ALTER TABLE interaction_logs ADD COLUMN clinical_score REAL;
ALTER TABLE interaction_logs ADD COLUMN clinical_level INTEGER;
ALTER TABLE interaction_logs ADD COLUMN tutor_question_type TEXT;
ALTER TABLE interaction_logs ADD COLUMN newly_confirmed TEXT;
ALTER TABLE interaction_logs ADD COLUMN concept_results TEXT;      -- JSON: {"C1": true, "C2": false, ...}
ALTER TABLE interaction_logs ADD COLUMN matched_count INTEGER;
ALTER TABLE interaction_logs ADD COLUMN total_count INTEGER;
ALTER TABLE interaction_logs ADD COLUMN word_count_learner INTEGER;
ALTER TABLE interaction_logs ADD COLUMN word_count_tutor INTEGER;
ALTER TABLE interaction_logs ADD COLUMN word_ratio REAL;
ALTER TABLE interaction_logs ADD COLUMN info_density REAL;
```

### 3.8 conversation_logs, session_checklist (v7 유지, 변경 없음)

---

## 4. API 엔드포인트

### 4.1 인증

| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/login` | PIN 로그인 |
| POST | `/auth/register` | 신규 등록 |
| GET | `/auth/me` | 로그인 상태 |

### 4.2 세션

| Method | Path | Body/Params | 설명 |
|--------|------|-------------|------|
| POST | `/session/start` | `{node_id, mode}` | 새 세션 → pre_test 문항 반환 |
| GET | `/session/{sid}` | — | 세션 상태 조회 |
| GET | `/session/{sid}/restore` | — | 세션 복원 (대화+체크리스트+상태) |
| GET | `/sessions` | — | 내 세션 목록 |

### 4.3 평가 (Pre/Post/Retention)

| Method | Path | Body | 설명 |
|--------|------|------|------|
| POST | `/test/submit` | `{session_id, test_phase, responses[]}` | 평가 응답 제출 + 자동 채점 |
| GET | `/test/items/{node_id}?form=A&phase=pre_test` | — | 문항 조회 |

### 4.4 학습 — Tutoring

| Method | Path | Body | 설명 |
|--------|------|------|------|
| POST | `/tutor/message` | `{session_id, message}` | 학습자 메시지 → 튜터 응답 |

응답 스키마 (v8 binary 추출 기반):

```json
{
    "tutor_message": "...",
    "concept_results": {"C1": true, "C2": true, "C3": false, "C4": false, "C5": false},
    "score": 0.4,
    "matched_count": 2,
    "total_count": 5,
    "bloom_level": "understand",
    "clinical_score": null,
    "clinical_level": null,
    "checklist": {"C1": "confirmed", "C2": "confirmed", "C3": "not_yet", "C4": "not_yet", "C5": "not_yet"},
    "newly_confirmed": ["C2"],
    "moving_avg": 0.38,
    "word_count_learner": 45,
    "word_count_tutor": 120,
    "word_ratio": 0.375,
    "info_density": 4.44,
    "elapsed_sec": 32.1,
    "turn": 3,
    "is_complete": false
}
```

### 4.5 학습 — Reading

| Method | Path | Body | 설명 |
|--------|------|------|------|
| GET | `/reading/{node_id}/content` | — | 마크다운 + 동영상 URL |
| POST | `/reading/log` | `{session_id, event_type, event_data}` | 행동 로그 |
| POST | `/reading/complete` | `{session_id}` | 학습 완료 → post_test 전이 |

### 4.6 성적표 & Retention

| Method | Path | 설명 |
|--------|------|------|
| GET | `/report/{session_id}` | 성적표 |
| GET | `/retention/pending` | 복습 대기 목록 |
| POST | `/retention/start` | 복습 퀴즈 시작 |

---

## 5. 프론트엔드 상태 머신

### 5.1 화면 교체 로직

```javascript
const PHASES = {
    PRE_TEST: 'pre_test',
    LEARNING_READING: 'learning_reading',
    LEARNING_TUTORING: 'learning_tutoring',
    POST_TEST: 'post_test',
    COMPLETED: 'completed'
};

function transitionTo(phase) {
    state.phase = phase;
    document.querySelectorAll('.phase-panel').forEach(p => p.hidden = true);
    document.getElementById('panel-' + phase).hidden = false;
    updateHeader();
    saveState();
}
```

### 5.2 패널 구성

| 패널 | 내용 |
|------|------|
| `panel-pre_test` | 문항 카드 (MCQ 선택 + 서술형 입력) |
| `panel-learning_reading` | 마크다운 뷰어 + 동영상 + 완료 버튼 |
| `panel-learning_tutoring` | 대화 UI (v7 그대로) + 체크리스트 사이드바 |
| `panel-post_test` | 문항 카드 (pre와 동일 UI, 다른 문항) |
| `panel-completed` | 성적표 (gain, Bloom별 점수, 체크리스트 결과) |

### 5.3 elapsed_sec 측정

```javascript
// 프론트엔드에서 매 턴 시간 측정
let lastMessageTime = null;

function send() {
    const now = Date.now();
    const elapsed = lastMessageTime ? (now - lastMessageTime) / 1000 : null;
    lastMessageTime = now;
    
    fetch('/tutor/message', {
        method: 'POST',
        body: JSON.stringify({
            session_id: state.sessionId,
            message: input.value,
            elapsed_sec: elapsed
        })
    });
}
```

---

## 6. 채점 원칙: LLM = 데이터 추출기, 점수 = 코드 계산

### 6.1 핵심 원칙

```
[기존 v7]  LLM → "이 답변은 0.7점" → 저장
[v8]       LLM → "개념A: yes, 개념B: no, 개념C: yes" → 코드가 2/3 = 0.67 계산
```

LLM에게 점수를 매기라고 하지 않는다. LLM은 **개념 유무를 binary(yes/no)로 판별**하는 추출기 역할만 한다. 점수는 `matched / total` 공식으로 코드가 산출한다. 이 원칙은 Pre-test, 형성 평가(매 턴), Post-test 전부에 동일하게 적용된다.

### 6.2 Tutor 턴별 평가 (형성 평가)

#### EVAL 태그 변경

기존 v7: `[EVAL:score:brief]` (LLM이 score를 직접 산출)

v8: `[EVAL:C1:yes,C2:no,C3:yes,C4:no,C5:no:bloom:brief]`

```
예시:
[EVAL:C1:yes,C2:yes,C3:no,C4:no,C5:no:understand:후천적 개념 이해했으나 ADL 미언급]
```

#### 서버 파싱 + 점수 계산 (test_scorer.py)

```python
def calculate_turn_score(eval_tag: str, checklist_items: list) -> dict:
    """EVAL 태그에서 binary 추출 → 점수 계산"""
    # 파싱: C1:yes,C2:no,C3:yes → {"C1": True, "C2": False, "C3": True}
    concept_results = parse_eval_tag(eval_tag)
    
    matched = sum(1 for v in concept_results.values() if v)
    total = len(concept_results)
    score = matched / total if total > 0 else 0.0
    
    # 새로 confirmed된 항목 추출
    newly_confirmed = [k for k, v in concept_results.items() 
                       if v and checklist_state.get(k) == 'not_yet']
    
    return {
        "score": round(score, 4),
        "matched": matched,
        "total": total,
        "concept_results": concept_results,  # 투명한 근거
        "newly_confirmed": newly_confirmed,
        "bloom_level": parsed_bloom,
        "brief": parsed_brief
    }
```

#### 임상 적용 (C5) 점수도 동일 원칙

C5 턴에서 LLM이 직접 Level을 매기지 않는다. 대신:

```python
def calculate_clinical_level(concept_results: dict) -> tuple:
    """C1~C4 언급 개수 + 구조화 여부로 Level 자동 결정"""
    evidence_count = sum(1 for k in ['C1','C2','C3','C4'] 
                         if concept_results.get(k))
    has_structure = concept_results.get('structured', False)  # 논리적 순서 유무
    has_limitation = concept_results.get('limitation', False)  # 감별 한계 인식
    
    if evidence_count == 0:
        return 1, 0.2   # Level 1: 결론만
    elif evidence_count == 1:
        return 2, 0.4   # Level 2: 근거 1개
    elif evidence_count <= 3 and not has_structure:
        return 3, 0.6   # Level 3: 근거 2~3개
    elif evidence_count >= 4 and has_structure and not has_limitation:
        return 4, 0.8   # Level 4: 전부 + 구조화
    elif evidence_count >= 4 and has_structure and has_limitation:
        return 5, 1.0   # Level 5: + 감별 한계
    else:
        return 3, 0.6
```

### 6.3 Pre/Post test 채점 프롬프트

#### MCQ

코드가 정답 키 매칭. LLM 불필요. score = 1.0 (정답) / 0.0 (오답).

#### 서술형 — LLM 추출 프롬프트

```
당신은 간호학 답변 분석기입니다. 점수를 매기지 마세요.
학습자의 답변에서 아래 핵심 개념이 언급되었는지 각각 yes/no로만 판별하세요.

문항: {question}
학습자 답변: {response}

핵심 개념:
1. 후천적 인지 저하 — 이전에는 정상이었다가 나중에 저하되었다는 의미의 언급
2. 다영역 침범 — 기억력 외 다른 인지 영역(실행기능, 언어, 시공간 등)도 저하
3. ADL 장애 — 일상생활 활동(요리, 금전관리, 운전 등)에 지장
4. 증후군 개념 — 치매가 단일 질환이 아닌 여러 원인의 증상 묶음
5. 구조화된 논리 — 근거를 나열이 아닌 체계적 순서로 제시
6. 추가 평가 제안 — MMSE 등 후속 검사 필요성 언급

JSON으로만 응답:
{
    "후천적_인지_저하": "yes" 또는 "no",
    "다영역_침범": "yes" 또는 "no",
    "ADL_장애": "yes" 또는 "no",
    "증후군_개념": "yes" 또는 "no",
    "구조화된_논리": "yes" 또는 "no",
    "추가_평가_제안": "yes" 또는 "no",
    "brief": "한줄 요약"
}
```

#### 서버에서 점수 산출

```python
def score_short_answer(llm_extraction: dict, rubric: dict) -> dict:
    """LLM binary 추출 결과 + 루브릭 가중치 → 점수 산출"""
    total_weight = 0
    earned_weight = 0
    matched_concepts = []
    missing_concepts = []
    
    for criterion in rubric["criteria"]:
        concept_key = criterion["concept_key"]  # 루브릭의 키
        weight = criterion["weight"]
        total_weight += weight
        
        if llm_extraction.get(concept_key) == "yes":
            earned_weight += weight
            matched_concepts.append(concept_key)
        else:
            missing_concepts.append(concept_key)
    
    score = earned_weight / total_weight if total_weight > 0 else 0.0
    
    return {
        "score": round(score, 4),
        "matched": matched_concepts,
        "missing": missing_concepts,
        "matched_count": len(matched_concepts),
        "total_count": len(rubric["criteria"]),
        "brief": llm_extraction.get("brief", "")
    }
```

### 6.4 Bloom 수준 판정

Bloom도 LLM 직접 판정 대신, 규칙 기반으로 보조:

```python
def determine_bloom(concept_results: dict, question_bloom: str) -> str:
    """응답에서 달성한 Bloom 수준 결정"""
    matched = sum(1 for v in concept_results.values() if v == "yes")
    total = len(concept_results)
    ratio = matched / total if total > 0 else 0
    
    # 문항이 요구하는 Bloom 수준과 달성 비율로 결정
    if ratio >= 0.8:
        return question_bloom  # 문항 수준 달성
    elif ratio >= 0.5:
        # 한 단계 아래
        bloom_order = ['remember', 'understand', 'apply', 'analyze']
        idx = bloom_order.index(question_bloom)
        return bloom_order[max(0, idx - 1)]
    else:
        return 'remember'
```

### 6.5 하브루타 "AI에게 가르치기" 규칙

Tutor system prompt에 추가:

```
규칙 9: 체크리스트 항목이 confirmed 되었을 때, 가끔(2~3번에 1번) 
"제가 잘 이해가 안 가는데, 다시 한번 설명해 주시겠어요?"라고 요청하세요.
학습자가 확인된 개념을 자기 말로 재설명하게 하여 깊은 이해를 유도합니다.
```

### 6.6 Tutoring 응답에 추가되는 프로세스 지표

```python
# interaction_logs에 저장되는 보조 지표
{
    "word_count_learner": len(answer.split()),       # 학습자 발화량
    "word_count_tutor": len(tutor_response.split()), # 튜터 발화량  
    "word_ratio": learner / tutor,                   # 자기주도성 지표
    "info_density": matched_count / word_count_learner * 100  # 정보 밀도
}
```

이 지표들은 **종속변수가 아니라**, "왜 Tutoring이 효과적이었는가"를 설명하는 탐색적 보조 데이터.

---

## 7. 파일 구조

```
agentic_ale_v8/
├── main.py
├── database.py
├── claude_client.py           -- v7 + bloom/clinical 파싱
├── routes/
│   ├── auth.py
│   ├── session.py             -- 세션 생성/상태전이/복원
│   ├── tutor.py               -- Socratic 대화 (v7 로직 분리)
│   ├── reading.py             -- Reading 모드 콘텐츠 + 행동 로그
│   ├── test.py                -- Pre/Post/Retention 평가 + 채점
│   └── report.py              -- 성적표
├── domain/
│   ├── state_machine.py       -- 세션 상태 전이
│   ├── test_scorer.py         -- binary 추출 파싱 + matched/total 점수 계산
│   ├── retention.py           -- SM-2 스케줄러
│   └── bloom.py               -- Bloom 규칙 기반 판정
├── templates/
│   ├── student.html           -- 학습자 SPA
│   ├── login.html
│   └── admin.html             -- 문항 관리 + 데이터 조회
├── content/
│   ├── wiki_docs/             -- 노드 마크다운 (기존)
│   └── test_items/            -- 노드별 문항 풀 JSON
│       └── 01.치매개요.json
├── static/
└── data/
    └── ale.db
```

---

## 8. 실험 배정 로직

```python
def assign_mode(learner_id: str, node_id: str) -> str:
    """Within-subjects crossover 배정"""
    previous = get_learner_completed_modes(learner_id)
    if not previous:
        return random.choice(['reading', 'tutoring'])
    return 'reading' if previous[-1] == 'tutoring' else 'tutoring'
```

---

## 9. v7 재사용 목록

| 컴포넌트 | 재사용 | 변경 사항 |
|----------|--------|----------|
| claude_client.py | ✅ | EVAL 태그 → binary 추출 형태로 변경, score는 서버가 계산 |
| Socratic 대화 루프 | ✅ | tutor.py로 분리 |
| 체크리스트 추적 | ✅ | newly_confirmed 추가 |
| student.html 대화 UI | ✅ | 상태머신 래퍼 내부로 이동 |
| BKT 엔진 | ✅ | 보조 지표 유지 |
| KG JSON | ✅ | 변경 없음 |
| 노드 마크다운 | ✅ | Reading 모드에서도 사용 |
| 로그인/인증 | ✅ | 변경 없음 |

---

## 10. 구현 순서

### Phase 1 — 실험 가능 최소 단위

| # | 작업 | 예상 |
|---|------|------|
| 1 | DB 스키마 v8 | 0.5일 |
| 2 | state_machine.py | 0.5일 |
| 3 | test.py — Pre/Post API + LLM 채점 | 1일 |
| 4 | student.html — 문항 카드 UI | 1일 |
| 5 | reading.py — 콘텐츠 서빙 + 행동 로그 | 0.5일 |
| 6 | student.html — Reading 뷰어 | 0.5일 |
| 7 | 치매 개요 문항 풀 (Bloom별 12~15문항) | 1일 |
| 8 | tutor.py — v7 + bloom/clinical 파싱 | 0.5일 |

### Phase 2 — 분석

| # | 작업 | 예상 |
|---|------|------|
| 9 | report.py — 성적표 API | 0.5일 |
| 10 | 성적표 UI | 0.5일 |
| 11 | admin.html — 데이터 조회/CSV 내보내기 | 1일 |

### Phase 3 — Retention

| # | 작업 | 예상 |
|---|------|------|
| 12 | retention.py — SM-2 스케줄러 | 0.5일 |
| 13 | Retention 퀴즈 UI | 0.5일 |
