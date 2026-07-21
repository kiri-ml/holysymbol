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

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const WIDE_SYMBOL_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

function isWideGrapheme(grapheme: string) {
  if (WIDE_SYMBOL_PATTERN.test(grapheme)) return true;

  const codePoint = grapheme.codePointAt(0) ?? 0;
  return codePoint >= 0x1100 && (
    codePoint <= 0x115f
    || codePoint === 0x2329
    || codePoint === 0x232a
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1b000 && codePoint <= 0x1b001)
    || (codePoint >= 0x1f200 && codePoint <= 0x1f251)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

export function formatExp(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return EXP_FORMAT.format(Math.max(0, Math.round(value)));
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

export function formatMonogram(label: string, maxWidth = 4) {
  const graphemes = GRAPHEME_SEGMENTER.segment(label.replace(/\s/gu, ''));
  const monogram: string[] = [];
  let width = 0;

  for (const { segment } of graphemes) {
    const segmentWidth = isWideGrapheme(segment) ? 2 : 1;
    if (width + segmentWidth > maxWidth) break;
    width += segmentWidth;
    monogram.push(segment);
  }

  return monogram.join('') || '—';
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
