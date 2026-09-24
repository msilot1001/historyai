import type { StudyMode, StudyState } from '../types/domain';
import { byId, units } from './data.ts';

const KEY = 'history-v2';

export const defaults: StudyState = {
  topic: 'all', count: 10, setIndex: 0, indices: {}, session: [], drafts: {}, progress: {},
  stage: 2, blankSeed: 0, timelineDirection: 'event', placements: {}, order: [], selected: null,
  questionVersion: 3, coachRound: [], coachIndex: 0,
};

function validState(x: unknown): x is Partial<StudyState> {
  const s = x as Partial<StudyState> | null;
  return !!s && typeof s === 'object' && !Array.isArray(s) &&
    (!s.session || Array.isArray(s.session)) && (!s.drafts || typeof s.drafts === 'object');
}

/**
 * Read the persisted study state.
 * Unknown/older payloads fall back to defaults; a question version change resets only the quiz
 * index, so existing drafts and per-mode progress survive the upgrade.
 */
export function load(): StudyState {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!validState(x)) return structuredClone(defaults);
    const next: StudyState = { ...defaults, ...x };
    if (x.questionVersion !== 3) { next.indices = { ...next.indices, questions: 0 }; next.questionVersion = 3 }
    return next;
  } catch { return structuredClone(defaults) }
}

/** The single mutable study state. Kept outside React so per-keystroke drafts never re-render. */
export let state: StudyState = load();

let onStatus: (message: string) => void = () => {};
export function setStatusHandler(fn: (message: string) => void) { onStatus = fn }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); onStatus('저장됨') }
  catch { onStatus('저장하지 못했습니다. 이 화면을 닫지 마세요.') }
}

export function resetState() {
  localStorage.removeItem(KEY);
  state = structuredClone(defaults);
}

export function modeIndex(mode: StudyMode): number { return state.indices[mode] || 0 }

export function draftKey(mode: string, u: { id: string }, suffix = 'main'): string {
  return `${mode}:${u.id}:${suffix}`;
}

/** Units inside the current 범위 filter. */
export function filtered() {
  return units.filter(u => state.topic === 'all' || String(u.topic) === String(state.topic));
}

export function totalSets(): number {
  return Math.max(1, Math.ceil(filtered().length / (Number(state.count) || 10)));
}

/** Rebuild the current set and clear every per-set position. Clamps setIndex into range. */
export function buildSession() {
  const pool = filtered(), size = Number(state.count) || 10, total = Math.max(1, Math.ceil(pool.length / size));
  state.setIndex = Math.min(Math.max(0, state.setIndex || 0), total - 1);
  const start = state.setIndex * size;
  state.session = pool.slice(start, start + size).map(u => u.id);
  state.indices = {}; state.placements = {}; state.order = [];
  save();
}

export function currentUnit(mode: StudyMode) {
  return byId.get(state.session[modeIndex(mode)]) || units[0];
}

/** The 10 cards the 연도 배치 / 순서 회상 boards work with. */
export function roundUnits() {
  return state.session.map(id => byId.get(id)).filter(Boolean).slice(0, 10) as ReturnType<typeof filtered>;
}
