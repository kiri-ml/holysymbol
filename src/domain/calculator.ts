import { expGainedBetween, rawExpAt } from './expTable';
import type {
  BuyerCalculation,
  BuyerId,
  EstimateCalculation,
  HourlyBilling,
  HourlyLedger,
  InstanceCalculation,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  RatioBilling,
} from './types';

function orderedRatioTiers(billing: RatioBilling) {
  return [...billing.tiers].sort((left, right) => left.minLevel - right.minLevel);
}

export function calculateTieredRatioDue(
  billing: RatioBilling,
  fromLevel: number,
  fromExpPercent: number,
  toLevel: number,
  toExpPercent: number,
): number | undefined {
  const startExp = rawExpAt(fromLevel, fromExpPercent);
  const endExp = Math.max(startExp, rawExpAt(toLevel, toExpPercent));
  let currentRatio = billing.expPerMesoRatio;
  let segmentStart = startExp;
  let due = 0;

  for (const tier of orderedRatioTiers(billing)) {
    const thresholdExp = rawExpAt(tier.minLevel, 0);
    if (thresholdExp <= startExp) {
      currentRatio = tier.expPerMesoRatio;
      continue;
    }
    if (thresholdExp >= endExp) break;
    if (currentRatio <= 0) return undefined;
    due += (thresholdExp - segmentStart) / currentRatio;
    segmentStart = thresholdExp;
    currentRatio = tier.expPerMesoRatio;
  }

  if (currentRatio <= 0) return undefined;
  return due + (endExp - segmentStart) / currentRatio;
}

function liveElapsedMs(ledger: HourlyLedger, now: number): number {
  if (ledger.status !== 'running' || ledger.checkpointAt === undefined) return 0;
  return Math.max(0, now - ledger.checkpointAt);
}

export function getBillableMs(ledger: HourlyLedger, now = Date.now()): number {
  return ledger.accumulatedMs + liveElapsedMs(ledger, now);
}

export function getBuyerBillableMs(billing: HourlyBilling, buyerId: BuyerId, now = Date.now()): number {
  const account = billing.ledger.accounts[buyerId];
  if (!account) return 0;
  const activeCount = Object.values(billing.ledger.accounts).filter((item) => item.active).length;
  const liveShare = account.active && activeCount > 0 ? liveElapsedMs(billing.ledger, now) / activeCount : 0;
  return account.accruedMs + liveShare;
}

export function isBuyerHourlyTimerRunning(billing: HourlyBilling, buyerId: BuyerId): boolean {
  return billing.ledger.status === 'running' && Boolean(billing.ledger.accounts[buyerId]?.active);
}

export function checkpointHourlyBilling(billing: HourlyBilling, now = Date.now()): HourlyBilling {
  if (billing.ledger.status !== 'running') return billing;
  const elapsedMs = liveElapsedMs(billing.ledger, now);
  const activeIds = Object.entries(billing.ledger.accounts)
    .filter(([, account]) => account.active)
    .map(([buyerId]) => Number(buyerId));
  const shareMs = activeIds.length > 0 ? elapsedMs / activeIds.length : 0;
  const accounts = { ...billing.ledger.accounts };
  for (const buyerId of activeIds) {
    accounts[buyerId] = { ...accounts[buyerId], accruedMs: accounts[buyerId].accruedMs + shareMs };
  }
  return {
    ...billing,
    ledger: {
      ...billing.ledger,
      accumulatedMs: billing.ledger.accumulatedMs + elapsedMs,
      checkpointAt: now,
      accounts,
    },
  };
}

export function startHourlyBilling(billing: HourlyBilling, activeBuyerIds: BuyerId[], now = Date.now()): HourlyBilling {
  if (billing.ledger.status === 'running') return billing;
  const activeIds = new Set(activeBuyerIds);
  const accounts = { ...billing.ledger.accounts };
  for (const buyerId of activeIds) {
    accounts[buyerId] = { accruedMs: accounts[buyerId]?.accruedMs ?? 0, active: true };
  }
  for (const [rawBuyerId, account] of Object.entries(accounts)) {
    const buyerId = Number(rawBuyerId);
    if (!activeIds.has(buyerId) && account.active) accounts[buyerId] = { ...account, active: false };
  }
  return {
    ...billing,
    ledger: { ...billing.ledger, status: 'running', checkpointAt: now, accounts },
  };
}

export function pauseHourlyBilling(billing: HourlyBilling, now = Date.now()): HourlyBilling {
  const checkpointed = checkpointHourlyBilling(billing, now);
  if (checkpointed.ledger.status !== 'running') return checkpointed;
  return {
    ...checkpointed,
    ledger: {
      ...checkpointed.ledger,
      status: 'paused',
      checkpointAt: undefined,
      accounts: Object.fromEntries(Object.entries(checkpointed.ledger.accounts).map(([id, account]) => [id, { ...account, active: false }])),
    },
  };
}

export function setHourlyAccountActive(billing: HourlyBilling, buyerId: BuyerId, active: boolean, now = Date.now()): HourlyBilling {
  const checkpointed = checkpointHourlyBilling(billing, now);
  const existing = checkpointed.ledger.accounts[buyerId];
  if (!existing && !active) return checkpointed;
  return {
    ...checkpointed,
    ledger: {
      ...checkpointed.ledger,
      accounts: {
        ...checkpointed.ledger.accounts,
        [buyerId]: { accruedMs: existing?.accruedMs ?? 0, active: active && checkpointed.ledger.status === 'running' },
      },
    },
  };
}

export function removeHourlyAccount(billing: HourlyBilling, buyerId: BuyerId, now = Date.now()): HourlyBilling {
  const checkpointed = checkpointHourlyBilling(billing, now);
  const accounts = { ...checkpointed.ledger.accounts };
  delete accounts[buyerId];
  return { ...checkpointed, ledger: { ...checkpointed.ledger, accounts } };
}

export function resetHourlyBilling(billing: HourlyBilling): HourlyBilling {
  return { ...billing, ledger: { status: 'idle', accumulatedMs: 0, accounts: {} } };
}

export function calculateBuyer(buyer: LeechBuyer, billing: LeechBilling, now = Date.now(), _buyers: LeechBuyer[] = [buyer]): BuyerCalculation {
  const expGained = buyer.start && buyer.current
    ? Math.max(0, expGainedBetween(buyer.start.level, buyer.start.expPercent, buyer.current.level, buyer.current.expPercent))
    : undefined;

  if (billing.type === 'ratio') {
    return {
      expGained,
      ratioMesosDue: buyer.start && buyer.current
        ? calculateTieredRatioDue(
          billing,
          buyer.start.level,
          buyer.start.expPercent,
          buyer.current.level,
          buyer.current.expPercent,
        )
        : undefined,
    };
  }

  const billableMs = getBuyerBillableMs(billing, buyer.id, now);
  return {
    expGained,
    hourlyMesosDue: billableMs > 0 && buyer.start ? (billableMs / 3_600_000) * billing.hourlyRateMesos : undefined,
  };
}

export function calculateInstance(instance: LeechInstance, now = Date.now()): InstanceCalculation {
  const buyerCount = instance.buyers.filter((buyer) => buyer.start || buyer.ign.trim()).length;
  const doneBuyerCount = instance.buyers.filter(
    (buyer) => (buyer.start || buyer.ign.trim()) && buyer.locked,
  ).length;
  const buyerCalculations = instance.buyers.map((buyer) => calculateBuyer(buyer, instance.billing, now, instance.buyers));
  const totalExpGained = buyerCalculations.reduce((total, calculation) => total + (calculation.expGained ?? 0), 0);

  if (instance.billing.type === 'ratio') {
    const totalMesosDue = buyerCalculations.reduce(
      (total, calculation) => total + (calculation.ratioMesosDue ?? 0),
      0,
    );
    return {
      buyerCount,
      doneBuyerCount,
      totalExpGained,
      totalMesosDue,
    };
  }

  const billableMs = getBillableMs(instance.billing.ledger, now);
  const totalHourlyMesos = buyerCalculations.reduce(
    (total, calculation) => total + (calculation.hourlyMesosDue ?? 0),
    0,
  );

  return {
    buyerCount,
    doneBuyerCount,
    totalExpGained,
    billableMs,
    totalMesosDue: totalHourlyMesos,
  };
}

export function calculateEstimate(input: {
  fromLevel: number;
  fromExpPercent: number;
  toLevel: number;
  toExpPercent: number;
  billingType: 'ratio' | 'hourly';
  expPerMesoRatio: number;
  hourlyRateMesos: number;
  expPerHourMillions: number;
}): EstimateCalculation {
  const expNeeded = Math.max(
    0,
    expGainedBetween(input.fromLevel, input.fromExpPercent, input.toLevel, input.toExpPercent),
  );

  if (input.billingType === 'ratio') {
    return {
      expNeeded,
      ratioMesosDue: input.expPerMesoRatio > 0 ? expNeeded / input.expPerMesoRatio : undefined,
    };
  }

  const eph = input.expPerHourMillions * 1_000_000;
  const hours = eph > 0 ? expNeeded / eph : undefined;

  return {
    expNeeded,
    expectedDurationMs: hours !== undefined ? hours * 3_600_000 : undefined,
    hourlyMesosDue: hours !== undefined ? hours * input.hourlyRateMesos : undefined,
  };
}
