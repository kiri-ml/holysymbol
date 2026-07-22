export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function nonNegativeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function validIsoString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

export function validEpochMs(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function validIntegerSeconds(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

export function validEpochSeconds(value: unknown) {
  const seconds = validIntegerSeconds(value);
  if (seconds === undefined || seconds < 0) return undefined;
  return Number.isFinite(new Date(seconds * 1000).getTime()) ? seconds : undefined;
}

export function validNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function epochToIso(value: unknown) {
  const epochMs = validEpochMs(value);
  return epochMs === undefined ? undefined : new Date(epochMs).toISOString();
}

export function epochSecondsToIso(value: unknown) {
  const seconds = validEpochSeconds(value);
  return seconds === undefined ? undefined : new Date(seconds * 1000).toISOString();
}

export function relativeSecondsToIso(value: unknown, baseEpochSeconds: number) {
  const offsetSeconds = validIntegerSeconds(value);
  if (offsetSeconds === undefined) return undefined;
  const epochMs = (baseEpochSeconds + offsetSeconds) * 1000;
  return Number.isFinite(new Date(epochMs).getTime()) ? new Date(epochMs).toISOString() : undefined;
}
