import { useState } from 'react';
import type { ClozeTarget, StudyMode } from '../../types/domain';
import { targets as clozeTargets } from '../../lib/cloze.ts';
import { currentUnit, draftKey, save, state } from '../../lib/state.ts';
import { gradingText } from '../../lib/text.ts';
import { Navigation, StudyShell } from '../../components/StudyShell.tsx';
import { PaperSurface, usePaperScale } from '../../components/Paper.tsx';
import { useRefresh } from '../../app/store.ts';

type Mark = 'correct' | 'wrong';

/**
 * 랜덤 빈칸 (`blanks`) and 단계별 가리기 (`stages`) share one screen; they differ only in
 * how the blanks are chosen — one key blank per line rotated by `blankSeed`, versus a
 * widening mask driven by the 가림 단계 slider.
 */
export function ClozeMode({ mode }: { mode: 'blanks' | 'stages' }) {
  const refresh = useRefresh();
  const u = currentUnit(mode);
  const list = clozeTargets(u, mode === 'stages' ? state.stage : 2, mode === 'blanks', state.blankSeed);
  const [peek, setPeek] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark | undefined>>({});
  const [result, setResult] = useState<{ ok: boolean } | null>(null);
  usePaperScale();

  const check = () => {
    setPeek(false);
    const next: Record<string, Mark> = {};
    let ok = true;
    for (const x of list) {
      const el = document.querySelector<HTMLInputElement>(`[data-cloze="${x.id}"]`);
      const good = gradingText(el?.value ?? '') === gradingText(x.answer);
      next[x.id] = good ? 'correct' : 'wrong';
      ok &&= good;
    }
    setMarks(next);
    setResult({ ok });
  };

  /** Enter walks to the next blank, and from the last one runs the check. */
  const onEnter = (x: ClozeTarget) => {
    const i = list.indexOf(x), nextTarget = list[i + 1];
    if (nextTarget) document.querySelector<HTMLInputElement>(`[data-cloze="${nextTarget.id}"]`)?.focus();
    else { document.querySelector<HTMLButtonElement>('#check')?.focus(); check() }
  };

  const reset = () => { setPeek(false); setMarks({}); setResult(null) };

  return (
    <StudyShell mode={mode as StudyMode} total={state.session.length}>
      {mode === 'stages' && (
        <div className="toolbar stage-picker">
          <label>가림 단계 <input
            id="stage" type="range" min="1" max="5" value={state.stage}
            onChange={e => { state.stage = Number(e.target.value); save(); reset(); refresh() }}
          /> <b>{state.stage}</b></label>
        </div>
      )}
      <div className="workspace">
        <PaperSurface
          unit={u}
          cloze={{
            targets: list, peek, marks,
            draft: x => state.drafts[draftKey(mode, u, x.id)] || '',
            onInput: (x, value) => { state.drafts[draftKey(mode, u, x.id)] = value; setMarks(m => (m[x.id] ? { ...m, [x.id]: undefined } : m)); save() },
            onEnter,
            onHidePeek: () => setPeek(false),
          }}
        />
        <section className="surface answer">
          <div className="prompt">빈칸에서 바로 입력하세요. 가운뎃점·화살표·괄호·띄어쓰기는 채점하지 않습니다. Enter/Tab은 다음 칸입니다.</div>
          <div className="actions">
            <button id="check" onClick={check}>정답 확인</button>
            <button className="ghost" id="reveal" aria-pressed={peek} onClick={() => setPeek(v => !v)}>
              {peek ? '정답 다시 가리기' : '정답 살짝 보기'}
            </button>
            {mode === 'blanks' && (
              <button className="ghost" id="new" onClick={() => {
                state.blankSeed++;
                list.forEach(x => delete state.drafts[draftKey(mode, u, x.id)]);
                save(); reset(); refresh();
              }}>새 빈칸</button>
            )}
          </div>
          <div id="result" className={result ? `result ${result.ok ? 'ok' : 'bad'}` : undefined}>
            {result && (result.ok ? '✓ 특수기호를 제외한 모든 단어가 일치합니다.' : '표시된 빈칸의 단어를 다시 확인하세요.')}
          </div>
          <Navigation mode={mode as StudyMode} total={state.session.length} afterMove={reset} />
        </section>
      </div>
    </StudyShell>
  );
}
