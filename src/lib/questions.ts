import type { PoolQuestion, Question, Unit } from '../types/domain';

const headings = /^(목적|과정|결과|영향|특징|내용|배경|전개|피해|의의|원인|변화)$/;

/** One recall prompt per source fact; every required answer comes from its cited card. */
export function unitQuestions(u: Unit): Question[] {
  return u.lines.flatMap((line, index) => {
    const raw = line.text.trim();
    if (!raw) return [];
    const arrow = raw.startsWith('→');
    const text = raw.replace(/^→\s*/, '');
    const colon = text.indexOf(':');
    const label = colon < 0 ? '' : text.slice(0, colon).trim();
    const answer = colon < 0 ? text : text.slice(colon + 1).trim();
    if (!answer || headings.test(label)) return [];
    const q = arrow
      ? `${u.title}: 화살표로 제시된 사실은?`
      : label
        ? `${u.title}: ${label}에 해당하는 내용은?`
        : `${u.title}: 이 카드에 제시된 사실은?`;
    return [{ id: `v3:${u.id}:${index}`, kind: '원문 사실', refs: [u.id], q, a: answer, facts: [answer] }];
  });
}

/** Compatibility helper for callers that need a single question for one card. */
export function unitQuestion(u: Unit, _detail = false): Question {
  return unitQuestions(u)[0] || { id: `v3:${u.id}:0`, kind: '원문 사실', refs: [u.id], q: `${u.title}: 이 카드의 내용은?`, a: u.answer };
}

/** Everything `questionPool` needs from the session/state layer, injected so it stays pure. */
export interface PoolContext {
  questionBank: Question[];
  byId: Map<string, Unit>;
  state: Pick<import('../types/domain').StudyState, 'session' | 'setIndex' | 'count'>;
  filtered: () => Unit[];
  buildSession: () => void;
}

/** The current quiz covers every source fact in the set, then keeps the earlier-set recap. */
export function questionPool(ctx: PoolContext): PoolQuestion[] {
  const { questionBank, byId, state, filtered, buildSession } = ctx;
  if (!state.session.length) buildSession();
  const all = filtered();
  const current = state.session.map(id => byId.get(id)).filter(Boolean) as Unit[];
  const ids = new Set(state.session);
  const main = questionBank.filter(q => q.refs.length && q.refs.every(id => ids.has(id)));
  const seen = new Set(main.map(q => q.id));
  const covered = new Set(main.flatMap(q => q.refs));
  for (const unit of current) {
    if (!covered.has(unit.id)) {
      for (const question of unitQuestions(unit)) {
        if (!seen.has(question.id)) {
          main.push(question);
          seen.add(question.id);
        }
      }
    }
  }

  const prior = all.slice(0, state.setIndex * Number(state.count));
  const priorIds = new Set(prior.map(unit => unit.id));
  const used = new Set<string | number>();
  const recap = Array.from({ length: Math.min(8, prior.length) }, (_, i) => prior[Math.floor((i + .5) * prior.length / Math.min(8, prior.length))]).map(unit => {
    const picked = questionBank.find(q => !used.has(q.id) && q.refs.includes(unit.id) && q.refs.every(id => priorIds.has(id))) || unitQuestions(unit)[0] || unitQuestion(unit);
    used.add(picked.id);
    return picked;
  });
  const source = (q: Question) => q.refs.map(id => {
    const unit = byId.get(id);
    const index = all.findIndex(item => item.id === id);
    const size = Number(state.count);
    return !unit || index < 0 ? '' : `${Math.floor(index / size) + 1}세트 ${index % size + 1}번째 카드 · 주제 ${unit.topic} ${unit.title}`;
  }).filter(Boolean).join(' / ');
  const pool: PoolQuestion[] = main.map(q => ({ ...q, scope: 'current', source: source(q), groupCount: main.length }));
  return pool.concat(recap.map(q => ({ ...q, scope: 'recap', source: source(q), groupCount: recap.length })));
}
