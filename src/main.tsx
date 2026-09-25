import { createRoot } from 'react-dom/client';
import '../styles.css';
import { App } from './app/App.tsx';
import { applyDataBundle } from './lib/data.ts';
import { state, save } from './lib/state.ts';

const root = createRoot(document.getElementById('app')!);
fetch('/api/study?dataset=active').then(async response => response.ok ? response.json() :
  fetch('/data-sets/v4.json').then(fallback => fallback.json())).catch(() =>
  fetch('/data-sets/v4.json').then(fallback => fallback.json())).then(bundle => {
  const version = applyDataBundle(bundle);
  if (state.questionVersion !== version) { state.questionVersion = version; state.indices.questions = 0; save() }
}).finally(() => root.render(<App />));
