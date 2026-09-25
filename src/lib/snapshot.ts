import type { CloudEvent, Grade, LearningSnapshot, PointHistoryItem, Question, Rating, TrackedPoint } from '../types/domain';
import { DATA, byId, units } from './data.ts';

type Attempt = Extract<CloudEvent, { type: 'attempt' }>;

/**
 * Fold the append-only cloud log into the coach view model.
 *
 * Each attempt is joined with its grade and self-rating. Every graded key fact becomes one
 * TrackedPoint keyed `questionId:pointIndex`, carrying the full history of how it has been
 * graded, so the UI can tell 보완 확인 from 다시 빠짐. Attempts graded before per-fact grading
 * existed have no points and are surfaced separately as `legacy` instead of being guessed at.
 */
export function learningSnapshot(cloudEvents: CloudEvent[] | null, dataVersion = 5): LearningSnapshot {
  const entries = new Map<string, Attempt>(), grades = new Map<string, Grade>(),
    ratings = new Map<string, Rating>(), reviewed = new Map<string, string>();
  const scoped = (cloudEvents || []).filter(event => event.type === 'attempt' ? (event.dataVersion ?? 2) === dataVersion
    : event.type === 'grade' ? (event.dataVersion ?? 2) === dataVersion
      : event.type !== 'reviewed' || (event.dataVersion ?? 2) === dataVersion);
  for (const event of scoped) {
    if (event.type === 'attempt') entries.set(event.id, event);
    else if (event.type === 'grade') grades.set(event.attemptId, event.grade);
    else if (event.type === 'rating') ratings.set(event.attemptId, event.rating);
    else if (event.type === 'reviewed') reviewed.set(`${dataVersion}:${event.questionId}:${event.pointIndex}`, event.at);
  }
  const all = [...entries.values()].map(event => ({ ...event, grade: grades.get(event.id), rating: ratings.get(event.id) }));
  const points = new Map<string, TrackedPoint>(), questions = new Map<string | number, Question & { source?: string }>(),
    tested = new Set<string>(), legacy = new Map<string | number, Attempt>();
  for (const event of all) {
    const q = event.question; questions.set(q.id, q);
    if (!event.grade?.points?.length) { if (![...points.values()].some(p => p.id === q.id)) legacy.set(q.id, event); continue }
    q.refs.forEach(id => tested.add(id)); legacy.delete(q.id);
    for (const part of event.grade.points) {
      const key = `${q.id}:${part.index}`, old = points.get(key);
      const history: PointHistoryItem[] = [...(old?.history || []), { at: event.at, status: part.status, answer: event.answer, feedback: part.feedback || '' }];
      points.set(key, {
        key, id: q.id, index: part.index, text: part.text, status: part.status, feedback: part.feedback || '',
        question: q, at: event.at, answer: event.answer, history,
        misses: history.filter(item => item.status !== 'covered').length,
        reviewed: Date.parse(reviewed.get(`${dataVersion}:${key}`) || '0') >= Date.parse(event.at),
      });
    }
  }
  const list = [...points.values()], gaps = list.filter(p => p.status !== 'covered'), covered = list.filter(p => p.status === 'covered');
  const priority: Record<string, number> = { incorrect: 0, missing: 1, partial: 2 };
  gaps.sort((a, b) => (priority[a.status] ?? 3) - (priority[b.status] ?? 3) || b.misses - a.misses || a.at.localeCompare(b.at));
  const topics = DATA.topics.map(topic => {
    const topicUnits = units.filter(u => String(u.topic) === String(topic.number));
    const topicPoints = list.filter(p => String(p.question.topic || byId.get(p.question.refs[0])?.topic) === String(topic.number));
    return {
      number: topic.number, title: topic.title, total: topicUnits.length,
      tested: topicUnits.filter(u => tested.has(u.id)).length,
      assessed: topicPoints.length,
      covered: topicPoints.filter(p => p.status === 'covered').length,
      gaps: topicPoints.filter(p => p.status !== 'covered').length,
      legacy: [...legacy.values()].filter(e => String(e.question.topic) === String(topic.number)).length,
    };
  });
  return { dataVersion, all, points: list, gaps, covered, topics, questions, legacy: [...legacy.values()], tested: tested.size, unseen: units.length - tested.size, reviewed };
}
