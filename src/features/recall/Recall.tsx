import { useRef, useState } from 'react';
import { currentUnit, draftKey, save, state } from '../../lib/state.ts';
import { gradingText, text } from '../../lib/text.ts';
import { Navigation, StudyShell } from '../../components/StudyShell.tsx';
import { PaperSurface, usePaperScale } from '../../components/Paper.tsx';

export function Recall() {
  const u = currentUnit('recall');
  const key = draftKey('recall', u);
  const answer = useRef<HTMLTextAreaElement>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean } | null>(null);
  usePaperScale();

  const persist = () => { state.drafts[key] = answer.current?.value ?? ''; save() };
  const check = () => {
    persist();
    setResult({ ok: gradingText(text(u)) === gradingText(answer.current?.value ?? '') });
    setChecked(true);
  };

  return (
    <StudyShell mode="recall" total={state.session.length}>
      <div className="workspace">
        <PaperSurface unit={u} hide={!revealed && checked} />
        <section className="surface answer">
          <div className="prompt">원문을 읽은 뒤 가리고, 문구와 줄 순서를 그대로 입력하세요. Ctrl+Enter로 채점합니다.</div>
          <label>원문 복원
            <textarea
              key={key} id="answer" ref={answer} spellCheck={false} placeholder="기억한 문장을 입력하세요"
              defaultValue={state.drafts[key] || ''}
              onInput={() => { persist(); setChecked(false) }}
              onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); check() } }}
            />
          </label>
          <div className="actions">
            <button id="hide" onClick={() => setChecked(v => !v)}>{checked ? '원문 다시 보기' : '가리고 복원하기'}</button>
            <button className="ghost" id="check" onClick={check}>정답 확인</button>
            <button className="ghost" id="reveal" onClick={() => setRevealed(true)}>정답 공개</button>
          </div>
          <div id="result" className={result ? `result ${result.ok ? 'ok' : 'bad'}` : undefined}>
            {result && (result.ok ? '✓ 특수기호를 제외한 단어가 일치합니다.' : (
              <>다시 확인할 단어가 있습니다.<br /><b>원문</b><br />
                {text(u).split('\n').map((l, i) => <span key={i}>{i ? <br /> : null}{l}</span>)}
              </>
            ))}
          </div>
          <Navigation
            mode="recall" total={state.session.length}
            beforeMove={persist}
            afterMove={() => { setChecked(false); setRevealed(false); setResult(null) }}
          />
        </section>
      </div>
    </StudyShell>
  );
}
