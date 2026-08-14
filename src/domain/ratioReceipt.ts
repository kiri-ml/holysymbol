export type RatioReceipt = {
  ign: string;
  startLevel: number;
  startExpPercent: number;
  endLevel: number;
  endExpPercent: number;
  ratio: number;
};

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE_LENGTH = 10;
const DATA_BYTES = 7;
const LEVEL_RADIX = 200n;
const EXP_RADIX = 10_000n;
const RATIO_RADIX = 1_125n;
const MAX_DATA = LEVEL_RADIX * EXP_RADIX * LEVEL_RADIX * EXP_RADIX * RATIO_RADIX;
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
    throw new RatioReceiptError(`${name} must be from 0 to ${(maximum / 100).toFixed(2)} with 0.01 precision`);
  }
  return units;
}

function packData(receipt: RatioReceipt) {
  if (!isValidRatioReceiptIgn(receipt.ign)) {
    throw new RatioReceiptError('IGN must contain 4 to 12 ASCII letters or numbers');
  }
  requireInteger('Start level', receipt.startLevel, 1, 200);
  requireInteger('End level', receipt.endLevel, 1, 200);
  const startExp = hundredths('Start EXP', receipt.startExpPercent, 9_999);
  const endExp = hundredths('End EXP', receipt.endExpPercent, 9_999);
  const ratio = hundredths('Ratio', receipt.ratio, 1_124);

  let data = BigInt(receipt.startLevel - 1);
  data = data * EXP_RADIX + BigInt(startExp);
  data = data * LEVEL_RADIX + BigInt(receipt.endLevel - 1);
  data = data * EXP_RADIX + BigInt(endExp);
  return data * RATIO_RADIX + BigInt(ratio);
}

function dataBytes(data: bigint) {
  const bytes = new Uint8Array(DATA_BYTES);
  let remaining = data;
  for (let index = DATA_BYTES - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

/** CRC-8/SMBUS: poly 0x07, init 0x00, refin false, refout false, xorout 0x00. */
function crc8(data: bigint, ign: string) {
  const input = [...dataBytes(data), ...new TextEncoder().encode(ign)];
  let crc = 0;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function encode60Bits(value: bigint) {
  let result = '';
  for (let shift = 54n; shift >= 0n; shift -= 6n) {
    result += BASE64URL[Number((value >> shift) & 0x3fn)];
  }
  return result;
}

function decode60Bits(code: string) {
  if (code.length !== CODE_LENGTH) throw new RatioReceiptError('Receipt code must be 10 characters');
  let value = 0n;
  for (const character of code) {
    const digit = BASE64URL.indexOf(character);
    if (digit < 0) throw new RatioReceiptError('Receipt code contains an invalid character');
    value = (value << 6n) | BigInt(digit);
  }
  return value;
}

export function encodeRatioReceipt(receipt: RatioReceipt) {
  const data = packData(receipt);
  const packed = (data << 8n) | BigInt(crc8(data, receipt.ign));
  return `${encode60Bits(packed)}.${receipt.ign}`;
}

export function ratioReceiptPath(receipt: RatioReceipt) {
  return `/r1/${encodeRatioReceipt(receipt)}`;
}

export function decodeRatioReceipt(payload: string): RatioReceipt {
  if (payload.length < CODE_LENGTH + 1 || payload[CODE_LENGTH] !== '.') {
    throw new RatioReceiptError('Receipt must use the format <10-character code>.<IGN>');
  }
  const code = payload.slice(0, CODE_LENGTH);
  const ign = payload.slice(CODE_LENGTH + 1);
  if (!isValidRatioReceiptIgn(ign)) throw new RatioReceiptError('IGN must contain 4 to 12 ASCII letters or numbers');

  const packed = decode60Bits(code);
  const expectedCrc = Number(packed & 0xffn);
  let data = packed >> 8n;
  if (data >= MAX_DATA) throw new RatioReceiptError('Receipt data is outside the supported range');
  if (crc8(data, ign) !== expectedCrc) throw new RatioReceiptError('Receipt checksum does not match');

  const ratio = Number(data % RATIO_RADIX);
  data /= RATIO_RADIX;
  const endExp = Number(data % EXP_RADIX);
  data /= EXP_RADIX;
  const endLevel = Number(data % LEVEL_RADIX) + 1;
  data /= LEVEL_RADIX;
  const startExp = Number(data % EXP_RADIX);
  data /= EXP_RADIX;
  const startLevel = Number(data) + 1;

  return {
    ign,
    startLevel,
    startExpPercent: startExp / 100,
    endLevel,
    endExpPercent: endExp / 100,
    ratio: ratio / 100,
  };
}

export function decodeRatioReceiptPath(pathname: string) {
  const match = /^\/r1\/([^/]+)\/?$/.exec(pathname);
  if (!match) throw new RatioReceiptError('Receipt URL must start with /r1/');
  return decodeRatioReceipt(match[1]);
}
