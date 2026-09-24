import { Home } from '../features/Home.tsx';
import { Memorize } from '../features/memorize/Memorize.tsx';
import { Recall } from '../features/recall/Recall.tsx';
import { Compare } from '../features/compare/Compare.tsx';
import { ClozeMode } from '../features/blanks/ClozeMode.tsx';
import { Timeline } from '../features/timeline/Timeline.tsx';
import { Order } from '../features/order/Order.tsx';
import { LegacyRoute } from './Legacy.tsx';
import { pathMode, usePath } from './router.ts';
import { MODES, useStudyKeys } from '../components/StudyShell.tsx';
import { buildSession, state } from '../lib/state.ts';
import { useStudyState } from './store.ts';

/** Routes already ported to React. Everything else still renders through app.js. */
export function App() {
  const path = usePath();
  const mode = pathMode(path);
  const study = mode && mode in MODES ? mode : undefined;
  useStudyState();
  // Legacy routes install their own keyboard handler; installing both would double every press.
  const ported = study && study !== 'questions';
  useStudyKeys(ported ? study : undefined);

  if (path === '/coach' || path === '/review' || path === '/coach/recap') return <LegacyRoute path={path} />;
  if (!study) return <Home />;
  if (!state.session.length) buildSession();

  switch (study) {
    case 'memorize': return <Memorize />;
    case 'recall': return <Recall />;
    case 'compare': return <Compare />;
    case 'blanks': return <ClozeMode mode="blanks" />;
    case 'stages': return <ClozeMode mode="stages" />;
    case 'timeline': return <Timeline />;
    case 'order': return <Order />;
    default: return <LegacyRoute path={path} />;
  }
}
