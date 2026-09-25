import type { CloudEvent, Question } from '../types/domain';

export type QuestionStatus = '미학습' | '미채점' | '완료' | '보완 필요';

/** Use the latest current-version attempt and its graded required facts; self-ratings do not count. */
export function questionProgress(questions: Question[], events: CloudEvent[], dataVersion = 6) {
  const attempts = new Map<string | number, Extract<CloudEvent, { type: 'attempt' }>>();
  const grades = new Map<string, Extract<CloudEvent, { type: 'grade' }>['grade']>();
  for (const event of events) {
    if (event.type === 'attempt' && (event.dataVersion ?? 2) === dataVersion) attempts.set(event.question.id, event);
    else if (event.type === 'grade' && (event.dataVersion ?? 2) === dataVersion) grades.set(event.attemptId, event.grade);
  }
  return new Map(questions.map(question => {
    const attempt = attempts.get(question.id);
    if (!attempt) return [question.id, '미학습' as const];
    const grade = grades.get(attempt.id);
    if (!grade) return [question.id, '미채점' as const];
    const facts = question.facts || [];
    const covered = facts.length > 0 && facts.every((_, index) => grade.points?.some(point => point.index === index && point.status === 'covered'));
    return [question.id, covered ? '완료' as const : '보완 필요' as const];
  }));
}
