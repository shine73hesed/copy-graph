# ALE v8 — 프론트엔드 개발 가이드 (Next.js)

> **기반**: v7 `student.html` (2170L) 분석 결과  
> **전환**: vanilla HTML/JS → Next.js (App Router) + TypeScript  
> **원칙**: v7 디자인 토큰/UI 패턴 그대로 이식, 상태머신 래퍼 추가  
> **Claude Code 작업용 문서**

---

## 1. v7 student.html 분석 요약

### 구조

```
student.html (2170L, 단일 파일)
├── CSS (L1-1145)
│   ├── CSS 변수 (:root) — 디자인 토큰
│   ├── 레이아웃 (header, scroll area, input bar)
│   ├── 메시지 버블 (.msg-tutor, .msg-user)
│   ├── 체크리스트 UI
│   ├── 완료 카드 (.done-card)
│   ├── 사이드바 (위키, 노트 모달)
│   └── 반응형/애니메이션
│
├── HTML (L1145-1153)
│   ├── header (노드명, 체크리스트 진행, 버튼들)
│   ├── #scr (스크롤 영역 — 대화 메시지)
│   ├── footer (입력창 + 전송 버튼)
│   └── 디버그 패널 (숨김)
│
└── JS (L1154-2170)
    ├── 유틸 ($, scrl, clean, addT, addU, showTyping, hideTyping)
    ├── 체크리스트 (updateCL, updateHeader)
    ├── 완료 카드 (addDone)
    ├── 위키 모달 (showWikiDoc, loadWikiNode)
    ├── 노트 모달 (showNotes, saveMemo)
    ├── 에디토리얼 헤더 (loadEditorialHeader)
    ├── 세션 관리 (startNode, send, newSession, tryRestoreOrStart, selectNode)
    ├── 디버그 (updateDebug)
    └── 초기화 (DOMContentLoaded → tryRestoreOrStart)
```

### CSS 변수 (디자인 토큰)

```css
:root {
    --ink: #1a1a1a;
    --ink2: #555;
    --ink3: #999;
    --ink4: #c4c4c4;
    --paper: #fbfaf8;
    --paper2: #f4f2ef;
    --cream: #edeae4;
    --accent: #c0582e;
    --accent-light: #f8f0eb;
    --teal: #14b8a6;
    --teal-bg: #ecfdf5;
    --primary: #ec5b13;
    --primary-light: #fff4ed;
    --serif: "Cormorant Garamond", Georgia, serif;
    --sans: "Pretendard Variable", Pretendard, -apple-system, sans-serif;
    --mono: "DM Mono", monospace;
}
```

### 외부 의존성

- `marked.js` (마크다운 파싱)
- `mermaid.js` (다이어그램 렌더링)
- Pretendard Variable (한국어 본문)
- Cormorant Garamond (에디토리얼 헤더)
- DM Mono (디버그/코드)
- Material Symbols Outlined (아이콘)

---

## 2. Next.js 프로젝트 구조

```
ale-v8-frontend/
├── app/
│   ├── layout.tsx                    -- 공통 레이아웃, 폰트, 디자인 토큰
│   ├── globals.css                   -- v7 CSS 변수 + Tailwind 기반
│   ├── login/
│   │   └── page.tsx                  -- 로그인 (v7 login.html 이식)
│   ├── dashboard/
│   │   └── page.tsx                  -- 노드 선택 + 세션 목록 (v7 dashboard.html 이식)
│   ├── session/[sid]/
│   │   └── page.tsx                  -- 세션 메인 (상태머신 래퍼)
│   ├── admin/
│   │   ├── page.tsx                  -- 데이터 조회
│   │   └── items/page.tsx            -- 문항 관리
│   └── wiki/
│       └── [nodeId]/page.tsx         -- 위키 뷰어 (v7 wiki.html 이식)
│
├── components/
│   ├── session/
│   │   ├── SessionProvider.tsx       ★ 상태머신 Context
│   │   ├── PreTest.tsx               ★ 사전 평가 UI
│   │   ├── Tutoring.tsx              -- v7 대화 UI 이식
│   │   ├── Reading.tsx               ★ Reading 모드 UI
│   │   ├── PostTest.tsx              ★ 사후 평가 UI
│   │   └── Report.tsx                ★ 성적표 UI
│   ├── chat/
│   │   ├── MessageBubble.tsx         -- v7 addT/addU 이식
│   │   ├── TypingIndicator.tsx       -- v7 showTyping/hideTyping
│   │   ├── InputBar.tsx              -- v7 footer 입력창
│   │   ├── DoneCard.tsx              -- v7 addDone 이식
│   │   └── MermaidBlock.tsx          -- mermaid 렌더링
│   ├── checklist/
│   │   ├── ChecklistSidebar.tsx      -- v7 updateCL/updateHeader
│   │   └── ChecklistItem.tsx
│   ├── test/
│   │   ├── TestCard.tsx              ★ MCQ/서술형 문항 카드
│   │   ├── MCQOption.tsx             ★ MCQ 선택지
│   │   └── ShortAnswer.tsx           ★ 서술형 입력
│   ├── reading/
│   │   ├── MarkdownViewer.tsx        ★ 마크다운 렌더
│   │   ├── VideoPlayer.tsx           ★ 동영상
│   │   └── ReadingProgress.tsx       ★ 스크롤/시간 진행 표시
│   ├── report/
│   │   ├── ScoreCard.tsx             ★ gain, Bloom별 점수
│   │   ├── BloomChart.tsx            ★ Bloom 수준별 차트
│   │   └── ChecklistResult.tsx       ★ 체크리스트 최종 결과
│   └── common/
│       ├── Header.tsx                -- v7 header 이식
│       ├── WikiModal.tsx             -- v7 showWikiDoc 이식
│       └── NoteModal.tsx             -- v7 showNotes 이식
│
├── hooks/
│   ├── useSession.ts                 ★ 세션 상태 관리 훅
│   ├── useTimer.ts                   ★ elapsed_sec 측정
│   ├── useScrollTracker.ts           ★ Reading 모드 스크롤 추적
│   └── useApi.ts                     -- API 호출 래퍼
│
├── lib/
│   ├── api.ts                        -- FastAPI 엔드포인트 호출
│   ├── types.ts                      -- TypeScript 타입 정의
│   └── constants.ts                  -- 상태 코드, Bloom 수준 등
│
├── public/
│   └── fonts/                        -- 셀프호스팅 시
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. v7 컴포넌트 분해 매핑

### 3.1 JS 함수 → React 컴포넌트/훅

| v7 함수 (student.html) | v8 컴포넌트/훅 | 비고 |
|------------------------|---------------|------|
| `addT(md)` L1171 | `MessageBubble.tsx` | marked.parse + mermaid 처리 |
| `addU(tx)` L1242 | `MessageBubble.tsx` (role=user) | |
| `showTyping()`/`hideTyping()` L1249-1261 | `TypingIndicator.tsx` | |
| `addDone(...)` L1262 | `DoneCard.tsx` | 완료 카드 + 다음 노드 버튼 |
| `updateCL(state)` L1304 | `ChecklistSidebar.tsx` | |
| `updateHeader()` L1309 | `Header.tsx` | confirmed/total 표시 |
| `showWikiDoc()` L1332 | `WikiModal.tsx` | |
| `showNotes()` L1404 | `NoteModal.tsx` | |
| `startNode(nodeId)` L1692 | `useSession.ts` → `startSession()` | |
| `send()` L1745 | `useSession.ts` → `sendMessage()` | elapsed_sec 추가 |
| `newSession()` L1826 | `useSession.ts` → `newSession()` | |
| `tryRestoreOrStart()` L1841 | `useSession.ts` → `restoreSession()` | |
| `updateDebug(d)` L2020 | 제거 (admin에서 확인) | |

### 3.2 CSS 클래스 → Tailwind 매핑

v7 CSS를 Tailwind + CSS 변수로 변환. 핵심:

| v7 CSS | Tailwind 접근 |
|--------|-------------|
| `.msg-tutor` | `globals.css`에 커스텀 클래스 유지 (Tailwind으로 변환하기엔 복잡) |
| `.msg-user` | 동일 |
| `.done-card` | 동일 |
| header 56px | `h-14` |
| `font-family: var(--serif)` | Tailwind `font-serif` 커스텀 |
| `color: var(--ink)` | Tailwind `text-ink` 커스텀 |

`tailwind.config.ts`에서 v7 디자인 토큰을 Tailwind 테마로 등록:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a1a1a', 2: '#555', 3: '#999', 4: '#c4c4c4' },
        paper: { DEFAULT: '#fbfaf8', 2: '#f4f2ef' },
        cream: '#edeae4',
        accent: { DEFAULT: '#c0582e', light: '#f8f0eb' },
        teal: { DEFAULT: '#14b8a6', bg: '#ecfdf5' },
        primary: { DEFAULT: '#ec5b13', light: '#fff4ed' },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
}
```

---

## 4. 핵심 컴포넌트 상세

### 4.1 SessionProvider.tsx — 상태머신 Context

```typescript
type SessionPhase = 'pre_test' | 'learning_reading' | 'learning_tutoring' | 'post_test' | 'completed';

interface SessionState {
  sessionId: string | null;
  mode: 'reading' | 'tutoring';
  phase: SessionPhase;
  nodeId: string;
  // pre/post
  preScore: number | null;
  postScore: number | null;
  gain: number | null;
  // test items
  currentItems: TestItem[];
  currentResponses: TestResponse[];
  // tutoring
  messages: Message[];
  checklist: Record<string, string>;
  checklistItems: ChecklistItem[];
  turn: number;
  // reading
  readingStartedAt: number | null;
  // timing
  learningStartedAt: number | null;
}

// Context로 하위 컴포넌트에 상태 + 액션 제공
const SessionContext = createContext<{
  state: SessionState;
  startSession: (nodeId: string, mode: string) => Promise<void>;
  submitTest: (phase: string, responses: any[]) => Promise<void>;
  sendMessage: (message: string, elapsedSec: number) => Promise<void>;
  completeReading: () => Promise<void>;
}>()
```

### 4.2 PreTest.tsx / PostTest.tsx — 문항 카드 UI

```
┌─────────────────────────────────────────┐
│  사전 평가 (1/3)                         │
│                                          │
│  Q. 치매의 가장 정확한 정의를 고르세요.     │
│                                          │
│  ○ A) 노화에 따른 기억력 감퇴             │
│  ● B) 후천적 인지기능 저하 증후군          │
│  ○ C) 뇌의 특정 질환                     │
│  ○ D) 일시적 혼란 상태                    │
│                                          │
│                          [다음 →]         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  사전 평가 (3/3)                         │
│                                          │
│  Q. 73세 할머니가 약을 자꾸 잊습니다.      │
│  치매인지 건망증인지 어떻게 구분하시겠어요?  │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │ (서술형 입력)                        │ │
│  │                                     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ⏱ 응답 시간: 32초        [제출 →]       │
└─────────────────────────────────────────┘
```

### 4.3 Tutoring.tsx — v7 대화 UI 이식

v7 `student.html`의 대화 영역을 그대로 이식:

- `MessageBubble` (tutor/user 구분)
- `InputBar` (textarea + 전송 버튼, autoResize)
- `ChecklistSidebar` (오른쪽 또는 헤더 내장)
- `TypingIndicator`
- `DoneCard` (완료 시)

**v7에서 가져오는 CSS**: `.msg-tutor`, `.msg-user`, `.typing`, `.done-card` 등 메시지 관련 스타일을 `globals.css`에 그대로 복사.

**v7에서 가져오는 로직**: `send()` → `useSession.sendMessage()`, `addT()` → `MessageBubble`, `updateCL()` → `ChecklistSidebar`.

### 4.4 Reading.tsx — 신규

```
┌─────────────────────────────────────────┐
│  Reading Mode — 치매 개요                │
│  ──────────────────────────────────      │
│  ⏱ 경과: 3분 12초 / 최소 5분            │
│  ▓▓▓▓▓▓▓▓░░░░░░░░ 64%                  │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │  # 치매의 정의                       │ │
│  │                                     │ │
│  │  치매(dementia)는 후천적으로          │ │
│  │  인지기능이 저하되어 일상생활에        │ │
│  │  장애가 있는 증후군을 말합니다.        │ │
│  │                                     │ │
│  │  [mermaid diagram]                  │ │
│  │                                     │ │
│  │  [video player]                     │ │
│  │                                     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  [학습 완료 →] (최소 시간 미충족 시 비활성) │
└─────────────────────────────────────────┘
```

### 4.5 Report.tsx — 신규

```
┌──────────────────────────────────────────────┐
│  학습 성적표                                  │
│                                               │
│  ── 평가 결과 ──                               │
│  사전: 0.27        사후: 0.78                  │
│  ████████████████████░░░░  성장폭: +0.51       │
│                                               │
│  ── Bloom 수준별 ──                            │
│  Remember    ████████████████████  1.0 → 1.0   │
│  Understand  ██████████░░░░░░░░░  0.5 → 1.0   │
│  Apply       ░░░░░░░░░░░░░░█████  0.0 → 0.7   │
│  Analyze     ░░░░░░░░░░░░░░░████  — → 0.5     │
│                                               │
│  ── 임상 적용 ──                               │
│  Level 3: 근거 2~3개 + 사례 매칭               │
│                                               │
│  ── 체크리스트 (Tutoring 전용) ──               │
│  ✅ C1 정의 (T3) | ✅ C2 다영역 (T4)           │
│  ✅ C3 ADL (T2)  | ✅ C4 증후군 (T6)           │
│  ✅ C5 임상적용 (T8)                           │
│                                               │
│  [대시보드로 돌아가기]                           │
└──────────────────────────────────────────────┘
```

---

## 5. hooks 상세

### 5.1 useTimer.ts

```typescript
// v7의 elapsed_sec 측정 로직을 훅으로
export function useTimer() {
  const lastMessageTime = useRef<number | null>(null);
  
  const getElapsed = (): number | null => {
    const now = Date.now();
    const elapsed = lastMessageTime.current 
      ? (now - lastMessageTime.current) / 1000 
      : null;
    lastMessageTime.current = now;
    return elapsed;
  };
  
  return { getElapsed };
}
```

### 5.2 useScrollTracker.ts

```typescript
// Reading 모드 스크롤 깊이 추적
export function useScrollTracker(sessionId: string) {
  const [scrollDepth, setScrollDepth] = useState(0);
  
  useEffect(() => {
    const handler = throttle(() => {
      const el = document.getElementById('reading-content');
      if (!el) return;
      const depth = (el.scrollTop + el.clientHeight) / el.scrollHeight;
      setScrollDepth(Math.max(scrollDepth, depth));
      // 서버에 로그 전송
      fetch('/reading/log', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, event_type: 'scroll', event_data: { depth } }),
      });
    }, 3000); // 3초 throttle
    // ...
  }, [sessionId]);
}
```

---

## 6. API 호출 매핑

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8200';

export const api = {
  // 세션
  startSession: (nodeId: string, mode: string) =>
    post('/session/start', { node_id: nodeId, mode }),
  getSession: (sid: string) =>
    get(`/session/${sid}`),
  restoreSession: (sid: string) =>
    get(`/session/${sid}/restore`),
  listSessions: () =>
    get('/sessions'),
  
  // 평가
  submitTest: (sessionId: string, phase: string, responses: any[]) =>
    post('/test/submit', { session_id: sessionId, test_phase: phase, responses }),
  
  // 대화
  sendMessage: (sessionId: string, message: string, elapsedSec: number | null) =>
    post('/tutor/message', { session_id: sessionId, message, elapsed_sec: elapsedSec }),
  
  // Reading
  getReadingContent: (nodeId: string) =>
    get(`/reading/${nodeId}/content`),
  logReadingEvent: (sessionId: string, eventType: string, eventData: any) =>
    post('/reading/log', { session_id: sessionId, event_type: eventType, event_data: eventData }),
  completeReading: (sessionId: string) =>
    post('/reading/complete', { session_id: sessionId }),
  
  // 성적표
  getReport: (sid: string) =>
    get(`/report/${sid}`),
  
  // KG, Wiki (v7 호환)
  getKG: () => get('/kg'),
  getWikiDoc: (nodeId: string) => get(`/wiki/${nodeId}`),
};
```

---

## 7. 페이지 라우팅 플로우

```
/login → 로그인 → /dashboard
/dashboard → 노드 선택 → /session/[sid]
/session/[sid] → SessionProvider가 상태에 따라 패널 전환:
  status=pre_test       → <PreTest />
  status=learning_reading  → <Reading />
  status=learning_tutoring → <Tutoring />
  status=post_test      → <PostTest />
  status=completed      → <Report />
```

---

## 8. v7 CSS 이식 전략

1. **globals.css**: v7의 CSS 변수(:root)를 그대로 복사
2. **Tailwind 확장**: 색상, 폰트를 tailwind.config.ts에 등록
3. **메시지 버블 CSS**: `.msg-tutor`, `.msg-user` 등 복잡한 스타일은 globals.css에 v7 코드 그대로 유지 (Tailwind으로 변환하면 가독성 저하)
4. **레이아웃**: Tailwind flex/grid로 재구성
5. **애니메이션**: `@keyframes rise`, `breathe` 등 globals.css에 유지

---

## 9. 작업 순서 (Claude Code용)

```
Phase 1: 프로젝트 셋업
  1. Next.js 프로젝트 생성 (App Router, TypeScript, Tailwind)
  2. tailwind.config.ts — v7 디자인 토큰 등록
  3. globals.css — v7 CSS 변수 + 메시지 버블 스타일 이식
  4. lib/types.ts — 타입 정의
  5. lib/api.ts — API 호출 래퍼

Phase 2: 공통 컴포넌트
  6. components/common/Header.tsx — v7 header 이식
  7. components/chat/MessageBubble.tsx — v7 addT/addU 이식
  8. components/chat/InputBar.tsx — v7 입력창 이식
  9. components/chat/TypingIndicator.tsx
  10. components/chat/MermaidBlock.tsx

Phase 3: 세션 상태머신
  11. hooks/useSession.ts — 상태 관리
  12. hooks/useTimer.ts — elapsed_sec
  13. components/session/SessionProvider.tsx — Context
  14. app/session/[sid]/page.tsx — 상태별 패널 전환

Phase 4: 각 패널
  15. components/test/TestCard.tsx — 문항 카드
  16. components/session/PreTest.tsx
  17. components/session/Tutoring.tsx — v7 대화 UI 이식
  18. components/session/Reading.tsx
  19. components/session/PostTest.tsx
  20. components/session/Report.tsx

Phase 5: 페이지
  21. app/login/page.tsx — v7 login.html 이식
  22. app/dashboard/page.tsx — v7 dashboard.html 이식
  23. app/admin/page.tsx

Phase 6: 보완
  24. hooks/useScrollTracker.ts — Reading 스크롤 추적
  25. components/common/WikiModal.tsx
  26. components/common/NoteModal.tsx
  27. components/checklist/ChecklistSidebar.tsx
```

---

## 10. 개발 환경

```bash
# Next.js 프론트
cd ale-v8-frontend
npm run dev  # localhost:3000

# FastAPI 백엔드
cd ale-v8-backend  
uvicorn main:app --reload --port 8200

# Next.js → FastAPI 프록시
# next.config.ts에서 rewrites 설정
```

```typescript
// next.config.ts
module.exports = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8200/:path*' },
      { source: '/session/:path*', destination: 'http://localhost:8200/session/:path*' },
      { source: '/tutor/:path*', destination: 'http://localhost:8200/tutor/:path*' },
      { source: '/test/:path*', destination: 'http://localhost:8200/test/:path*' },
      { source: '/reading/:path*', destination: 'http://localhost:8200/reading/:path*' },
      { source: '/report/:path*', destination: 'http://localhost:8200/report/:path*' },
      { source: '/auth/:path*', destination: 'http://localhost:8200/auth/:path*' },
      { source: '/kg', destination: 'http://localhost:8200/kg' },
      { source: '/wiki/:path*', destination: 'http://localhost:8200/wiki/:path*' },
    ];
  },
};
```
