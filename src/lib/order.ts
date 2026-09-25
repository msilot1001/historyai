import type { Unit } from '../types/domain';

/** Units from the first selected set through the current set, in source-note order. */
export function cumulativeOrderUnits<T extends Unit>(selected: T[], setIndex: number, count: number): T[] {
  const size = Math.max(1, count || 10);
  const lastSet = Math.min(Math.max(0, setIndex), Math.ceil(selected.length / size) - 1);
  return selected.slice(0, Math.max(0, lastSet + 1) * size);
}

export function shuffleOrder<T>(items: T[], random = Math.random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
