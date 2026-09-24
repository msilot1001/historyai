# Frontend migration: vanilla → Vite + React + TypeScript

Baseline commit: c9d9f3c. `npm test` and `npm run build` green before stage 1.

## Current architecture (inspected)

| Concern | Where it lives today |
| --- | --- |
| Data | `data.js` → `window.HISTORY_DATA`; `question-bank.js` → `window.HISTORY_QUESTIONS`; `data.json` published as a static file |
| Runtime | `app.js`, one IIFE, ~1400 statements, template-literal rendering into `#app` |
| Routing | `location.pathname` + `history.pushState` + `popstate`; `[data-link]` anchors intercepted |
| Styling | `styles.css`, absolute `/fonts/*.ttf` |
| Build | `build.mjs` copies files, renames `app.js` → `client.js` |
| API | `api/study.js`, Vercel Function, CommonJS |
| Tests | `test.mjs` — **string-slices `app.js` and evals the slices** |

### Routes

`/` · `/study/{memorize,recall,blanks,stages,quiz,timeline,order,compare}` · `/coach` · `/coach/recap` · `/review` (alias of `/coach`).
`quiz` ↔ internal mode id `questions`. `vercel.json` rewrites all of these to `/`.

### State boundaries

1. **Persisted** — `localStorage['history-v2']`: `topic, count, setIndex, indices{mode→idx}, session[], drafts{}, progress{}, stage, blankSeed, timelineDirection, placements{}, order[], selected, questionVersion, coachRound, coachIndex`. Migration hook already exists (`questionVersion !== 2` resets the quiz index).
2. **Ephemeral per card** — `attempt = {revealed, checked, hint}`, reset on every navigation and `popstate`.
3. **Cloud cache** — `cloudEvents`, lazily fetched once, appended to by `record()`.
4. **Coach UI** — `coachTab`, `coachTopic`.
5. **Credential** — `localStorage['history-access-code']`.

### Feature boundaries

Pure domain logic, no DOM: `unitQuestion`, `questionPool`, `filtered`, `buildSession`, `clozeCandidates`, `splitTarget`, `randomKeyTarget`, `targets`, `gradingText`, `learningSnapshot`, `text`, `yearText`, `esc`.
Everything else is view + binding code, one function per mode.

## Compatibility risks found

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | `test.mjs` extracts functions by slicing `app.js` source between exact markers | Stage 3 rewires extraction to real module imports. Assertions, inputs and expected values stay byte-identical. |
| R2 | Korean IME: controlled React inputs drop/duplicate composition text | Cloze + textarea inputs stay **uncontrolled** (`defaultValue`), drafts written to a mutable store on `input`, never to React state. `isComposing` + `dataset.composing` guards preserved verbatim. |
| R3 | `resizePapers()` measures the DOM and sets `transform: scale()` | Runs in `useLayoutEffect` after commit, plus the existing `resize` listener. |
| R4 | `save()` runs on every keystroke and pokes `.status` textContent directly | Draft store stays outside React; no re-render per keystroke. |
| R5 | Raw HTML from the source data (`year_html`, `title_html`, `line.html`) | `dangerouslySetInnerHTML`, data-owned strings only. |
| R6 | Global `document.onkeydown` reassigned per render (Alt+←/→, memorize ←/→/Enter) | One keyboard effect keyed on mode; still clicks `[data-prev]`/`[data-next]`. |
| R7 | `/fonts/*.ttf` and `/original.pdf` are absolute URLs; `/data.json` is published | Move `fonts/`, `original.pdf`, `data.json` into `public/` so Vite serves and emits them at the same paths. |
| R8 | `order()` and `buildSession()` mutate + save during render | Moved into effects/handlers, never in render. |
| R9 | `data.js` / `question-bank.js` must not be edited | Imported for side effect (`import '../data.js'`); they assign to `window`, which is valid ESM. Globals typed in `src/types/globals.d.ts`. |
| R10 | `api/study.js` is CommonJS | `package.json` stays CommonJS-default. API untouched. |

## Stages

Each stage ends with `npm test` + `npm run build` green and its own commit.

1. **Baseline** — record green test/build. ✔
2. **Vite** — add vite/react/react-dom/typescript; `index.html` becomes the Vite entry; `src/main.ts` imports styles + data + `app.js`. `app.js` logic unchanged. Static passthroughs move to `public/`.
3. **Types + domain extraction** — `src/types/`, `src/lib/{data,text,state,cloze,questions,cloud,snapshot}.ts`. `app.js` consumes them. `test.mjs` imports the modules instead of slicing source (Node 25 strips types natively).
4. **React shell** — root, router, `<StudyShell>`, `<Home>`; legacy bridge so unported routes still render through `app.js`.
5. **Simple modes** — memorize, recall, compare.
6. **Stateful modes** — blanks, stages (IME), timeline, order.
7. **Quiz** — `features/quiz`.
8. **Coach** — `features/coach` + recap.
9. **Remove legacy** — delete `app.js` and the bridge.

Order deviates from the suggested one in exactly one place: domain extraction (3) comes before the React shell, because `test.mjs`'s source-slicing is the sharpest coupling in the repo and pinning it to real modules first means every later stage is covered by the existing suite.
