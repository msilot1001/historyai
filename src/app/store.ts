import { useCallback, useReducer } from 'react';

/**
 * The study state is a plain mutable module (src/lib/state.ts), not React state, so that
 * per-keystroke draft writes never re-render — which is what keeps Korean IME composition
 * intact in the cloze inputs and textareas. Components call `refresh()` when they have
 * changed something the UI must reflect.
 */
export function useRefresh(): () => void {
  const [, force] = useReducer((n: number) => n + 1, 0);
  return useCallback(() => force(), []);
}
