import { useEffect, useState } from 'react';
import type { LeechInstance } from '../../domain/types';
import { systemRunClock } from './runClock';
import type { RunClock } from './runClock';

export function useLiveNow(runs: LeechInstance[], clock: RunClock = systemRunClock) {
  const [now, setNow] = useState(() => clock.nowMs());
  const hasRunningTimer = runs.some(
    (run) => run.billing.type === 'hourly' && run.billing.ledger.status === 'running',
  );

  useEffect(() => {
    if (!hasRunningTimer) return;
    const id = window.setInterval(() => setNow(clock.nowMs()), 1000);
    return () => window.clearInterval(id);
  }, [clock, hasRunningTimer]);

  return now;
}
