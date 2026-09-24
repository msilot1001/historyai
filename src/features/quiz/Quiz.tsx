import { useMemo } from 'react';
import { byId, questionBank } from '../../lib/data.ts';
import { questionPool } from '../../lib/questions.ts';
import { buildSession, filtered, modeIndex, save, state } from '../../lib/state.ts';
import { Navigation, StudyShell } from '../../components/StudyShell.tsx';
import { QuizCard } from './QuizCard.tsx';
import { useStudyState } from '../../app/store.ts';

export function Quiz() {
  const version = useStudyState();
  // The pool is derived from the session and 범위; rebuilding it on every keystroke would be wasteful.
  const pool = useMemo(() => questionPool({ questionBank, byId, state, filtered, buildSession }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, state.topic, state.count, state.setIndex]);

  if (modeIndex('questions') > pool.length - 1) { state.indices.questions = Math.max(0, pool.length - 1); save() }
  const index = modeIndex('questions');
  const q = pool[index];
  if (!q) return null;
  // Recap questions are numbered within their own group, after the current-set questions.
  const number = q.scope === 'current' ? index + 1 : index - pool[0].groupCount + 1;

  return (
    <StudyShell mode="questions" total={pool.length}>
      <QuizCard
        // a fresh card per question: submit/grade/rating state must not leak across questions
        key={`${q.scope}:${q.id}`}
        question={q} number={number} total={q.groupCount}
        onRated={() => document.querySelector<HTMLButtonElement>('[data-next]')?.click()}
      >
        <Navigation
          mode="questions" total={pool.length}
          afterMove={() => requestAnimationFrame(() => document.getElementById('answer')?.focus())}
        />
      </QuizCard>
    </StudyShell>
  );
}
