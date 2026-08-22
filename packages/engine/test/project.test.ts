import { describe, it, expect } from 'vitest';
import {
  buildLedger, detectPrimaryAccount, hasReliableBalanceAt, withTransaction,
} from '../src/project/ledger';
import { inferIncomeEvents } from '../src/project/income';
import { projectBalance, projectWithPaused, occurrencesInWindow } from '../src/project/curve';
import { istDayKey } from '../src/time';
import type { Mandate, Transaction } from '../src/types';

const NOW = new Date('2026-03-01T09:00:00+05:30');
const ist = (s: string) => new Date(`${s}+05:30`);

let seq = 0;
function txn(partial: Partial<Transaction> & { amount: number; timestamp: Date }): Transaction {
  return {
    id: `t${seq++}`,
    direction: 'DEBIT',
    bank: 'HDFC',
    isFailure: false,
    accountTail: '4471',
    source: 'STATEMENT',
    ...partial,
  };
}

function mandate(partial: Partial<Mandate> & { amount: number; dayOfMonth: number }): Mandate {
  return {
    id: `m${partial.dayOfMonth}_${partial.amount}`,
    normalizedVpa: 'x@bank',
    displayName: 'Thing',
    cadence: 'MONTHLY',
    nextDebit: ist(`2026-03-${String(partial.dayOfMonth).padStart(2, '0')}T09:00:00`),
    confidence: 0.9,
    occurrences: 6,
    sourceTxnIds: [],
    priority: 'LOW',
    category: 'OTHER',
    isPaused: false,
    ...partial,
  };
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

describe('buildLedger', () => {
  it('accumulates debits and credits', () => {
    const ledger = buildLedger([
      txn({ amount: 1000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00') }),
      txn({ amount: 300, direction: 'DEBIT', timestamp: ist('2026-02-02T10:00:00') }),
    ]);
    expect(ledger.currentBalance).toBe(700);
  });

  it('snaps to a stated balance and reports the drift', () => {
    const ledger = buildLedger([
      txn({ amount: 1000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00'), balanceHint: 1000 }),
      txn({ amount: 300, direction: 'DEBIT', timestamp: ist('2026-02-02T10:00:00') }),
      // Bank says 650, we think 700 — a ₹50 debit we never saw an SMS for.
      txn({ amount: 50, direction: 'DEBIT', timestamp: ist('2026-02-03T10:00:00'), balanceHint: 600 }),
    ]);
    expect(ledger.currentBalance).toBe(600);
    expect(ledger.drift).toBe(50);
    expect(ledger.reconciliations).toBe(2);
  });

  it('treats the first hint as bootstrap, not drift', () => {
    // We start from zero knowing nothing. The first stated balance is where we
    // learn the number, so it must not be reported as a ₹50,000 error.
    const ledger = buildLedger([
      txn({ amount: 100, direction: 'DEBIT', timestamp: ist('2026-02-01T10:00:00'), balanceHint: 50000 }),
    ]);
    expect(ledger.drift).toBe(0);
    expect(ledger.maxDrift).toBe(0);
  });

  it('does NOT move the balance on a failed transaction', () => {
    // The whole point of a bounce is that the money never left. Counting it
    // understates the balance by exactly the amount that did not move.
    const ledger = buildLedger([
      txn({ amount: 5000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00') }),
      txn({ amount: 5000, direction: 'DEBIT', timestamp: ist('2026-02-02T10:00:00'), isFailure: true }),
    ]);
    expect(ledger.currentBalance).toBe(5000);
  });

  it('scopes to one account and ignores card spends', () => {
    const ledger = buildLedger([
      txn({ amount: 1000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00'), balanceHint: 1000 }),
      txn({ amount: 900, direction: 'DEBIT', timestamp: ist('2026-02-02T10:00:00'), accountTail: '8812' }),
      txn({ amount: 500, direction: 'DEBIT', timestamp: ist('2026-02-03T10:00:00'), accountTail: '9032' }),
      txn({ amount: 100, direction: 'DEBIT', timestamp: ist('2026-02-04T10:00:00') }),
    ]);
    expect(ledger.accountTail).toBe('4471');
    expect(ledger.currentBalance).toBe(900);
    expect(ledger.txns).toHaveLength(2);
  });

  it('picks the account the bank keeps stating a balance for', () => {
    const txns = [
      txn({ amount: 10, timestamp: ist('2026-02-01T10:00:00'), accountTail: '1111' }),
      txn({ amount: 10, timestamp: ist('2026-02-02T10:00:00'), accountTail: '1111' }),
      txn({ amount: 10, timestamp: ist('2026-02-03T10:00:00'), accountTail: '2222', balanceHint: 500 }),
    ];
    expect(detectPrimaryAccount(txns)).toBe('2222');
  });

  it('never mutates the input array', () => {
    const txns = [
      txn({ amount: 10, timestamp: ist('2026-02-05T10:00:00') }),
      txn({ amount: 10, timestamp: ist('2026-02-01T10:00:00') }),
    ];
    const order = txns.map((t) => t.id);
    buildLedger(txns);
    expect(txns.map((t) => t.id)).toEqual(order);
  });

  describe('balanceAt', () => {
    const ledger = buildLedger([
      txn({ amount: 10000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00'), balanceHint: 10000 }),
      txn({ amount: 2000, direction: 'DEBIT', timestamp: ist('2026-02-10T10:00:00') }),
      txn({ amount: 3000, direction: 'DEBIT', timestamp: ist('2026-02-20T10:00:00') }),
    ]);

    it('reads the balance on a given day', () => {
      expect(ledger.balanceAt(ist('2026-02-05T12:00:00'))).toBe(10000);
      expect(ledger.balanceAt(ist('2026-02-15T12:00:00'))).toBe(8000);
      expect(ledger.balanceAt(ist('2026-02-25T12:00:00'))).toBe(5000);
    });

    it('includes debits from earlier the same IST day', () => {
      expect(ledger.balanceAt(ist('2026-02-10T00:30:00'))).toBe(8000);
    });

    it('returns 0 before any transaction exists', () => {
      expect(ledger.balanceAt(ist('2026-01-01T10:00:00'))).toBe(0);
    });
  });

  it('reports whether a balance near a date is trustworthy', () => {
    const ledger = buildLedger([
      txn({ amount: 100, timestamp: ist('2026-02-01T10:00:00'), balanceHint: 5000 }),
      txn({ amount: 100, timestamp: ist('2026-02-02T10:00:00') }),
    ]);
    expect(hasReliableBalanceAt(ledger, ist('2026-02-04T10:00:00'))).toBe(true);
    expect(hasReliableBalanceAt(ledger, ist('2026-03-20T10:00:00'))).toBe(false);
  });

  it('clones with an extra transaction without touching the original', () => {
    const ledger = buildLedger([
      txn({ amount: 10000, direction: 'CREDIT', timestamp: ist('2026-02-01T10:00:00'), balanceHint: 10000 }),
    ]);
    const after = withTransaction(
      ledger,
      txn({ amount: 8000, direction: 'DEBIT', timestamp: ist('2026-03-01T09:00:00') }),
    );
    expect(after.currentBalance).toBe(2000);
    expect(ledger.currentBalance).toBe(10000);
  });
});

// ─── Income ──────────────────────────────────────────────────────────────────

describe('inferIncomeEvents', () => {
  const salary = (month: number, day: number, amount: number) =>
    txn({
      amount,
      direction: 'CREDIT',
      timestamp: ist(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T06:30:00`),
      merchantHint: `a/c **4471 towards SALARY ${['', 'JAN', 'FEB'][month] ?? 'MAR'}26 ACME TECH PVT LTD`,
    });

  it('detects a fixed salary despite the month changing in every message', () => {
    // The regression that hid the salary: 'SALARY JAN26' and 'SALARY FEB26'
    // grouped separately, so it never reached three occurrences.
    const events = inferIncomeEvents(
      [
        salary(1, 25, 82000),
        salary(2, 25, 82000),
        txn({
          amount: 82000,
          direction: 'CREDIT',
          timestamp: ist('2025-12-25T06:30:00'),
          merchantHint: 'a/c **4471 towards SALARY DEC25 ACME TECH PVT LTD',
        }),
      ],
      NOW,
      { days: 45 },
    );
    const pay = events.filter((e) => e.kind === 'SALARY');
    expect(pay.length).toBeGreaterThanOrEqual(1);
    expect(pay[0]!.amount).toBe(82000);
    expect(istDayKey(pay[0]!.date)).toBe('2026-03-25');
    expect(pay[0]!.confidence).toBeGreaterThan(0.7);
  });

  it('does not swallow words that merely start with a month', () => {
    // 'mar[a-z]*' would eat 'marketing' and merge unrelated payers.
    const events = inferIncomeEvents(
      [1, 2, 3].map((i) =>
        txn({
          amount: 20000,
          direction: 'CREDIT',
          timestamp: ist(`2025-${9 + i}-10T12:00:00`),
          merchantHint: 'from MARKETING RETAINER LTD',
        }),
      ),
      NOW,
      { days: 45 },
    );
    expect(events.length).toBeGreaterThan(0);
  });

  it('classifies variable amounts on variable dates as irregular, with lower confidence', () => {
    const events = inferIncomeEvents(
      [
        txn({ amount: 24500, direction: 'CREDIT', timestamp: ist('2025-12-05T12:00:00'), vpa: 'client.payouts@icici' }),
        txn({ amount: 17800, direction: 'CREDIT', timestamp: ist('2026-01-02T12:00:00'), vpa: 'client.payouts@icici' }),
        txn({ amount: 21200, direction: 'CREDIT', timestamp: ist('2026-02-04T12:00:00'), vpa: 'client.payouts@icici' }),
      ],
      NOW,
      { days: 45 },
    );
    const irregular = events.filter((e) => e.kind === 'IRREGULAR');
    expect(irregular.length).toBeGreaterThan(0);
    expect(irregular[0]!.confidence).toBeLessThan(0.7);
    expect(irregular[0]!.confidence).toBeGreaterThan(0);
  });

  it('ignores small credits — a friend paying you back is not income', () => {
    const events = inferIncomeEvents(
      [1, 2, 3].map((i) =>
        txn({ amount: 400, direction: 'CREDIT', timestamp: ist(`2026-01-0${i}T12:00:00`), vpa: 'anita.k@oksbi' }),
      ),
      NOW,
    );
    expect(events).toHaveLength(0);
  });

  it('needs three observations before calling anything a pattern', () => {
    const events = inferIncomeEvents(
      [
        txn({ amount: 50000, direction: 'CREDIT', timestamp: ist('2026-01-25T12:00:00'), vpa: 'acme@hdfcbank' }),
        txn({ amount: 50000, direction: 'CREDIT', timestamp: ist('2026-02-25T12:00:00'), vpa: 'acme@hdfcbank' }),
      ],
      NOW,
    );
    expect(events).toHaveLength(0);
  });

  it('ignores failed credits', () => {
    const events = inferIncomeEvents(
      [1, 2, 3].map((i) =>
        txn({
          amount: 50000, direction: 'CREDIT', isFailure: true,
          timestamp: ist(`2026-0${i}-25T12:00:00`), vpa: 'acme@hdfcbank',
        }),
      ),
      NOW,
    );
    expect(events).toHaveLength(0);
  });
});

// ─── Occurrences ─────────────────────────────────────────────────────────────

describe('occurrencesInWindow', () => {
  it('finds one occurrence of a monthly mandate in a 30-day window', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12 });
    const dates = occurrencesInWindow(m, ist('2026-03-01T00:00:00'), ist('2026-03-30T23:59:59'));
    expect(dates.map(istDayKey)).toEqual(['2026-03-12']);
  });

  it('finds four or five occurrences of a weekly mandate', () => {
    const m = mandate({
      amount: 200, dayOfMonth: 2, cadence: 'WEEKLY',
      nextDebit: ist('2026-03-03T09:00:00'),
    });
    const dates = occurrencesInWindow(m, ist('2026-03-01T00:00:00'), ist('2026-03-30T23:59:59'));
    expect(dates.length).toBeGreaterThanOrEqual(4);
  });

  it('re-anchors when the World Clock moves past a stale nextDebit', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12, nextDebit: ist('2026-01-12T09:00:00') });
    const dates = occurrencesInWindow(m, ist('2026-03-01T00:00:00'), ist('2026-03-30T23:59:59'));
    expect(dates.map(istDayKey)).toEqual(['2026-03-12']);
  });

  it('clamps a day-31 mandate into a short month', () => {
    const m = mandate({ amount: 100, dayOfMonth: 31, nextDebit: ist('2026-01-31T09:00:00') });
    const dates = occurrencesInWindow(m, ist('2026-02-01T00:00:00'), ist('2026-02-28T23:59:59'));
    expect(dates.map(istDayKey)).toEqual(['2026-02-28']);
  });
});

// ─── Projection ──────────────────────────────────────────────────────────────

describe('projectBalance', () => {
  const ledger = buildLedger([
    txn({
      amount: 21597, direction: 'CREDIT',
      timestamp: ist('2026-02-28T20:15:00'), balanceHint: 21597,
    }),
  ]);

  it('emits exactly `days` points — A\'s morph needs equal lengths', () => {
    expect(projectBalance(ledger, [], [], NOW, 30)).toHaveLength(30);
    expect(projectBalance(ledger, [], [], NOW, 45)).toHaveLength(45);
    expect(projectBalance(ledger, [], [], NOW, 1)).toHaveLength(1);
  });

  it('starts from the ledger balance at now', () => {
    expect(projectBalance(ledger, [], [], NOW, 30)[0]!.balance).toBe(21597);
  });

  it('applies a mandate on its day and holds the balance after', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12, confidence: 0.9 });
    const curve = projectBalance(ledger, [m], [], NOW, 30);
    const by = (k: string) => curve.find((p) => istDayKey(p.date) === k)!;
    expect(by('2026-03-11').balance).toBe(21597);
    expect(by('2026-03-12').balance).toBe(16597);
    expect(by('2026-03-13').balance).toBe(16597);
    expect(by('2026-03-12').events[0]).toMatchObject({ kind: 'MANDATE', amount: -5000 });
  });

  it('skips paused mandates', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12, isPaused: true });
    const curve = projectBalance(ledger, [m], [], NOW, 30);
    expect(curve.at(-1)!.balance).toBe(21597);
  });

  it('skips mandates below the confidence floor', () => {
    // Six phantom buckets — three Swiggy orders that happened to land near each
    // other — move the curve by thousands and put the shortfall on the wrong day.
    const noise = mandate({ amount: 2416, dayOfMonth: 12, confidence: 0.4 });
    const real = mandate({ amount: 5000, dayOfMonth: 12, confidence: 0.96 });
    const curve = projectBalance(ledger, [noise, real], [], NOW, 30);
    expect(curve.at(-1)!.balance).toBe(16597);
  });

  it('honours a raised income confidence floor', () => {
    const income = [{ amount: 20000, date: ist('2026-03-17T12:00:00'), confidence: 0.5 }];
    expect(projectBalance(ledger, [], income, NOW, 30).at(-1)!.balance).toBe(41597);
    expect(
      projectBalance(ledger, [], income, NOW, 30, { minIncomeConfidence: 0.7 }).at(-1)!.balance,
    ).toBe(21597);
  });

  it('applies outflows before inflows on the same day', () => {
    // A bank debiting a mandate at 8am does not know a credit lands at 6pm.
    // Ordering it the other way hides real bounces.
    const small = buildLedger([
      txn({ amount: 1000, direction: 'CREDIT', timestamp: ist('2026-02-28T20:00:00'), balanceHint: 1000 }),
    ]);
    const m = mandate({ amount: 5000, dayOfMonth: 12, confidence: 0.9 });
    const income = [{ amount: 20000, date: ist('2026-03-12T18:00:00'), confidence: 0.9 }];
    const curve = projectBalance(small, [m], income, NOW, 30);
    const day12 = curve.find((p) => istDayKey(p.date) === '2026-03-12')!;
    expect(day12.events[0]!.amount).toBe(-5000);
    expect(day12.events[1]!.amount).toBe(20000);
    expect(day12.balance).toBe(16000);
  });

  it('does not mutate the mandates it is given', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12 });
    projectWithPaused(ledger, [m], [], NOW, [m.id], 30);
    expect(m.isPaused).toBe(false);
  });

  it('projectWithPaused returns a curve of identical length', () => {
    const m = mandate({ amount: 5000, dayOfMonth: 12 });
    const base = projectBalance(ledger, [m], [], NOW, 30);
    const paused = projectWithPaused(ledger, [m], [], NOW, [m.id], 30);
    expect(paused).toHaveLength(base.length);
    expect(paused.at(-1)!.balance).toBeGreaterThan(base.at(-1)!.balance);
  });

  it('keeps rupees clean to 2dp across a long walk', () => {
    const m = mandate({ amount: 19.99, dayOfMonth: 3, cadence: 'WEEKLY', nextDebit: ist('2026-03-03T09:00:00') });
    const curve = projectBalance(ledger, [m], [], NOW, 30);
    for (const p of curve) {
      expect(Number.isInteger(Math.round(p.balance * 100))).toBe(true);
      expect(p.balance).toBe(Math.round(p.balance * 100) / 100);
    }
  });
});
