import { useEffect, useRef } from 'react';
import { mountLegacy, unmountLegacy } from '../../app.js';
import { navigate } from './router.ts';

/**
 * ponytail: migration scaffolding. Routes that have not been ported yet still render
 * through app.js, into a container React owns but does not reconcile. Deleted with app.js
 * once every feature has moved.
 */
export function LegacyRoute({ path }: { path: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (el) mountLegacy(el, navigate);
    return () => unmountLegacy();
  }, [path]);
  return <div ref={host} className="legacy-host" />;
}
