export const MESOS_PER_MILLION = 1_000_000;

export function roundToHundredth(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeRatio(value: number) {
  if (!Number.isFinite(value)) return 0.1;
  return Math.max(0.1, value);
}

export function normalizeNonNegativeHundredth(value: number) {
  return Math.max(0, roundToHundredth(value));
}

export function mesosToMillions(value: number) {
  return value / MESOS_PER_MILLION;
}

export function millionsToMesos(value: number) {
  return value * MESOS_PER_MILLION;
}
