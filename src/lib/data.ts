// data.js and question-bank.js are source-history files kept verbatim; importing them
// for their side effect populates window.HISTORY_DATA / window.HISTORY_QUESTIONS.
import '../../data.js';
import '../../question-bank.js';
import type { DataBundle, HistoryData, IndexedUnit, Question, Topic } from '../types/domain';

export let DATA: HistoryData = window.HISTORY_DATA;

/** Units in unmodified source order; `sourceIndex` is what 순서 맞추기 grades against. */
export let units: IndexedUnit[] = DATA.units.map((u, i) => ({ ...u, sourceIndex: i }));
export let byId = new Map<string, IndexedUnit>(units.map(u => [u.id, u]));
export let topics: Topic[] = DATA.topics;

export let questionBank: Question[] = window.HISTORY_QUESTIONS.map(
  ([topic, kind, refs, q, a], id) => ({ topic, kind, refs: refs.split(' '), q, a, id }),
);

export function applyDataBundle(bundle: DataBundle) {
  if (![2, 3, 4, 5, 6].includes(bundle.version) || !bundle.data?.units?.length || !Array.isArray(bundle.questions)) throw new Error('학습 자료 형식이 올바르지 않습니다.');
  const ids = new Set(bundle.data.units.map(u => u.id));
  const unitsById = new Map(bundle.data.units.map(u => [u.id, u]));
  const invalidQuestions = bundle.questions.some(q => {
    if ((typeof q.id !== 'string' && !Number.isInteger(q.id)) || String(q.id).length > 100 || typeof q.q !== 'string' || q.q.length > 600 || typeof q.a !== 'string' || q.a.length > 2400 || !Array.isArray(q.refs) || !q.refs.length || q.refs.length > 6 || q.refs.some(id => !ids.has(id))) return true;
    if (bundle.version < 4) return false;
    return !Array.isArray(q.facts) || !q.facts.length || q.facts.length > 24 || q.facts.some(f => typeof f !== 'string' || !f.trim() || f.length > 500) ||
      !Array.isArray(q.covers) || !q.covers.length || q.covers.some(c => !ids.has(c.id) || !q.refs.includes(c.id) || !Number.isInteger(c.line) || c.line < 0 || c.line >= (unitsById.get(c.id)?.lines.length || 0));
  });
  if (ids.size !== bundle.data.units.length || bundle.data.units.some(u => !u.lines?.length || u.lines.map(line => line.text).join('\n') !== u.answer) || invalidQuestions) throw new Error('학습 자료의 카드·질문 연결을 확인해 주세요.');
  DATA = bundle.data;
  units = DATA.units.map((u, i) => ({ ...u, sourceIndex: i }));
  byId = new Map(units.map(u => [u.id, u]));
  topics = DATA.topics;
  questionBank = bundle.questions;
  return bundle.version;
}
