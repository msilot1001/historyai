import { useSyncExternalStore } from 'react';
import type { StudyMode } from '../types/domain';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn) };
}

addEventListener('popstate', emit);

/** Push a new path. Same signature and side effects as the legacy `go()`. */
export function navigate(path: string) {
  history.pushState({}, '', path);
  emit();
  scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname, () => location.pathname);
}

/** `/study/quiz` is the public URL; `questions` is the internal mode id. */
export function pathMode(pathname = location.pathname): StudyMode | undefined {
  const mode = pathname.match(/^\/study\/([^/]+)/)?.[1];
  return (mode === 'quiz' ? 'questions' : mode) as StudyMode | undefined;
}

export function modePath(mode: StudyMode): string {
  return `/study/${mode === 'questions' ? 'quiz' : mode}`;
}

/** Intercepts in-app anchor clicks so they route instead of reloading. */
export function linkProps(href: string) {
  return {
    href,
    onClick(e: React.MouseEvent) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(href);
    },
  };
}
