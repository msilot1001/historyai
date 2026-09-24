import { createRoot } from 'react-dom/client';
import '../styles.css';
import { App } from './app/App.tsx';

createRoot(document.getElementById('app')!).render(<App />);
