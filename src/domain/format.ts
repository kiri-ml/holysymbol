const MESO_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const EXP_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const COMPACT_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  notation: 'compact',
});

const DECIMAL_FORMAT = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const FIXED_DECIMAL_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatExp(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return EXP_FORMAT.format(Math.max(0, Math.round(value)));
}

export function formatMesos(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${MESO_FORMAT.format(Math.max(0, Math.round(value)))} mesos`;
}

export function formatMesosValue(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return MESO_FORMAT.format(Math.max(0, Math.round(value)));
}

export function formatMesosShort(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const mesos = Math.max(0, value);
  if (mesos >= 1_000_000_000) return `${DECIMAL_FORMAT.format(mesos / 1_000_000_000)}B`;
  if (mesos >= 1_000_000) return `${DECIMAL_FORMAT.format(mesos / 1_000_000)}M`;
  if (mesos >= 1_000) return `${DECIMAL_FORMAT.format(mesos / 1_000)}K`;
  return MESO_FORMAT.format(mesos);
}

export function formatMesosShortPrecise(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const mesos = Math.max(0, value);
  if (mesos >= 1_000_000_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000_000_000)}B`;
  if (mesos >= 1_000_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000_000)}M`;
  if (mesos >= 1_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000)}K`;
  return FIXED_DECIMAL_FORMAT.format(mesos);
}

export function formatCompact(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return COMPACT_FORMAT.format(Math.max(0, value));
}

export function formatPercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

export function formatRatio(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return '—';
  return `1:${DECIMAL_FORMAT.format(value)}`;
}

export function formatRatioRange(min: number | undefined, max: number | undefined, prefix = '1 :') {
  if (min === undefined || max === undefined || !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return '—';
  const minLabel = DECIMAL_FORMAT.format(min);
  const maxLabel = DECIMAL_FORMAT.format(max);
  return min === max ? `${prefix} ${minLabel}` : `${prefix} ${minLabel}~${maxLabel}`;
}

export function formatDuration(ms: number | undefined) {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatHours(ms: number | undefined) {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  return `${DECIMAL_FORMAT.format(ms / 3_600_000)} h`;
}

export function formatLocalDateTime(iso: string | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
