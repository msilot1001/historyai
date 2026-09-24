import { topics } from '../lib/data.ts';
import { buildSession, filtered, resetState, state, totalSets } from '../lib/state.ts';
import { linkProps, modePath } from '../app/router.ts';
import { useRefresh } from '../app/store.ts';
import { MODES } from '../components/StudyShell.tsx';
import { toast } from '../lib/toast.ts';
import type { StudyMode } from '../types/domain';

export function Home() {
  const refresh = useRefresh();
  const pool = filtered(), size = Number(state.count) || 10, setCount = totalSets();
  state.setIndex = Math.min(state.setIndex || 0, setCount - 1);
  const start = state.setIndex * size, end = Math.min(start + size, pool.length);
  const percent = Math.round(((state.setIndex + 1) / setCount) * 100);

  // Changing 범위 invalidates the quiz position, which is indexed against the old set.
  const applySettings = (topic: string, count: number) => {
    if (state.topic !== topic) state.indices.questions = 0;
    state.topic = topic; state.count = count; state.setIndex = 0;
    buildSession(); refresh(); toast('첫 세트로 변경했습니다');
  };
  const step = (delta: number) => {
    const next = state.setIndex + delta;
    if (next < 0 || next > setCount - 1) return;
    state.setIndex = next; buildSession(); refresh();
  };

  return (
    <>
      <section className="hero">
        <div>
          <div className="kicker">137개 원문 · 217개 학습 카드</div>
          <h1>문장을 외우고,<br />자리를 기억한다.</h1>
          <p>연표 노트의 문구는 그대로 두고, 학습 방식에 맞춰 화면만 바꿉니다.</p>
        </div>
        <section className="setup-card compact-setup" aria-label="학습 세트">
          <div className="setup-fields">
            <label className="field">범위
              <select id="topic" value={String(state.topic)} onChange={e => applySettings(e.target.value, state.count)}>
                <option value="all">전체 주제</option>
                {topics.map(t => <option key={t.number} value={t.number}>주제 {t.number} · {t.title}</option>)}
              </select>
            </label>
            <label className="field small-field">분량
              <select id="count" value={String(state.count)} onChange={e => applySettings(state.topic, Number(e.target.value))}>
                {[6, 10, 20].map(n => <option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="set-row">
            <div className="set-copy">
              <strong>{state.setIndex + 1} / {setCount} 세트</strong>
              <span>{pool.length ? `${start + 1}–${end}번째 카드 · 전체 ${pool.length}개` : '선택 범위에 카드 없음'}</span>
              <i style={{ '--set-progress': `${percent}%` } as React.CSSProperties} />
            </div>
            <div className="set-actions">
              <button className="ghost" id="prevSet" disabled={state.setIndex === 0} aria-label="이전 학습 세트" onClick={() => step(-1)}>←</button>
              <button id="nextSet" disabled={state.setIndex >= setCount - 1} onClick={() => step(1)}>다음 세트 →</button>
            </div>
          </div>
        </section>
      </section>

      <section className="mode-grid">
        <a className="mode-card mode-coach" {...linkProps('/coach')}>
          <b>AI 코칭 · 누적 학습 분석</b>
          <h2>내가 아는 것과 놓친 것</h2>
          <p>핵심 사실별 진단 · 취약 주제 · 놓친 내용 다시보기 · 보완 리캡</p>
          <span className="arrow">→</span>
        </a>
        {(Object.entries(MODES) as Array<[StudyMode, [string, string]]>).map(([id, [name, desc]], i) => (
          <a key={id} className={`mode-card${id === 'memorize' ? ' mode-zero' : ''}`} {...linkProps(modePath(id))}>
            <b>{String(i).padStart(2, '0')}</b>
            <h2>{name}</h2>
            <p>{desc}</p>
            <span className="arrow">→</span>
          </a>
        ))}
      </section>

      <div className="home-foot">
        <span>파스텔 그린 · Wanted Sans</span>
        <span>퀴즈 답안은 클라우드, 나머지 진도는 브라우저에 저장</span>
        <button className="ghost danger" id="reset" onClick={() => {
          if (confirm('학습 기록과 초안을 모두 지울까요? 원문은 지워지지 않습니다.')) { resetState(); refresh() }
        }}>로컬 학습 기록 초기화</button>
      </div>
    </>
  );
}
