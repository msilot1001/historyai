import { currentUnit, state } from '../../lib/state.ts';
import { Navigation, StudyShell } from '../../components/StudyShell.tsx';
import { PaperSurface, usePaperScale } from '../../components/Paper.tsx';

export function Memorize() {
  const u = currentUnit('memorize');
  usePaperScale();
  return (
    <StudyShell mode="memorize" total={state.session.length}>
      <div className="memorize-wrap">
        <PaperSurface unit={u} />
        <section className="surface memorize-note">
          <div className="kicker">0번 · 먼저 눈으로 외우기</div>
          <h2>{u.title}</h2>
          <p>연도, 제목, 화살표의 위치와 문장을 그대로 읽으세요. 준비되면 다음 카드로 넘어가고, 한 바퀴 본 뒤 다른 활동을 시작하면 됩니다.</p>
          <p className="key-help">키보드: ←/→ 또는 Enter로 넘기기</p>
          <Navigation mode="memorize" total={state.session.length} />
        </section>
      </div>
    </StudyShell>
  );
}
