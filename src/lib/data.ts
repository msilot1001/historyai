// data.js and question-bank.js are source-history files kept verbatim; importing them
// for their side effect populates window.HISTORY_DATA / window.HISTORY_QUESTIONS.
import '../../data.js';
import '../../question-bank.js';
import type { HistoryData, IndexedUnit, Question, Topic } from '../types/domain';

export const DATA: HistoryData = window.HISTORY_DATA;

/** Units in unmodified source order; `sourceIndex` is what 순서 회상 grades against. */
export const units: IndexedUnit[] = DATA.units.map((u, i) => ({ ...u, sourceIndex: i }));
export const byId = new Map<string, IndexedUnit>(units.map(u => [u.id, u]));
export const topics: Topic[] = DATA.topics;

export const questionBank: Question[] = window.HISTORY_QUESTIONS.map(
  ([topic, kind, refs, q, a], id) => ({ topic, kind, refs: refs.split(' '), q, a, id }),
);
