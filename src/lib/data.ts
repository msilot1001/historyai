// data.js and question-bank.js are source-history files kept verbatim; importing them
// for their side effect populates window.HISTORY_DATA / window.HISTORY_QUESTIONS.
import '../../data.js';
import '../../question-bank.js';
import type { DataBundle, HistoryData, IndexedUnit, Question, Topic } from '../types/domain';

export let DATA: HistoryData = window.HISTORY_DATA;

/** Units in unmodified source order; `sourceIndex` is what 순서 회상 grades against. */
export let units: IndexedUnit[] = DATA.units.map((u, i) => ({ ...u, sourceIndex: i }));
export let byId = new Map<string, IndexedUnit>(units.map(u => [u.id, u]));
export let topics: Topic[] = DATA.topics;

export let questionBank: Question[] = window.HISTORY_QUESTIONS.map(
  ([topic, kind, refs, q, a], id) => ({ topic, kind, refs: refs.split(' '), q, a, id }),
);

export function applyDataBundle(bundle: DataBundle) {
  if (![2, 3].includes(bundle.version) || !bundle.data?.units?.length || !Array.isArray(bundle.questions)) throw new Error('학습 자료 형식이 올바르지 않습니다.');
  const ids = new Set(bundle.data.units.map(u => u.id));
  if (ids.size !== bundle.data.units.length || bundle.data.units.some(u => !u.lines?.length || u.lines.map(line => line.text).join('\n') !== u.answer) ||
    bundle.questions.some(q => !q.q || !q.a || !Array.isArray(q.refs) || q.refs.length > 6 || q.refs.some(id => !ids.has(id)))) throw new Error('학습 자료의 카드·질문 연결을 확인해 주세요.');
  DATA = bundle.data;
  units = DATA.units.map((u, i) => ({ ...u, sourceIndex: i }));
  byId = new Map(units.map(u => [u.id, u]));
  topics = DATA.topics;
  questionBank = bundle.questions;
  return bundle.version;
}
