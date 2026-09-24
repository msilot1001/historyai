import { Home } from '../features/Home.tsx';
import { LegacyRoute } from './Legacy.tsx';
import { pathMode, usePath } from './router.ts';
import { MODES } from '../components/StudyShell.tsx';

/** Routes already ported to React. Everything else still renders through app.js. */
export function App() {
  const path = usePath();
  const mode = pathMode(path);
  if (path === '/coach' || path === '/review' || path === '/coach/recap') return <LegacyRoute path={path} />;
  if (!mode || !(mode in MODES)) return <Home />;
  return <LegacyRoute path={path} />;
}
