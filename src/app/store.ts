import { useSyncExternalStore } from 'react';

/**
 * The study state is a plain mutable module (src/lib/state.ts), not React state, so that
 * per-keystroke draft writes never re-render — which is what keeps Korean IME composition
 * intact in the cloze inputs and textareas.
 *
 * Components that read study state call `useStudyState()` and any mutation is followed by
 * `refresh()`, which re-renders every subscriber rather than only the component that
 * triggered it: card position lives in the state module, so the whole route must update.
 */
const listeners = new Set<() => void>();
let version = 0;

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn) };
}

export function refresh() {
  version++;
  listeners.forEach(fn => fn());
}

export function useStudyState(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

/** Convenience for components that only need to trigger a refresh. */
export function useRefresh(): () => void {
  useStudyState();
  return refresh;
}
