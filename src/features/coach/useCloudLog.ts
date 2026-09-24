import { useEffect, useState } from 'react';
import { events, loadCloud } from '../../lib/cloud.ts';
import { refresh } from '../../app/store.ts';

type LogState = { phase: 'ready' | 'loading' | 'error'; message?: string };

/**
 * The cloud study log is fetched once per session and then appended to locally.
 * Coach and 보완 리캡 both need it, so the fetch and its retry live here.
 */
export function useCloudLog(enabled: boolean): LogState & { retry: () => void } {
  const [status, setStatus] = useState<LogState>(() => (events() ? { phase: 'ready' } : { phase: 'loading' }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || events()) return;
    let live = true;
    setStatus({ phase: 'loading' });
    loadCloud()
      .then(() => { if (live) { setStatus({ phase: 'ready' }); refresh() } })
      .catch((error: Error) => { if (live) setStatus({ phase: 'error', message: error.message }) });
    return () => { live = false };
  }, [enabled, attempt]);

  return { ...status, retry: () => setAttempt(n => n + 1) };
}
