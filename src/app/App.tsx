import { Home } from '../features/Home.tsx';
import { Memorize } from '../features/memorize/Memorize.tsx';
import { Recall } from '../features/recall/Recall.tsx';
import { Compare } from '../features/compare/Compare.tsx';
import { ClozeMode } from '../features/blanks/ClozeMode.tsx';
import { Timeline } from '../features/timeline/Timeline.tsx';
import { Order } from '../features/order/Order.tsx';
import { Quiz } from '../features/quiz/Quiz.tsx';
import { Coach } from '../features/coach/Coach.tsx';
import { CoachRecap } from '../features/coach/CoachRecap.tsx';
import { pathMode, usePath } from './router.ts';
import { MODES, useStudyKeys } from '../components/StudyShell.tsx';
import { buildSession, state } from '../lib/state.ts';
import { useStudyState } from './store.ts';

/** Every public route. `vercel.json` rewrites all of them to `/`. */
export function App() {
  const path = usePath();
  const mode = pathMode(path);
  const study = mode && mode in MODES ? mode : undefined;
  useStudyState();
  useStudyKeys(study);

  if (path === '/coach/recap') return <CoachRecap />;
  // /review is the original path for this screen and stays supported.
  if (path === '/coach' || path === '/review') return <Coach />;
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
    case 'questions': return <Quiz />;
  }
}
