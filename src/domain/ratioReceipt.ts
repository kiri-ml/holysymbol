import type { RatioTier } from './types';

export type RatioReceipt = {
  ign: string;
  startLevel: number;
  startExpPercent: number;
  endLevel: number;
  endExpPercent: number;
  ratio: number;
  tiers: RatioTier[];
};

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CORE_CODE_LENGTH = 10;
const TIER_CODE_LENGTH = 3;
const CORE_BYTES = 7;
const TIER_BYTES = 3;
const LEVEL_RADIX = 200n;
const EXP_RADIX = 10_000n;
const CORE_TAIL_RADIX = LEVEL_RADIX * EXP_RADIX * LEVEL_RADIX * EXP_RADIX;
const CORE_RATIO_STATES = (1n << 52n) / CORE_TAIL_RADIX;
const TIER_RATIO_STATES = (1n << 18n) / LEVEL_RADIX;
const MAX_CORE = CORE_RATIO_STATES * CORE_TAIL_RADIX;
const MAX_TIER = TIER_RATIO_STATES * LEVEL_RADIX;
const MAX_CORE_RATIO_UNITS = Number(CORE_RATIO_STATES);
const MAX_TIER_RATIO_UNITS = Number(TIER_RATIO_STATES);
const MAX_ENCODED_TIERS = 199;
const IGN_PATTERN = /^[A-Za-z0-9]{4,12}$/;

export function isValidRatioReceiptIgn(value: string) {
  return IGN_PATTERN.test(value);
}

export class RatioReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RatioReceiptError';
  }
}

function requireInteger(name: string, value: number, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RatioReceiptError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
}

function hundredths(name: string, value: number, maximum: number) {
  if (!Number.isFinite(value)) throw new RatioReceiptError(`${name} must be a finite number`);
  const units = Math.round(value * 100);
  if (units < 0 || units > maximum || Math.abs(value * 100 - units) > 1e-7) {
    throw new RatioReceiptError(`${name} must be between 0 and ${(maximum / 100).toFixed(2)} with at most 0.01 precision`);
  }
  return units;
}

function ratioHundredths(name: string, value: number, maximum: number) {
  const units = hundredths(name, value, maximum);
  if (units === 0) throw new RatioReceiptError(`${name} must be at least 0.01`);
  return units;
}

function fixedBytes(value: bigint, size: number) {
  const bytes = new Uint8Array(size);
  let remaining = value;
  for (let index = size - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

/** CRC-8/SMBUS: poly 0x07, init 0x00, refin false, refout false, xorout 0x00. */
function crc8(core: bigint, tiers: bigint[], ign: string) {
  const input = [
    ...fixedBytes(core, CORE_BYTES),
    ...tiers.flatMap((tier) => [...fixedBytes(tier, TIER_BYTES)]),
    ...new TextEncoder().encode(ign),
  ];
  let crc = 0;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function encodeBits(value: bigint, characterCount: number) {
  let result = '';
  for (let index = characterCount - 1; index >= 0; index -= 1) {
    result += BASE64URL[Number((value >> BigInt(index * 6)) & 0x3fn)];
  }
  return result;
}

function decodeBits(code: string) {
  let value = 0n;
  for (const character of code) {
    const digit = BASE64URL.indexOf(character);
    if (digit < 0) throw new RatioReceiptError('Receipt code contains an invalid character');
    value = (value << 6n) | BigInt(digit);
  }
  return value;
}

function normalizeTiers(receipt: RatioReceipt) {
  if (receipt.tiers.length > 200) throw new RatioReceiptError('Receipt has too many ratio tiers');
  const sorted = [...receipt.tiers].sort((left, right) => left.minLevel - right.minLevel);
  for (let index = 0; index < sorted.length; index += 1) {
    requireInteger('Tier minimum level', sorted[index].minLevel, 1, 200);
    if (index > 0 && sorted[index - 1].minLevel === sorted[index].minLevel) {
      throw new RatioReceiptError('Receipt tiers must use unique minimum levels');
    }
  }

  let ratioUnits = ratioHundredths('Base ratio', receipt.ratio, MAX_CORE_RATIO_UNITS);
  if (sorted[0]?.minLevel === 1) {
    ratioUnits = ratioHundredths('Level 1 tier ratio', sorted[0].expPerMesoRatio, MAX_CORE_RATIO_UNITS);
    sorted.shift();
  }
  if (sorted.length > MAX_ENCODED_TIERS) throw new RatioReceiptError('Receipt has too many encodable ratio tiers');

  const tiers = sorted.map((tier) => {
    const tierRatioUnits = ratioHundredths('Tier ratio', tier.expPerMesoRatio, MAX_TIER_RATIO_UNITS);
    return BigInt(tierRatioUnits - 1) * LEVEL_RADIX + BigInt(tier.minLevel - 1);
  });
  return { ratioUnits: ratioUnits - 1, tiers };
}

function packCore(receipt: RatioReceipt, ratioUnits: number) {
  requireInteger('Start level', receipt.startLevel, 1, 200);
  requireInteger('End level', receipt.endLevel, 1, 200);
  const startExp = hundredths('Start EXP', receipt.startExpPercent, 9_999);
  const endExp = hundredths('End EXP', receipt.endExpPercent, 9_999);

  let core = BigInt(ratioUnits);
  core = core * LEVEL_RADIX + BigInt(receipt.startLevel - 1);
  core = core * EXP_RADIX + BigInt(startExp);
  core = core * LEVEL_RADIX + BigInt(receipt.endLevel - 1);
  return core * EXP_RADIX + BigInt(endExp);
}

export function encodeRatioReceipt(receipt: RatioReceipt) {
  if (!isValidRatioReceiptIgn(receipt.ign)) {
    throw new RatioReceiptError('IGN must contain 4 to 12 ASCII letters or numbers');
  }
  const normalized = normalizeTiers(receipt);
  const core = packCore(receipt, normalized.ratioUnits);
  const checksum = crc8(core, normalized.tiers, receipt.ign);
  const coreCode = encodeBits((core << 8n) | BigInt(checksum), CORE_CODE_LENGTH);
  const tierCode = normalized.tiers.map((tier) => encodeBits(tier, TIER_CODE_LENGTH)).join('');
  return `${coreCode}${tierCode}.${receipt.ign}`;
}

export function ratioReceiptPath(receipt: RatioReceipt) {
  return `/r1/${encodeRatioReceipt(receipt)}`;
}

export function decodeRatioReceipt(payload: string): RatioReceipt {
  const separator = payload.indexOf('.');
  if (separator < CORE_CODE_LENGTH || payload.indexOf('.', separator + 1) !== -1) {
    throw new RatioReceiptError('Receipt must use the format <code>.<IGN>');
  }
  const code = payload.slice(0, separator);
  const ign = payload.slice(separator + 1);
  if ((code.length - CORE_CODE_LENGTH) % TIER_CODE_LENGTH !== 0) {
    throw new RatioReceiptError('Receipt tier data has an invalid length');
  }
  const tierCount = (code.length - CORE_CODE_LENGTH) / TIER_CODE_LENGTH;
  if (tierCount > MAX_ENCODED_TIERS) throw new RatioReceiptError('Receipt has too many ratio tiers');
  if (!isValidRatioReceiptIgn(ign)) throw new RatioReceiptError('IGN must contain 4 to 12 ASCII letters or numbers');

  const coreWithCrc = decodeBits(code.slice(0, CORE_CODE_LENGTH));
  const expectedCrc = Number(coreWithCrc & 0xffn);
  let core = coreWithCrc >> 8n;
  if (core >= MAX_CORE) throw new RatioReceiptError('Receipt core is outside the supported range');

  const tierValues: bigint[] = [];
  const tiers: RatioTier[] = [];
  for (let offset = CORE_CODE_LENGTH; offset < code.length; offset += TIER_CODE_LENGTH) {
    const value = decodeBits(code.slice(offset, offset + TIER_CODE_LENGTH));
    if (value >= MAX_TIER) throw new RatioReceiptError('Receipt tier is outside the supported range');
    const minLevel = Number(value % LEVEL_RADIX) + 1;
    if (minLevel === 1 || (tiers.at(-1)?.minLevel ?? 0) >= minLevel) {
      throw new RatioReceiptError('Receipt tiers must use strictly increasing levels above 1');
    }
    tierValues.push(value);
    tiers.push({ minLevel, expPerMesoRatio: (Number(value / LEVEL_RADIX) + 1) / 100 });
  }
  if (crc8(core, tierValues, ign) !== expectedCrc) throw new RatioReceiptError('Receipt checksum does not match');

  const endExp = Number(core % EXP_RADIX);
  core /= EXP_RADIX;
  const endLevel = Number(core % LEVEL_RADIX) + 1;
  core /= LEVEL_RADIX;
  const startExp = Number(core % EXP_RADIX);
  core /= EXP_RADIX;
  const startLevel = Number(core % LEVEL_RADIX) + 1;
  core /= LEVEL_RADIX;

  return {
    ign,
    startLevel,
    startExpPercent: startExp / 100,
    endLevel,
    endExpPercent: endExp / 100,
    ratio: (Number(core) + 1) / 100,
    tiers,
  };
}

export function decodeRatioReceiptPath(pathname: string) {
  const match = /^\/r1\/([^/]+)\/?$/.exec(pathname);
  if (!match) throw new RatioReceiptError('Receipt URL must start with /r1/');
  return decodeRatioReceipt(match[1]);
}
