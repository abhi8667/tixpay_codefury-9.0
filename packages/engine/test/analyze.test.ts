import { describe, it, expect } from 'vitest';
import { categorizeTransaction, computeSpendBreakdown } from '../src/analyze/spend';
import { computeAvgMonthlySurplus, projectGoal } from '../src/analyze/goals';
import { checkSipAffordability } from '../src/analyze/sipCheck';
import type { Mandate, ShadowLedger, Transaction } from '../src/types';

const txn = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t_${Math.random()}`,
  direction: 'DEBIT',
  amount: 100,
  bank: 'HDFC',
  timestamp: new Date('2026-03-01T00:00:00.000Z'),
  isFailure: false,
  ...over,
});

describe('analyze/spend', () => {
  it('categorises known merchants and falls back to OTHER', () => {
    expect(categorizeTransaction(txn({ merchantHint: 'SWIGGY ORDER 123' }))).toBe('FOOD');
    expect(categorizeTransaction(txn({ merchantHint: 'AMAZON PAY' }))).toBe('SHOPPING');
    expect(categorizeTransaction(txn({ merchantHint: 'RANDOM XYZ 999' }))).toBe('OTHER');
  });

  it('buckets by window and computes change vs the prior window', () => {
    const now = new Date('2026-03-31T00:00:00.000Z');
    const txns: Transaction[] = [
      txn({ id: 'a', amount: 500, merchantHint: 'SWIGGY', timestamp: new Date('2026-03-05T00:00:00.000Z') }),
      txn({ id: 'b', amount: 500, merchantHint: 'SWIGGY', timestamp: new Date('2026-02-05T00:00:00.000Z') }),
    ];
    const breakdown = computeSpendBreakdown(txns, now, 30);
    expect(breakdown.totalSpend).toBe(500);
    expect(breakdown.categories[0]!.category).toBe('FOOD');
    expect(breakdown.previousPeriodTotal).toBe(500);
    expect(breakdown.changePct).toBe(0);
  });

  it('ignores failed transactions and credits', () => {
    const now = new Date('2026-03-31T00:00:00.000Z');
    const txns: Transaction[] = [
      txn({ amount: 500, isFailure: true, timestamp: new Date('2026-03-05T00:00:00.000Z') }),
      txn({ amount: 500, direction: 'CREDIT', timestamp: new Date('2026-03-06T00:00:00.000Z') }),
    ];
    expect(computeSpendBreakdown(txns, now, 30).totalSpend).toBe(0);
  });
});

describe('analyze/goals', () => {
  it('computes average monthly surplus from actual transactions', () => {
    const now = new Date('2026-04-01T00:00:00.000Z');
    const txns: Transaction[] = [
      txn({ direction: 'CREDIT', amount: 30000, timestamp: new Date('2026-03-05T00:00:00.000Z') }),
      txn({ direction: 'DEBIT', amount: 20000, timestamp: new Date('2026-03-10T00:00:00.000Z') }),
    ];
    expect(computeAvgMonthlySurplus(txns, now, 1)).toBe(10000);
  });

  it('projects a completion date when surplus is positive', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    const projection = projectGoal(10000, 50000, 10000, now);
    expect(projection.monthsRemaining).toBe(4);
    expect(projection.onTrack).toBe(true);
    expect(projection.projectedCompletionDate).not.toBeNull();
  });

  it('is not on track with zero surplus and money still owed', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    const projection = projectGoal(10000, 50000, 0, now);
    expect(projection.monthsRemaining).toBeNull();
    expect(projection.onTrack).toBe(false);
  });

  it('reports complete when saved meets target', () => {
    const now = new Date('2026-03-01T00:00:00.000Z');
    const projection = projectGoal(50000, 50000, 0, now);
    expect(projection.pct).toBe(1);
    expect(projection.onTrack).toBe(true);
  });
});

describe('analyze/sipCheck', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  const ledger = (balance: number): ShadowLedger => ({
    txns: [],
    currentBalance: balance,
    drift: 0,
    balanceAt: () => balance,
  });

  it('clears a SIP that fits comfortably', () => {
    const result = checkSipAffordability(500, 'MONTHLY', 5, ledger(100000), [], [], now, 30);
    expect(result.level).toBe('CLEAR');
  });

  it('warns when a SIP would create a shortfall', () => {
    const rentMandate: Mandate = {
      id: 'm_rent', normalizedVpa: 'rent', displayName: 'Rent', amount: 19000,
      cadence: 'MONTHLY', dayOfMonth: 3, nextDebit: new Date('2026-03-03T00:00:00.000Z'),
      confidence: 1, occurrences: 3, sourceTxnIds: [], priority: 'HIGH', category: 'OTHER', isPaused: false,
    };
    const result = checkSipAffordability(5000, 'MONTHLY', 5, ledger(19500), [rentMandate], [], now, 30);
    expect(result.level === 'WARNING' || result.level === 'ADVISORY').toBe(true);
    expect(result.newShortfalls.length).toBeGreaterThan(0);
  });
});
