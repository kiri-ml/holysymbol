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
import { DEFAULT_RATIO_BILLING, switchInstanceBillingType, updateInstanceBilling } from './domain/billing';
import { applyCurrentSnapshots, buyerLookupIgn } from './domain/buyers';
import { createManualSnapshot } from './domain/character';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBuyerBillableMs,
  getBillableMs,
  isBuyerHourlyTimerRunning,
  pauseHourlyBilling,
  removeHourlyAccount,
  resetHourlyBilling,
  setHourlyAccountActive,
  startHourlyBilling,
} from './domain/calculator';
import { formatCompact, formatDuration, formatExp, formatHours, formatLocalDateTime, formatMesosShort, formatMesosShortPrecise, formatMesosValue, formatPercent, formatRatio, formatRatioRange } from './domain/format';
import { createId } from './domain/id';
import { createInstanceWithBillingSettings } from './domain/instances';
import type {
  BillingType,
  BuyerId,
  CharacterSnapshot,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  TimerStatus,
} from './domain/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useInstancesStorage } from './hooks/useInstancesStorage';
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
    nextBuyerId: 0,
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
  return instance.billing.ledger.status === 'idle' && instance.billing.ledger.accumulatedMs === 0;
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
        instance.billing.type === 'hourly' ? getBuyerBillableMs(instance.billing, buyer.id, now) : undefined,
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

function updateBuyer(instance: LeechInstance, buyerId: BuyerId, updater: (buyer: LeechBuyer) => LeechBuyer): LeechInstance {
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

  return (
    <div className={`snapshot-summary snapshot-summary--${tone}`}>
      <div className="snapshot-summary__head">
        <div>
          <span>{title}</span>
          <strong>{snapshotShort(snapshot, t)}</strong>
        </div>
        <button type="button" className="icon-button snapshot-refresh-button" onClick={onRefresh} disabled={refreshDisabled} aria-label={refreshLabel}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      <small>{snapshot ? `${formatLocalDateTime(snapshot.capturedAt)} · ${sourceLabel}` : t('snapshot.emptyPrompt')}</small>
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
  const { t } = useTranslation();
  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: 'light', label: t('theme.light'), icon: <Sun size={15} /> },
    { value: 'system', label: t('theme.system'), icon: <Monitor size={15} /> },
    { value: 'dark', label: t('theme.dark'), icon: <Moon size={15} /> },
  ];

  return (
    <div className="theme-switch segmented-control topbar-control" role="group" aria-label={t('theme.label')}>
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

function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const selectedLanguage = isSupportedLocale(i18n.resolvedLanguage ?? '')
    ? i18n.resolvedLanguage
    : isSupportedLocale(i18n.language)
      ? i18n.language
      : DEFAULT_LOCALE;

  return (
    <label className="language-select">
      <Languages size={15} aria-hidden="true" />
      <select
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
    <span className={`ratio-input${className ? ` ${className}` : ''}`}>
      <span>{t('common.ratioPrefix')}</span>
      <EditableNumberInput
        type="number"
        min={0.1}
        step={0.1}
        value={value}
        emptyValue={0.1}
        normalize={(nextValue) => Math.max(0.1, nextValue)}
        aria-label={ariaLabel}
        onValueChange={onValueChange}
      />
    </span>
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
    <div className="level-exp-grid" onBlur={handleBlur}>
      <label>
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
      <label>
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
    <div className="estimate-level-inputs" onBlur={handleBlur}>
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
    <section className="panel estimate-panel">
      <div className="panel-heading">
        <div>
          <h2>{t('calculator.heading')}</h2>
        </div>
        <div className="segmented-control" role="group" aria-label={t('billing.estimateType')}>
          <button type="button" className={estimate.billingType === 'ratio' ? 'active' : ''} onClick={() => onChange({ ...estimate, billingType: 'ratio' })}>
            {t('billing.ratio')}
          </button>
          <button type="button" className={estimate.billingType === 'hourly' ? 'active' : ''} onClick={() => onChange({ ...estimate, billingType: 'hourly' })}>
            {t('billing.hourly')}
          </button>
        </div>
      </div>

      <div className="estimate-grid">
        <FlowCard
          step="1"
          title={t('calculator.from')}
          labels={
            <div className="estimate-label-row estimate-label-row--level-exp">
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
            <div className="estimate-label-row estimate-label-row--level-exp">
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
              <div className="estimate-label-row estimate-label-row--single">
                <span>{t('billing.ratio')}</span>
              </div>
            ) : (
              <div className="estimate-label-row estimate-label-row--pricing">
                <span>{t('calculator.price')}</span>
                <span>{t('calculator.eph')}</span>
              </div>
            )
          }
        >
          {estimate.billingType === 'ratio' ? (
            <span className="ratio-input estimate-ratio-input">
              <span>{t('common.ratioPrefix')}</span>
              <EditableNumberInput
                type="number"
                min={0.1}
                step={0.1}
                value={estimate.expPerMesoRatio}
                aria-label={t('aria.expPerMesoRatio')}
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
                    aria-label={t('aria.hourlyPriceMillions')}
                    onValueChange={(hourlyRateMillions) => onChange({ ...estimate, hourlyRateMillions })}
                  />
                  <span>{t('common.millionPerHour')}</span>
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
                    aria-label={t('aria.expRateMillions')}
                    onValueChange={(expPerHourMillions) => onChange({ ...estimate, expPerHourMillions })}
                  />
                  <span>{t('common.millionExpPerHour')}</span>
                </span>
              </div>
            </div>
          )}
        </FlowCard>

        <div className="estimate-result flow-card">
          <div className="flow-card__heading">
            <span>4</span>
            <strong>{t('calculator.result')}</strong>
          </div>
          <button
            type="button"
            className={`estimate-result__item estimate-result__item--full copy-metric${costCopied ? ' copy-metric--copied' : ''}`}
            aria-label={costCopied ? t('aria.estimatedCostCopied') : t('aria.copyEstimatedCost')}
            onClick={() => void copyEstimatedCost()}
          >
            <span className="copy-metric__label" aria-live="polite">
              {costCopied ? t('common.copied') : t('calculator.estimatedCost')}
              {costCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            </span>
            <strong>{formatMesosShort(estimatedCost)}</strong>
            <small>{formatMesosValue(estimatedCost)}</small>
          </button>
          <div className={`estimate-result__item${estimate.billingType === 'ratio' ? ' estimate-result__item--full' : ''}`}>
            <span>{t('calculator.expNeeded')}</span>
            <strong>{formatCompact(result.expNeeded)}</strong>
            <small>{formatExp(result.expNeeded)}</small>
          </div>
          {estimate.billingType === 'hourly' ? (
            <div className="estimate-result__item">
              <span>{t('calculator.expectedTime')}</span>
              <strong>{formatDuration(result.expectedDurationMs)}</strong>
              <small>{formatHours(result.expectedDurationMs)}</small>
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
  const billableMs = getBillableMs(billing.ledger, now);
  const isRunning = billing.ledger.status === 'running';

  return (
    <div className={`timer-card timer-card--${billing.ledger.status}`}>
      <div className="timer-card__header">
        <span className="billing-field-label">{t('timer.runTime')}</span>
        <small className="timer-status">{timerStatusLabel(billing.ledger.status, t)}</small>
      </div>
      <div className="timer-card__body">
        <div className="timer-card__main">
          <strong>{formatDuration(billableMs)}</strong>
        </div>
        <div className="timer-card__actions">
          <button
            type="button"
            className="timer-card__toggle"
            onClick={onToggle}
            aria-label={isRunning ? t('aria.pauseTimer') : t('aria.startTimer')}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? t('timer.pause') : t('timer.start')}
          </button>
          <button type="button" className="secondary-button timer-card__reset" onClick={onReset} disabled={isRunning}>
            <RotateCcw size={16} /> {t('common.reset')}
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
  onUpdate: (buyer: LeechBuyer, hourlyActive?: boolean) => void;
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
  const buyerBillableMs = instance.billing.type === 'hourly' ? getBuyerBillableMs(instance.billing, buyer.id, now) : undefined;
  const buyerTimerRunning = instance.billing.type === 'hourly' && isBuyerHourlyTimerRunning(instance.billing, buyer.id);
  const lookupIgn = buyerLookupIgn(buyer);
  const displayIgn = lookupIgn || t('buyer.fallback');
  const locked = buyer.locked ?? false;
  const job = buyer.current?.job ?? buyer.start?.job;
  const guild = buyer.current?.guild ?? buyer.start?.guild;

  useEffect(() => {
    if (!buyer.start) return;
    setStartDraft({ level: buyer.start.level, expPercent: buyer.start.expPercent });
  }, [buyer.start?.capturedAt, buyer.start?.level, buyer.start?.expPercent]);

  useEffect(() => {
    if (!buyer.current) return;
    setCurrentDraft({ level: buyer.current.level, expPercent: buyer.current.expPercent });
  }, [buyer.current?.capturedAt, buyer.current?.level, buyer.current?.expPercent]);

  async function fetchStart() {
    if (buyer.start && !confirmSnapshotOverwrite(t('confirm.refreshSnapshot', { label: t('common.start').toLowerCase() }))) return;
    setRefreshingSnapshot('start');
    try {
      const snapshot = await onFetchSnapshot(lookupIgn);
      const nextBuyer = { ...buyer, ign: snapshot.ign, start: snapshot, current: buyer.current ?? snapshot };
      onUpdate(nextBuyer, instance.billing.type === 'hourly' && instance.billing.ledger.status === 'running' && !locked);
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
    onUpdate(nextBuyer, instance.billing.type === 'hourly' && instance.billing.ledger.status === 'running' && !locked);
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
      onUpdate({ ...buyer, locked: true }, false);
      return;
    }
    onUpdate({ ...buyer, locked: false }, instance.billing.ledger.status === 'running' && Boolean(buyer.start));
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
            <strong>{buyer.ign || t('buyer.placeholderName')}</strong>
            {job || guild ? (
              <div className="buyer-character-meta">
                {job ? <span aria-label={t('aria.job', { job })} title={job}>{job}</span> : null}
                {guild ? <span aria-label={t('aria.guild', { guild })} title={guild}>{guild}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="buyer-row-metrics">
          <div className="buyer-row-stat">
            <span>{t('common.start')}</span>
            <strong>{snapshotShort(buyer.start, t)}</strong>
            {buyer.start ? <small>{formatLocalDateTime(buyer.start.capturedAt)}</small> : null}
          </div>
          <div className="buyer-row-stat">
            <span>{t('common.current')}</span>
            <strong>{snapshotShort(buyer.current, t)}</strong>
            {buyer.current ? <small>{formatLocalDateTime(buyer.current.capturedAt)}</small> : null}
          </div>
          {instance.billing.type === 'hourly' ? (
            <div className="buyer-row-stat">
              <span>{t('buyer.billableTime')}</span>
              <strong>{formatDuration(buyerBillableMs)}</strong>
              <small>{buyerTimerRunning ? t('timer.running') : t('timer.paused')}</small>
            </div>
          ) : (
            <div className="buyer-row-stat">
              <span>{t('buyer.expGained')}</span>
              <strong>{formatCompact(calc.expGained)}</strong>
              <small>{formatExp(calc.expGained)}</small>
            </div>
          )}
          <div
            className={`buyer-row-stat buyer-row-stat--due${dueCopied ? ' buyer-row-stat--copied' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={dueCopied ? t('aria.dueCopied', { name: displayIgn }) : t('aria.copyDue', { name: displayIgn })}
            onClick={() => void copyDue()}
            onKeyDown={handleDueKeyDown}
          >
            <span className="buyer-row-stat__copy-label" aria-live="polite">
              {dueCopied ? t('common.copied') : t('common.due')}
              {dueCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            </span>
            <strong>{formatMesosShortPrecise(due)}</strong>
            <small>{formatMesosValue(due)}</small>
          </div>
        </div>
        <div className="buyer-row-actions">
          <button
            type="button"
            className={`icon-button completion-button${locked ? ' completion-button--done' : ''}${completionPreviewSuppressed ? ' completion-button--preview-suppressed' : ''}`}
            onClick={() => {
              setCompletionPreviewSuppressed(true);
              toggleBuyerDone();
            }}
            onPointerLeave={() => setCompletionPreviewSuppressed(false)}
            onBlur={() => setCompletionPreviewSuppressed(false)}
            aria-label={locked ? t('aria.reopenBuyer', { name: displayIgn }) : t('aria.markBuyerDone', { name: displayIgn })}
            aria-pressed={locked}
          >
            <span className="completion-button__state" aria-hidden="true">
              {locked ? <CircleCheckBig size={16} /> : <CircleDashed size={16} />}
            </span>
            <span className="completion-button__action" aria-hidden="true">
              {locked ? <CircleDashed size={16} /> : <CircleCheckBig size={16} />}
            </span>
            <span className="buyer-action-label" aria-hidden="true">
              {locked ? t('buyer.completed') : t('buyer.active')}
            </span>
          </button>
          <button type="button" className="icon-button danger-button" onClick={onDelete} aria-label={t('aria.removeBuyer', { name: displayIgn })}>
            <Trash2 size={16} />
            <span className="buyer-action-label" aria-hidden="true">{t('buyer.delete')}</span>
          </button>
        </div>
      </div>

      {!locked ? (
        <details className="buyer-details">
          <summary>{t('buyer.edit')}</summary>
          <div className="snapshot-editor-grid">
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
  copiedBuyerId: BuyerId | null;
  onDueCopied: (buyerId: BuyerId) => void;
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
        id: instance.nextBuyerId,
        ign: snapshot.ign,
        start: snapshot,
        current: snapshot,
      };
      const billing = instance.billing.type === 'hourly' && instance.billing.ledger.status === 'running'
        ? setHourlyAccountActive(instance.billing, buyer.id, true, Date.now())
        : instance.billing;
      const nextInstance = {
        ...instance,
        buyers: [...instance.buyers, buyer],
        nextBuyerId: instance.nextBuyerId + 1,
      };
      onUpdate(billing.type === 'hourly' ? updateInstanceBilling(nextInstance, billing) : nextInstance);
      setNewBuyerIgn('');
    } catch {
      const buyer: LeechBuyer = {
        id: instance.nextBuyerId,
        ign,
      };
      onUpdate({ ...instance, buyers: [...instance.buyers, buyer], nextBuyerId: instance.nextBuyerId + 1 });
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
        buyers: applyCurrentSnapshots(instance.buyers, batch.snapshots),
      });
    } finally {
      setRefreshingRun(false);
    }
  }

  function toggleHourlyRunTimer() {
    if (instance.billing.type !== 'hourly') return;
    const isRunning = instance.billing.ledger.status === 'running';
    const operationNow = Date.now();
    const billing = isRunning
      ? pauseHourlyBilling(instance.billing, operationNow)
      : startHourlyBilling(
        instance.billing,
        instance.buyers.filter((buyer) => !buyer.locked && buyer.start).map((buyer) => buyer.id),
        operationNow,
      );
    onUpdate(updateInstanceBilling(instance, billing));
  }

  function resetHourlyRunTimer() {
    if (instance.billing.type !== 'hourly') return;
    if (!confirmTimerReset(t('confirm.resetTimer'))) return;
    onUpdate(updateInstanceBilling(instance, resetHourlyBilling(instance.billing)));
  }

  return (
    <section className={`panel leech-instance${highlighted ? ' leech-instance--highlighted' : ''}`}>
      <div className="instance-header">
        <div>
          <input
            className="instance-title-input"
            value={instance.name}
            onChange={(event) => onUpdate({ ...instance, name: event.target.value })}
            aria-label={t('run.nameLabel', { number: index + 1 })}
          />
          <p className="run-created-at">
            {instance.billing.type === 'ratio'
              ? t('billing.ratioModeSummary', { label: compactBillingLabel(instance.billing, t) })
              : t('billing.hourlyModeSummary', { label: billingLabel(instance.billing, t) })} · {t('run.created', { date: formatLocalDateTime(instance.createdAt) })}
          </p>
        </div>
        <div className="button-row wrap">
          <div className="segmented-control" role="group" aria-label={t('billing.type')}>
            <button type="button" className={instance.billing.type === 'ratio' ? 'active' : ''} onClick={() => setBillingType('ratio')}>{t('billing.ratio')}</button>
            <button type="button" className={instance.billing.type === 'hourly' ? 'active' : ''} onClick={() => setBillingType('hourly')}>{t('billing.hourly')}</button>
          </div>
          <button type="button" className="icon-button danger-button" onClick={onDelete} aria-label={t('run.delete')}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={`instance-billing instance-billing--${instance.billing.type}`}>
        <div className="billing-settings">
          {ratioBilling ? (
            <div className="ratio-tier-editor">
              <div className="ratio-tier-card ratio-tier-card--base">
                <label className="ratio-tier-stack billing-field-label">
                  {t('billing.baseRatio')}
                  <RatioInput
                    className="ratio-tier-control"
                    value={ratioBilling.expPerMesoRatio}
                    ariaLabel={t('aria.runExpRatio')}
                    onValueChange={(expPerMesoRatio) => updateBilling({ ...ratioBilling, expPerMesoRatio })}
                  />
                </label>
              </div>
              {ratioBilling.tiers.map((tier, index) => (
                <div className="ratio-tier-card" key={tier.minLevel}>
                  <div className="ratio-tier-stack">
                    <span className="billing-field-label ratio-tier-level">{t('billing.tierLevel')} {tier.minLevel}</span>
                    <div className="ratio-tier-control-row">
                      <RatioInput
                        className="ratio-tier-control"
                        value={tier.expPerMesoRatio}
                        ariaLabel={t('aria.ratioTierRatio', { number: index + 1 })}
                        onValueChange={(expPerMesoRatio) => updateRatioTierRatio(tier.minLevel, expPerMesoRatio)}
                      />
                      <button
                        type="button"
                        className="icon-button danger-button"
                        onClick={() => removeRatioTier(tier.minLevel)}
                        aria-label={t('aria.removeRatioTier', { number: index + 1 })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="ratio-tier-card ratio-tier-card--add">
                <label className="billing-field-label" htmlFor={ratioTierLevelId}>{t('billing.tierLevel')}</label>
                <form
                  className="ratio-tier-control-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addRatioTier();
                  }}
                >
                  <input
                    id={ratioTierLevelId}
                    className="ratio-tier-control"
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={ratioTierLevelDraft}
                    placeholder="120"
                    aria-label={t('aria.ratioTierLevel', { number: ratioBilling.tiers.length + 1 })}
                    onChange={(event) => setRatioTierLevelDraft(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="icon-button ratio-tier-add-button"
                    aria-label={t('billing.addTier')}
                    disabled={!canAddRatioTier}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span className="ratio-tier-add-button__label" aria-hidden="true">
                      {t('billing.addTier')}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          ) : null}
          {hourlyBilling ? (
            <label className="compact-label hourly-rate-field billing-field-label">
              {t('billing.hourlyRate')}
              <span className="unit-input">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hourlyBilling.hourlyRateMesos / 1_000_000}
                  aria-label={t('aria.runHourlyPriceMillions')}
                  onChange={(event) => updateBilling({ ...hourlyBilling, hourlyRateMesos: Number(event.target.value) * 1_000_000 })}
                />
                <span>{t('common.millionPerHourSpaced')}</span>
              </span>
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

      <div className="buyers-header buyers-toolbar">
        <div className="buyers-heading">
          <h3>{t('buyer.buyers')}</h3>
          {instance.lastCurrentRefreshedAt ? (
            <small>{t('snapshot.refreshed')} <time dateTime={instance.lastCurrentRefreshedAt}>{formatLocalDateTime(instance.lastCurrentRefreshedAt)}</time></small>
          ) : null}
        </div>
        <div className="buyers-toolbar__actions">
          <form
            className="add-buyer-form"
            onSubmit={(event) => {
              event.preventDefault();
              void addBuyerFromInput();
            }}
          >
            <input
              aria-label={t('buyer.ign')}
              value={newBuyerIgn}
              onChange={(event) => setNewBuyerIgn(event.target.value)}
              placeholder={t('buyer.ign')}
            />
            <button
              type="submit"
              aria-label={addingBuyer ? t('buyer.adding') : t('buyer.add')}
              aria-busy={addingBuyer}
              disabled={addingBuyer || !newBuyerIgn.trim()}
            >
              {addingBuyer ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} {t('common.add')}
            </button>
          </form>
          <div className="refresh-exp-control">
            <button
              type="button"
              className="secondary-button refresh-exp-button"
              onClick={refreshRunCurrentExp}
              disabled={refreshingRun || refreshableBuyers.length === 0}
              aria-describedby={refreshExpTipId}
            >
              <RefreshCw size={16} className={refreshingRun ? 'spin' : ''} /> {refreshingRun ? t('common.refreshing') : t('common.refreshExp')}
            </button>
            <div id={refreshExpTipId} className="refresh-exp-tooltip" role="tooltip">
              <strong><AlertCircle size={14} /> {t('tip.updateExpBeforeRefreshing')}</strong>
              <span><b>{t('tip.partyUpdateTitle')}</b><em>{t('tip.partyUpdateBody')}</em></span>
              <span><b>{t('tip.selfUpdateTitle')}</b><em>{t('tip.selfUpdateBody')}</em></span>
            </div>
          </div>
        </div>
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
              onUpdate={(nextBuyer, hourlyActive) => {
                const nextInstance = updateBuyer(instance, buyer.id, () => nextBuyer);
                onUpdate(instance.billing.type === 'hourly' && hourlyActive !== undefined
                  ? updateInstanceBilling(nextInstance, setHourlyAccountActive(instance.billing, buyer.id, hourlyActive, Date.now()))
                  : nextInstance);
              }}
              onDelete={() => {
                const name = buyerLookupIgn(buyer) || t('buyer.thisCharacter');
                if (!isEmptyBuyer(buyer) && !confirmDeletion(t('confirm.deleteBuyer', { name, run: instance.name }))) return;
                const withoutBuyer = { ...instance, buyers: instance.buyers.filter((item) => item.id !== buyer.id) };
                if (instance.billing.type === 'hourly') {
                  onUpdate(updateInstanceBilling(withoutBuyer, removeHourlyAccount(instance.billing, buyer.id, Date.now())));
                  return;
                }
                onUpdate({
                  ...withoutBuyer,
                  inactiveBilling: instance.inactiveBilling?.hourly ? {
                    ...instance.inactiveBilling,
                    hourly: removeHourlyAccount(instance.inactiveBilling.hourly, buyer.id, Date.now()),
                  } : instance.inactiveBilling,
                });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="empty-buyers-state">
          <UserPlus size={24} />
          <strong>{t('buyer.noBuyersTitle')}</strong>
          <span>{t('buyer.noBuyersBody')}</span>
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
  const { t } = useTranslation();
  return (
    <aside className="run-rail" aria-label={t('run.railLabel')}>
      <div className="rail-header">
        <div>
          <span className="rail-kicker">{t('run.railKicker')}</span>
          <strong>{t('run.active', { count: instances.length })}</strong>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t('run.new')}>
          <Plus size={17} />
        </button>
      </div>

      <label className="run-picker">
        <select value={selectedRunId ?? ''} onChange={(event) => onSelect(event.target.value)} aria-label={t('run.selected')}>
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
                <strong>{instance.name || t('common.untitledRun')}</strong>
                <small>{compactBillingLabel(instance.billing, t)}</small>
              </span>
              <span>
                <b>{formatMesosShort(summary.totalMesosDue)}</b>
                <small>{t('buyer.count', { count: summary.buyerCount })}</small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
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
    <section className="panel run-tools">
      <div className="panel-heading">
        <div>
          <h2>{t('status.heading')}</h2>
        </div>
      </div>
      <button
        type="button"
        className={`tool-stat copy-metric${totalDueCopied ? ' copy-metric--copied' : ''}`}
        aria-label={totalDueCopied ? t('aria.totalDueCopied', { defaultValue: 'Total due copied' }) : t('aria.copyTotalDue', { defaultValue: 'Copy total due' })}
        onClick={() => void copyTotalDue()}
      >
        <span className="copy-metric__label" aria-live="polite">
          {totalDueCopied ? t('common.copied') : t('status.totalDue')}
          {totalDueCopied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
        </span>
        <strong>{formatMesosShort(summary.totalMesosDue)}</strong>
        <small>{formatMesosValue(summary.totalMesosDue)}</small>
      </button>
      <div className="tools-grid">
        <div className="tool-stat">
          <span>{t('status.buyers')}</span>
          <strong>{summary.buyerCount}</strong>
          <small>{summary.doneBuyerCount > 0 ? t('buyer.done', { count: summary.doneBuyerCount }) : t('buyer.allActive')}</small>
        </div>
        <div className="tool-stat">
          <span>{t('status.totalExp')}</span>
          <strong>{formatCompact(summary.totalExpGained)}</strong>
          <small>{formatExp(summary.totalExpGained)}</small>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [instances, setInstances] = useInstancesStorage(initialInstances());
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
  const [copiedBuyerId, setCopiedBuyerId] = useState<BuyerId | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const displayedInstances = useMemo(() => [...instances].sort((a, b) => createdAtMs(b) - createdAtMs(a)), [instances]);

  useEffect(() => {
    const hasRunningTimer = instances.some((instance) => (
      instance.billing.type === 'hourly' && instance.billing.ledger.status === 'running'
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
    document.documentElement.dataset.theme = theme;
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

  function addInstance(source?: LeechInstance) {
    const id = createId('leech');
    const createdAt = new Date().toISOString();
    const instance = source
      ? createInstanceWithBillingSettings(source, {
        id,
        createdAt,
        name: defaultRunName(createdAt),
      })
      : emptyInstance(DEFAULT_RATIO_BILLING, id);
    setHighlightedRunId(id);
    setSelectedRunId(id);
    setInstances((current) => [...current, instance]);
  }

  function showCopiedBuyer(buyerId: BuyerId) {
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
    <main className="app-shell">
      <header className="app-topbar">
        <div className="brand-lockup">
          <img src="/assets/icons/hs.png" alt="" className="brand-logo" />
          <div>
            <span className="app-mark">{t('app.name')}</span>
            <p>{t('app.tagline')}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <ThemeSwitch theme={theme} onChange={setTheme} />
          <LanguageSelect />
          <button type="button" className="secondary-button topbar-control topbar-export-button" onClick={() => exportInstances(instances, t, now)} disabled={instances.length === 0}>
            <Download size={16} /> {t('topbar.exportCsv')}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`notice notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <AlertCircle size={18} />
          <span>{notice.text}</span>
          <button type="button" className="notice__dismiss" onClick={() => setNotice(null)} aria-label={t('common.dismiss')}>
            <X size={17} />
          </button>
        </div>
      ) : null}

      <div className="workbench-layout">
        <RunRail instances={displayedInstances} selectedRunId={selectedInstance?.id ?? null} now={now} onSelect={setSelectedRunId} onAdd={() => addInstance(selectedInstance)} />

        <section className="ledger-column instances-section" aria-label={t('run.selectedLedger')}>
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

        <aside className="tools-column">
          {selectedInstance ? <RunTools instance={selectedInstance} now={now} /> : null}
          <QuickEstimate estimate={estimate} onChange={setEstimate} />
        </aside>
      </div>
    </main>
  );
}
