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

---

## Outcome

Completed. `app.js` is deleted and React is the only frontend runtime.

| Stage | Commit | Result |
| --- | --- | --- |
| 1 Baseline | `4a09697` | test + build green, 59-check browser baseline recorded |
| 2 Vite | `d6466b0` | Vite builds; `app.js` still the runtime, unchanged |
| 3 Domain extraction | `4bd5972` | `src/lib` + `src/types`; `test.mjs` imports real modules |
| 4 React shell | `b46fb83` | router, primitives, Home; bridge for unported routes |
| 5 Simple modes | `b22d8d5` | memorize, recall, compare |
| 6 Stateful modes | `1609c9c` | blanks, stages, timeline, order |
| 7 Quiz | `bb97a8f` | quiz + cloud grading |
| 8–9 Coach, cleanup | `ab3c0f1` | coach, recap, `app.js` deleted |

### What each risk cost

- **R1** paid off first: rewiring `test.mjs` to import `src/lib/cloze.ts` and
  `src/lib/questions.ts` proved the extraction was faithful across all 217 units and every
  topic/분량/세트 combination, before a single view was rewritten.
- **R2** was real. Making the cloze input controlled was tried deliberately and the browser
  suite caught it: composing text was clobbered by the previous draft and the commit produced
  `테스트감` instead of `감`. The inputs are uncontrolled, and `test-browser.mjs` drives real
  CDP `Input.imeSetComposition` events so the next agent cannot regress it silently.
- **R6** bit once: React's key handler and the legacy one were both installed on bridged
  routes, doubling every Alt+← / Alt+→. `useStudyKeys` now installs nothing without a mode.
- One bug was found that was not on the risk list: `useRefresh` re-rendered only the component
  that called it, so a card move updated the nav buttons but not the card. Replaced with a
  `useSyncExternalStore` subscription (`src/app/store.ts`).

## Remaining migration debt

1. **`resizePapers` is imperative.** It still measures the DOM and writes inline
   `transform`/`width` on `.paper`, from a layout effect that runs after every commit. A CSS
   `container-query`-based scale would delete it, but that is a styling change and this
   migration was not allowed to touch the visual layer.
2. **One bundle, ~670 KB raw.** `data.js` (385 KB of 원문) is imported eagerly. Route-level
   `React.lazy` plus a dynamic import of the data module would cut first paint, but it changes
   loading behavior and belongs in its own task.
3. **`data.js` and `question-bank.js` are still globals.** They are imported for side effect
   and read off `window` because the files must stay verbatim. If they are ever regenerated,
   emit ES modules and drop `src/types/globals.d.ts`.
4. **`src/package.json`** exists only to mark `src/` as ESM so `test.mjs` can import the typed
   modules directly under Node. It disappears if the repo root ever becomes
   `"type": "module"`, which needs `api/study.js` converted from CommonJS first.
5. **No component-level tests.** Coverage is the Node suite (domain + API) plus the browser
   suite (behavior). There are no unit tests for individual components, which is the right
   trade for this codebase's size but worth revisiting if the feature folders grow.
6. **`QA_REPORT.md` is dated 2026-09-22** and describes the pre-migration build. Its checks are
   now automated in `test-browser.mjs`; the report should be re-run or retired.
