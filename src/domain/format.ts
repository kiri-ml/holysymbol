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
  if (mesos >= 1_000_000_000) return `${DECIMAL_FORMAT.format(mesos / 1_000_000_000)}b`;
  if (mesos >= 1_000_000) return `${DECIMAL_FORMAT.format(mesos / 1_000_000)}m`;
  if (mesos >= 1_000) return `${DECIMAL_FORMAT.format(mesos / 1_000)}k`;
  return MESO_FORMAT.format(mesos);
}

export function formatMesosShortPrecise(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const mesos = Math.max(0, value);
  if (mesos >= 1_000_000_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000_000_000)}b`;
  if (mesos >= 1_000_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000_000)}m`;
  if (mesos >= 1_000) return `${FIXED_DECIMAL_FORMAT.format(mesos / 1_000)}k`;
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

export function formatDuration(ms: number | undefined) {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
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
