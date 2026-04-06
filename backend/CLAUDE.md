# Agentic-ALE v8

> AI 기반 간호 교육 튜터링 플랫폼 — 치매 돌봄 커리큘럼

## 프로젝트 개요

치매 돌봄 간호/간병 교육을 위한 Socratic 튜터링 시스템.
학습자가 노드(주제)를 선택하면 Pre-test → 학습(Tutoring 또는 Reading) → Post-test → Retention 순으로 진행.

## 기술 스택

- **Backend**: FastAPI + Uvicorn (Python 3.12)
- **DB**: SQLite (aiosqlite, 비동기)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **학습 모델**: BKT(Bayesian Knowledge Tracing) + ZPD(Zone of Proximal Development)
- **콘텐츠**: 마크다운 위키 문서 (content/wiki_docs/demensia/)

## 프로젝트 구조

```
agentic-ale-v1/
├── main.py                  # FastAPI 앱 엔트리포인트
├── config.py                # 환경 설정 (dataclass)
├── database.py              # SQLite 스키마 + CRUD 헬퍼 (aiosqlite)
├── routes/
│   ├── auth.py              # PIN 로그인/회원가입
│   └── test_session.py      # [v7] 세션/대화/KG/노트 — v8에서 분리 예정
├── services/
│   ├── claude_client.py     # Analyst + Tutor 프롬프트 + Claude API 호출
│   ├── scorer.py            # should_update, quick_score
│   ├── bkt_service.py       # BKT 엔진
│   ├── zpd_tracker.py       # ZPD/struggle 추적
│   ├── content_loader.py    # 마크다운/plan 파일 로딩
│   ├── kg_service.py        # Knowledge Graph JSON 로딩
│   └── logger.py            # 로깅
├── templates/               # Jinja2 HTML (v7 호환용)
├── content/
│   └── wiki_docs/demensia/  # 위키 마크다운 99개 + nodes/ + cases/ + plan/
└── data/                    # SQLite DB 파일 (gitignore)
```

## v8 리팩토링 계획

test_session.py(1423L)를 기능별로 분리:
- routes/session.py — 세션 생성/상태전이/복원
- routes/tutor.py — Socratic 대화 (handle_answer)
- routes/test.py — Pre/Post/Retention 평가
- routes/reading.py — Reading 모드 콘텐츠 + 행동 로그
- routes/report.py — 성적표
- routes/admin.py — DB 조회/CSV
- routes/kg.py — KG API
- routes/wiki.py — Wiki/노트 API

신규 서비스:
- services/test_scorer.py — binary 추출 파싱 + 점수 계산
- services/state_machine.py — 세션 상태 전이 로직
- services/retention.py — SM-2 스케줄러

## 코딩 규칙

- 비동기 함수는 `async def` 사용
- API 응답은 dict 또는 Pydantic BaseModel
- 에러 핸들링은 `fastapi.HTTPException` 사용
- DB 접근은 `async with await get_db() as db:` 패턴 → 아님, `db = await get_db()` + `try/finally db.close()`
- 인메모리 세션: `sessions: dict[str, dict] = {}` 패턴 유지
- 로그는 print 문 사용 (logger.py의 파일 로깅과 병행)
- 환경변수: ANTHROPIC_API_KEY (필수), SECRET_KEY (선택)

## DB 패턴

```python
# 올바른 DB 접근 패턴
db = await get_db()
try:
    cursor = await db.execute("SELECT ...", params)
    row = await cursor.fetchone()
    await db.commit()  # INSERT/UPDATE 시
finally:
    await db.close()
```

## 파일 경로 규칙

- 위키 문서: `content/wiki_docs/demensia/{node_id}.md`
- 교수 계획: `content/wiki_docs/demensia/plan/{plan_name}.md`
- 임상 사례: `content/wiki_docs/demensia/cases/`
- 노드 상세: `content/wiki_docs/demensia/nodes/{node_id}.md`
- DB 파일: `data/ale.db`

## 실행 방법

```bash
# 가상환경 활성화
conda activate ale_v8

# 환경변수
export ANTHROPIC_API_KEY="sk-..."

# 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8040
```

## 작업 순서 (v8 Phase 1: 골격)

1. database.py — v8 테이블 추가 + 마이그레이션 + 헬퍼 함수
2. services/test_scorer.py — binary 추출 파싱 + 점수 계산
3. services/state_machine.py — 상태 전이
4. routes/session.py — test_session.py에서 세션 코드 분리 + v8 상태머신
5. routes/tutor.py — test_session.py에서 handle_answer 분리 + binary 채점
6. routes/test.py — Pre/Post 평가 API
7. routes/reading.py — Reading 모드
8. main.py — 라우터 등록

## 금지사항 / 실수 기록

- `database.py`의 `get_db()`는 context manager가 아님. `async with`로 쓰지 말 것.
- content 파일명에 한글 유니코드 인코딩이 사용됨 (예: `#Uce58#Ub9e4_#Uac1c#Uc694.md`). 파일 탐색 시 주의.
- `test_session.py`의 인메모리 `sessions` dict는 서버 재시작 시 초기화됨. DB 복원 로직 필수.
- Claude API 호출 시 반드시 `await` 사용 (AsyncAnthropic 클라이언트).
- 새 API 응답 필드 추가 시 프론트엔드 `frontend/lib/api.ts` 타입과 동기화할 것. (2026-03-31 타입 불일치 버그 3건 수정)
- `routes/session.py`의 `/test/status` 응답에 `status` 필드 반드시 포함. 프론트엔드 세션 복원이 이 필드에 의존.
- `routes/session.py`의 `/test/sessions` SQL에 `mode` 컬럼 포함할 것. 프론트엔드 세션 복원 시 mode 구분 필요.
- `main.py` 미들웨어는 HTML 페이지(`/test`, `/dashboard`, `/student`)만 보호. API 경로(`/test/start`, `/test/answer` 등)는 각 라우트에서 자체 인증.
