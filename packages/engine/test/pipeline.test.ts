import { describe, it, expect } from 'vitest';
import inbox from '../fixtures/demo_inbox.json';
import expected from '../fixtures/demo_expectations.json';
import { runPipeline } from '../src/pipeline';
import { projectWithPaused } from '../src/project/curve';
import { withTransaction } from '../src/project/ledger';
import { istDayKey } from '../src/time';
import type { RawSms, Transaction } from '../src/types';

/**
 * End-to-end: the demo corpus through the whole pipeline.
 *
 * These assertions ARE the stage performance. If one of them goes red, the
 * numbers on the projector have moved and the script no longer matches the app.
 */

const NOW = new Date(expected.now);
const result = runPipeline(inbox as RawSms[], NOW);
const on = (key: string) => result.curve.find((p) => istDayKey(p.date) === key)!;

describe('runPipeline — the seam Person C binds to', () => {
  it('returns every slice the app renders', () => {
    expect(result.txns.length).toBeGreaterThan(0);
    expect(result.ledger).toBeDefined();
    expect(result.mandates.length).toBeGreaterThan(0);
    expect(result.income.length).toBeGreaterThan(0);
    expect(result.curve).toHaveLength(30);
  });

  it('parses across all six banks', () => {
    expect(result.stats.banks).toEqual(['AXIS', 'HDFC', 'ICICI', 'KOTAK', 'PNB', 'SBI']);
  });

  it('clears the >70% parse floor from the brief', () => {
    // Denominator includes deliberate noise — OTPs and promos that MUST be
    // rejected — so the true rate on financial messages is higher than this.
    expect(result.stats.parseRate).toBeGreaterThan(0.7);
  });

  it('reconciles against one account, not a blend of several', () => {
    expect(result.stats.accountTail).toBe(expected.primaryAccount);
    for (const t of result.ledger.txns) {
      expect(t.accountTail).toBe(expected.primaryAccount);
    }
  });

  it('is deterministic — same inbox, same numbers, every run', () => {
    const again = runPipeline(inbox as RawSms[], NOW);
    expect(again.curve.map((p) => p.balance)).toEqual(result.curve.map((p) => p.balance));
    expect(again.mandates.map((m) => m.id)).toEqual(result.mandates.map((m) => m.id));
  });

  it('is fast enough to sit behind a tap', () => {
    const t0 = performance.now();
    runPipeline(inbox as RawSms[], NOW);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('shadow ledger against the demo corpus', () => {
  it('lands on the anchor balance', () => {
    expect(result.ledger.balanceAt(NOW)).toBe(expected.anchorBalance);
  });

  it('tracks the bank\'s stated balance exactly', () => {
    // The pitch line is "our inferred balance tracks the bank's stated balance
    // to within ₹X". On a corpus with no unseen transactions, X is zero.
    expect(result.ledger.drift).toBe(0);
    expect(result.ledger.maxDrift).toBe(0);
  });

  it('reconciled many times, not once', () => {
    expect(result.stats.reconciliations).toBeGreaterThan(100);
  });
});

describe('mandate discovery', () => {
  it('surfaces exactly the eight seeded mandates', () => {
    expect(result.mandates).toHaveLength(8);
  });

  it('drops the coincidental buckets', () => {
    // Three Swiggy orders that happened to land near each other are not a
    // mandate. They detect, then fail the confidence floor.
    expect(result.stats.mandatesDetected).toBeGreaterThan(result.stats.mandatesSurfaced);
    for (const m of result.mandates) expect(m.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('found each from six messages — the provenance line in the demo script', () => {
    for (const m of result.mandates) {
      expect(m.occurrences, m.displayName).toBe(6);
      expect(m.sourceTxnIds, m.displayName).toHaveLength(6);
    }
  });

  it('lands every mandate on its true day of month', () => {
    for (const want of expected.mandates) {
      const got = result.mandates.find((m) => m.displayName === want.displayName);
      expect(got, want.displayName).toBeDefined();
      expect(got!.dayOfMonth, want.displayName).toBe(want.dayOfMonth);
      expect(got!.amount, want.displayName).toBe(want.amount);
      expect(got!.category, want.displayName).toBe(want.category);
    }
  });

  it('projects nextDebit onto the calendar day, not last-plus-median-gap', () => {
    // The bug this guards: median gap across Sept–Feb is 31 days, so a day-5
    // mandate projects to the 8th and the whole demo calendar shifts right.
    for (const m of result.mandates) {
      expect(istDayKey(m.nextDebit), m.displayName).toBe(
        `2026-03-${String(m.dayOfMonth).padStart(2, '0')}`,
      );
    }
  });
});

describe('income inference', () => {
  it('finds the salary — fixed amount, fixed day, high confidence', () => {
    const salary = result.income.filter((e) => e.kind === 'SALARY');
    expect(salary.length).toBeGreaterThanOrEqual(1);
    expect(salary[0]!.amount).toBe(expected.income.salaried.amount);
    expect(salary[0]!.confidence).toBeGreaterThan(0.8);
    expect(istDayKey(salary[0]!.date)).toBe('2026-03-25');
  });

  it('finds the freelance stream and marks it uncertain', () => {
    const irregular = result.income.filter((e) => e.kind === 'IRREGULAR');
    expect(irregular.length).toBeGreaterThanOrEqual(1);
    expect(irregular[0]!.confidence).toBeLessThan(0.7);
  });

  it('keeps the freelance cheque clear of the shortfall', () => {
    // If inferred income lands before the 12th it rescues the balance and there
    // is no demo. This is a property of the corpus and must stay true.
    for (const e of result.income) {
      expect(istDayKey(e.date) > expected.shortfall.date, e.label).toBe(true);
    }
  });
});

describe('the balance curve — beat 5 of the demo script', () => {
  it('holds at the anchor until the first debit', () => {
    expect(on('2026-03-01').balance).toBe(expected.anchorBalance);
    expect(on('2026-03-04').balance).toBe(expected.anchorBalance);
  });

  it('reaches ₹4,900 on the 9th', () => {
    expect(on('2026-03-09').balance).toBe(expected.shortfall.balanceBeforeSip);
  });

  it('dips below zero on the 12th when the SIP bounces', () => {
    expect(on('2026-03-12').balance).toBe(expected.shortfall.balanceAfterSip);
    expect(on('2026-03-12').balance).toBeLessThan(0);
    expect(on('2026-03-12').events.some((e) => e.label.includes('Nippon'))).toBe(true);
  });

  it('has exactly one dip — one dip is one story', () => {
    const below = result.curve.filter((p) => p.balance < 500).map((p) => istDayKey(p.date));
    expect(below[0]).toBe('2026-03-12');
    // Contiguous: no day above the buffer in the middle of the run.
    const first = result.curve.findIndex((p) => p.balance < 500);
    const last = result.curve.map((p) => p.balance < 500).lastIndexOf(true);
    expect(last - first + 1).toBe(below.length);
  });

  it('recovers before the window ends', () => {
    expect(result.curve.at(-1)!.balance).toBeGreaterThan(0);
  });
});

describe('intervention — beat 9, pause Netflix', () => {
  const netflix = result.mandates.find((m) => m.displayName === 'Netflix')!;
  const rescued = projectWithPaused(result.ledger, result.mandates, result.income, NOW, [netflix.id]);
  const rescuedOn = (k: string) => rescued.find((p) => istDayKey(p.date) === k)!;

  it('pausing ₹649 rescues the ₹5,000 SIP', () => {
    expect(netflix.amount).toBe(expected.shortfall.lever.amount);
    expect(rescuedOn('2026-03-12').balance).toBe(expected.shortfall.lever.resultingBalance);
    expect(rescuedOn('2026-03-12').balance).toBeGreaterThan(0);
  });

  it('clears the ₹500 buffer, so the curve actually turns green', () => {
    expect(rescuedOn('2026-03-12').balance).toBeGreaterThanOrEqual(500);
    expect(rescued.every((p) => p.balance >= 500)).toBe(true);
  });

  it('returns a curve A can morph to — identical length', () => {
    expect(rescued).toHaveLength(result.curve.length);
  });

  it('the rescued mandate is a CRITICAL SIP, worth ₹250 of penalty', () => {
    const sip = result.mandates.find((m) => m.displayName.includes('Nippon'))!;
    expect(sip.category).toBe('SIP');
    expect(sip.priority).toBe('CRITICAL');
    expect(sip.amount).toBe(expected.shortfall.sipAmount);
  });
});

describe('pre-payment — beat 8, the ₹8,000 payment', () => {
  const payment: Transaction = {
    id: 'hypothetical',
    direction: 'DEBIT',
    amount: expected.prePayment.amount,
    bank: 'HDFC',
    timestamp: NOW,
    isFailure: false,
    source: 'INTENT',
    vpa: 'merchant@ybl',
    raw: { address: 'AD-HDFCBK', body: 'intent', date: NOW.getTime() },
  };

  const after = withTransaction(result.ledger, payment);
  const curve = runPipeline(inbox as RawSms[], NOW).curve;
  const hypothetical = projectWithPaused(after, result.mandates, result.income, NOW, []);
  const hOn = (k: string) => hypothetical.find((p) => istDayKey(p.date) === k)!;

  it('drops the balance by the payment amount', () => {
    expect(after.balanceAt(NOW)).toBe(expected.anchorBalance - expected.prePayment.amount);
  });

  it('pulls the shortfall from the 12th to the 9th', () => {
    expect(curve.find((p) => p.balance < 0)).toBeDefined();
    expect(istDayKey(curve.find((p) => p.balance < 0)!.date)).toBe(expected.shortfall.date);
    expect(istDayKey(hypothetical.find((p) => p.balance < 0)!.date)).toBe(
      expected.prePayment.shiftsShortfallTo,
    );
  });

  it('leaves the balance where the demo script says on the 9th', () => {
    expect(hOn('2026-03-09').balance).toBe(expected.prePayment.balanceOnNinth);
  });

  it('does not touch the real ledger', () => {
    expect(result.ledger.balanceAt(NOW)).toBe(expected.anchorBalance);
  });
});
