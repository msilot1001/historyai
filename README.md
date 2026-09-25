# 한국사Ⅱ 기억 연표 v2

원문 137항목·217학습 단위의 암기 앱입니다. 퀴즈 답안과 핵심 사실별 AI 채점 이력은 Vercel Redis에 저장됩니다. AI 코칭 화면에서 주제별 약점, 반복 누락, 보완 리캡을 확인할 수 있습니다.

## 로컬 확인

```bash
npm install
npm run dev
```

Vite dev 서버가 `/study/...`, `/coach` 직접 접근과 새로고침을 그대로 처리합니다.
AI 채점까지 확인하려면 `node test-browser-server.mjs`를 띄우고 접속 코드에 `browser-test`를 넣으세요.

검증:

```bash
npm test            # 데이터·빈칸·퀴즈·클라우드 API 회귀 검사 (Node 22.6+)
npm run typecheck   # tsc --noEmit
npm run build       # vite build -> dist
npm run test:browser  # 브라우저 회귀 검사 (test-browser-server.mjs 필요)
```

## Vercel

Vercel 프로젝트에 `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `STUDY_ACCESS_CODE`가 필요합니다. AI 채점은 Vercel AI Gateway의 `openai/gpt-6-luna`를 사용하며, Vercel 배포 환경에서는 OIDC로 인증합니다. 하루 AI 호출 상한은 80회입니다. AI Gateway에서 지출 한도를 설정하세요.

이전 AWS 연동 절차를 기록한 [AWS_SETUP.md](./AWS_SETUP.md)는 현재 배포에 적용되지 않습니다.

원본 PDF도 정적 파일로 함께 공개됩니다. 공개 범위와 저작권을 확인한 뒤 배포하세요.

## 키보드

- 빈칸: `Enter` 또는 `Tab`으로 다음 칸
- 퀴즈: 답안 작성 후 `Enter`로 제출, 결과에서 `Enter`로 자기평가·다음 문제
- 모든 카드형 학습: `Alt+←` / `Alt+→`로 이전·다음
- 먼저 외우기: `←` / `→` / `Enter`로 넘기기
- 순서 맞추기: 첫 세트부터 현재 세트까지의 카드를 카드에 초점을 둔 뒤 `↑` / `↓`로 이동
- 연도 배치: 카드의 `선택`을 누르고 Tab으로 슬롯에 이동한 뒤 `Enter`

## 데이터 주의

학습 기록은 접속 코드를 아는 사람에게 열리므로 코드를 공유하지 마세요.
