import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Lock,
  Monitor,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { avatarUrl, fetchCharacter } from './api/legends';
import { createManualSnapshot } from './domain/character';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBillableMs,
  pauseTimer,
  resetTimer,
  startTimer,
} from './domain/calculator';
import { formatCompact, formatDuration, formatExp, formatHours, formatLocalDateTime, formatMesosShort, formatMesosShortPrecise, formatMesosValue, formatPercent, formatRatio } from './domain/format';
import { createId } from './domain/id';
import type {
  BillingType,
  CharacterSnapshot,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  RatioBilling,
  TimerStatus,
} from './domain/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import './styles/app.css';

type Notice = { type: 'error' | 'info'; text: string } | null;
type ThemeMode = 'system' | 'light' | 'dark';

type QuickEstimateState = {
  fromLevel: number;
  fromExpPercent: number;
  toLevel: number;
  toExpPercent: number;
  billingType: BillingType;
  expPerMesoRatio: number;
  hourlyRateMillions: number;
  expPerHourMillions: number;
};

type DraftSnapshotState = {
  level: number;
  expPercent: number;
};

const INSTANCES_STORAGE_KEY = 'legends-leech-calculator.instances.v5';
const ESTIMATE_STORAGE_KEY = 'legends-leech-calculator.estimate.v1';
const THEME_STORAGE_KEY = 'legends-leech-calculator.theme.v1';
const MANUAL_SNAPSHOT_COMMIT_DELAY_MS = 350;

const DEFAULT_ESTIMATE: QuickEstimateState = {
  fromLevel: 120,
  fromExpPercent: 0,
  toLevel: 125,
  toExpPercent: 0,
  billingType: 'ratio',
  expPerMesoRatio: 3.3,
  hourlyRateMillions: 12,
  expPerHourMillions: 35,
};

const DEFAULT_RATIO_BILLING: RatioBilling = {
  type: 'ratio',
  expPerMesoRatio: 3.3,
};

function defaultRunName(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Run';

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${day} · ${time}`;
}

function emptyInstance(billing: LeechBilling = DEFAULT_RATIO_BILLING, id = createId('leech')): LeechInstance {
  const createdAt = new Date().toISOString();
  return {
    id,
    name: defaultRunName(createdAt),
    billing,
    buyers: [],
    createdAt,
  };
}

function initialInstances(): LeechInstance[] {
  return [emptyInstance()];
}

function confirmDeletion(message: string) {
  return window.confirm(message);
}

function confirmSnapshotOverwrite(label: 'start') {
  return window.confirm(`Refresh ${label} EXP? This will overwrite the current level and EXP data.`);
}

function isEmptyBuyer(buyer: LeechBuyer) {
  return !buyer.ign.trim() && !buyer.start && !buyer.current;
}

function isEmptyInstance(instance: LeechInstance) {
  if (instance.buyers.some((buyer) => !isEmptyBuyer(buyer)) || instance.quote) return false;
  if (instance.billing.type !== 'hourly') return true;
  return instance.billing.timer.status === 'idle' && instance.billing.timer.accumulatedMs === 0 && !instance.billing.timer.lastStartedAt;
}

function clampLevel(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(200, Math.round(value)));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99.999, value));
}

function roundToHundredth(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function normalizePercent(value: number) {
  return Math.max(0, Math.min(99.99, roundToHundredth(value)));
}

function normalizeNonNegativeHundredth(value: number) {
  return Math.max(0, roundToHundredth(value));
}

function numberInputText(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function billingLabel(billing: LeechBilling) {
  if (billing.type === 'ratio') return formatRatio(billing.expPerMesoRatio);
  return `${formatMesosShort(billing.hourlyRateMesos)}/hr`;
}

function timerStatusLabel(status: TimerStatus) {
  switch (status) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'idle':
    default:
      return 'idle';
  }
}

function makeManualSnapshot(ign: string, draft: DraftSnapshotState): CharacterSnapshot {
  return createManualSnapshot({
    ign: ign || 'Entered buyer',
    level: clampLevel(draft.level),
    expPercent: clampPercent(draft.expPercent),
  });
}

function draftDiffersFromSnapshot(draft: DraftSnapshotState, snapshot?: CharacterSnapshot) {
  return !snapshot || snapshot.level !== clampLevel(draft.level) || snapshot.expPercent !== clampPercent(draft.expPercent);
}

function createdAtMs(instance: LeechInstance) {
  const ms = new Date(instance.createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buyerLookupIgn(buyer: LeechBuyer) {
  return (buyer.ign || buyer.start?.ign || buyer.current?.ign || '').trim();
}

function snapshotShort(snapshot?: CharacterSnapshot) {
  return snapshot ? `Lv.${snapshot.level} · ${formatPercent(snapshot.expPercent)}` : '—';
}

function exportInstances(instances: LeechInstance[], now = Date.now()) {
  const columns = [
    'instance',
    'created_at',
    'billing',
    'buyer',
    'start_level',
    'start_exp_percent',
    'start_time',
    'current_level',
    'current_exp_percent',
    'current_time',
    'exp_gained',
    'mesos_due',
    'billable_ms',
  ];

  const rows = instances.flatMap((instance) => {
    const instanceCalc = calculateInstance(instance, now);
    const chargedBuyerCount = instance.billing.type === 'hourly' ? instance.buyers.filter((buyer) => buyer.start).length : 1;
    return instance.buyers.map((buyer) => {
      const buyerCalc = calculateBuyer(buyer, instance.billing, now, chargedBuyerCount);
      const due = instance.billing.type === 'ratio' ? buyerCalc.ratioMesosDue : buyerCalc.hourlyMesosDue;
      return [
        instance.name,
        instance.createdAt,
        billingLabel(instance.billing),
        buyerLookupIgn(buyer),
        buyer.start?.level,
        buyer.start?.expPercent,
        buyer.start?.capturedAt,
        buyer.current?.level,
        buyer.current?.expPercent,
        buyer.current?.capturedAt,
        buyerCalc.expGained,
        due,
        instanceCalc.billableMs,
      ].map(csvEscape).join(',');
    });
  });

  const blob = new Blob([[columns.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `holy-symbol-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateBuyer(instance: LeechInstance, buyerId: string, updater: (buyer: LeechBuyer) => LeechBuyer): LeechInstance {
  return {
    ...instance,
    buyers: instance.buyers.map((buyer) => (buyer.id === buyerId ? updater(buyer) : buyer)),
  };
}

function SnapshotSummary({
  title,
  tone,
  snapshot,
  draft,
  refreshLabel,
  refreshDisabled,
  refreshing,
  onDraftChange,
  onCommitDraft,
  onRefresh,
}: {
  title: string;
  tone: 'start' | 'current';
  snapshot?: CharacterSnapshot;
  draft: DraftSnapshotState;
  refreshLabel: string;
  refreshDisabled: boolean;
  refreshing: boolean;
  onDraftChange: (value: DraftSnapshotState) => void;
  onCommitDraft: (value: DraftSnapshotState) => void;
  onRefresh: () => void;
}) {
  const sourceLabel = snapshot?.source === 'manual' ? 'entered' : 'refreshed';

  return (
    <div className={`snapshot-summary snapshot-summary--${tone}`}>
      <div className="snapshot-summary__head">
        <div>
          <span>{title}</span>
          <strong>{snapshotShort(snapshot)}</strong>
        </div>
        <button type="button" className="icon-button snapshot-refresh-button" onClick={onRefresh} disabled={refreshDisabled} aria-label={refreshLabel}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      <small>{snapshot ? `${formatLocalDateTime(snapshot.capturedAt)} · ${sourceLabel}` : 'Fetch or enter EXP'}</small>
      <div className="manual-snapshot">
        <LevelExpInputs value={draft} onChange={onDraftChange} onCommit={onCommitDraft} />
      </div>
    </div>
  );
}

function FlowCard({ step, title, labels, children }: { step: string; title: string; labels: ReactNode; children: ReactNode }) {
  return (
    <div className="flow-card">
      <div className="flow-card__top">
        <div className="flow-card__heading">
          <span>{step}</span>
          <strong>{title}</strong>
        </div>
        {labels}
      </div>
      {children}
    </div>
  );
}

function ThemeSwitch({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: 'light', label: 'Light', icon: <Sun size={15} /> },
    { value: 'system', label: 'System', icon: <Monitor size={15} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
  ];

  return (
    <div className="theme-switch segmented-control" role="group" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={theme === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
          aria-pressed={theme === option.value}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

type EditableNumberInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyValue?: number;
  normalize?: (value: number) => number;
};

function EditableNumberInput({
  value,
  onValueChange,
  emptyValue = 0,
  normalize = (nextValue) => nextValue,
  onBlur,
  onFocus,
  ...inputProps
}: EditableNumberInputProps) {
  const [text, setText] = useState(numberInputText(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(numberInputText(value));
  }, [value]);

  function parseText(raw: string) {
    if (raw === '') return emptyValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : emptyValue;
  }

  return (
    <input
      {...inputProps}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const normalized = normalize(parseText(text));
        const nextText = String(normalized);
        event.currentTarget.value = nextText;
        setText(nextText);
        onValueChange(normalized);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        if (nextText === '') return;
        const parsed = Number(nextText);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
    />
  );
}

function LevelExpInputs({
  value,
  onChange,
  onCommit,
  prefix = '',
}: {
  value: DraftSnapshotState;
  onChange: (value: DraftSnapshotState) => void;
  onCommit?: (value: DraftSnapshotState) => void;
  prefix?: string;
}) {
  const commitTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== undefined) window.clearTimeout(commitTimerRef.current);
    };
  }, []);

  function clearScheduledCommit() {
    if (commitTimerRef.current === undefined) return;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = undefined;
  }

  function scheduleCommit(nextValue: DraftSnapshotState) {
    if (!onCommit) return;
    clearScheduledCommit();
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = undefined;
      onCommit(nextValue);
    }, MANUAL_SNAPSHOT_COMMIT_DELAY_MS);
  }

  function updateValue(nextValue: DraftSnapshotState) {
    onChange(nextValue);
    scheduleCommit(nextValue);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;

    const inputs = event.currentTarget.querySelectorAll('input');
    const normalized = {
      level: clampLevel(Number(inputs[0].value)),
      expPercent: normalizePercent(Number(inputs[1].value)),
    };

    inputs[0].value = String(normalized.level);
    inputs[1].value = String(normalized.expPercent);

    clearScheduledCommit();
    onChange(normalized);
    onCommit?.(normalized);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.currentTarget.blur();
  }

  return (
    <div className="level-exp-grid" onBlur={handleBlur}>
      <label>
        {prefix}Level
        <EditableNumberInput
          type="number"
          min={1}
          max={200}
          value={value.level}
          emptyValue={1}
          normalize={clampLevel}
          onKeyDown={handleKeyDown}
          onValueChange={(level) => updateValue({ ...value, level })}
        />
      </label>
      <label>
        {prefix}EXP %
        <EditableNumberInput
          type="number"
          min={0}
          max={99.999}
          step={0.01}
          value={value.expPercent}
          normalize={normalizePercent}
          onKeyDown={handleKeyDown}
          onValueChange={(expPercent) => updateValue({ ...value, expPercent })}
        />
      </label>
    </div>
  );
}

function EstimateLevelExpInputs({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DraftSnapshotState;
  onChange: (value: DraftSnapshotState) => void;
}) {
  function updateValue(nextValue: DraftSnapshotState) {
    onChange(nextValue);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;

    const inputs = event.currentTarget.querySelectorAll('input');
    const normalized = {
      level: clampLevel(Number(inputs[0].value)),
      expPercent: normalizePercent(Number(inputs[1].value)),
    };

    inputs[0].value = String(normalized.level);
    inputs[1].value = String(normalized.expPercent);
    onChange(normalized);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.currentTarget.blur();
  }

  return (
    <div className="estimate-level-inputs" onBlur={handleBlur}>
      <EditableNumberInput
        type="number"
        min={1}
        max={200}
        value={value.level}
        emptyValue={1}
        normalize={clampLevel}
        aria-label={`${label} level`}
        onKeyDown={handleKeyDown}
        onValueChange={(level) => updateValue({ ...value, level })}
      />
      <EditableNumberInput
        type="number"
        min={0}
        max={99.999}
        step={0.01}
        value={value.expPercent}
        normalize={normalizePercent}
        aria-label={`${label} EXP percent`}
        onKeyDown={handleKeyDown}
        onValueChange={(expPercent) => updateValue({ ...value, expPercent })}
      />
    </div>
  );
}

function QuickEstimate({
  estimate,
  onChange,
}: {
  estimate: QuickEstimateState;
  onChange: (next: QuickEstimateState) => void;
}) {
  const result = useMemo(
    () =>
      calculateEstimate({
        fromLevel: clampLevel(estimate.fromLevel),
        fromExpPercent: estimate.fromExpPercent,
        toLevel: clampLevel(estimate.toLevel),
        toExpPercent: estimate.toExpPercent,
        billingType: estimate.billingType,
        expPerMesoRatio: estimate.expPerMesoRatio,
        hourlyRateMesos: estimate.hourlyRateMillions * 1_000_000,
        expPerHourMillions: estimate.expPerHourMillions,
      }),
    [estimate],
  );

  return (
    <section className="panel estimate-panel">
      <div className="panel-heading">
        <div>
          <h2>Calculator</h2>
        </div>
        <div className="segmented-control" role="group" aria-label="Estimate pricing type">
          <button type="button" className={estimate.billingType === 'ratio' ? 'active' : ''} onClick={() => onChange({ ...estimate, billingType: 'ratio' })}>
            Ratio
          </button>
          <button type="button" className={estimate.billingType === 'hourly' ? 'active' : ''} onClick={() => onChange({ ...estimate, billingType: 'hourly' })}>
            Hourly
          </button>
        </div>
      </div>

      <div className="estimate-grid">
        <FlowCard
          step="1"
          title="From"
          labels={
            <div className="estimate-label-row estimate-label-row--level-exp">
              <span>Level</span>
              <span>EXP %</span>
            </div>
          }
        >
          <EstimateLevelExpInputs
            label="From"
            value={{ level: estimate.fromLevel, expPercent: estimate.fromExpPercent }}
            onChange={(value) => onChange({ ...estimate, fromLevel: clampLevel(value.level), fromExpPercent: clampPercent(value.expPercent) })}
          />
        </FlowCard>

        <FlowCard
          step="2"
          title="To"
          labels={
            <div className="estimate-label-row estimate-label-row--level-exp">
              <span>Level</span>
              <span>EXP %</span>
            </div>
          }
        >
          <EstimateLevelExpInputs
            label="To"
            value={{ level: estimate.toLevel, expPercent: estimate.toExpPercent }}
            onChange={(value) => onChange({ ...estimate, toLevel: clampLevel(value.level), toExpPercent: clampPercent(value.expPercent) })}
          />
        </FlowCard>

        <FlowCard
          step="3"
          title="Pricing"
          labels={
            estimate.billingType === 'ratio' ? (
              <div className="estimate-label-row estimate-label-row--single">
                <span>Ratio</span>
              </div>
            ) : (
              <div className="estimate-label-row estimate-label-row--pricing">
                <span>Price</span>
                <span>EPH</span>
              </div>
            )
          }
        >
          {estimate.billingType === 'ratio' ? (
            <span className="ratio-input">
              <span>1 :</span>
              <EditableNumberInput
                type="number"
                min={0.1}
                step={0.1}
                value={estimate.expPerMesoRatio}
                aria-label="EXP per meso ratio"
                onValueChange={(expPerMesoRatio) => onChange({ ...estimate, expPerMesoRatio })}
              />
            </span>
          ) : (
            <div className="estimate-pricing-inputs">
              <div>
                <span className="unit-input">
                  <EditableNumberInput
                    type="number"
                    min={0}
                    step={0.5}
                    value={estimate.hourlyRateMillions}
                    aria-label="Hourly price in millions of mesos"
                    onValueChange={(hourlyRateMillions) => onChange({ ...estimate, hourlyRateMillions })}
                  />
                  <span>M/h</span>
                </span>
              </div>
              <div>
                <span className="unit-input">
                  <EditableNumberInput
                    type="number"
                    min={0}
                    step={0.01}
                    value={estimate.expPerHourMillions}
                    normalize={normalizeNonNegativeHundredth}
                    aria-label="EXP rate in millions per hour"
                    onValueChange={(expPerHourMillions) => onChange({ ...estimate, expPerHourMillions })}
                  />
                  <span>M EXP/h</span>
                </span>
              </div>
            </div>
          )}
        </FlowCard>

        <div className="estimate-result flow-card">
          <div className="flow-card__heading">
            <span>4</span>
            <strong>Result</strong>
          </div>
          <div>
            <span>EXP needed</span>
            <strong>{formatCompact(result.expNeeded)}</strong>
            <small>{formatExp(result.expNeeded)}</small>
          </div>
          {estimate.billingType === 'hourly' ? (
            <div>
              <span>Expected time</span>
              <strong>{formatDuration(result.expectedDurationMs)}</strong>
              <small>{formatHours(result.expectedDurationMs)}</small>
            </div>
          ) : null}
          <div>
            <span>Estimated cost</span>
            <strong>{formatMesosShort(estimate.billingType === 'ratio' ? result.ratioMesosDue : result.hourlyMesosDue)}</strong>
            <small>{formatMesosValue(estimate.billingType === 'ratio' ? result.ratioMesosDue : result.hourlyMesosDue)}</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimerControls({ billing, onChange, now }: { billing: Extract<LeechBilling, { type: 'hourly' }>; onChange: (billing: LeechBilling) => void; now: number }) {
  const billableMs = getBillableMs(billing.timer, now);
  const isRunning = billing.timer.status === 'running';

  return (
    <div className={`timer-card timer-card--${billing.timer.status}`}>
      <div className="timer-card__header">
        <span>Run time</span>
        <small className="timer-status">{timerStatusLabel(billing.timer.status)}</small>
      </div>
      <div className="timer-card__body">
        <div className="timer-card__main">
          <strong>{formatDuration(billableMs)}</strong>
        </div>
        <div className="timer-card__actions">
          <button type="button" className="timer-card__toggle" onClick={() => onChange({ ...billing, timer: isRunning ? pauseTimer(billing.timer) : startTimer(billing.timer) })} aria-label={isRunning ? 'Pause run timer' : 'Start run timer'}>
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button type="button" className="secondary-button timer-card__reset" onClick={() => onChange({ ...billing, timer: resetTimer() })} disabled={isRunning}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function BuyerRow({
  instance,
  buyer,
  busy,
  now,
  onUpdate,
  onDelete,
  onFetchSnapshot,
  dueCopied,
  onDueCopied,
}: {
  instance: LeechInstance;
  buyer: LeechBuyer;
  busy: boolean;
  now: number;
  onUpdate: (buyer: LeechBuyer) => void;
  onDelete: () => void;
  onFetchSnapshot: (ign: string) => Promise<CharacterSnapshot>;
  dueCopied: boolean;
  onDueCopied: () => void;
}) {
  const [startDraft, setStartDraft] = useState<DraftSnapshotState>({ level: buyer.start?.level ?? 120, expPercent: buyer.start?.expPercent ?? 0 });
  const [currentDraft, setCurrentDraft] = useState<DraftSnapshotState>({ level: buyer.current?.level ?? buyer.start?.level ?? 120, expPercent: buyer.current?.expPercent ?? 0 });
  const [refreshingSnapshot, setRefreshingSnapshot] = useState<'start' | 'current' | null>(null);
  const chargedBuyerCount = instance.billing.type === 'hourly' ? instance.buyers.filter((item) => item.start).length : 1;
  const calc = calculateBuyer(buyer, instance.billing, now, chargedBuyerCount);
  const due = instance.billing.type === 'ratio' ? calc.ratioMesosDue : calc.hourlyMesosDue;
  const lookupIgn = buyerLookupIgn(buyer);
  const displayIgn = lookupIgn || 'Buyer';
  const locked = buyer.locked ?? false;
  const job = buyer.current?.job ?? buyer.start?.job;
  const guild = buyer.current?.guild ?? buyer.start?.guild;

  useEffect(() => {
    if (!buyer.start) return;
    setStartDraft({ level: buyer.start.level, expPercent: buyer.start.expPercent });
  }, [buyer.start?.id, buyer.start?.level, buyer.start?.expPercent]);

  useEffect(() => {
    if (!buyer.current) return;
    setCurrentDraft({ level: buyer.current.level, expPercent: buyer.current.expPercent });
  }, [buyer.current?.id, buyer.current?.level, buyer.current?.expPercent]);

  async function fetchStart() {
    if (buyer.start && !confirmSnapshotOverwrite('start')) return;
    setRefreshingSnapshot('start');
    try {
      const snapshot = await onFetchSnapshot(lookupIgn);
      onUpdate({ ...buyer, ign: snapshot.ign, start: snapshot, current: buyer.current ?? snapshot });
    } finally {
      setRefreshingSnapshot(null);
    }
  }

  async function fetchCurrent() {
    setRefreshingSnapshot('current');
    try {
      const snapshot = await onFetchSnapshot(lookupIgn);
      onUpdate({ ...buyer, ign: snapshot.ign, current: snapshot });
    } finally {
      setRefreshingSnapshot(null);
    }
  }

  function commitStartDraft(nextDraft = startDraft) {
    if (!draftDiffersFromSnapshot(nextDraft, buyer.start)) return;
    const snapshot = makeManualSnapshot(lookupIgn, nextDraft);
    onUpdate({ ...buyer, ign: buyer.ign || snapshot.ign, start: snapshot, current: buyer.current ?? snapshot });
  }

  function commitCurrentDraft(nextDraft = currentDraft) {
    if (!draftDiffersFromSnapshot(nextDraft, buyer.current)) return;
    const snapshot = makeManualSnapshot(lookupIgn, nextDraft);
    onUpdate({ ...buyer, ign: buyer.ign || buyer.start?.ign || snapshot.ign, current: snapshot });
  }

  async function copyDue() {
    if (due === undefined || !Number.isFinite(due)) return;
    try {
      await navigator.clipboard.writeText(String(Math.max(0, Math.round(due))));
      onDueCopied();
    } catch {}
  }

  function handleDueKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    void copyDue();
  }

  return (
    <article className="buyer-row-card">
      <div className={`buyer-row-main${locked ? ' buyer-row-main--locked' : ''}`}>
        <div className="buyer-identity-cell">
          {lookupIgn ? (
            <div className="avatar-frame avatar-frame--small">
              <img src={avatarUrl(lookupIgn, !locked)} alt="" loading="lazy" />
            </div>
          ) : (
            <div className="avatar-frame avatar-frame--small avatar-frame--empty"><UserPlus size={18} /></div>
          )}
          <div className="buyer-name-display">
            <strong>{buyer.ign || 'BuyerName'}</strong>
            {job || guild ? (
              <div className="buyer-character-meta">
                {job ? <span aria-label={`Job: ${job}`} title={job}>{job}</span> : null}
                {guild ? <span aria-label={`Guild: ${guild}`} title={guild}>{guild}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="buyer-row-metrics">
          <div className="buyer-row-stat">
            <span>Start</span>
            <strong>{snapshotShort(buyer.start)}</strong>
            {buyer.start ? <small>{formatLocalDateTime(buyer.start.capturedAt)}</small> : null}
          </div>
          <div className="buyer-row-stat">
            <span>Current</span>
            <strong>{snapshotShort(buyer.current)}</strong>
            {buyer.current ? <small>{formatLocalDateTime(buyer.current.capturedAt)}</small> : null}
          </div>
          <div className="buyer-row-stat">
            <span>EXP gained</span>
            <strong>{formatCompact(calc.expGained)}</strong>
            <small>{formatExp(calc.expGained)}</small>
          </div>
          <div
            className={`buyer-row-stat buyer-row-stat--due${dueCopied ? ' buyer-row-stat--copied' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={dueCopied ? `${displayIgn} due amount copied` : `Copy ${displayIgn} due amount`}
            onClick={() => void copyDue()}
            onKeyDown={handleDueKeyDown}
          >
            <span className="buyer-row-stat__copy-label" aria-live="polite">
              {dueCopied ? 'Copied' : 'Due'}
              {dueCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            </span>
            <strong>{formatMesosShortPrecise(due)}</strong>
            <small>{formatMesosValue(due)}</small>
          </div>
        </div>
        <div className="buyer-row-actions">
          <button
            type="button"
            className={`icon-button lock-button${locked ? ' lock-button--locked' : ''}`}
            onClick={() => onUpdate({ ...buyer, locked: !locked })}
            aria-label={`${locked ? 'Unlock' : 'Lock'} ${displayIgn}`}
            aria-pressed={locked}
          >
            {locked ? <Unlock size={16} /> : <Lock size={16} />}
          </button>
          <button type="button" className="icon-button danger-button" onClick={onDelete} aria-label={`Remove ${displayIgn}`}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!locked ? (
        <details className="buyer-details">
          <summary>Edit buyer</summary>
          <div className="snapshot-editor-grid">
            <SnapshotSummary
              title="Start"
              tone="start"
              snapshot={buyer.start}
              draft={startDraft}
              refreshLabel="Fetch start EXP"
              refreshDisabled={busy || !lookupIgn}
              refreshing={refreshingSnapshot === 'start'}
              onDraftChange={setStartDraft}
              onCommitDraft={commitStartDraft}
              onRefresh={fetchStart}
            />

            <SnapshotSummary
              title="Current"
              tone="current"
              snapshot={buyer.current}
              draft={currentDraft}
              refreshLabel="Refresh EXP"
              refreshDisabled={busy || !lookupIgn}
              refreshing={refreshingSnapshot === 'current'}
              onDraftChange={setCurrentDraft}
              onCommitDraft={commitCurrentDraft}
              onRefresh={fetchCurrent}
            />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function LeechInstanceCard({
  instance,
  index,
  highlighted,
  busyKey,
  now,
  onUpdate,
  onDelete,
  onFetchSnapshot,
  copiedBuyerId,
  onDueCopied,
}: {
  instance: LeechInstance;
  index: number;
  highlighted: boolean;
  busyKey: string | null;
  now: number;
  onUpdate: (instance: LeechInstance) => void;
  onDelete: () => void;
  onFetchSnapshot: (ign: string) => Promise<CharacterSnapshot>;
  copiedBuyerId: string | null;
  onDueCopied: (buyerId: string) => void;
}) {
  const [newBuyerIgn, setNewBuyerIgn] = useState('');
  const [addingBuyer, setAddingBuyer] = useState(false);
  const [refreshingRun, setRefreshingRun] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const ratioBilling = instance.billing.type === 'ratio' ? instance.billing : undefined;
  const hourlyBilling = instance.billing.type === 'hourly' ? instance.billing : undefined;
  const refreshableBuyers = instance.buyers.filter((buyer) => !buyer.locked && buyerLookupIgn(buyer));

  function updateBilling(billing: LeechBilling) {
    onUpdate({ ...instance, billing });
  }

  function setBillingType(type: BillingType) {
    if (type === instance.billing.type) return;
    const billing: LeechBilling =
      type === 'ratio'
        ? { type: 'ratio', expPerMesoRatio: 3.3 }
        : { type: 'hourly', hourlyRateMesos: 12_000_000, expPerHourMillions: 35, timer: { status: 'idle', accumulatedMs: 0 } };
    updateBilling(billing);
  }

  async function addBuyerFromInput() {
    const ign = newBuyerIgn.trim();
    if (!ign) return;

    setAddingBuyer(true);
    setRefreshResult(null);
    try {
      const snapshot = await onFetchSnapshot(ign);
      const buyer: LeechBuyer = {
        id: createId('buyer'),
        ign: snapshot.ign,
        start: snapshot,
        current: snapshot,
      };
      onUpdate({ ...instance, buyers: [...instance.buyers, buyer] });
      setNewBuyerIgn('');
    } catch {
      const buyer: LeechBuyer = {
        id: createId('buyer'),
        ign,
      };
      onUpdate({ ...instance, buyers: [...instance.buyers, buyer] });
      setNewBuyerIgn('');
    } finally {
      setAddingBuyer(false);
    }
  }

  async function refreshRunCurrentExp() {
    if (refreshableBuyers.length === 0) return;

    setRefreshingRun(true);
    setRefreshResult(null);
    const snapshots = new Map<string, CharacterSnapshot>();
    const failures: string[] = [];

    for (const buyer of refreshableBuyers) {
      const ign = buyerLookupIgn(buyer);
      try {
        const snapshot = await onFetchSnapshot(ign);
        snapshots.set(buyer.id, snapshot);
      } catch {
        failures.push(ign);
      }
    }

    const refreshedAt = snapshots.size > 0 ? new Date().toISOString() : instance.lastCurrentRefreshedAt;
    onUpdate({
      ...instance,
      lastCurrentRefreshedAt: refreshedAt,
      buyers: instance.buyers.map((buyer) => {
        const snapshot = snapshots.get(buyer.id);
        return snapshot ? { ...buyer, ign: snapshot.ign, current: snapshot } : buyer;
      }),
    });

    setRefreshResult(
      failures.length > 0
        ? `Updated ${snapshots.size}/${refreshableBuyers.length}. Failed: ${failures.join(', ')}`
        : `Updated ${snapshots.size} buyer${snapshots.size === 1 ? '' : 's'}`,
    );
    setRefreshingRun(false);
  }

  return (
    <section className={`panel leech-instance${highlighted ? ' leech-instance--highlighted' : ''}`}>
      <div className="instance-header">
        <div>
          <input
            className="instance-title-input"
            value={instance.name}
            onChange={(event) => onUpdate({ ...instance, name: event.target.value })}
            aria-label={`Name for leech run ${index + 1}`}
          />
          <p className="run-created-at">
            {instance.billing.type === 'ratio' ? `Ratio · ${billingLabel(instance.billing)}` : `Hourly · ${billingLabel(instance.billing)}`} · Created {formatLocalDateTime(instance.createdAt)}
          </p>
        </div>
        <div className="button-row wrap">
          <div className="segmented-control" role="group" aria-label="Billing type">
            <button type="button" className={instance.billing.type === 'ratio' ? 'active' : ''} onClick={() => setBillingType('ratio')}>Ratio</button>
            <button type="button" className={instance.billing.type === 'hourly' ? 'active' : ''} onClick={() => setBillingType('hourly')}>Hourly</button>
          </div>
          <button type="button" className="icon-button danger-button" onClick={onDelete} aria-label="Delete run">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="instance-billing">
        <div className="billing-settings">
          <span>Pricing</span>
          {ratioBilling ? (
            <label className="compact-label">
              EXP ratio
              <span className="ratio-input">
                <span>1 :</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={ratioBilling.expPerMesoRatio}
                  aria-label="Run EXP per meso ratio"
                  onChange={(event) => updateBilling({ type: 'ratio', expPerMesoRatio: Number(event.target.value) })}
                />
              </span>
            </label>
          ) : null}
          {hourlyBilling ? (
            <label className="compact-label">
              Hourly rate
              <span className="unit-input">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hourlyBilling.hourlyRateMesos / 1_000_000}
                  aria-label="Run hourly price in millions of mesos"
                  onChange={(event) => updateBilling({ ...hourlyBilling, hourlyRateMesos: Number(event.target.value) * 1_000_000 })}
                />
                <span>m / hr</span>
              </span>
            </label>
          ) : null}
        </div>
        {hourlyBilling ? (
          <TimerControls billing={hourlyBilling} now={now} onChange={updateBilling} />
        ) : null}
        {ratioBilling ? (
          <div className="tip-card tip-card--inline">
            <div className="tip-card__content">
              <strong>Keep EXP updated <AlertCircle size={14} /></strong>
              <div className="tip-card__rows">
                <span><b>Party refresh</b><em>Invite any character to the party, such as the HS mule.</em></span>
                <span><b>Self refresh</b><em>Enter a map, change channels, or exit the Cash Shop.</em></span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="buyers-header buyers-toolbar">
        <div>
          <h3>Buyers</h3>
          <p>Add buyers before the run, then refresh current EXP as the run goes.</p>
        </div>
        <div className="button-row wrap">
          <button type="button" className="secondary-button refresh-exp-button" onClick={refreshRunCurrentExp} disabled={refreshingRun || refreshableBuyers.length === 0}>
            <RefreshCw size={16} className={refreshingRun ? 'spin' : ''} /> {refreshingRun ? 'Refreshing...' : 'Refresh EXP'}
          </button>
        </div>
      </div>

      <form
        className="add-buyer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addBuyerFromInput();
        }}
      >
        <label>
          Buyer IGN
          <input value={newBuyerIgn} onChange={(event) => setNewBuyerIgn(event.target.value)} placeholder="BuyerName" />
        </label>
        <button type="submit" disabled={addingBuyer || !newBuyerIgn.trim()}>
          <Plus size={16} /> {addingBuyer ? 'Adding...' : 'Add buyer'}
        </button>
      </form>

      <div className="refresh-status-row">
        {instance.lastCurrentRefreshedAt ? <small>Last refreshed: {formatLocalDateTime(instance.lastCurrentRefreshedAt)}</small> : <small>Start EXP is fetched once when a buyer is added.</small>}
        {refreshResult ? <small>{refreshResult}</small> : null}
      </div>

      {instance.buyers.length > 0 ? (
        <div className="buyer-list">
          {instance.buyers.map((buyer) => (
            <BuyerRow
              key={buyer.id}
              instance={instance}
              buyer={buyer}
              now={now}
              busy={busyKey === `character:${buyerLookupIgn(buyer)}` || refreshingRun}
              onFetchSnapshot={onFetchSnapshot}
              dueCopied={copiedBuyerId === buyer.id}
              onDueCopied={() => onDueCopied(buyer.id)}
              onUpdate={(nextBuyer) => onUpdate(updateBuyer(instance, buyer.id, () => nextBuyer))}
              onDelete={() => {
                const name = buyerLookupIgn(buyer) || 'this character';
                if (!isEmptyBuyer(buyer) && !confirmDeletion(`Delete ${name} from ${instance.name}?`)) return;
                onUpdate({ ...instance, buyers: instance.buyers.filter((item) => item.id !== buyer.id) });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="empty-buyers-state">
          <UserPlus size={24} />
          <strong>No buyers yet</strong>
          <span>Add the buyer’s IGN to fetch their start EXP.</span>
        </div>
      )}
    </section>
  );
}

function RunRail({
  instances,
  selectedRunId,
  now,
  onSelect,
  onAdd,
}: {
  instances: LeechInstance[];
  selectedRunId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <aside className="run-rail" aria-label="Runs">
      <div className="rail-header">
        <div>
          <span className="rail-kicker">Runs</span>
          <strong>{instances.length} active</strong>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label="New run">
          <Plus size={17} />
        </button>
      </div>

      <label className="run-picker">
        <select value={selectedRunId ?? ''} onChange={(event) => onSelect(event.target.value)} aria-label="Selected run">
          {instances.map((instance) => {
            const summary = calculateInstance(instance, now);
            return (
              <option key={instance.id} value={instance.id}>
                {instance.name || 'Untitled run'} · {billingLabel(instance.billing)} · {formatMesosShort(summary.totalMesosDue)}
              </option>
            );
          })}
        </select>
      </label>

      <div className="run-tabs">
        {instances.map((instance) => {
          const summary = calculateInstance(instance, now);
          const selected = instance.id === selectedRunId;
          return (
            <button
              key={instance.id}
              type="button"
              className={`run-tab${selected ? ' run-tab--active' : ''}`}
              onClick={() => onSelect(instance.id)}
              aria-current={selected ? 'true' : undefined}
            >
              <span>
                <strong>{instance.name || 'Untitled run'}</strong>
                <small>{billingLabel(instance.billing)}</small>
              </span>
              <span>
                <b>{formatMesosShort(summary.totalMesosDue)}</b>
                <small>{summary.buyerCount} buyer{summary.buyerCount === 1 ? '' : 's'}</small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function RunTools({ instance, now }: { instance?: LeechInstance; now: number }) {
  if (!instance) {
    return (
      <section className="panel run-tools">
        <div className="panel-heading">
          <div>
            <h2>Status</h2>
          </div>
        </div>
      </section>
    );
  }

  const summary = calculateInstance(instance, now);
  return (
    <section className="panel run-tools">
      <div className="panel-heading">
        <div>
          <h2>Status</h2>
        </div>
      </div>
      <div className="tool-stat tool-stat--due">
        <span>Total due</span>
        <strong>{formatMesosShort(summary.totalMesosDue)}</strong>
        <small>{formatMesosValue(summary.totalMesosDue)}</small>
      </div>
      <div className="tools-grid">
        <div className="tool-stat">
          <span>Buyers</span>
          <strong>{summary.buyerCount}</strong>
          <small>{summary.completedBuyerCount} refreshed</small>
        </div>
        <div className="tool-stat">
          <span>Total EXP</span>
          <strong>{formatCompact(summary.totalExpGained)}</strong>
          <small>{formatExp(summary.totalExpGained)}</small>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [instances, setInstances] = useLocalStorage<LeechInstance[]>(INSTANCES_STORAGE_KEY, initialInstances());
  const [estimate, setEstimate] = useLocalStorage<QuickEstimateState>(ESTIMATE_STORAGE_KEY, DEFAULT_ESTIMATE);
  const [theme, setTheme] = useLocalStorage<ThemeMode>(THEME_STORAGE_KEY, 'system');
  const [notice, setNotice] = useState<Notice>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [copiedBuyerId, setCopiedBuyerId] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const hasRunningTimer = instances.some((instance) => instance.billing.type === 'hourly' && instance.billing.timer.status === 'running');
    if (!hasRunningTimer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [instances]);

  useEffect(() => {
    if (!highlightedRunId) return;
    const id = window.setTimeout(() => setHighlightedRunId(null), 2400);
    return () => window.clearTimeout(id);
  }, [highlightedRunId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (instances.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (selectedRunId && instances.some((instance) => instance.id === selectedRunId)) return;
    setSelectedRunId(instances[0].id);
  }, [instances, selectedRunId]);

  function upsertInstance(nextInstance: LeechInstance) {
    setInstances((current) => current.map((instance) => (instance.id === nextInstance.id ? nextInstance : instance)));
  }

  function addInstance() {
    const id = createId('leech');
    setHighlightedRunId(id);
    setSelectedRunId(id);
    setInstances((current) => [...current, emptyInstance(DEFAULT_RATIO_BILLING, id)]);
  }

  function showCopiedBuyer(buyerId: string) {
    setCopiedBuyerId(buyerId);
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
    copyFeedbackTimerRef.current = window.setTimeout(() => setCopiedBuyerId(null), 1600);
  }

  async function loadCharacter(ign: string): Promise<CharacterSnapshot> {
    const cleanIgn = ign.trim();
    setNotice(null);
    setBusyKey(`character:${cleanIgn}`);
    try {
      return await fetchCharacter(cleanIgn);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not refresh character.';
      setNotice({ type: 'error', text });
      throw error;
    } finally {
      setBusyKey(null);
    }
  }

  const displayedInstances = useMemo(() => [...instances].sort((a, b) => createdAtMs(b) - createdAtMs(a)), [instances]);
  const selectedInstance = useMemo(
    () => displayedInstances.find((instance) => instance.id === selectedRunId) ?? displayedInstances[0],
    [displayedInstances, selectedRunId],
  );

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="brand-lockup">
          <img src="/assets/icons/hs.png" alt="" className="brand-logo" />
          <div>
            <span className="app-mark">Holy Symbol</span>
            <p>Leech Calculator for MapleLegends</p>
          </div>
        </div>
        <div className="topbar-actions">
          <ThemeSwitch theme={theme} onChange={setTheme} />
          <button type="button" className="secondary-button" onClick={() => exportInstances(instances, now)} disabled={instances.length === 0}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`notice notice--${notice.type}`}>
          <AlertCircle size={18} />
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="workbench-layout">
        <RunRail instances={displayedInstances} selectedRunId={selectedInstance?.id ?? null} now={now} onSelect={setSelectedRunId} onAdd={addInstance} />

        <section className="ledger-column instances-section" aria-label="Selected run ledger">
          {selectedInstance ? (
            <div className="instances-stack">
              <LeechInstanceCard
                key={selectedInstance.id}
                instance={selectedInstance}
                index={displayedInstances.findIndex((instance) => instance.id === selectedInstance.id)}
                highlighted={selectedInstance.id === highlightedRunId}
                busyKey={busyKey}
                now={now}
                onFetchSnapshot={loadCharacter}
                copiedBuyerId={copiedBuyerId}
                onDueCopied={showCopiedBuyer}
                onUpdate={upsertInstance}
                onDelete={() => {
                  if (!isEmptyInstance(selectedInstance) && !confirmDeletion(`Delete ${selectedInstance.name}?`)) return;
                  setInstances((current) => (current.length <= 1 ? [emptyInstance()] : current.filter((item) => item.id !== selectedInstance.id)));
                }}
              />
            </div>
          ) : null}
        </section>

        <aside className="tools-column">
          <RunTools instance={selectedInstance} now={now} />
          <QuickEstimate estimate={estimate} onChange={setEstimate} />
        </aside>
      </div>
    </main>
  );
}
