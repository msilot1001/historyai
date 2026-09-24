import { byId, units } from '../../lib/data.ts';
import { draftKey, modeIndex, save, state } from '../../lib/state.ts';
import { Navigation, StudyShell } from '../../components/StudyShell.tsx';
import { PaperSurface, usePaperScale } from '../../components/Paper.tsx';
import type { IndexedUnit } from '../../types/domain';

/** Fixed pairs of 원문 that are worth reading side by side. */
const PAIR_NAMES = [
  ['국내 비밀 결사와 의병', '의열 투쟁'],
  ['이봉창 의거', '윤봉길 의거'],
  ['제1차 미소 공동 위원회', '제2차 미소 공동 위원회'],
  ['발췌 개헌', '사사오입 개헌'],
  ['봉오동 전투', '청산리 대첩'],
];

export function Compare() {
  usePaperScale();
  const index = modeIndex('compare');
  const pairs = PAIR_NAMES
    .map(names => names.map(n => units.find(u => u.title === n)))
    .filter(p => p.every(Boolean)) as IndexedUnit[][];
  const fallbackFirst = byId.get(state.session[index]) || units[0];
  const pair = pairs[index % pairs.length] || [fallbackFirst, units[fallbackFirst.sourceIndex + 1] || units[0]];

  return (
    <StudyShell mode="compare" total={state.session.length}>
      <p className="prompt">관련 사건의 원문 표현을 나란히 보고 공통점과 차이를 기억하세요.</p>
      <div className="compare">
        {pair.map(u => (
          <section className="surface" key={u.id}>
            <PaperSurface unit={u} bare />
            <div className="answer">
              <label>{u.title} 메모
                <textarea
                  key={u.id} data-compare={u.id} defaultValue={state.drafts[draftKey('compare', u)] || ''}
                  onInput={e => { state.drafts[draftKey('compare', u)] = e.currentTarget.value; save() }}
                />
              </label>
            </div>
          </section>
        ))}
      </div>
      <Navigation mode="compare" total={state.session.length} />
    </StudyShell>
  );
}
