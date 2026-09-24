import { useEffect, useMemo } from 'react';
import { events } from '../../lib/cloud.ts';
import { learningSnapshot } from '../../lib/snapshot.ts';
import { save, state } from '../../lib/state.ts';
import { toast } from '../../lib/toast.ts';
import { linkProps, navigate } from '../../app/router.ts';
import { refresh, useStudyState } from '../../app/store.ts';
import { QuizCard } from '../quiz/QuizCard.tsx';
import { useCloudLog } from './useCloudLog.ts';
import { accessCode } from '../../lib/cloud.ts';

/** Re-answers the questions behind the facts that are still missing, one at a time. */
export function CoachRecap() {
  const version = useStudyState();
  const log = useCloudLog(Boolean(accessCode()));
  const ready = log.phase === 'ready' && Boolean(events());
  const summary = useMemo(() => learningSnapshot(events()), [version, log.phase]);

  const ids = state.coachRound || [];
  const index = state.coachIndex || 0;
  const done = ready && (index >= ids.length || !ids.length);
  const question = ready && !done ? summary.questions.get(ids[index]) : undefined;

  useEffect(() => {
    if (!ready) return;
    if (done) {
      state.coachRound = []; state.coachIndex = 0; save();
      navigate('/coach');
      toast('보완 리캡을 마쳤습니다. 사실별 상태를 확인해 보세요.');
      return;
    }
    // A question that is no longer in the log (an older round) is skipped rather than shown empty.
    if (!question) { state.coachIndex++; save(); refresh() }
  }, [ready, done, question]);

  useEffect(() => { if (question) requestAnimationFrame(() => document.getElementById('answer')?.focus()) }, [question]);

  if (!ready) return (
    <section className="surface review-loading">
      <h1>AI 코칭 준비 중</h1>
      <p>클라우드 학습 기록을 불러옵니다.</p>
      <p id="loadStatus" role="status">
        {log.phase === 'error' && <>{log.message} <button id="retryCloud" onClick={log.retry}>다시 연결</button></>}
      </p>
    </section>
  );
  if (!question) return null;

  return (
    <>
      <header className="study-head">
        <div>
          <a className="crumb" {...linkProps('/coach')}>← AI 코칭</a>
          <h1>보완 리캡</h1>
          <div className="status">앞서 놓친 사실을 전체 질문에 답하며 다시 확인합니다.</div>
        </div>
        <div className="progress">{index + 1} / {ids.length}<i style={{ '--p': `${Math.round((index + 1) / ids.length * 100)}%` } as React.CSSProperties} /></div>
      </header>
      <QuizCard
        key={`recap:${question.id}`}
        question={{ ...question, scope: 'coach', source: question.source || '', groupCount: ids.length }}
        number={index + 1} total={ids.length} reviewing
        onRated={() => { state.coachIndex++; save(); refresh() }}
      />
    </>
  );
}
