import { byId } from '../../lib/data.ts';
import { Paper } from '../../components/Paper.tsx';
import { STATUS_LABEL } from '../quiz/QuizCard.tsx';
import type { TrackedPoint } from '../../types/domain';

/**
 * One key fact with its whole grading history, so the label can distinguish a fact that was
 * recovered (보완 확인) from one that had been known and was missed again (다시 빠짐).
 */
export function PointCard({ point, onRead }: { point: TrackedPoint; onRead: (key: string) => void }) {
  const improved = point.status === 'covered' && point.history.some(item => item.status !== 'covered');
  const regressed = point.status !== 'covered' && point.history.some(item => item.status === 'covered');
  const place = point.question.refs.map(id => byId.get(id)).filter(Boolean);

  return (
    <article className={`coach-point ${point.status}`}>
      <div className="coach-point-head">
        <span className={`point-pill ${point.status}`}>
          {improved ? '보완 확인' : regressed ? '다시 빠짐' : STATUS_LABEL[point.status]}
        </span>
        <small>{point.question.source || place.map(u => `주제 ${u!.topic} · ${u!.title}`).join(' / ')}</small>
      </div>
      <h3>{point.text}</h3>
      <p>{point.feedback || '다음 답안에서 이 사실을 다시 확인해 보세요.'}</p>
      <div className="point-meta">
        <span>제출 {point.history.length}회 · 누락 {point.misses}회</span>
        <span>{point.status === 'covered'
          ? (improved ? '다시 답해 보완 확인' : '답안으로 확인')
          : point.reviewed ? '원문 읽음 · 답안으로 재확인 필요' : '원문 미확인'}</span>
      </div>
      <details>
        <summary>이전 답안과 원문 보기</summary>
        <div className="coach-evidence">
          <strong>질문</strong><p>{point.question.q}</p>
          <strong>최근 답안</strong><p>{point.answer || '(빈 답안)'}</p>
          <strong>핵심 답안</strong><p>{point.question.a}</p>
          {place.map(u => <Paper unit={u!} key={u!.id} />)}
        </div>
      </details>
      {point.status !== 'covered' && (
        <button className="ghost point-read" data-read={point.key} disabled={point.reviewed} onClick={() => onRead(point.key)}>
          {point.reviewed ? '읽음 기록됨' : '놓친 사실 읽었어요'}
        </button>
      )}
    </article>
  );
}
