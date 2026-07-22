export type RunClock = {
  nowMs: () => number;
};

export const systemRunClock: RunClock = {
  nowMs: Date.now,
};

export function isoTimestamp(nowMs: number) {
  return new Date(nowMs).toISOString();
}
