# ALE v8.2 — 프론트엔드 리디자인 설계서 (v2)

> 수정 반영: wiki 2-panel, Detail에서 모드 선택, pre/post 스킵 조건, 보고서 모바일 카드형, 백엔드 디버그 로깅

---

## 1. 수정 요약 (v1 → v2)

| # | v1 설계 | v2 수정 |
|---|---------|---------|
| 1 | wiki.html 3-panel (slim + TOC + article + meta) | **2-panel** (TOC + article). slim sidebar 삭제, meta panel 삭제 |
| 2 | Detail에서 NEW 버튼 + 모드 선택 팝업 | **NEW 삭제**. 노드 선택 시 대화 목록에서 모드(읽기/대화) 선택 → 새 세션 생성 |
| 3 | pre/post 항상 실행 | **기존 완료 세션 복원 시 pre/post 스킵**. 헤더에 보고서 버튼 추가 |
| 4 | 기존 TestCard 디자인 | 첨부 이미지1 스타일로 교체 (상단 progress bar, 중앙 질문+옵션, 하단 Next 버튼) |
| 5 | 기존 Report.tsx (리스트형) | 첨부 이미지2 모바일 카드형 (Health앱 스타일: 둥근 카드, 아이콘, 큰 숫자) |
| 6 | 백엔드 변경 없음 | **test_debug_logs 테이블 신규** — pre/post 채점 과정 상세 로깅 |

---

## 2. Reading: 3-panel → 2-panel

### 삭제 항목
- **slim sidebar** (72px 아이콘 바): 불필요. 네비게이션은 헤더의 뒤로가기 버튼으로 충분
- **meta panel** (280px 우측): 문서정보/목차/관련개념 삭제. 관련 개념은 TOC에서 충분히 표현

### 최종 레이아웃
```
┌──────────────┬────────────────────────────────────┐
│  TOC panel   │         article                    │
│  280px       │         flex:1                     │
│              │                                    │
│ 검색          │  [← 이전] [2/50] [다음 →] [A-][A+] │
│ 도메인별 목록  │  ──────────────────────────────── │
│              │  본문 (marked.js, prose 스타일)      │
│              │                                    │
│ N개 교재      │  [학습 완료 →] (최소 시간 도달 시)    │
│ N개 읽음      │                                    │
└──────────────┴────────────────────────────────────┘
상단: readBar (position: fixed, 프로그레스바)
```

### 컴포넌트 (수정)
```
components/reading/
  ├ ReadingLayout.tsx    — 2-panel (TOC + article)
  ├ TOCPanel.tsx         — 검색 + 도메인별 교재 목록 (wiki.html 그대로)
  ├ ArticleView.tsx      — 헤더(breadcrumb+nav+폰트조절) + 본문 + 완료 버튼
  ├ ReadBar.tsx          — 상단 프로그레스바
  └ MarkdownViewer.tsx   — 기존 확장 (prose 스타일 적용)
```

SlimSidebar.tsx, MetaPanel.tsx **삭제**.

---

## 3. Detail View: 모드 선택 통합

### v1: NEW 버튼 + 모드 팝업
### v2: 대화 목록 안에서 모드 선택

노드 선택 시 우측 사이드바 구조:

```
┌─────────────────────────────────────┐
│ ● 알츠하이머병                        │
├─────────────────────────────────────┤
│  학습 시작                            │
│  ┌──────────────┐ ┌───────────────┐ │
│  │ 📖 읽기 학습   │ │ 💬 대화 학습   │ │
│  └──────────────┘ └───────────────┘ │
├─────────────────────────────────────┤
│  학습 기록                            │
│  ┌─────────────────────────────────┐│
│  │ ✓ 12턴 · 3/28  완료   📖읽기    ││
│  │   [이어하기 →]  [🗑]             ││
│  ├─────────────────────────────────┤│
│  │ 💬 8턴 · 3/25   진행중  💬대화   ││
│  │   [이어하기 →]  [🗑]             ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  대화 미리보기                        │
│  ┌─ 튜터: 안녕하세요...             ─┐│
│  │  나: 아밀로이드가...               ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 동작 흐름
1. **"📖 읽기 학습" 클릭** → `router.push('/session/new?node={id}&mode=reading')` → 새 세션 생성 → pre_test 시작
2. **"💬 대화 학습" 클릭** → `router.push('/session/new?node={id}&mode=tutoring')` → 새 세션 생성 → pre_test 시작
3. **기존 세션 "이어하기"** → `router.push('/session/{sid}?node={id}&mode={mode}&restore=1')` → 세션 복원

### 기존 node-row의 NEW 버튼 삭제
CategoryAccordion의 각 노드 행에서 NEW 버튼 제거. 노드 클릭 → 사이드바에서 모드 선택.

---

## 4. Pre/Post 스킵 조건 + 헤더 보고서 버튼

### 조건: 이미 pre/post를 완료한 세션

```
세션 복원 시:
  if (session.status === 'completed' && restore === true) {
    → pre_test, post_test 스킵
    → 바로 learning_tutoring 또는 learning_reading 진입
    → 헤더에 "보고서" 버튼 표시
  }
```

### 헤더 변경

기존 Header.tsx:
```
[← 뒤로] [노드명] [진행률] ... [교재] [노트]
```

v8.2 Header.tsx:
```
[← 뒤로] [노드명] [진행률] ... [교재] [노트] [📊 보고서]
```

- **보고서 버튼**: `session.status === 'completed'`일 때만 표시
- 클릭 시 **모달** 또는 **사이드 패널**로 보고서 표시 (페이지 이동 X)

### 백엔드 영향
- `routes/session.py`의 restore 응답에 `has_report: boolean`, `pre_score`, `post_score` 포함 필요
- 기존 `GET /test/session-report?session_id={sid}` API 활용 가능 → 보고서 데이터 로드

### 프론트엔드
- `useSession.ts`의 `restoreSession`에서 completed 세션 감지 시 `phase`를 `learning_*`로 직접 설정
- `components/common/ReportModal.tsx` 신규 — 모달로 보고서 표시

---

## 5. Pre/Post 퀴즈 디자인 교체

### 현재 (v8.1 TestCard)
- 단순 카드: `phaseLabel (1/N)` + question + options/textarea + 타이머
- 버튼: 이전/다음 (PreTest.tsx에서 관리)

### v8.2 디자인 (첨부 이미지1 스타일)

```
┌──────────────────────────────────────────────┐
│ ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 상단 세그먼트 프로그레스바
│                                              │     (완료=primary, 현재=blue, 미완=gray)
│ ← PREVIOUS                                  │
│                                              │
│            QUESTION 2 / 6                    │
│    What is your ideal workplace?             │
│                                              │
│    ┌────────────────────────────────────────┐ │
│    │ ○  A place where people don't...       │ │  ← 라디오 버튼 옵션
│    ├────────────────────────────────────────┤ │     (회색 배경 카드, 선택 시 primary 테두리)
│    │ ○  Wherever my best friends are...     │ │
│    ├────────────────────────────────────────┤ │
│    │ ● One where everyone pushes...         │ │  ← 선택됨 (primary 배경)
│    ├────────────────────────────────────────┤ │
│    │ ○  One that's organized...             │ │
│    └────────────────────────────────────────┘ │
│                                              │
│              [ Next Question → ]             │  ← primary 버튼 (하단 중앙)
│                                              │
└──────────────────────────────────────────────┘
```

### 핵심 요소
1. **세그먼트 프로그레스바** — 문항 수만큼 세그먼트, 완료=채움, 현재=강조색, 미완=회색
2. **"QUESTION N / M"** 라벨 — 상단 중앙, 소문자 라벨 + 볼드 질문
3. **옵션 카드** — 각 옵션이 독립 카드 (회색 배경 #f8f8f8, 라운드 12px)
4. **선택 시** — primary 테두리 + 라디오 채움
5. **Next Question 버튼** — 하단 중앙, primary 배경, 화살표
6. **← PREVIOUS** — 좌측 상단 텍스트 링크

### 컴포넌트 변경
```
components/test/
  ├ QuizLayout.tsx       — 전체화면 퀴즈 레이아웃 (세그먼트 바 + 콘텐츠 + 하단 버튼)
  ├ SegmentProgress.tsx  — 세그먼트형 프로그레스바
  ├ QuizCard.tsx         — 질문 표시 + MCQ 옵션 카드 또는 서술형 입력
  └ (TestCard.tsx 삭제)
```

### PreTest.tsx / PostTest.tsx 수정
- `QuizLayout`으로 래핑
- 기존 "이전/다음" 버튼 → QuizLayout 내부로 통합

---

## 6. 보고서: 모바일 카드형 디자인

### 현재 (v8.1 Report.tsx)
- 세로 스크롤 리스트: ScoreCard → AI 평가 → 문항별 결과 → Bloom 차트 → 체크리스트
- 텍스트 중심, 데스크톱 레이아웃

### v8.2 디자인 (첨부 이미지2 - Health앱 스타일)

```
┌─────────────────────────────────────┐
│  학습 보고서              ⓘ         │
│  3/28 2026                          │
│                                     │
│  ┌───────┐         ┌───────┐       │
│  │🟠 사전 │         │🔴 사후 │       │
│  │  45    │  ❤️🧡💙  │  82    │       │
│  │ /100   │         │ /100   │       │
│  └───────┘         └───────┘       │
│  │🔵 성장 │                         │
│  │  +37   │                         │
│  │ point  │                         │
│  └───────┘                         │
│                                     │
│  🏃 오늘 학습 턴수 12 / 목표 20       │
├─────────────────────────────────────┤
│                                     │
│  ❤️  AI 종합 평가         ★★★★☆    │
│     3/28 14:30                      │
│                           85 점     │
├─────────────────────────────────────┤
│                                     │
│  💧  잘한 점              ────      │
│     3/28 14:30                      │
│                                     │
│     • 아밀로이드 가설 정확히 설명     │
│     • 타우 단백질 역할 이해          │
├─────────────────────────────────────┤
│                                     │
│  🌿  보완할 점            ────      │
│     3/28 14:30                      │
│                                     │
│     • 약물 부작용 구체화 필요        │
├─────────────────────────────────────┤
│                                     │
│  🫧  Bloom 수준            분석     │
│     3/28 14:30                      │
│                                     │
│                           이해 →    │
│                           적용      │
└─────────────────────────────────────┘

[대시보드로 돌아가기]
```

### 핵심 디자인 패턴 (Health 앱에서 차용)

1. **상단 요약 카드** — 날짜 + 3개 메트릭 (사전/사후/성장) 큰 숫자 + 작은 라벨
   - 중앙에 클로버/하트형 장식 아이콘 (학습 주제 관련)
   - 하단에 프로그레스 바 ("오늘 학습 턴수")

2. **섹션 카드** — 각각 독립 둥근 카드 (border-radius: 20px)
   - 좌측: 아이콘 (둥근 그라데이션 배경) + 제목 + 날짜
   - 우측: 큰 숫자 또는 짧은 텍스트
   - 색상 코딩: 사전(orange), 사후(coral), 성장(teal), 잘한점(green), 보완(amber), Bloom(purple)

3. **카드 배경색** — 각 카드마다 옅은 배경색 (Health 앱의 핑크/초록/노랑 그라데이션)

### 컴포넌트 변경
```
components/report/
  ├ ReportCard.tsx        — 전체 보고서 카드형 레이아웃
  ├ SummaryClover.tsx     — 상단 3-metric 요약 (사전/사후/성장 + 장식 아이콘)
  ├ MetricCard.tsx        — 개별 섹션 카드 (아이콘 + 제목 + 날짜 + 값)
  ├ StrengthsList.tsx     — 잘한점/보완점 리스트 카드
  ├ BloomBadge.tsx        — Bloom 수준 뱃지 카드
  └ (ScoreCard.tsx 삭제, BloomChart.tsx 삭제)
```

### ReportModal.tsx (헤더에서 호출)
- completed 세션에서 보고서 버튼 클릭 시 모달로 표시
- 내부에 `<ReportCard>` 렌더링
- 모달 닫기 버튼 + 배경 클릭 닫기

---

## 7. 백엔드: test_debug_logs 테이블 + 채점 디버깅

### 목적
pre/post 채점 과정의 상세 로그를 DB에 저장하여:
- LLM이 어떤 concept_results를 반환했는지
- score_short_answer가 어떻게 계산했는지
- MCQ 정답 매칭이 정확한지
- 전체 phase_score 계산 과정

### 7.1 신규 테이블

```sql
CREATE TABLE IF NOT EXISTS test_debug_logs (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    test_phase      TEXT NOT NULL,        -- 'pre_test' | 'post_test'
    item_id         TEXT NOT NULL,
    timestamp       REAL NOT NULL,

    -- 입력
    item_type       TEXT,                 -- 'mcq' | 'short_answer'
    question        TEXT,                 -- 문항 원문
    learner_response TEXT,                -- 학습자 응답 원문
    correct_answer  TEXT,                 -- MCQ 정답 또는 rubric JSON

    -- LLM 추출 (서술형만)
    llm_raw_response TEXT,                -- LLM 원본 응답 (JSON)
    extraction_result TEXT,               -- parse_concept_results 결과 (JSON)
    extraction_error TEXT,                -- 파싱 에러 시 메시지

    -- 채점 결과
    auto_score      REAL,
    matched_count   INTEGER,
    total_count     INTEGER,
    matched_keys    TEXT,                 -- JSON array
    bloom_level     TEXT,
    scoring_method  TEXT,                 -- 'mcq_exact' | 'binary_extraction' | 'fallback'

    -- 메타
    elapsed_ms      INTEGER,              -- 채점 소요 시간 (ms)
    error           TEXT,                 -- 채점 에러 메시지

    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### 7.2 routes/test.py 수정

현재 `submit_test()`에서:

```python
# 현재 (v8.1)
for resp in responses:
    item = await get_test_item(resp["item_id"])
    if item.get("item_type") == "mcq":
        score = 1.0 if resp["response"] == item.get("correct") else 0.0
    else:
        extraction = await extract_concepts(resp["response"], rubric)
        score_data = score_short_answer(extraction, rubric)
```

v8.2에서 각 단계마다 debug_log 레코드 생성:

```python
# v8.2 수정
import time as _time

for resp in responses:
    debug = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "test_phase": test_phase,
        "item_id": resp["item_id"],
        "timestamp": _time.time(),
        "learner_response": resp["response"],
    }
    t0 = _time.monotonic()

    item = await get_test_item(resp["item_id"])
    debug["item_type"] = item.get("item_type")
    debug["question"] = item.get("question")
    debug["correct_answer"] = item.get("correct") or json.dumps(item.get("rubric"), ensure_ascii=False)

    try:
        if item.get("item_type") == "mcq":
            score = 1.0 if resp["response"] == item.get("correct") else 0.0
            debug["scoring_method"] = "mcq_exact"
            debug["auto_score"] = score
        else:
            rubric = item.get("rubric")
            if isinstance(rubric, str):
                rubric = json.loads(rubric)
            extraction = await extract_concepts(resp["response"], rubric)
            debug["llm_raw_response"] = json.dumps(extraction, ensure_ascii=False)

            parsed = parse_concept_results(extraction)
            debug["extraction_result"] = json.dumps(parsed, ensure_ascii=False)

            score_data = score_short_answer(extraction, rubric)
            score = score_data["score"]
            debug["scoring_method"] = "binary_extraction"
            debug["auto_score"] = score
            debug["matched_count"] = score_data["matched_count"]
            debug["total_count"] = score_data["total_count"]
            debug["matched_keys"] = json.dumps(score_data.get("matched_keys", []))

    except Exception as e:
        debug["error"] = str(e)
        debug["extraction_error"] = traceback.format_exc()
        score = 0.0
        debug["scoring_method"] = "fallback"
        debug["auto_score"] = 0.0

    debug["elapsed_ms"] = int((_time.monotonic() - t0) * 1000)
    debug["bloom_level"] = item.get("bloom_level", "remember")

    await save_test_debug_log(debug)
    # ... 기존 save_test_response / results.append 로직 유지
```

### 7.3 phase_score 계산 로그

`submit_test()` 마지막에 phase 전체 계산 과정도 로그:

```python
# phase 종합 디버그 로그
await save_test_debug_log({
    "id": str(uuid.uuid4()),
    "session_id": session_id,
    "test_phase": test_phase,
    "item_id": "__PHASE_SUMMARY__",
    "timestamp": _time.time(),
    "scoring_method": "phase_calculation",
    "auto_score": phase_score,
    "bloom_level": phase_bloom,
    "extraction_result": json.dumps({
        "individual_scores": [{r["item_id"]: r["auto_score"]} for r in results],
        "bloom_weights_used": {r.get("bloom", "remember"): BLOOM_WEIGHTS.get(r.get("bloom", "remember"), 1.0) for r in results},
        "phase_score": phase_score,
        "phase_bloom": phase_bloom,
    }, ensure_ascii=False),
})
```

### 7.4 database.py 추가 함수

```python
async def save_test_debug_log(data: dict) -> None:
    """test_debug_logs 테이블에 디버그 로그 저장."""
    db = await get_db()
    try:
        await db.execute("""
            INSERT INTO test_debug_logs
            (id, session_id, test_phase, item_id, timestamp,
             item_type, question, learner_response, correct_answer,
             llm_raw_response, extraction_result, extraction_error,
             auto_score, matched_count, total_count, matched_keys,
             bloom_level, scoring_method, elapsed_ms, error)
            VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?)
        """, (
            data.get("id"), data.get("session_id"), data.get("test_phase"),
            data.get("item_id"), data.get("timestamp"),
            data.get("item_type"), data.get("question"),
            data.get("learner_response"), data.get("correct_answer"),
            data.get("llm_raw_response"), data.get("extraction_result"),
            data.get("extraction_error"),
            data.get("auto_score"), data.get("matched_count"),
            data.get("total_count"), data.get("matched_keys"),
            data.get("bloom_level"), data.get("scoring_method"),
            data.get("elapsed_ms"), data.get("error"),
        ))
        await db.commit()
    finally:
        await db.close()
```

---

## 8. 백엔드 영향 전체 요약

### 신규 테이블
| 테이블 | 위치 | 설명 |
|--------|------|------|
| `test_debug_logs` | database.py | pre/post 채점 디버그 로그 |

### 신규 엔드포인트
| 메서드 | 경로 | 위치 | 설명 |
|--------|------|------|------|
| DELETE | `/test/delete-session` | routes/admin.py | 세션 삭제 |
| GET | `/test/notes` | routes/wiki.py | 전체 노트 목록 |
| GET | `/test/debug-logs/{session_id}` | routes/admin.py | 디버그 로그 조회 (개발용) |

### 기존 엔드포인트 수정
| 경로 | 변경 |
|------|------|
| `/test/wiki-list` | 응답에 `category` 추가 |
| `/test/restore` | 응답에 `has_report`, `pre_score`, `post_score` 추가 |
| `/test/submit` | 채점 과정에 `save_test_debug_log()` 호출 추가 |

### 기존 세션 복원 로직 수정
- `routes/session.py`의 restore에서 `completed` 세션 감지 시:
  - `status: 'completed'` 플래그 포함
  - 프론트에서 이를 보고 pre/post 스킵, 바로 학습 진입

---

## 9. 파일 변경 목록 (최종)

### 삭제
```
components/reading/SlimSidebar.tsx     ← 2-panel이므로 불필요
components/reading/MetaPanel.tsx       ← 2-panel이므로 불필요
components/test/TestCard.tsx           ← QuizCard로 교체
components/report/ScoreCard.tsx        ← SummaryClover로 교체
components/report/BloomChart.tsx       ← BloomBadge로 교체
```

### 신규 생성
```
-- 대시보드
components/dashboard/DashboardLayout.tsx
components/dashboard/NavSidebar.tsx
components/dashboard/CourseCard.tsx
components/dashboard/RightSidebar.tsx
components/dashboard/CourseDetail.tsx
components/dashboard/ConversationSidebar.tsx    ← 모드 선택 버튼 포함
components/dashboard/CategoryAccordion.tsx

-- 읽기 (2-panel)
components/reading/ReadingLayout.tsx
components/reading/TOCPanel.tsx
components/reading/ArticleView.tsx
components/reading/ReadBar.tsx

-- 퀴즈
components/test/QuizLayout.tsx
components/test/SegmentProgress.tsx
components/test/QuizCard.tsx

-- 보고서 (모바일 카드형)
components/report/ReportCard.tsx
components/report/SummaryClover.tsx
components/report/MetricCard.tsx
components/report/StrengthsList.tsx
components/report/BloomBadge.tsx

-- 공통
components/common/ReportModal.tsx
```

### 수정
```
app/globals.css                        — 디자인 토큰 v8.2
app/login/page.tsx                     — login.html 디자인
app/dashboard/page.tsx                 — 전면 재작성
components/session/Reading.tsx         — 2-panel 교체
components/session/PreTest.tsx         — QuizLayout 적용
components/session/PostTest.tsx        — QuizLayout 적용
components/session/Report.tsx          — 카드형 교체
components/common/Header.tsx           — 보고서 버튼 추가
hooks/useSession.ts                    — completed 세션 스킵 로직
lib/api.ts                             — deleteSession, cost, allNotes, debugLogs 추가
lib/types.ts                           — WikiListItem 확장, DebugLog 타입
```

### 유지 (변경 없음)
```
components/session/Tutoring.tsx        ★ 기존 디자인 유지
components/session/SessionProvider.tsx
components/chat/*                      ★ 전부 유지
components/checklist/*
components/common/WikiModal.tsx
components/common/NoteModal.tsx
hooks/useScrollTracker.ts
hooks/useTimer.ts
lib/constants.ts
```

---

## 10. 작업 순서

### Phase 1: 기반 정비
1. `globals.css` 토큰 교체 + Tutoring 로컬 토큰 격리
2. `lib/api.ts`, `lib/types.ts` 확장
3. 백엔드: `test_debug_logs` 테이블 + `save_test_debug_log()` 함수

### Phase 2: 백엔드 채점 로깅
4. `routes/test.py` — submit_test에 디버그 로깅 삽입
5. `routes/admin.py` — DELETE session + debug-logs 조회 엔드포인트
6. `routes/session.py` — restore 응답에 has_report 추가

### Phase 3: 퀴즈 리디자인
7. `QuizLayout` + `SegmentProgress` + `QuizCard`
8. `PreTest.tsx`, `PostTest.tsx` 교체

### Phase 4: 보고서 리디자인
9. `SummaryClover` + `MetricCard` + `StrengthsList` + `BloomBadge`
10. `ReportCard.tsx` 통합 + `ReportModal.tsx`
11. `Report.tsx` 교체 + `Header.tsx` 보고서 버튼

### Phase 5: Login
12. `login/page.tsx` — login.html 디자인

### Phase 6: Dashboard + Detail
13. `DashboardLayout` + `NavSidebar` + `CourseCard` + `RightSidebar`
14. `CategoryAccordion` + `CourseDetail`
15. `ConversationSidebar` (모드 선택 포함)
16. `dashboard/page.tsx` 통합

### Phase 7: Reading
17. `ReadingLayout` + `TOCPanel` + `ArticleView` + `ReadBar`
18. `Reading.tsx` 교체

### Phase 8: 통합 테스트
19. 전체 흐름 검증: 로그인 → 대시보드 → 노드선택 → 모드선택 → pre → 학습 → post → 보고서
20. completed 세션 복원 → pre/post 스킵 → 헤더 보고서 확인
21. test_debug_logs DB 데이터 검증
