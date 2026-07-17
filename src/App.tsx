import {
  AlertCircle,
  Check,
  CircleCheckBig,
  CircleDashed,
  Copy,
  Download,
  Languages,
  LoaderCircle,
  Monitor,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { avatarUrl, fetchCharacter, fetchCharacters } from './api/legends';
import type { CharacterBatch } from './api/legends';
import { DEFAULT_RATIO_BILLING, ensureBuyerHourlyState, switchInstanceBillingType, updateInstanceBilling } from './domain/billing';
import { createManualSnapshot } from './domain/character';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBuyerBillableMs,
  getBillableMs,
  isBuyerHourlyTimerRunning,
  pauseTimer,
  pauseBuyerHourlyTimer,
  resetTimer,
  startBuyerHourlyTimer,
  startTimer,
} from './domain/calculator';
import { formatCompact, formatDuration, formatExp, formatHours, formatLocalDateTime, formatMesosShort, formatMesosShortPrecise, formatMesosValue, formatPercent, formatRatio, formatRatioRange } from './domain/format';
import { createId } from './domain/id';
import { normalizeInstances } from './domain/persistence';
import type {
  BillingType,
  CharacterSnapshot,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  TimerStatus,
} from './domain/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  Button,
  IconButton,
  InputAddon,
  InputGroup,
  SegmentedControl,
  SegmentedControlButton,
  Stat,
  Surface,
  Tooltip,
  TooltipContent,
  cx,
  fieldLabelClass,
  groupedInputClass,
  inputClass,
  selectClass,
} from './ui/primitives';
import { i18n, setLanguagePreference } from './i18n';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from './i18n/locales';
import './styles/app.css';

type Notice = { type: 'error' | 'info'; text: string; transient?: boolean } | null;
type ThemeMode = 'system' | 'light' | 'dark';

const COPY_FEEDBACK_MS = 1600;
const SUCCESS_NOTICE_MS = 4000;

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
const SELECTED_RUN_STORAGE_KEY = 'legends-leech-calculator.selected-run.v1';
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

function defaultRunName(createdAt: string) {
  const name = i18n.t('run.defaultName');
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return name;

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${day} ${time}`;
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

function confirmSnapshotOverwrite(message: string) {
  return window.confirm(message);
}

function confirmTimerReset(message: string) {
  return window.confirm(message);
}

function isEmptyBuyer(buyer: LeechBuyer) {
  return !buyer.ign.trim() && !buyer.start && !buyer.current;
}

function isEmptyInstance(instance: LeechInstance) {
  if (instance.buyers.some((buyer) => !isEmptyBuyer(buyer))) return false;
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

function billingLabel(billing: LeechBilling, t: TFunction) {
  if (billing.type === 'ratio') {
    return [
      formatRatio(billing.expPerMesoRatio),
      ...billing.tiers.map((tier) => `Lv.${tier.minLevel}+ ${formatRatio(tier.expPerMesoRatio)}`),
    ].join(' · ');
  }
  return t('billing.hourlyRateShort', { rate: formatMesosShort(billing.hourlyRateMesos) });
}

function compactBillingLabel(billing: LeechBilling, t: TFunction) {
  if (billing.type !== 'ratio') return billingLabel(billing, t);
  const ratios = [billing.expPerMesoRatio, ...billing.tiers.map((tier) => tier.expPerMesoRatio)];
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  return formatRatioRange(minRatio, maxRatio, t('common.ratioPrefix'));
}

function timerStatusLabel(status: TimerStatus, t: TFunction) {
  switch (status) {
    case 'running':
      return t('timer.running');
    case 'paused':
      return t('timer.paused');
    case 'idle':
    default:
      return t('timer.idle');
  }
}

function makeManualSnapshot(ign: string, draft: DraftSnapshotState, fallbackIgn: string): CharacterSnapshot {
  return createManualSnapshot({
    ign: ign || fallbackIgn,
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

function snapshotShort(snapshot: CharacterSnapshot | undefined, t: TFunction) {
  return snapshot ? t('snapshot.short', { level: snapshot.level, expPercent: formatPercent(snapshot.expPercent) }) : '—';
}

function exportInstances(instances: LeechInstance[], t: TFunction, now = Date.now()) {
  const columns = [
    t('csv.instance'),
    t('csv.createdAt'),
    t('csv.billing'),
    t('csv.buyer'),
    t('csv.startLevel'),
    t('csv.startExpPercent'),
    t('csv.startTime'),
    t('csv.currentLevel'),
    t('csv.currentExpPercent'),
    t('csv.currentTime'),
    t('csv.expGained'),
    t('csv.mesosDue'),
    t('csv.billableMs'),
  ];

  const rows = instances.flatMap((instance) => {
    return instance.buyers.map((buyer) => {
      const buyerCalc = calculateBuyer(buyer, instance.billing, now, instance.buyers);
      const due = instance.billing.type === 'ratio' ? buyerCalc.ratioMesosDue : buyerCalc.hourlyMesosDue;
      return [
        instance.name,
        instance.createdAt,
        billingLabel(instance.billing, t),
        buyerLookupIgn(buyer),
        buyer.start?.level,
        buyer.start?.expPercent,
        buyer.start?.capturedAt,
        buyer.current?.level,
        buyer.current?.expPercent,
        buyer.current?.capturedAt,
        buyerCalc.expGained,
        due,
        instance.billing.type === 'hourly' ? getBuyerBillableMs(buyer, now) : undefined,
      ].map(csvEscape).join(',');
    });
  });

  const blob = new Blob(['\uFEFF', [columns.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
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
  const { t } = useTranslation();
  const sourceLabel = snapshot?.source === 'manual' ? t('snapshot.entered') : t('snapshot.refreshed');
  const titleClass = tone === 'start'
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-sky-700 dark:text-sky-300';

  return (
    <div
      className={cx(
        'grid gap-3 rounded-xl border p-3',
        tone === 'start'
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/30'
          : 'border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={cx('text-xs font-semibold uppercase tracking-wide', titleClass)}>{title}</span>
          <strong className="block text-sm font-bold text-slate-950 dark:text-white">{snapshotShort(snapshot, t)}</strong>
        </div>
        <IconButton type="button" className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onRefresh} disabled={refreshDisabled} aria-label={refreshLabel}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} />
        </IconButton>
      </div>
      <small className="text-xs text-slate-500 dark:text-slate-400">
        {snapshot ? `${formatLocalDateTime(snapshot.capturedAt)} · ${sourceLabel}` : t('snapshot.emptyPrompt')}
      </small>
      <div className="border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
        <LevelExpInputs value={draft} onChange={onDraftChange} onCommit={onCommitDraft} />
      </div>
    </div>
  );
}

function StepHeading({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
        {step}
      </span>
      <strong className="text-sm font-semibold text-slate-900 dark:text-white">{title}</strong>
    </div>
  );
}

function FlowCard({ step, title, labels, children }: { step: string; title: string; labels: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <StepHeading step={step} title={title} />
        {labels}
      </div>
      {children}
    </div>
  );
}

function ThemeSwitch({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  const { t } = useTranslation();
  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: 'light', label: t('theme.light'), icon: <Sun size={15} /> },
    { value: 'system', label: t('theme.system'), icon: <Monitor size={15} /> },
    { value: 'dark', label: t('theme.dark'), icon: <Moon size={15} /> },
  ];

  return (
    <SegmentedControl className="w-full sm:w-auto" role="group" aria-label={t('theme.label')}>
      {options.map((option) => (
        <SegmentedControlButton
          key={option.value}
          type="button"
          className="flex-1 sm:flex-none"
          onClick={() => onChange(option.value)}
          aria-pressed={theme === option.value}
        >
          {option.icon}
          <span className="hidden lg:inline">{option.label}</span>
        </SegmentedControlButton>
      ))}
    </SegmentedControl>
  );
}

function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const selectedLanguage = isSupportedLocale(i18n.resolvedLanguage ?? '')
    ? i18n.resolvedLanguage
    : isSupportedLocale(i18n.language)
      ? i18n.language
      : DEFAULT_LOCALE;

  return (
    <label className="relative flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
      <Languages size={15} aria-hidden="true" />
      <select
        className="absolute inset-0 cursor-pointer opacity-0 sm:static sm:h-auto sm:w-auto sm:appearance-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-sm sm:font-semibold sm:text-slate-700 sm:opacity-100 sm:dark:text-slate-200"
        value={selectedLanguage}
        onChange={(event) => {
          if (isSupportedLocale(event.target.value)) void setLanguagePreference(event.target.value);
        }}
        aria-label={t('language.label')}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type EditableNumberInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyValue?: number;
  normalize?: (value: number) => number;
  appearance?: 'default' | 'grouped';
};

function EditableNumberInput({
  value,
  onValueChange,
  emptyValue = 0,
  normalize = (nextValue) => nextValue,
  appearance = 'default',
  onBlur,
  onFocus,
  className,
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
      className={cx(appearance === 'grouped' ? groupedInputClass : inputClass, className)}
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

function RatioInput({
  value,
  ariaLabel,
  className = '',
  onValueChange,
}: {
  value: number;
  ariaLabel: string;
  className?: string;
  onValueChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <InputGroup className={className}>
      <InputAddon side="left">{t('common.ratioPrefix')}</InputAddon>
      <EditableNumberInput
        appearance="grouped"
        type="number"
        min={0.1}
        step={0.1}
        value={value}
        emptyValue={0.1}
        normalize={(nextValue) => Math.max(0.1, nextValue)}
        aria-label={ariaLabel}
        onValueChange={onValueChange}
      />
    </InputGroup>
  );
}

function UnitInput({ children, suffix }: { children: ReactNode; suffix: string }) {
  return (
    <InputGroup>
      {children}
      <InputAddon>{suffix}</InputAddon>
    </InputGroup>
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
  const { t } = useTranslation();
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
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1" onBlur={handleBlur}>
      <label className={fieldLabelClass}>
        {prefix}{t('common.level')}
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
      <label className={fieldLabelClass}>
        {prefix}{t('common.expPercent')}
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
  const { t } = useTranslation();
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
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-2" onBlur={handleBlur}>
      <EditableNumberInput
        type="number"
        min={1}
        max={200}
        value={value.level}
        emptyValue={1}
        normalize={clampLevel}
        aria-label={t('aria.estimateLevel', { label })}
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
        aria-label={t('aria.estimateExpPercent', { label })}
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
  const { t } = useTranslation();
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
  const estimatedCost = estimate.billingType === 'ratio' ? result.ratioMesosDue : result.hourlyMesosDue;
  const [costCopied, setCostCopied] = useState(false);
  const costCopyFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return clearCostCopyFeedbackTimer;
  }, []);

  useEffect(() => {
    clearCostCopyFeedbackTimer();
    setCostCopied(false);
  }, [estimatedCost]);

  function clearCostCopyFeedbackTimer() {
    if (costCopyFeedbackTimerRef.current === null) return;
    window.clearTimeout(costCopyFeedbackTimerRef.current);
    costCopyFeedbackTimerRef.current = null;
  }

  async function copyEstimatedCost() {
    if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost)) return;
    const roundedCost = Math.max(0, Math.round(estimatedCost));
    try {
      await navigator.clipboard.writeText(String(roundedCost));
      setCostCopied(true);
      clearCostCopyFeedbackTimer();
      costCopyFeedbackTimerRef.current = window.setTimeout(() => setCostCopied(false), COPY_FEEDBACK_MS);
    } catch {}
  }

  return (
    <Surface className="grid gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>{t('calculator.heading')}</h2>
        </div>
        <SegmentedControl role="group" aria-label={t('billing.estimateType')}>
          <SegmentedControlButton
            type="button"
            aria-pressed={estimate.billingType === 'ratio'}
            onClick={() => onChange({ ...estimate, billingType: 'ratio' })}
          >
            {t('billing.ratio')}
          </SegmentedControlButton>
          <SegmentedControlButton
            type="button"
            aria-pressed={estimate.billingType === 'hourly'}
            onClick={() => onChange({ ...estimate, billingType: 'hourly' })}
          >
            {t('billing.hourly')}
          </SegmentedControlButton>
        </SegmentedControl>
      </div>

      <div className="grid gap-3">
        <FlowCard
          step="1"
          title={t('calculator.from')}
          labels={
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
              <span>{t('common.level')}</span>
              <span>{t('common.expPercent')}</span>
            </div>
          }
        >
          <EstimateLevelExpInputs
            label={t('calculator.from')}
            value={{ level: estimate.fromLevel, expPercent: estimate.fromExpPercent }}
            onChange={(value) => onChange({ ...estimate, fromLevel: clampLevel(value.level), fromExpPercent: clampPercent(value.expPercent) })}
          />
        </FlowCard>

        <FlowCard
          step="2"
          title={t('calculator.to')}
          labels={
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
              <span>{t('common.level')}</span>
              <span>{t('common.expPercent')}</span>
            </div>
          }
        >
          <EstimateLevelExpInputs
            label={t('calculator.to')}
            value={{ level: estimate.toLevel, expPercent: estimate.toExpPercent }}
            onChange={(value) => onChange({ ...estimate, toLevel: clampLevel(value.level), toExpPercent: clampPercent(value.expPercent) })}
          />
        </FlowCard>

        <FlowCard
          step="3"
          title={t('billing.pricing')}
          labels={
            estimate.billingType === 'ratio' ? (
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                <span>{t('billing.ratio')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                <span>{t('calculator.price')}</span>
                <span>{t('calculator.eph')}</span>
              </div>
            )
          }
        >
          {estimate.billingType === 'ratio' ? (
            <RatioInput
              value={estimate.expPerMesoRatio}
              ariaLabel={t('aria.expPerMesoRatio')}
              onValueChange={(expPerMesoRatio) => onChange({ ...estimate, expPerMesoRatio })}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              <div>
                <UnitInput suffix={t('common.millionPerHour')}>
                  <EditableNumberInput
                    appearance="grouped"
                    type="number"
                    min={0}
                    step={0.5}
                    value={estimate.hourlyRateMillions}
                    aria-label={t('aria.hourlyPriceMillions')}
                    onValueChange={(hourlyRateMillions) => onChange({ ...estimate, hourlyRateMillions })}
                  />
                </UnitInput>
              </div>
              <div>
                <UnitInput suffix={t('common.millionExpPerHour')}>
                  <EditableNumberInput
                    appearance="grouped"
                    type="number"
                    min={0}
                    step={0.01}
                    value={estimate.expPerHourMillions}
                    normalize={normalizeNonNegativeHundredth}
                    aria-label={t('aria.expRateMillions')}
                    onValueChange={(expPerHourMillions) => onChange({ ...estimate, expPerHourMillions })}
                  />
                </UnitInput>
              </div>
            </div>
          )}
        </FlowCard>

        <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/70 dark:bg-indigo-950/30">
          <div className="col-span-full p-3">
            <StepHeading step="4" title={t('calculator.result')} />
          </div>
          <button
            type="button"
            className={cx(
              'col-span-full min-h-0 border-0 border-t border-indigo-100 p-3 text-left shadow-none transition dark:border-indigo-900/50',
              costCopied
                ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-transparent text-indigo-800 hover:bg-indigo-100/70 dark:text-indigo-300 dark:hover:bg-indigo-950/60',
            )}
            aria-label={costCopied ? t('aria.estimatedCostCopied') : t('aria.copyEstimatedCost')}
            onClick={() => void copyEstimatedCost()}
          >
            <Stat
              label={(
                <span className="inline-flex items-center gap-1.5" aria-live="polite">
                  {costCopied ? t('common.copied') : t('calculator.estimatedCost')}
                  {costCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                </span>
              )}
              value={formatMesosShort(estimatedCost)}
              detail={formatMesosValue(estimatedCost)}
              labelClassName="uppercase tracking-wide text-current"
              valueClassName="text-2xl text-current dark:text-current"
              detailClassName="text-current dark:text-current"
            />
          </button>
          <Stat
            className={cx(
              'border-t border-indigo-100 p-3 dark:border-indigo-900/50',
              estimate.billingType === 'ratio' && 'col-span-full',
            )}
            label={t('calculator.expNeeded')}
            value={formatCompact(result.expNeeded)}
            detail={formatExp(result.expNeeded)}
            valueClassName="text-lg"
          />
          {estimate.billingType === 'hourly' ? (
            <Stat
              className="border-t border-indigo-100 p-3 dark:border-indigo-900/50"
              label={t('calculator.expectedTime')}
              value={formatDuration(result.expectedDurationMs)}
              detail={formatHours(result.expectedDurationMs)}
              valueClassName="text-lg"
            />
          ) : null}
        </div>
      </div>
    </Surface>
  );
}

function TimerControls({
  billing,
  onReset,
  onToggle,
  now,
}: {
  billing: Extract<LeechBilling, { type: 'hourly' }>;
  onReset: () => void;
  onToggle: () => void;
  now: number;
}) {
  const { t } = useTranslation();
  const billableMs = getBillableMs(billing.timer, now);
  const isRunning = billing.timer.status === 'running';

  return (
    <div
      className={cx(
        'grid gap-3 rounded-xl border p-3',
        billing.timer.status === 'running'
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/30'
          : billing.timer.status === 'paused'
            ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/30'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('timer.runTime')}</span>
        <small className={cx(
          'inline-flex items-center gap-1.5 text-xs font-semibold',
          billing.timer.status === 'running'
            ? 'text-emerald-700 dark:text-emerald-300'
            : billing.timer.status === 'paused'
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-slate-500 dark:text-slate-400',
        )}>{timerStatusLabel(billing.timer.status, t)}</small>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="font-mono text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          <strong>{formatDuration(billableMs)}</strong>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          <Button
            type="button"
            className="max-sm:flex-1"
            onClick={onToggle}
            aria-label={isRunning ? t('aria.pauseTimer') : t('aria.startTimer')}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? t('timer.pause') : t('timer.start')}
          </Button>
          <Button type="button" variant="secondary" className="max-sm:flex-1" onClick={onReset} disabled={isRunning}>
            <RotateCcw size={16} /> {t('common.reset')}
          </Button>
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
  const { t } = useTranslation();
  const [startDraft, setStartDraft] = useState<DraftSnapshotState>({ level: buyer.start?.level ?? 120, expPercent: buyer.start?.expPercent ?? 0 });
  const [currentDraft, setCurrentDraft] = useState<DraftSnapshotState>({ level: buyer.current?.level ?? buyer.start?.level ?? 120, expPercent: buyer.current?.expPercent ?? 0 });
  const [refreshingSnapshot, setRefreshingSnapshot] = useState<'start' | 'current' | null>(null);
  const [completionPreviewSuppressed, setCompletionPreviewSuppressed] = useState(false);
  const calc = calculateBuyer(buyer, instance.billing, now, instance.buyers);
  const due = instance.billing.type === 'ratio' ? calc.ratioMesosDue : calc.hourlyMesosDue;
  const buyerBillableMs = instance.billing.type === 'hourly' ? getBuyerBillableMs(buyer, now) : undefined;
  const buyerTimerRunning = instance.billing.type === 'hourly' && isBuyerHourlyTimerRunning(buyer);
  const lookupIgn = buyerLookupIgn(buyer);
  const displayIgn = lookupIgn || t('buyer.fallback');
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
    if (buyer.start && !confirmSnapshotOverwrite(t('confirm.refreshSnapshot', { label: t('common.start').toLowerCase() }))) return;
    setRefreshingSnapshot('start');
    try {
      const snapshot = await onFetchSnapshot(lookupIgn);
      const nextBuyer = { ...buyer, ign: snapshot.ign, start: snapshot, current: buyer.current ?? snapshot };
      const nowIso = new Date().toISOString();
      onUpdate(instance.billing.type === 'hourly' && instance.billing.timer.status === 'running' && !locked
        ? startBuyerHourlyTimer(ensureBuyerHourlyState(nextBuyer), nowIso)
        : nextBuyer);
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
    const snapshot = makeManualSnapshot(lookupIgn, nextDraft, t('buyer.entered'));
    const nextBuyer = { ...buyer, ign: buyer.ign || snapshot.ign, start: snapshot, current: buyer.current ?? snapshot };
    const nowIso = new Date().toISOString();
    onUpdate(instance.billing.type === 'hourly' && instance.billing.timer.status === 'running' && !locked
      ? startBuyerHourlyTimer(ensureBuyerHourlyState(nextBuyer), nowIso)
      : nextBuyer);
  }

  function commitCurrentDraft(nextDraft = currentDraft) {
    if (!draftDiffersFromSnapshot(nextDraft, buyer.current)) return;
    const snapshot = makeManualSnapshot(lookupIgn, nextDraft, t('buyer.entered'));
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

  function toggleBuyerDone() {
    if (instance.billing.type !== 'hourly') {
      onUpdate({ ...buyer, locked: !locked });
      return;
    }
    if (!locked) {
      onUpdate({ ...pauseBuyerHourlyTimer(ensureBuyerHourlyState(buyer), now), locked: true });
      return;
    }
    const nowIso = new Date(now).toISOString();
    const prepared = instance.billing.timer.status === 'running' && buyer.start
      ? startBuyerHourlyTimer(ensureBuyerHourlyState(buyer), nowIso)
      : ensureBuyerHourlyState(buyer);
    onUpdate({ ...prepared, locked: false });
  }

  return (
    <Surface as="article" radius="xl" className="overflow-hidden">
      <div className={cx(
          'grid grid-cols-[minmax(11rem,0.9fr)_minmax(0,2.5fr)_auto] items-center gap-4 p-4 max-lg:grid-cols-1',
          locked && 'bg-slate-50 opacity-75 dark:bg-slate-950/40',
        )}>
        <div className="flex min-w-0 items-center gap-3">
          {lookupIgn ? (
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
              <img className="h-full w-full object-contain" src={avatarUrl(lookupIgn, !locked)} alt="" loading="lazy" />
            </div>
          ) : (
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500"><UserPlus size={18} /></div>
          )}
          <div className="min-w-0">
            <strong className="block truncate text-sm font-bold text-slate-950 dark:text-white">{buyer.ign || t('buyer.placeholderName')}</strong>
            {job || guild ? (
              <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
                {job ? <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400" aria-label={t('aria.job', { job })} title={job}>{job}</span> : null}
                {guild ? <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400" aria-label={t('aria.guild', { guild })} title={guild}>{guild}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800 max-lg:grid-cols-2 max-lg:divide-x-0 max-lg:gap-y-3 max-sm:grid-cols-1">
          <Stat
            className="gap-0.5 px-3 first:pl-0 max-lg:px-0"
            label={t('common.start')}
            value={snapshotShort(buyer.start, t)}
            detail={buyer.start ? formatLocalDateTime(buyer.start.capturedAt) : undefined}
            labelClassName="uppercase tracking-wide text-slate-400"
            valueClassName="text-sm"
          />
          <Stat
            className="gap-0.5 px-3 first:pl-0 max-lg:px-0"
            label={t('common.current')}
            value={snapshotShort(buyer.current, t)}
            detail={buyer.current ? formatLocalDateTime(buyer.current.capturedAt) : undefined}
            labelClassName="uppercase tracking-wide text-slate-400"
            valueClassName="text-sm"
          />
          {instance.billing.type === 'hourly' ? (
            <Stat
              className="gap-0.5 px-3 first:pl-0 max-lg:px-0"
              label={t('buyer.billableTime')}
              value={formatDuration(buyerBillableMs)}
              detail={buyerTimerRunning ? t('timer.running') : t('timer.paused')}
              labelClassName="uppercase tracking-wide text-slate-400"
              valueClassName="text-sm"
            />
          ) : (
            <Stat
              className="gap-0.5 px-3 first:pl-0 max-lg:px-0"
              label={t('buyer.expGained')}
              value={formatCompact(calc.expGained)}
              detail={formatExp(calc.expGained)}
              labelClassName="uppercase tracking-wide text-slate-400"
              valueClassName="text-sm"
            />
          )}
          <div
            className={cx(
              'min-w-0 cursor-pointer rounded-lg px-3 py-1 outline-none transition first:pl-0 max-lg:px-2',
              'focus-visible:ring-4 focus-visible:ring-indigo-500/20',
              dueCopied
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70',
            )}
            role="button"
            tabIndex={0}
            aria-label={dueCopied ? t('aria.dueCopied', { name: displayIgn }) : t('aria.copyDue', { name: displayIgn })}
            onClick={() => void copyDue()}
            onKeyDown={handleDueKeyDown}
          >
            <Stat
              className="gap-0.5"
              label={(
                <span className="inline-flex items-center gap-1.5" aria-live="polite">
                  {dueCopied ? t('common.copied') : t('common.due')}
                  {dueCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                </span>
              )}
              value={formatMesosShortPrecise(due)}
              detail={formatMesosValue(due)}
              labelClassName="uppercase tracking-wide text-current dark:text-current"
              valueClassName="text-sm text-current dark:text-current"
              detailClassName="text-current dark:text-current"
            />
          </div>
        </div>
        <div className="flex gap-1 self-start md:flex-col">
          <IconButton
            type="button"
            className={cx(
              'group',
              locked
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300',
            )}
            onClick={() => {
              setCompletionPreviewSuppressed(true);
              toggleBuyerDone();
            }}
            onPointerLeave={() => setCompletionPreviewSuppressed(false)}
            onBlur={() => setCompletionPreviewSuppressed(false)}
            aria-label={locked ? t('aria.reopenBuyer', { name: displayIgn }) : t('aria.markBuyerDone', { name: displayIgn })}
            aria-pressed={locked}
          >
            <span
              className={completionPreviewSuppressed ? 'inline-flex' : 'group-hover:hidden group-focus-visible:hidden'}
              aria-hidden="true"
            >
              {locked ? <CircleCheckBig size={16} /> : <CircleDashed size={16} />}
            </span>
            <span
              className={completionPreviewSuppressed ? 'hidden' : 'hidden group-hover:inline-flex group-focus-visible:inline-flex'}
              aria-hidden="true"
            >
              {locked ? <CircleDashed size={16} /> : <CircleCheckBig size={16} />}
            </span>
          </IconButton>
          <IconButton type="button" variant="danger" onClick={onDelete} aria-label={t('aria.removeBuyer', { name: displayIgn })}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      {!locked ? (
        <details className="border-t border-slate-200 dark:border-slate-800">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-indigo-600 outline-none hover:bg-slate-50 dark:text-indigo-300 dark:hover:bg-slate-800/50">{t('buyer.edit')}</summary>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50/60 p-3 max-lg:grid-cols-1 dark:border-slate-800 dark:bg-slate-950/30">
            <SnapshotSummary
              title={t('common.start')}
              tone="start"
              snapshot={buyer.start}
              draft={startDraft}
              refreshLabel={t('snapshot.fetchStartExp')}
              refreshDisabled={busy || !lookupIgn}
              refreshing={refreshingSnapshot === 'start'}
              onDraftChange={setStartDraft}
              onCommitDraft={commitStartDraft}
              onRefresh={fetchStart}
            />

            <SnapshotSummary
              title={t('common.current')}
              tone="current"
              snapshot={buyer.current}
              draft={currentDraft}
              refreshLabel={t('snapshot.refreshExp')}
              refreshDisabled={busy || !lookupIgn}
              refreshing={refreshingSnapshot === 'current'}
              onDraftChange={setCurrentDraft}
              onCommitDraft={commitCurrentDraft}
              onRefresh={fetchCurrent}
            />
          </div>
        </details>
      ) : null}
    </Surface>
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
  onFetchSnapshots,
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
  onFetchSnapshots: (igns: string[]) => Promise<CharacterBatch>;
  copiedBuyerId: string | null;
  onDueCopied: (buyerId: string) => void;
}) {
  const { t } = useTranslation();
  const [newBuyerIgn, setNewBuyerIgn] = useState('');
  const [ratioTierLevelDraft, setRatioTierLevelDraft] = useState('');
  const [addingBuyer, setAddingBuyer] = useState(false);
  const [refreshingRun, setRefreshingRun] = useState(false);
  const refreshExpTipId = useId();
  const ratioTierLevelId = useId();
  const ratioBilling = instance.billing.type === 'ratio' ? instance.billing : undefined;
  const hourlyBilling = instance.billing.type === 'hourly' ? instance.billing : undefined;
  const refreshableBuyers = instance.buyers.filter((buyer) => !buyer.locked && buyerLookupIgn(buyer));
  const ratioTierLevel = Number(ratioTierLevelDraft);
  const canAddRatioTier = Boolean(
    ratioBilling
    && ratioBilling.tiers.length < 200
    && Number.isInteger(ratioTierLevel)
    && ratioTierLevel >= 1
    && ratioTierLevel <= 200
    && !ratioBilling.tiers.some((tier) => tier.minLevel === ratioTierLevel),
  );

  function updateBilling(billing: LeechBilling) {
    onUpdate(updateInstanceBilling(instance, billing));
  }

  function addRatioTier() {
    if (!ratioBilling || !canAddRatioTier) return;
    const precedingTier = ratioBilling.tiers.filter((tier) => tier.minLevel < ratioTierLevel).at(-1);
    const expPerMesoRatio = precedingTier?.expPerMesoRatio ?? ratioBilling.expPerMesoRatio;

    updateBilling({
      ...ratioBilling,
      tiers: [...ratioBilling.tiers, { minLevel: ratioTierLevel, expPerMesoRatio }]
        .sort((left, right) => left.minLevel - right.minLevel),
    });
    setRatioTierLevelDraft('');
  }

  function updateRatioTierRatio(minLevel: number, expPerMesoRatio: number) {
    if (!ratioBilling) return;
    updateBilling({
      ...ratioBilling,
      tiers: ratioBilling.tiers.map((tier) => (
        tier.minLevel === minLevel ? { ...tier, expPerMesoRatio } : tier
      )),
    });
  }

  function removeRatioTier(minLevel: number) {
    if (!ratioBilling) return;
    updateBilling({ ...ratioBilling, tiers: ratioBilling.tiers.filter((tier) => tier.minLevel !== minLevel) });
  }

  function setBillingType(type: BillingType) {
    onUpdate(switchInstanceBillingType(instance, type, now));
  }

  async function addBuyerFromInput() {
    const ign = newBuyerIgn.trim();
    if (!ign) return;

    setAddingBuyer(true);
    try {
      const snapshot = await onFetchSnapshot(ign);
      const buyer: LeechBuyer = {
        id: createId('buyer'),
        ign: snapshot.ign,
        start: snapshot,
        current: snapshot,
        hourly: instance.billing.type === 'hourly' ? { sessions: [] } : undefined,
      };
      const nowIso = new Date().toISOString();
      onUpdate({
        ...instance,
        buyers: [
          ...instance.buyers,
          instance.billing.type === 'hourly' && instance.billing.timer.status === 'running'
            ? startBuyerHourlyTimer(ensureBuyerHourlyState(buyer), nowIso)
            : buyer,
        ],
      });
      setNewBuyerIgn('');
    } catch {
      const buyer: LeechBuyer = {
        id: createId('buyer'),
        ign,
        hourly: instance.billing.type === 'hourly' ? { sessions: [] } : undefined,
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
    try {
      const batch = await onFetchSnapshots(refreshableBuyers.map(buyerLookupIgn));
      const refreshedAt = batch.snapshots.size > 0 ? new Date().toISOString() : instance.lastCurrentRefreshedAt;
      onUpdate({
        ...instance,
        lastCurrentRefreshedAt: refreshedAt,
        buyers: instance.buyers.map((buyer) => {
          const snapshot = batch.snapshots.get(buyerLookupIgn(buyer).toLocaleLowerCase());
          return snapshot ? { ...buyer, ign: snapshot.ign, current: snapshot } : buyer;
        }),
      });
    } finally {
      setRefreshingRun(false);
    }
  }

  function toggleHourlyRunTimer() {
    if (instance.billing.type !== 'hourly') return;
    const isRunning = instance.billing.timer.status === 'running';
    const nowIso = new Date().toISOString();
    const billing = {
      ...instance.billing,
      timer: isRunning ? pauseTimer(instance.billing.timer, now) : startTimer(instance.billing.timer, nowIso),
    };

    onUpdate({
      ...instance,
      billing,
      buyers: instance.buyers.map((buyer) => {
        if (buyer.locked) return buyer;
        if (isRunning) return pauseBuyerHourlyTimer(ensureBuyerHourlyState(buyer), now);
        if (!buyer.start) return buyer;
        return startBuyerHourlyTimer(ensureBuyerHourlyState(buyer), nowIso);
      }),
    });
  }

  function resetHourlyRunTimer() {
    if (instance.billing.type !== 'hourly') return;
    if (!confirmTimerReset(t('confirm.resetTimer'))) return;
    onUpdate({
      ...instance,
      billing: { ...instance.billing, timer: resetTimer() },
      buyers: instance.buyers.map((buyer) => ({
        ...buyer,
        hourly: { sessions: [] },
      })),
    });
  }

  return (
    <Surface
      className={cx(
        'overflow-hidden',
        highlighted && 'ring-4 ring-indigo-500/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div>
          <input
            className="min-h-0 w-full border-0 bg-transparent p-0 text-xl font-bold tracking-tight text-slate-950 shadow-none outline-none placeholder:text-slate-400 focus:ring-0 dark:text-white"
            value={instance.name}
            onChange={(event) => onUpdate({ ...instance, name: event.target.value })}
            aria-label={t('run.nameLabel', { number: index + 1 })}
          />
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {instance.billing.type === 'ratio'
              ? t('billing.ratioModeSummary', { label: compactBillingLabel(instance.billing, t) })
              : t('billing.hourlyModeSummary', { label: billingLabel(instance.billing, t) })} · {t('run.created', { date: formatLocalDateTime(instance.createdAt) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl role="group" aria-label={t('billing.type')}>
            <SegmentedControlButton type="button" aria-pressed={instance.billing.type === 'ratio'} onClick={() => setBillingType('ratio')}>
              {t('billing.ratio')}
            </SegmentedControlButton>
            <SegmentedControlButton type="button" aria-pressed={instance.billing.type === 'hourly'} onClick={() => setBillingType('hourly')}>
              {t('billing.hourly')}
            </SegmentedControlButton>
          </SegmentedControl>
          <IconButton type="button" variant="danger" onClick={onDelete} aria-label={t('run.delete')}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <div className={cx(
          'grid gap-3 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30',
          instance.billing.type === 'hourly' && 'lg:grid-cols-[minmax(12rem,0.8fr)_minmax(20rem,1.2fr)]',
        )}>
        <div className="min-w-0">
          {ratioBilling ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <label className="grid gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('billing.baseRatio')}
                  <RatioInput
                    className="w-full"
                    value={ratioBilling.expPerMesoRatio}
                    ariaLabel={t('aria.runExpRatio')}
                    onValueChange={(expPerMesoRatio) => updateBilling({ ...ratioBilling, expPerMesoRatio })}
                  />
                </label>
              </div>
              {ratioBilling.tiers.map((tier, index) => (
                <div className="min-w-44 flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" key={tier.minLevel}>
                  <div className="grid gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('billing.tierLevel')} {tier.minLevel}</span>
                    <div className="flex items-center gap-2">
                      <RatioInput
                        className="w-full"
                        value={tier.expPerMesoRatio}
                        ariaLabel={t('aria.ratioTierRatio', { number: index + 1 })}
                        onValueChange={(expPerMesoRatio) => updateRatioTierRatio(tier.minLevel, expPerMesoRatio)}
                      />
                      <IconButton
                        type="button"
                        variant="danger"
                        onClick={() => removeRatioTier(tier.minLevel)}
                        aria-label={t('aria.removeRatioTier', { number: index + 1 })}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
              <div className="min-w-44 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={ratioTierLevelId}>{t('billing.tierLevel')}</label>
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addRatioTier();
                  }}
                >
                  <input
                    id={ratioTierLevelId}
                    className={cx(inputClass, 'flex-1')}
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={ratioTierLevelDraft}
                    placeholder="120"
                    aria-label={t('aria.ratioTierLevel', { number: ratioBilling.tiers.length + 1 })}
                    onChange={(event) => setRatioTierLevelDraft(event.target.value)}
                  />
                  <IconButton
                    type="submit"
                    className="w-auto px-3"
                    aria-label={t('billing.addTier')}
                    disabled={!canAddRatioTier}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span className="hidden 2xl:inline" aria-hidden="true">
                      {t('billing.addTier')}
                    </span>
                  </IconButton>
                </form>
              </div>
            </div>
          ) : null}
          {hourlyBilling ? (
            <label className="grid max-w-sm gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('billing.hourlyRate')}
              <UnitInput suffix={t('common.millionPerHourSpaced')}>
                <input
                  className={groupedInputClass}
                  type="number"
                  min={0}
                  step={0.5}
                  value={hourlyBilling.hourlyRateMesos / 1_000_000}
                  aria-label={t('aria.runHourlyPriceMillions')}
                  onChange={(event) => updateBilling({ ...hourlyBilling, hourlyRateMesos: Number(event.target.value) * 1_000_000 })}
                />
              </UnitInput>
            </label>
          ) : null}
        </div>
        {hourlyBilling ? (
          <TimerControls
            billing={hourlyBilling}
            now={now}
            onReset={resetHourlyRunTimer}
            onToggle={toggleHourlyRunTimer}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">{t('buyer.buyers')}</h3>
          {instance.lastCurrentRefreshedAt ? (
            <small className="text-xs text-slate-500 dark:text-slate-400">{t('snapshot.refreshed')} <time dateTime={instance.lastCurrentRefreshedAt}>{formatLocalDateTime(instance.lastCurrentRefreshedAt)}</time></small>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch">
          <InputGroup
            as="form"
            onSubmit={(event) => {
              event.preventDefault();
              void addBuyerFromInput();
            }}
          >
            <input
              className={groupedInputClass}
              aria-label={t('buyer.ign')}
              value={newBuyerIgn}
              onChange={(event) => setNewBuyerIgn(event.target.value)}
              placeholder={t('buyer.ign')}
            />
            <Button
              type="submit"
              className="rounded-none shadow-none"
              aria-label={addingBuyer ? t('buyer.adding') : t('buyer.add')}
              aria-busy={addingBuyer}
              disabled={addingBuyer || !newBuyerIgn.trim()}
            >
              {addingBuyer ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} {t('common.add')}
            </Button>
          </InputGroup>
          <Tooltip className="max-sm:w-full">
            <Button
              type="button"
              variant="secondary"
              className="max-sm:w-full"
              onClick={refreshRunCurrentExp}
              disabled={refreshingRun || refreshableBuyers.length === 0}
              aria-describedby={refreshExpTipId}
            >
              <RefreshCw size={16} className={refreshingRun ? 'animate-spin' : undefined} /> {refreshingRun ? t('common.refreshing') : t('common.refreshExp')}
            </Button>
            <TooltipContent id={refreshExpTipId} className="grid gap-2" role="tooltip">
              <strong className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300"><AlertCircle size={14} /> {t('tip.updateExpBeforeRefreshing')}</strong>
              <span className="grid gap-0.5"><b className="text-slate-900 dark:text-white">{t('tip.partyUpdateTitle')}</b><em className="not-italic text-slate-500 dark:text-slate-400">{t('tip.partyUpdateBody')}</em></span>
              <span className="grid gap-0.5"><b className="text-slate-900 dark:text-white">{t('tip.selfUpdateTitle')}</b><em className="not-italic text-slate-500 dark:text-slate-400">{t('tip.selfUpdateBody')}</em></span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {instance.buyers.length > 0 ? (
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30">
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
                const name = buyerLookupIgn(buyer) || t('buyer.thisCharacter');
                if (!isEmptyBuyer(buyer) && !confirmDeletion(t('confirm.deleteBuyer', { name, run: instance.name }))) return;
                onUpdate({ ...instance, buyers: instance.buyers.filter((item) => item.id !== buyer.id) });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
          <UserPlus size={24} className="text-slate-400" />
          <strong className="text-slate-900 dark:text-white">{t('buyer.noBuyersTitle')}</strong>
          <span>{t('buyer.noBuyersBody')}</span>
        </div>
      )}
    </Surface>
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
  const { t } = useTranslation();
  return (
    <Surface as="aside" className="self-start p-3 md:sticky md:top-5" aria-label={t('run.railLabel')}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <span className="block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">{t('run.railKicker')}</span>
          <strong>{t('run.active', { count: instances.length })}</strong>
        </div>
        <IconButton type="button" onClick={onAdd} aria-label={t('run.new')}>
          <Plus size={17} />
        </IconButton>
      </div>

      <label className="relative block md:hidden">
        <select className={cx(selectClass, 'w-full')} value={selectedRunId ?? ''} onChange={(event) => onSelect(event.target.value)} aria-label={t('run.selected')}>
          {instances.map((instance) => {
            const summary = calculateInstance(instance, now);
            return (
              <option key={instance.id} value={instance.id}>
                {instance.name || t('common.untitledRun')} · {compactBillingLabel(instance.billing, t)} · {formatMesosShort(summary.totalMesosDue)}
              </option>
            );
          })}
        </select>
      </label>

      <div className="hidden gap-1.5 md:grid">
        {instances.map((instance) => {
          const summary = calculateInstance(instance, now);
          const selected = instance.id === selectedRunId;
          return (
            <button
              key={instance.id}
              type="button"
              className={cx(
                'grid min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left shadow-none transition',
                selected
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-100 hover:bg-indigo-100 dark:border-indigo-900/70 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-900/50'
                  : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/70',
              )}
              onClick={() => onSelect(instance.id)}
              aria-current={selected ? 'true' : undefined}
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm font-bold">{instance.name || t('common.untitledRun')}</strong>
                <small className="block truncate text-xs">{compactBillingLabel(instance.billing, t)}</small>
              </span>
              <span className="min-w-0 text-right">
                <b className="block text-sm font-bold">{formatMesosShort(summary.totalMesosDue)}</b>
                <small className="block truncate text-xs">{t('buyer.count', { count: summary.buyerCount })}</small>
              </span>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}

function RunTools({ instance, now }: { instance: LeechInstance; now: number }) {
  const { t } = useTranslation();
  const [totalDueCopied, setTotalDueCopied] = useState(false);
  const totalDueCopyFeedbackTimerRef = useRef<number | null>(null);
  const summary = calculateInstance(instance, now);

  function clearTotalDueCopyFeedbackTimer() {
    if (totalDueCopyFeedbackTimerRef.current === null) return;
    window.clearTimeout(totalDueCopyFeedbackTimerRef.current);
    totalDueCopyFeedbackTimerRef.current = null;
  }

  useEffect(() => {
    return clearTotalDueCopyFeedbackTimer;
  }, []);

  useEffect(() => {
    clearTotalDueCopyFeedbackTimer();
    setTotalDueCopied(false);
  }, [summary.totalMesosDue]);

  async function copyTotalDue() {
    const roundedDue = Math.max(0, Math.round(summary.totalMesosDue));
    try {
      await navigator.clipboard.writeText(String(roundedDue));
      setTotalDueCopied(true);
      clearTotalDueCopyFeedbackTimer();
      totalDueCopyFeedbackTimerRef.current = window.setTimeout(() => setTotalDueCopied(false), COPY_FEEDBACK_MS);
    } catch {}
  }

  return (
    <Surface className="grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>{t('status.heading')}</h2>
        </div>
      </div>
      <button
        type="button"
        className={cx(
          'min-h-0 rounded-xl border p-3 text-left shadow-none transition',
          totalDueCopied
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900/70 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70',
        )}
        aria-label={totalDueCopied ? t('aria.totalDueCopied', { defaultValue: 'Total due copied' }) : t('aria.copyTotalDue', { defaultValue: 'Copy total due' })}
        onClick={() => void copyTotalDue()}
      >
        <Stat
          label={(
            <span className="inline-flex items-center gap-1.5" aria-live="polite">
              {totalDueCopied ? t('common.copied') : t('status.totalDue')}
              {totalDueCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            </span>
          )}
          value={formatMesosShort(summary.totalMesosDue)}
          detail={formatMesosValue(summary.totalMesosDue)}
          labelClassName="uppercase tracking-wide text-current dark:text-current"
          valueClassName="text-3xl font-extrabold tracking-tight text-current dark:text-current"
          detailClassName="text-current dark:text-current"
        />
      </button>
      <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
        <Stat
          className="p-3"
          label={t('status.buyers')}
          value={summary.buyerCount}
          detail={summary.doneBuyerCount > 0 ? t('buyer.done', { count: summary.doneBuyerCount }) : t('buyer.allActive')}
          valueClassName="text-2xl tracking-tight"
        />
        <Stat
          className="p-3"
          label={t('status.totalExp')}
          value={formatCompact(summary.totalExpGained)}
          detail={formatExp(summary.totalExpGained)}
          valueClassName="text-2xl tracking-tight"
        />
      </div>
    </Surface>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [instances, setInstances] = useLocalStorage<LeechInstance[]>(
    INSTANCES_STORAGE_KEY,
    initialInstances(),
    (value) => normalizeInstances(value, initialInstances()),
  );
  const [estimate, setEstimate] = useLocalStorage<QuickEstimateState>(ESTIMATE_STORAGE_KEY, DEFAULT_ESTIMATE);
  const [theme, setTheme] = useLocalStorage<ThemeMode>(THEME_STORAGE_KEY, 'system');
  const [notice, setNotice] = useState<Notice>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [highlightedRunId, setHighlightedRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useLocalStorage<string | null>(
    SELECTED_RUN_STORAGE_KEY,
    null,
    (value) => (typeof value === 'string' ? value : null),
  );
  const [copiedBuyerId, setCopiedBuyerId] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const displayedInstances = useMemo(() => [...instances].sort((a, b) => createdAtMs(b) - createdAtMs(a)), [instances]);

  useEffect(() => {
    const hasRunningTimer = instances.some((instance) => (
      instance.billing.type === 'hourly'
      && (instance.billing.timer.status === 'running' || instance.buyers.some(isBuyerHourlyTimerRunning))
    ));
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
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    if (!notice?.transient) return;
    const id = window.setTimeout(() => setNotice(null), SUCCESS_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (instances.length === 0) {
      setSelectedRunId(null);
      return;
    }
    if (selectedRunId && instances.some((instance) => instance.id === selectedRunId)) return;
    setSelectedRunId(displayedInstances[0].id);
  }, [displayedInstances, instances, selectedRunId, setSelectedRunId]);

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
    copyFeedbackTimerRef.current = window.setTimeout(() => setCopiedBuyerId(null), COPY_FEEDBACK_MS);
  }

  async function loadCharacter(ign: string): Promise<CharacterSnapshot> {
    const cleanIgn = ign.trim();
    setNotice(null);
    setBusyKey(`character:${cleanIgn}`);
    try {
      return await fetchCharacter(cleanIgn);
    } catch (error) {
      const text = error instanceof Error ? error.message : t('notice.refreshCharacterFailed');
      setNotice({ type: 'error', text });
      throw error;
    } finally {
      setBusyKey(null);
    }
  }

  async function loadCharacters(igns: string[]): Promise<CharacterBatch> {
    setNotice(null);
    try {
      const batch = await fetchCharacters(igns);
      const refreshed = batch.snapshots.size;
      setNotice({
        type: batch.failures.length > 0 ? 'error' : 'info',
        transient: batch.failures.length === 0,
        text: batch.failures.length > 0
          ? t('notice.batchRefreshPartial', { refreshed, failed: batch.failures.length })
          : t('notice.batchRefreshSuccess', { count: refreshed }),
      });
      return batch;
    } catch (error) {
      const text = error instanceof Error ? error.message : t('notice.refreshCharacterFailed');
      setNotice({ type: 'error', text });
      throw error;
    }
  }

  const selectedInstance = useMemo(
    () => displayedInstances.find((instance) => instance.id === selectedRunId) ?? displayedInstances[0],
    [displayedInstances, selectedRunId],
  );

  return (
    <main className="scheme-light dark:scheme-dark mx-auto min-h-screen max-w-[1800px] bg-slate-100 p-3 text-slate-950 sm:p-5 lg:p-6 dark:bg-slate-950 dark:text-slate-100">
      <Surface as="header" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/assets/icons/hs.png" alt="" className="size-11 rounded-xl bg-indigo-50 p-1.5 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20" />
          <div>
            <span className="text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">{t('app.name')}</span>
            <p>{t('app.tagline')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeSwitch theme={theme} onChange={setTheme} />
          <LanguageSelect />
          <Button type="button" variant="secondary" onClick={() => exportInstances(instances, t, now)} disabled={instances.length === 0}>
            <Download size={16} /> {t('topbar.exportCsv')}
          </Button>
        </div>
      </Surface>

      {notice ? (
        <div className={cx(
          'mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm',
          notice.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300'
            : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300',
        )} role={notice.type === 'error' ? 'alert' : 'status'}>
          <AlertCircle size={18} />
          <span>{notice.text}</span>
          <button type="button" className="ml-auto grid size-8 min-h-0 shrink-0 place-items-center rounded-full bg-transparent p-0 text-current shadow-none hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setNotice(null)} aria-label={t('common.dismiss')}>
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
        <RunRail instances={displayedInstances} selectedRunId={selectedInstance?.id ?? null} now={now} onSelect={setSelectedRunId} onAdd={addInstance} />

        <section className="min-w-0 md:col-start-2 xl:col-start-2" aria-label={t('run.selectedLedger')}>
          {selectedInstance ? (
            <LeechInstanceCard
              key={selectedInstance.id}
              instance={selectedInstance}
              index={displayedInstances.findIndex((instance) => instance.id === selectedInstance.id)}
              highlighted={selectedInstance.id === highlightedRunId}
              busyKey={busyKey}
              now={now}
              onFetchSnapshot={loadCharacter}
              onFetchSnapshots={loadCharacters}
              copiedBuyerId={copiedBuyerId}
              onDueCopied={showCopiedBuyer}
              onUpdate={upsertInstance}
              onDelete={() => {
                if (!isEmptyInstance(selectedInstance) && !confirmDeletion(t('confirm.deleteRun', { name: selectedInstance.name }))) return;
                setInstances((current) => (current.length <= 1 ? [emptyInstance()] : current.filter((item) => item.id !== selectedInstance.id)));
              }}
            />
          ) : null}
        </section>

        <aside className="grid min-w-0 gap-4 md:col-start-2 xl:col-start-3 xl:row-start-1 xl:self-start xl:sticky xl:top-5">
          {selectedInstance ? <RunTools instance={selectedInstance} now={now} /> : null}
          <QuickEstimate estimate={estimate} onChange={setEstimate} />
        </aside>
      </div>
    </main>
  );
}
