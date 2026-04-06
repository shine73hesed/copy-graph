# Frontend E2E Test Report

**Date:** 2026-03-31
**Frontend:** http://localhost:3000 (Next.js 14, React 18)
**Backend:** http://localhost:8040 (FastAPI)
**Tester:** Claude Code (automated curl through Next.js proxy)

---

## Summary

| Category | Tests | Pass | Fail | Fixed |
|----------|-------|------|------|-------|
| API Proxy | 3 | 3 | 0 | 0 |
| Auth Flow | 3 | 3 | 0 | 0 |
| Dashboard APIs | 2 | 2 | 0 | 1 |
| Session Start | 1 | 1 | 0 | 0 |
| Pre-test Submit | 1 | 1 | 0 | 0 |
| Tutoring | 1 | 1 | 0 | 0 |
| Reading | 2 | 2 | 0 | 0 |
| Session Restore | 2 | 2 | 0 | 1 |
| TypeScript Build | 1 | 1 | 0 | 1 |
| **Total** | **16** | **16** | **0** | **3** |

**Bugs found & fixed:** 3
**TypeScript build:** PASS (no compilation errors)
**Overall status:** ALL PASS

---

## 1. API Proxy Verification (Next.js Rewrite)

All API calls correctly proxied from port 3000 to port 8040.

### GET /auth/me (no cookies)
```
Proxy: localhost:3000 → localhost:8040
Status: 401
Response: {"error":"로그인 필요"}
Result: PASS (JSON, not HTML redirect)
```

### GET /db/stats (no auth)
```
Status: 200
Response: {"users":2, ...}
Result: PASS
```

### GET /test/kg (no auth)
```
Status: 200
Response: {nodes: 67, edges: 75}
Result: PASS
```

---

## 2. Auth Flow (Through Proxy)

### POST /auth/login
```
Status: 200
Response: {"user_id":"fetest1","display_name":"fetest1","is_new":true}
Cookies: ale_user=fetest1, ale_token=... (Path=/, 7-day expiry)
Result: PASS
```

### GET /auth/me (with cookies)
```
Status: 200
Response: {"user_id":"fetest1","display_name":"fetest1","role":"student",...}
Result: PASS
```

### POST /auth/logout
```
Status: 200
Result: PASS
```

---

## 3. Dashboard APIs

### GET /test/sessions
```
Status: 200
Response: {"sessions":[{id, node_id, mode, status, total_turns, ...}]}
Note: mode field now included after Bug B fix
Result: PASS
```

### GET /test/kg
```
Status: 200
Response: {nodes: 67 with progress data}
Result: PASS
```

---

## 4. Session Start (Tutoring Mode)

### POST /test/start
```json
Request: {"node_id":"치매_개요","mode":"tutoring"}
```
```
Status: 200
Response: {
  session_id: "96ffe3e392bc40c8",
  mode: "tutoring",
  status: "pre_test",
  pre_test_items: [5 items],
  checklist_items: [5 items],
  first_message: "안녕하세요! 치매 케어에 대해..." (162 chars)
}
Result: PASS
```

---

## 5. Pre-test Submit

### POST /test/submit
```json
Request: {session_id, test_phase: "pre_test", responses: [5 items]}
```
```
Status: 200
Response: {
  next_status: "learning_tutoring",
  phase_score: 0.0,
  first_message: "안녕하세요! 치매 케어에...",
  checklist_items: [5 items]
}
State transition: pre_test → learning_tutoring (confirmed)
Result: PASS
```

---

## 6. Tutoring Answer

### POST /test/answer
```json
Request: {session_id, answer: "치매는 후천적으로 인지기능이 저하되어..."}
```
```
Status: 200
Response: {
  turn: 1,
  score: 0.0,
  tutor_message: "좋은 기초 지식이 있으시네요!...",
  gate: {gate_a: false, gate_b: false, completed: false},
  checklist: {C1-C5 states}
}
Result: PASS
```

---

## 7. Reading Mode

### GET /reading/{node_id}/content
```
Status: 200
Response: {
  markdown: 1590 chars,
  mermaid_diagrams: [],
  video_urls: [],
  min_reading_sec: 190
}
Result: PASS
```

### POST /reading/log
```
Status: 200
Response: {"ok":true,"log_id":"3d96dead5a564a8e"}
Result: PASS
```

---

## 8. Session Restore (Bug A 수정 후)

### GET /test/restore
```
Status: 200
Response: {
  conversation: [3 messages],
  checklist_items: [5 items],
  last_state: {moving_avg, trend, checklist_state, turn, mastery}
}
Result: PASS
```

### GET /test/status (Bug A 수정 검증)
```
Before fix: {session_id, node_id, turn, bkt, ...} — "status" 필드 없음
After fix:  {status: "pre_test", session_id, node_id, turn, bkt, ...}
Result: PASS (status 필드 정상 포함)
```

---

## 9. TypeScript Build

```bash
npx next build
```
```
All pages compiled successfully:
  ○ /           (1.15 kB)
  ○ /dashboard  (2.66 kB)
  ○ /login      (2.08 kB)
  ƒ /session/[sid] (19.9 kB)
No type errors.
Result: PASS
```

---

## Bugs Found & Fixed

### Bug A: `/test/status` 응답에 `status` 필드 누락 (Critical)

**Symptom:** Frontend `useSession.ts:254`에서 `statusRes.status`를 읽지만 backend가 해당 필드를 반환하지 않아 세션 복원 시 phase 감지 실패.

**Root cause:** `code/routes/session.py` line 327-347 — `/test/status` 응답 dict에 `session["status"]` 미포함.

**Fix:** 응답에 `"status": session["status"]` 추가.

**Files changed:** `code/routes/session.py`

---

### Bug B: 대시보드 `handleRestore`가 mode를 항상 `tutoring`으로 고정 (Medium)

**Symptom:** Reading 모드로 진행 중인 세션을 "이어하기"로 복원하면 tutoring 모드로 열림.

**Root cause:** 
1. `frontend/app/dashboard/page.tsx:37` — `mode=tutoring` 하드코딩
2. Backend `/test/sessions` SQL에 `mode` 컬럼 미포함

**Fix:** 
1. Dashboard: `mode=${session.mode ?? 'tutoring'}`
2. Backend SQL: `SELECT s.id, s.node_id, s.mode, s.status, ...`
3. Types: `SessionListItem`에 `mode?: SessionMode` 필드 추가

**Files changed:** `code/routes/session.py`, `frontend/app/dashboard/page.tsx`, `frontend/lib/types.ts`

---

### Bug C: `api.ts` 반환 타입 3곳 불일치 (Low)

**Symptom:** TypeScript 타입이 실제 백엔드 응답과 불일치. 런타임에는 영향 없으나 타입 안전성 저하.

**Fix:**
- `login()`: `{ok: boolean}` → `{user_id: string; display_name: string; is_new: boolean}`
- `me()`: `{user_id: string}` → `{user_id: string; display_name: string; role: string}`
- `status()`: `{status: string}` → `{status: string; session_id: string; node_id: string; turn: number}`
- `resume()`: `StartSessionResponse` → `{session_id: string; resumed: boolean; checklist_items: ...}`

**Files changed:** `frontend/lib/api.ts`

---

## Test Execution Sequence

```
1. Start frontend (npm run dev, port 3000)
2. Verify API proxy: /auth/me, /db/stats, /test/kg through port 3000
3. Login: POST /auth/login → cookies set
4. Dashboard: GET /test/sessions, /test/kg
5. Session start: POST /test/start → session_id
6. Pre-test: POST /test/submit → learning_tutoring transition
7. Tutoring: POST /test/answer → AI response + checklist update
8. Reading: GET /reading/content, POST /reading/log
9. Restore: GET /test/restore, GET /test/status → Bug A confirmed & fixed
10. Bug fixes: A (session.py), B (dashboard + types), C (api.ts types)
11. Rebuild: npx next build → no TS errors
12. Re-verify: all fixes confirmed working
```
