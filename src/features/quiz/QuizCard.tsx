import { useEffect, useRef, useState } from 'react';
import type { Grade, PointStatus, PoolQuestion, Rating } from '../../types/domain';
import { byId } from '../../lib/data.ts';
import { accessCode, cloud, record } from '../../lib/cloud.ts';
import { save, state } from '../../lib/state.ts';
import { AccessPanel } from '../../components/AccessPanel.tsx';
import { Paper, usePaperScale } from '../../components/Paper.tsx';

export const STATUS_LABEL: Record<PointStatus, string> = {
  covered: '알고 있음', partial: '일부만 설명', missing: '빠뜨림', incorrect: '잘못 이해함',
};
const LEVEL_LABEL: Record<string, string> = {
  strong: '핵심 사실 확인', partial: '보완할 사실 있음', weak: '다시 살펴볼 사실 많음',
};

function GradeResult({ grade, answerKey }: { grade?: Grade; answerKey: string }) {
  const label = grade ? LEVEL_LABEL[grade.level] : undefined;
  return (
    <>
      {label && <div className={`ai-grade ${grade!.level}`}><b>AI 분석 · {label}</b><span>{grade!.reason}</span></div>}
      {grade?.writingNote && <p className="ai-writing-note"><b>표현·사실 보완</b> {grade.writingNote}</p>}
      {grade?.points?.length ? (
        <div className="point-results">
          <h3>핵심 사실별 진단 <small>{grade.points.filter(p => p.status === 'covered').length} / {grade.points.length}개 확인</small></h3>
          {grade.points.map(p => (
            <div className={`point-result ${p.status}`} key={p.index}>
              <b>{STATUS_LABEL[p.status]}</b><strong>{p.text}</strong><span>{p.feedback}</span>
            </div>
          ))}
        </div>
      ) : grade?.missing?.length ? <p>빠진 핵심: {grade.missing.join(' · ')}</p> : null}
      <details className="answer-detail"><summary>핵심 답안 전체 보기</summary><p>{answerKey}</p></details>
      <small>AI 평가는 참고용입니다. 자기평가는 핵심 사실 판정을 덮어쓰지 않습니다.</small>
    </>
  );
}

export interface QuizCardProps {
  question: PoolQuestion;
  number: number;
  total: number;
  /** 보완 리캡 cards hide the study navigation and store drafts under their own prefix. */
  reviewing?: boolean;
  onRated: (rating: Rating) => void;
  children?: React.ReactNode;
}

/**
 * One quiz question end to end: draft, submit to the cloud, show the AI's per-fact
 * diagnosis, then record the self-rating. The answer is persisted locally as it is typed
 * so a failed submit never loses it.
 */
export function QuizCard({ question: q, number, total, reviewing = false, onRated, children }: QuizCardProps) {
  const key = `${reviewing ? 'review' : 'questions'}:${q.id}`;
  const answer = useRef<HTMLTextAreaElement>(null);
  const [needCode, setNeedCode] = useState(!accessCode());
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'grading' | 'done' | 'failed'>('idle');
  const [status, setStatus] = useState('답안을 제출하면 클라우드에 기록되고 AI가 핵심 사실별로 살펴봅니다.');
  const [grade, setGrade] = useState<Grade | undefined>();
  const [showResult, setShowResult] = useState(false);
  const [rating, setRating] = useState(false);
  const attemptId = useRef<string | null>(null);
  const known = useRef<HTMLButtonElement>(null);
  const evidence = useRef<HTMLDetailsElement>(null);
  usePaperScale();
  useEffect(() => { if (showResult) known.current?.focus() }, [showResult]);

  const gradeSavedAttempt = async () => {
    if (!attemptId.current) return;
    setBusy(true); setPhase('grading'); setStatus('저장 완료 · AI 채점 중');
    try {
      const result = await cloud('POST', { type: 'grade', attemptId: attemptId.current });
      if (result.gradeEvent) record(result.gradeEvent);
      if (result.aiError || !result.grade) throw new Error(result.aiError || 'AI 채점에 실패했습니다. 같은 답안으로 다시 시도할 수 있습니다.');
      setGrade(result.grade); setPhase('done'); setStatus('저장 완료 · AI 채점 완료'); setShowResult(true);
    } catch (error) {
      setPhase('failed'); setStatus((error as Error).message); setShowResult(true);
    } finally { setBusy(false) }
  };

  const submit = async () => {
    if (busy) return;
    if (!accessCode()) { setNeedCode(true); requestAnimationFrame(() => document.getElementById('accessCode')?.focus()); return }
    setBusy(true);
    setPhase('saving');
    setStatus('답안을 클라우드에 저장하고 있습니다…');
    try {
      const question = { ...q, id: String(q.id), topic: q.topic ?? byId.get(q.refs[0])?.topic };
      const id = attemptId.current || (attemptId.current = crypto.randomUUID());
      const result = await cloud('POST', { type: 'attempt', id, dataVersion: state.questionVersion, question, answer: answer.current?.value ?? '' });
      attemptId.current = (result.event as { id: string }).id;
      record(result.event!);
      setPhase('grading'); setShowResult(true);
      await gradeSavedAttempt();
    } catch (error) {
      setPhase('failed');
      setStatus((error as Error).message);
      setBusy(false);
      if (!accessCode()) { setNeedCode(true); requestAnimationFrame(() => document.getElementById('accessCode')?.focus()) }
      else document.getElementById('check')?.focus();
    }
  };

  const rate = async (value: Rating) => {
    if (!attemptId.current) return;
    setRating(true);
    try {
      const result = await cloud('POST', { type: 'rating', attemptId: attemptId.current, rating: value });
      record(result.event!);
      state.progress[key] = value;
      save();
      onRated(value);
    } catch (error) { setStatus((error as Error).message); setRating(false) }
  };

  return (
    <div className="question-wrap surface question-card">
      <div className={`quiz-context ${q.scope || 'review'}`}>
        <span>{reviewing ? 'AI 코칭 · 보완 리캡' : q.scope === 'current' ? '현재 세트 퀴즈' : '이전 세트 누적 리캡'}</span>
        <strong>{number} / {total}</strong>
      </div>
      <div className="quiz-source">{q.source}</div>
      <div className="kicker">{q.kind || '내용 확인'}</div>
      <h2>{q.q}</h2>
      <label className="field">내 설명
        <textarea
          key={key} id="answer" ref={answer} spellCheck={false} maxLength={2000}
          placeholder="핵심 내용을 내 말로 설명해 보세요"
          defaultValue={state.drafts[key] || ''}
          onInput={e => { state.drafts[key] = e.currentTarget.value; save() }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
        />
      </label>
      <div className="actions">
        <button id="check" disabled={busy || showResult} onClick={submit}>{phase === 'saving' ? '저장 중…' : phase === 'grading' ? 'AI 채점 중…' : '답안 저장 · 분석'}</button>
        <button className="ghost" id="hint" onClick={() => { if (evidence.current) evidence.current.open = true }}>원문 근거 보기</button>
      </div>
      <div id="quizAccess" hidden={!needCode}>
        <AccessPanel onReady={() => { setNeedCode(false); submit() }} />
      </div>
      {busy && <div className={`quiz-progress ${phase}`} aria-hidden="true"><i /></div>}
      <p id="cloudStatus" className="cloud-status" role="status">{status}</p>
      {phase === 'failed' && attemptId.current && <button className="secondary" id="retryGrade" disabled={busy} onClick={gradeSavedAttempt}>같은 답안으로 AI 재채점</button>}
      <div id="result" className="result" role="status" hidden={!showResult}>
        {showResult && <GradeResult grade={grade} answerKey={q.a} />}
      </div>
      <div id="selfcheck" className="actions" hidden={!showResult}>
        <button id="known" ref={known} disabled={rating || phase !== 'done'} onClick={() => rate('known')}>확인했어요 →</button>
        <button id="review" className="secondary" disabled={rating || phase !== 'done'} onClick={() => rate('review')}>다시 볼게요 →</button>
      </div>
      <details className="evidence" id="evidence" ref={evidence}>
        <summary>원문 근거</summary>
        {q.refs.map(id => byId.get(id)).filter(Boolean).map(u => <Paper unit={u!} key={u!.id} />)}
      </details>
      {children}
    </div>
  );
}
