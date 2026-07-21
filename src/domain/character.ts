import type { CharacterApiPayload, CharacterSnapshot } from './types';

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExpPercent(value: unknown) {
  const parsed = toNumber(value);
  if (parsed === undefined) return 0;
  return Math.min(100, Math.max(0, parsed));
}

export function normalizeCharacter(payload: CharacterApiPayload, fallbackIgn: string): CharacterSnapshot {
  const level = toNumber(payload.level);
  if (!level) throw new Error('The character response did not include a valid level.');

  return {
    ign: String(payload.name || fallbackIgn).trim(),
    level,
    expPercent: parseExpPercent(payload.exp),
    job: payload.job ? String(payload.job) : undefined,
    guild: payload.guild ? String(payload.guild) : undefined,
    fame: toNumber(payload.fame),
    capturedAt: new Date().toISOString(),
    source: 'api',
  };
}

export function createManualSnapshot(input: {
  ign: string;
  level: number;
  expPercent: number;
  capturedAt?: string;
}): CharacterSnapshot {
  return {
    ign: input.ign.trim() || 'Manual',
    level: input.level,
    expPercent: Math.min(100, Math.max(0, input.expPercent)),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    source: 'manual',
  };
}
