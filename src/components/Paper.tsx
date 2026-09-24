import { useEffect, useLayoutEffect } from 'react';
import type { ClozeTarget, Unit } from '../types/domain';
import { yearText } from '../lib/text.ts';

/**
 * The original note is typeset at a fixed 360px width, exactly as it sits on the page,
 * and scaled down to fit narrow screens. Measured from the DOM, so it runs after commit.
 */
export function resizePapers() {
  document.querySelectorAll<HTMLElement>('.paper-stage').forEach(stage => {
    const wrap = stage.querySelector<HTMLElement>('.paper-scale'), p = stage.querySelector<HTMLElement>('.paper');
    if (!wrap || !p) return;
    const style = getComputedStyle(stage);
    const available = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const scale = Math.min(1, available / 360);
    p.style.transform = `scale(${scale})`;
    wrap.style.height = `${p.offsetHeight * scale}px`;
    wrap.style.flexBasis = `${360 * scale}px`;
    wrap.style.width = `${360 * scale}px`;
  });
}

export function usePaperScale(...deps: unknown[]) {
  useLayoutEffect(() => { resizePapers(); requestAnimationFrame(resizePapers) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { resizePapers() }, deps);
  useEffect(() => {
    addEventListener('resize', resizePapers);
    return () => removeEventListener('resize', resizePapers);
  }, []);
}

interface ClozeInputProps {
  target: ClozeTarget;
  ordinal: number;
  defaultValue: string;
  peek: boolean;
  mark?: 'correct' | 'wrong';
  onInput: (value: string) => void;
  onEnter: () => void;
  onHidePeek: () => void;
}

/**
 * Uncontrolled on purpose: a controlled React input drops or duplicates characters
 * mid-composition for Korean IME. `isComposing` plus the composing flag reproduce the
 * original guards so Enter never fires while a syllable is still being assembled.
 */
function ClozeInput({ target, ordinal, defaultValue, peek, mark, onInput, onEnter, onHidePeek }: ClozeInputProps) {
  return (
    <span className={peek ? 'cloze-wrap peek' : 'cloze-wrap'}>
      <input
        className={mark ? `inline-input ${mark}` : 'inline-input'}
        data-cloze={target.id}
        aria-label={`${ordinal}번째 빈칸`}
        autoComplete="off"
        spellCheck={false}
        defaultValue={defaultValue}
        style={{ width: `${Math.max(28, Math.min(160, target.answer.length * 13 + 8))}px` }}
        onFocus={onHidePeek}
        onInput={e => { onHidePeek(); onInput(e.currentTarget.value) }}
        onCompositionStart={e => { e.currentTarget.dataset.composing = '1' }}
        onCompositionEnd={e => { delete e.currentTarget.dataset.composing }}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing || e.currentTarget.dataset.composing) return;
          if (e.key === 'Enter') { e.preventDefault(); onEnter() }
        }}
      />
      <span className="cloze-peek" aria-hidden="true">{target.answer}</span>
    </span>
  );
}

interface ClozeOptions {
  targets: ClozeTarget[];
  peek: boolean;
  marks: Record<string, 'correct' | 'wrong' | undefined>;
  draft: (target: ClozeTarget) => string;
  onInput: (target: ClozeTarget, value: string) => void;
  onEnter: (target: ClozeTarget) => void;
  onHidePeek: () => void;
}

type ClozeLineProps = ClozeOptions & { line: string; lineIndex: number };

/** One source line with its blanks punched out; the text between blanks stays verbatim. */
function ClozeLine({ line, lineIndex, targets, peek, marks, draft, onInput, onEnter, onHidePeek }: ClozeLineProps) {
  const here = targets.filter(x => x.line === lineIndex).sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let at = 0;
  here.forEach(x => {
    out.push(line.slice(at, x.start));
    out.push(
      <ClozeInput
        key={x.id}
        target={x}
        ordinal={targets.indexOf(x) + 1}
        defaultValue={draft(x)}
        peek={peek}
        mark={marks[x.id]}
        onInput={value => onInput(x, value)}
        onEnter={() => onEnter(x)}
        onHidePeek={onHidePeek}
      />,
    );
    at = x.end;
  });
  out.push(line.slice(at));
  return <>{out}</>;
}

export interface PaperProps {
  unit: Unit;
  hide?: boolean;
  cloze?: ClozeOptions;
}

/** The 원문 card itself: 주제, 연도, 제목 and lines, with optional blanks or full masking. */
export function Paper({ unit, hide = false, cloze }: PaperProps) {
  const targets = cloze?.targets ?? [];
  const line = (value: string, lineIndex: number) =>
    cloze ? <ClozeLine {...cloze} line={value} lineIndex={lineIndex} /> : null;
  const special = (n: number) => targets.some(i => i.line === n) ? line(n === -1 ? yearText(unit) : unit.title, n) : null;
  return (
    <article className="paper">
      <div className="topic">주제 {String(unit.topic).padStart(2, '0')} {unit.topic_title}</div>
      <div className="year">{special(-1) || <span dangerouslySetInnerHTML={{ __html: unit.year_html }} />}</div>
      <h3 className="title">{special(-2) || <span dangerouslySetInnerHTML={{ __html: unit.title_html }} />}</h3>
      {unit.book ? <div className="book">교과서</div> : null}
      <div className="lines">
        {unit.lines.map((l, li) => (
          <div className="line" key={li}>
            {targets.length ? line(l.text, li) : hide ? '••••••••••••••' : <span dangerouslySetInnerHTML={{ __html: l.html }} />}
          </div>
        ))}
      </div>
    </article>
  );
}

/** The 원문 card plus its "원문의 자리" heading and the scaling stage. */
export function PaperSurface(props: PaperProps & { bare?: boolean }) {
  const { bare, ...paper } = props;
  const inner = (
    <>
      <div className="surface-head">
        <h2>원문의 자리</h2>
        <span className="meta">{props.unit.position.page}쪽 · {props.unit.position.column}단(상위 위치)</span>
      </div>
      <div className="paper-stage"><div className="paper-scale"><Paper {...paper} /></div></div>
    </>
  );
  return bare ? inner : <section className="surface">{inner}</section>;
}
