import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../app/confirmation';
import { DEFAULT_RATIO_BILLING } from '../../domain/billing';
import { createId } from '../../domain/id';
import { createInstanceWithBillingSettings } from '../../domain/instances';
import type { LeechInstance } from '../../domain/types';
import { useInstancesStorage } from '../../hooks/useInstancesStorage';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { RunUpdater, UpdateRun } from './runCommands';
import { isoTimestamp, systemRunClock } from './runClock';
import type { RunClock } from './runClock';
import { createEmptyRun, createInitialRuns, isEmptyRun, sortRunsByCreatedAt } from './runFactory';
import { getRunDisplayName } from './runPresentation';

const SELECTED_RUN_STORAGE_KEY = 'legends-leech-calculator.selected-run.v1';

export function useRunWorkspace(clock: RunClock = systemRunClock) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const initialRuns = useMemo(() => createInitialRuns(isoTimestamp(clock.nowMs())), [clock]);
  const [runs, setRuns] = useInstancesStorage(initialRuns);
  const [selectedRunId, setSelectedRunId] = useLocalStorage<string | null>(
    SELECTED_RUN_STORAGE_KEY,
    null,
    (value) => (typeof value === 'string' ? value : null),
  );
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const displayedRuns = useMemo(() => sortRunsByCreatedAt(runs), [runs]);
  const selectedRun = useMemo(
    () => displayedRuns.find((run) => run.id === selectedRunId) ?? displayedRuns[0],
    [displayedRuns, selectedRunId],
  );

  useEffect(() => {
    if (runs.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (selectedRunId && runs.some((run) => run.id === selectedRunId)) return;
    setSelectedRunId(displayedRuns[0].id);
  }, [displayedRuns, runs, selectedRunId, setSelectedRunId]);

  useEffect(() => {
    if (!highlightedRunId) return;
    const id = window.setTimeout(() => setHighlightedRunId(null), 2400);
    return () => window.clearTimeout(id);
  }, [highlightedRunId]);

  const updateRun: UpdateRun = useCallback((runId: string, update: RunUpdater) => {
    setRuns((current) => current.map((run) => (run.id === runId ? update(run) : run)));
  }, [setRuns]);

  const addRun = useCallback((source?: LeechInstance) => {
    const id = createId('leech');
    const createdAt = isoTimestamp(clock.nowMs());
    const run = source
      ? createInstanceWithBillingSettings(source, { id, createdAt, name: '' })
      : createEmptyRun(createdAt, DEFAULT_RATIO_BILLING, id);
    setHighlightedRunId(id);
    setSelectedRunId(id);
    setRuns((current) => [...current, run]);
  }, [clock, setRuns, setSelectedRunId]);

  const deleteRun = useCallback(async (run: LeechInstance) => {
    if (!isEmptyRun(run)) {
      const confirmed = await confirm({
        title: t('run.delete'),
        message: t('confirm.deleteRun', { name: getRunDisplayName(run) }),
        confirmLabel: t('run.delete'),
        tone: 'danger',
      });
      if (!confirmed) return false;
    }
    setRuns((current) => {
      if (!current.some((item) => item.id === run.id)) return current;
      const remaining = current.filter((item) => item.id !== run.id);
      return remaining.length === 0
        ? [createEmptyRun(isoTimestamp(clock.nowMs()))]
        : remaining;
    });
    return true;
  }, [clock, confirm, setRuns, t]);

  return {
    runs,
    displayedRuns,
    selectedRun,
    selectedRunIndex: selectedRun ? displayedRuns.findIndex((run) => run.id === selectedRun.id) : -1,
    highlightedRunId,
    selectRun: setSelectedRunId,
    addRun,
    updateRun,
    deleteRun,
  };
}
