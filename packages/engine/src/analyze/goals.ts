import type { Transaction } from '../types';
import { addDays, startOfIstDay } from '../time';

/**
 * Average monthly surplus (income − spend) over the last `months` calendar
 * months, read off actual transactions rather than assumed. Zero or negative
 * means the account has not been generating savings capacity on its own.
 */
export function computeAvgMonthlySurplus(txns: Transaction[], now: Date, months = 3): number {
  const end = startOfIstDay(now);
  const start = addDays(end, -30 * months);

  let net = 0;
  for (const t of txns) {
    if (t.isFailure) continue;
    if (t.timestamp.getTime() < start.getTime() || t.timestamp.getTime() >= end.getTime()) continue;
    net += t.direction === 'CREDIT' ? t.amount : -t.amount;
  }

  return Math.round((net / months) * 100) / 100;
}

export interface GoalProjection {
  savedAmount: number;
  targetAmount: number;
  pct: number; // 0–1
  avgMonthlySurplus: number;
  /** Months to reach target at the current surplus rate. Null if surplus <= 0. */
  monthsRemaining: number | null;
  projectedCompletionDate: Date | null;
  /** True if surplus is positive and (no target date, or projection beats it). */
  onTrack: boolean;
  /** Monthly contribution required to hit targetDate, if one was given. */
  suggestedMonthlyContribution: number | null;
}

/**
 * Project a savings goal forward from what the account has actually been
 * doing — no assumed rate, no invented income. `avgMonthlySurplus` is the
 * output of `computeAvgMonthlySurplus` over the same ledger the rest of the
 * app already trusts.
 */
export function projectGoal(
  savedAmount: number,
  targetAmount: number,
  avgMonthlySurplus: number,
  now: Date,
  targetDate?: Date,
): GoalProjection {
  const remaining = Math.max(0, targetAmount - savedAmount);
  const pct = targetAmount > 0 ? Math.min(savedAmount / targetAmount, 1) : 1;

  let monthsRemaining: number | null = null;
  let projectedCompletionDate: Date | null = null;
  if (avgMonthlySurplus > 0 && remaining > 0) {
    monthsRemaining = Math.ceil(remaining / avgMonthlySurplus);
    projectedCompletionDate = addDays(startOfIstDay(now), monthsRemaining * 30);
  } else if (remaining === 0) {
    monthsRemaining = 0;
    projectedCompletionDate = startOfIstDay(now);
  }

  let suggestedMonthlyContribution: number | null = null;
  if (targetDate && remaining > 0) {
    const monthsToTarget = Math.max(
      1,
      Math.round((targetDate.getTime() - startOfIstDay(now).getTime()) / (30 * 24 * 60 * 60 * 1000)),
    );
    suggestedMonthlyContribution = Math.ceil(remaining / monthsToTarget / 100) * 100;
  }

  const onTrack =
    remaining === 0 ||
    (avgMonthlySurplus > 0 &&
      (!targetDate || (projectedCompletionDate !== null && projectedCompletionDate.getTime() <= targetDate.getTime())));

  return {
    savedAmount,
    targetAmount,
    pct,
    avgMonthlySurplus,
    monthsRemaining,
    projectedCompletionDate,
    onTrack,
    suggestedMonthlyContribution,
  };
}
