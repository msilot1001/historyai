import { useMemo, useState } from 'react';
import { byId, topics, units } from '../../lib/data.ts';
import { accessCode, cloud, events, loadCloud, record } from '../../lib/cloud.ts';
import { learningSnapshot } from '../../lib/snapshot.ts';
import { save, state } from '../../lib/state.ts';
import { toast } from '../../lib/toast.ts';
import { linkProps, navigate } from '../../app/router.ts';
import { refresh, useStudyState } from '../../app/store.ts';
import { AccessPanel } from '../../components/AccessPanel.tsx';
import { usePaperScale } from '../../components/Paper.tsx';
import { PointCard } from './PointCard.tsx';
import { useCloudLog } from './useCloudLog.ts';

type Tab = 'gaps' | 'covered' | 'legacy' | 'pending';

export function Coach() {
  const version = useStudyState();
  const [hasCode, setHasCode] = useState(Boolean(accessCode()));
  const log = useCloudLog(hasCode);
  const [tab, setTab] = useState<Tab>('gaps');
  const [dataVersion, setDataVersion] = useState(state.questionVersion);
  const [topic, setTopic] = useState('all');
  usePaperScale();

  const summary = useMemo(() => learningSnapshot(events(), dataVersion), [version, log.phase, dataVersion]);

  if (!hasCode) return (
    <section className="surface review-loading">
      <a className="crumb" {...linkProps('/')}>← 학습 홈</a>
      <h1>AI 코칭</h1>
      <p>핵심 사실별 학습 기록을 보려면 접속 코드를 입력하세요.</p>
      <AccessPanel onReady={() => setHasCode(true)} />
    </section>
  );
  if (log.phase !== 'ready') return (
    <section className="surface review-loading">
      <h1>AI 코칭 준비 중</h1>
      <p>클라우드 학습 기록을 불러옵니다.</p>
      <p id="loadStatus" role="status">
        {log.phase === 'error' && <>{log.message} <button id="retryCloud" onClick={log.retry}>다시 연결</button></>}
      </p>
    </section>
  );

  const topicOf = (q: { topic?: number; refs: string[] }) => String(q.topic || byId.get(q.refs[0])?.topic);
  const shown = (tab === 'gaps' ? summary.gaps : tab === 'covered' ? summary.covered : [])
    .filter(p => topic === 'all' || topicOf(p.question) === topic);
  const legacy = summary.legacy.filter(e => topic === 'all' || String(e.question.topic) === topic);
  const pending = summary.all.filter(e => !e.grade).filter(e => topic === 'all' || String(e.question.topic) === topic);
  // Worst topics first, then by share of that topic's assessed facts still missing.
  const top = summary.topics.filter(t => t.gaps).sort((a, b) => b.gaps - a.gaps || b.gaps / b.assessed - a.gaps / a.assessed).slice(0, 3);
  const score = summary.points.length ? Math.round(summary.covered.length / summary.points.length * 100) : 0;

  const markRead = async (key: string) => {
    const [questionId, pointIndex] = key.split(/:(?=\d+$)/);
    try {
      const result = await cloud('POST', { type: 'reviewed', questionId, pointIndex: Number(pointIndex), dataVersion });
      record(result.event!);
      refresh();
    } catch (error) { toast((error as Error).message) }
  };

  const regrade = async (attemptId: string) => {
    try {
      const result = await cloud('POST', { type: 'grade', attemptId });
      if (result.gradeEvent) record(result.gradeEvent);
      if (result.aiError || !result.grade) throw new Error(result.aiError || 'AI 재채점에 실패했습니다.');
      refresh(); toast('저장된 답안을 다시 채점했습니다');
    } catch (error) { toast((error as Error).message) }
  };

  return (
    <>
      <header className="study-head coach-head">
        <div>
          <a className="crumb" {...linkProps('/')}>← 학습 홈</a>
          <h1>AI 코칭</h1>
          <div className="status">어떤 사실을 알고, 무엇을 반복해서 빠뜨리는지 답안 이력으로 분석합니다.</div>
        </div>
        <div className="review-tools">
          <button className="ghost" id="refreshLog" onClick={async () => {
            try { await loadCloud(); refresh(); toast('기록을 새로 읽었습니다') } catch (error) { toast((error as Error).message) }
          }}>새로고침</button>
          <button className="ghost" id="exportLog" onClick={() => {
            const blob = new Blob([JSON.stringify(events(), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'history-quiz-records.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>기록 내보내기</button>
        </div>
      </header>

      <section className="coach-summary">
        <div className="coach-lead">
          <span>현재 확인된 핵심 사실</span>
          <strong>{summary.covered.length}<small> / {summary.points.length}</small></strong>
          <i style={{ '--score': `${score}%` } as React.CSSProperties} />
          <p>AI로 평가한 사실만 분모에 포함합니다. 읽기·자가평가는 정답 확인으로 세지 않습니다.</p>
        </div>
        <div><b>{summary.gaps.length}</b><span>아직 보완할 사실</span></div>
        <div><b>{summary.tested}<small> / {units.length}</small></b><span>AI 평가와 연결된 학습 카드</span></div>
        <div><b>{summary.unseen}</b><span>아직 평가되지 않은 카드</span></div>
      </section>

      <section className="surface coach-topics">
        <div className="section-title">
          <div><span className="kicker">TOPIC MAP</span><h2>주제별 이해 상태</h2></div>
          <p>분모는 평가된 핵심 사실. 학습 범위 전체의 숙달률은 아닙니다.</p>
        </div>
        {top.length > 0 && (
          <p className="coach-focus">우선 보완: {top.map(t => `주제 ${t.number} ${t.title} (${t.gaps}개 누락)`).join(' · ')}</p>
        )}
        <div className="topic-matrix">
          {summary.topics.map(t => (
            <button
              key={t.number} className={`topic-cell${topic === String(t.number) ? ' active' : ''}`} data-topic={t.number}
              onClick={() => setTopic(topic === String(t.number) ? 'all' : String(t.number))}
            >
              <span>주제 {t.number}</span>
              <strong>{t.title}</strong>
              <i style={{ '--score': `${t.assessed ? Math.round(t.covered / t.assessed * 100) : 0}%` } as React.CSSProperties} />
              <small>확인 {t.covered} · 보완 {t.gaps} · 미평가 카드 {t.total - t.tested}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="coach-section">
        <div className="section-title">
          <div><span className="kicker">FACT TRACKER</span><h2>사실별 학습 기록</h2></div>
          <button id="startRecap" disabled={!summary.gaps.length} onClick={() => {
            const ids = [...new Set(summary.gaps.map(p => p.id))].slice(0, 10);
            state.coachRound = ids; state.coachIndex = 0;
            ids.forEach(id => delete state.drafts[`review:${id}`]);
            save(); navigate('/coach/recap');
          }}>보완 리캡 시작 →</button>
        </div>
        <label className="field">분석할 질문 버전
          <select value={dataVersion} onChange={e => { setDataVersion(Number(e.target.value)); setTopic('all'); setTab('gaps') }}>
            <option value={4}>현재 질문 · v4</option><option value={3}>이전 질문 · v3</option><option value={2}>이전 기록 · v2</option>
          </select>
        </label>
        <div className="coach-controls">
          <div className="coach-tabs" role="tablist" aria-label="학습 분석 보기">
            <button data-tab="gaps" aria-selected={tab === 'gaps'} onClick={() => setTab('gaps')}>놓친 사실 {summary.gaps.length}</button>
            <button data-tab="covered" aria-selected={tab === 'covered'} onClick={() => setTab('covered')}>알고 있는 사실 {summary.covered.length}</button>
            <button data-tab="legacy" aria-selected={tab === 'legacy'} onClick={() => setTab('legacy')}>이전 기록 {summary.legacy.length}</button>
            <button data-tab="pending" aria-selected={tab === 'pending'} onClick={() => setTab('pending')}>미채점 답안 {pending.length}</button>
          </div>
          <label className="field">주제 필터
            <select id="coachTopic" value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="all">전체 주제</option>
              {topics.map(t => <option key={t.number} value={t.number}>주제 {t.number} · {t.title}</option>)}
            </select>
          </label>
        </div>
        <div className="coach-list">
          {tab === 'pending'
            ? pending.map(e => <article className="coach-point" key={e.id}><span className="point-pill">저장됨 · 미채점</span><h3>{e.question.q}</h3><p>답안은 기존 기록에 저장되어 있습니다. 재채점해도 답안은 추가 저장되지 않습니다.</p><small>{e.question.source}</small><button className="secondary" onClick={() => regrade(e.id)}>저장된 답안 재채점</button></article>)
            : tab === 'legacy'
            ? legacy.map(e => (
              <article className="coach-point" key={e.id}>
                <span className="point-pill">세부 재확인 필요</span>
                <h3>{e.question.q}</h3>
                <p>예전 채점은 사실별로 저장되지 않았습니다. 추측해서 분석하지 않고, 새 답안으로 다시 확인합니다.</p>
                <small>{e.question.source}</small>
              </article>
            ))
            : shown.length
              ? shown.map(p => <PointCard point={p} key={p.key} onRead={markRead} />)
              : <p className="coach-empty">이 범위에는 아직 표시할 사실이 없습니다. 퀴즈를 풀면 여기에 쌓입니다.</p>}
        </div>
      </section>
    </>
  );
}
