# Coding agent instructions

작업 전에 반드시 `PROJECT.md`를 읽는다.

`.ai/GOAL.md`가 존재한다면 이번 실행의 목표로 사용한다.

## Scope

할당받은 task만 구현한다.

관련 없는 refactor, naming cleanup, architecture 변경을 임의로 추가하지 않는다.

작업 중 더 큰 문제가 발견되더라도 현재 task를 수행하는 데 반드시 필요하지 않다면 수정하지 말고 결과에 기록한다.

## Source data

다음 파일은 명시적인 요청이 없는 한 수정하지 않는다.

- `data.json`
- `data.js`
- `question-bank.js`
- `original.pdf`

역사 내용이나 원문 데이터를 임의로 보정하거나 재작성하지 않는다.

## Existing behavior

기존 동작을 보존한다.

특히:

- 학습 모드별 progress
- localStorage state
- keyboard navigation
- direct study URLs
- mobile layout
- cloud grading
- AI coaching
- quiz history

를 변경할 때는 regression 가능성을 확인한다.

## Verification

코드 변경 후 반드시 실행:

```bash
npm test
npm run build
```

실패하면 원인을 조사하고 task 범위 안에서 수정한다.

테스트 자체가 잘못됐다고 판단해 기존 테스트를 삭제하거나 약화하지 않는다.

## Parallel agent rule

다른 agent도 동시에 작업할 수 있다.

따라서:

- 할당된 파일과 기능 범위를 최대한 지킨다.
- 같은 파일에 불필요하게 광범위한 formatting 변경을 하지 않는다.
- unrelated cleanup을 하지 않는다.
- commit은 하나의 명확한 task 단위로 유지한다.

## Git

agent 작업은 독립 branch/worktree에서 수행될 수 있다.

main branch를 직접 변경한다고 가정하지 않는다.

작업 완료 후 변경사항과 검증 결과를 간단히 정리한다.