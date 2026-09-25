# HistoryAI

HistoryAI는 한국사Ⅱ 원문을 여러 방식으로 반복 회상하고, 퀴즈 답안과 AI 채점 기록을 바탕으로 취약한 내용을 다시 학습하는 개인 학습 웹앱이다.

## Product goals

- 원본 학습 자료의 문구와 구조를 최대한 정확하게 유지한다.
- 단순히 읽는 것이 아니라 여러 종류의 회상 학습을 제공한다.
- AI 채점을 이용해 답안에서 맞춘 핵심 사실과 놓친 사실을 구분한다.
- 누적 학습 기록을 이용해 실제로 도움이 되는 복습과 AI 코칭을 제공한다.
- 데스크톱과 모바일에서 모두 빠르고 편하게 사용할 수 있어야 한다.

## Current architecture

현재 구조:

- Vite + React + TypeScript SPA
- `index.html`이 Vite entry, `src/main.tsx`가 React root를 `#app`에 mount
- `src/app/`: router(`router.ts`), 라우팅 dispatch(`App.tsx`), 상태 구독(`store.ts`)
- `src/components/`: `Paper`(원문 카드·빈칸·360px 축소), `StudyShell`/`Navigation`/`useStudyKeys`, `AccessPanel`
- `src/features/<mode>/`: 학습 모드별 컴포넌트 (memorize, recall, blanks, timeline, order, compare, quiz, coach)
- `src/lib/`: DOM에 의존하지 않는 도메인 로직 (`data`, `text`, `state`, `cloze`, `questions`, `cloud`, `snapshot`)
- `src/types/domain.ts`: 원문·질문·빈칸·학습 상태·채점·코칭 타입
- `styles.css`에서 UI 스타일 관리 (Vite가 번들)
- `data.js`, `question-bank.js`는 원문 데이터 파일 그대로 두고 side-effect import로 읽음
- `public/`: `data.json`, `original.pdf`, `fonts/` (URL 그대로 유지)
- `api/study.js`는 Vercel Serverless Function (CommonJS, 변경 없음)
- Vercel Redis에 학습 및 채점 기록 저장
- Vercel AI Gateway를 통해 AI 채점
- `test.mjs`가 주요 자동 회귀 테스트 (`src/lib`의 모듈을 직접 import)
- `test-browser.mjs`가 브라우저 회귀 검사, `test-browser-server.mjs`가 그 정적·API 서버
- `npm run build`는 `vite build`

학습 상태는 React state가 아니라 `src/lib/state.ts`의 mutable 모듈이다. 입력 한 글자마다
리렌더링하지 않기 위한 의도적 선택이며, 이것이 한글 IME 조합을 깨뜨리지 않는 이유다.
상태를 바꾼 뒤에는 `src/app/store.ts`의 `refresh()`를 호출한다.

## Important invariants

다음은 명시적인 작업 목표가 없는 한 유지해야 한다.

- `data.json`, `data.js`, `question-bank.js`의 역사 자료를 임의로 변경하지 않는다.
- 기존 학습 URL과 직접 접근 동작을 유지한다.
- 기존 localStorage 학습 상태와 가능한 한 호환성을 유지한다.
- 키보드 접근성을 제거하지 않는다.
- 모바일 동작을 깨뜨리지 않는다.
- AI grading 데이터 형식을 이유 없이 변경하지 않는다.
- `api/study.js`와 Vercel 배포 구조를 이유 없이 재설계하지 않는다.
- 새로운 dependency는 필요한 경우에만 추가한다.
- 요청 범위를 벗어난 대규모 refactor를 하지 않는다.
- 실제 secret, access code, API key를 저장소에 넣지 않는다.
- 빈칸·답안 입력은 uncontrolled로 유지한다. controlled로 바꾸면 한글 IME 조합이 깨진다.
- `public/`의 파일 URL(`/data.json`, `/original.pdf`, `/fonts/*`)을 바꾸지 않는다.

## Verification

의미 있는 코드 변경 후 반드시 실행한다.

```bash
npm test
npm run build
```

UI 동작을 변경했다면 브라우저 회귀 검사도 실행한다.

```bash
node test-browser-server.mjs &
npm run test:browser
```

기존 `QA_REPORT.md`에 기록된 동작은 regression 기준으로 사용한다.

## Development philosophy

이 프로젝트는 개인용 vibe-coding 프로젝트다.

목표는 enterprise 수준의 process를 만드는 것이 아니라:

- 빠르게 기능을 구현하고
- 기존 동작을 망가뜨리지 않고
- 여러 coding agent를 필요할 때 병렬로 활용하고
- 개발용 infrastructure 자체가 프로젝트보다 복잡해지지 않게 하는 것

이다.

복잡한 planner hierarchy나 장기간 유지되는 task system을 만들지 않는다.

## Daily direction

그날 무엇을 개발할지는 이 문서에 기록하지 않는다.

일일 목표는 `.ai/GOAL.md`에 임시로 기록한다.

각 실행은 현재 코드, git history, PROJECT.md와 사용자가 입력한 목표를 기준으로 새로 계획한다.
