import { useEffect, useState, type ReactNode } from 'react';
import type { StudyMode } from '../types/domain';
import { modeIndex, save, setStatusHandler, state } from '../lib/state.ts';
import { navigate, linkProps } from '../app/router.ts';
import { useRefresh } from '../app/store.ts';

export const MODES: Record<StudyMode, [string, string]> = {
  memorize: ['먼저 외우기', '정답을 그대로 넘겨 보며 머릿속에 먼저 담기'],
  recall: ['읽고 가리기', '원문의 자리와 문장을 통째로 복원'],
  blanks: ['랜덤 빈칸', '원문 안의 빈칸에 바로 입력'],
  stages: ['단계별 가리기', '같은 자리에서 가림 범위를 점차 확대'],
  questions: ['퀴즈', '현재 세트 확인 후 이전 세트 누적 리캡'],
  timeline: ['연도 양방향', '사건과 연도 카드를 알맞은 자리에 배치'],
  order: ['순서 회상', '섞인 카드를 원본 노트 순서로 정렬'],
  compare: ['비교 암기', '관련된 두 원문을 나란히 대조'],
};

function StatusLine() {
  const [message, setMessage] = useState('브라우저에 자동 저장');
  useEffect(() => { setStatusHandler(setMessage); return () => setStatusHandler(() => {}) }, []);
  return <div className="status">{message}</div>;
}

export function StudyShell({ mode, total, children }: { mode: StudyMode; total: number; children: ReactNode }) {
  const index = modeIndex(mode);
  const percent = Math.round(((index + 1) / total) * 100);
  return (
    <>
      <header className="study-head">
        <div>
          <a className="crumb" {...linkProps('/')}>← 학습 홈</a>
          <h1>{MODES[mode][0]}</h1>
          <StatusLine />
        </div>
        <div className="progress">{index + 1} / {total}<i style={{ '--p': `${percent}%` } as React.CSSProperties} /></div>
      </header>
      {children}
    </>
  );
}

/**
 * Prev/next for every card mode. Keeps the `data-prev` / `data-next` hooks because the
 * Alt+←/→ shortcut and the memorize arrow keys click them.
 */
export function Navigation({ mode, total, beforeMove, afterMove }: {
  mode: StudyMode; total: number; beforeMove?: () => void; afterMove?: () => void;
}) {
  const refresh = useRefresh();
  const index = modeIndex(mode);
  const move = (to: number) => {
    beforeMove?.();
    if (to < 0) return;
    if (to > total - 1) { navigate('/'); return }
    state.indices[mode] = to;
    save();
    refresh();
    afterMove?.();
  };
  return (
    <div className="nav">
      <button className="ghost" data-prev disabled={index === 0} onClick={() => move(index - 1)}>← 이전</button>
      <button className="secondary" data-next onClick={() => move(index + 1)}>
        {index === total - 1 ? '학습 마치기' : '다음 →'}
      </button>
    </div>
  );
}

/** Alt+←/→ on every card mode; bare ←/→/Enter in 먼저 외우기 when nothing else has focus. */
export function useStudyKeys(mode?: StudyMode) {
  useEffect(() => {
    if (!mode) return;
    const click = (sel: string) => document.querySelector<HTMLButtonElement>(sel)?.click();
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.altKey && e.key === 'ArrowLeft') { click('[data-prev]'); e.preventDefault() }
      else if (e.altKey && e.key === 'ArrowRight') { click('[data-next]'); e.preventDefault() }
      else if (mode === 'memorize' && e.target === document.body && (e.key === 'Enter' || e.key === 'ArrowRight')) { click('[data-next]'); e.preventDefault() }
      else if (mode === 'memorize' && e.target === document.body && e.key === 'ArrowLeft') { click('[data-prev]'); e.preventDefault() }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode]);
}
