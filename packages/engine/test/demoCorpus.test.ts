import { describe, it, expect } from 'vitest';
import expected from '../fixtures/demo_expectations.json';
import { DEMO_TXNS, DEMO_META } from './_corpus';
import type { Transaction } from '../src/types';

/**
 * Guards the demo corpus.
 *
 * The whole stage performance rests on a handful of numbers agreeing: ₹21,597
 * at `now`, ₹16,697 of debits by the 9th, a ₹5,000 SIP against ₹4,900 on the
 * 12th, and ₹649 of Netflix being exactly enough to rescue it. If someone
 * "tidies up" a mandate amount at hour 17, this fails immediately instead of
 * on the projector.
 */

const FAILURE = /return|reversal|insufficient|failed|declined/i;
const clean = DEMO_TXNS.filter((t) => !t.isFailure);
const narration = (t: Transaction) => t.merchantHint ?? '';

describe('demo statement — shape', () => {
  it('is long enough to look like a real account history', () => {
    expect(DEMO_TXNS.length).toBeGreaterThanOrEqual(200);
  });

  it('parsed every row the file contained', () => {
    expect(DEMO_META.parsed).toBe(DEMO_META.rows);
    expect(DEMO_META.errors).toEqual([]);
  });

  it('is one account at one bank — which is what a statement is', () => {
    expect(DEMO_META.accountTail).toBe(expected.primaryAccount);
    expect(new Set(DEMO_TXNS.map((t) => t.bank)).size).toBe(1);
  });

  it('states a running balance on every row, so nothing has to be inferred', () => {
    expect(DEMO_META.hasRunningBalance).toBe(true);
  });

  it('is sorted chronologically', () => {
    for (let i = 1; i < DEMO_TXNS.length; i++) {
      expect(DEMO_TXNS[i]!.timestamp.getTime()).toBeGreaterThanOrEqual(
        DEMO_TXNS[i - 1]!.timestamp.getTime(),
      );
    }
  });

  it('ends before the anchor `now`', () => {
    const now = new Date(expected.now).getTime();
    expect(DEMO_TXNS.at(-1)!.timestamp.getTime()).toBeLessThan(now);
  });

  it('spans six months, so every mandate has six occurrences', () => {
    const months = new Set(DEMO_TXNS.map((t) => t.timestamp.toISOString().slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(6);
  });
});

describe('demo corpus — the eight mandates', () => {
  it('seeds exactly eight', () => {
    expect(expected.mandates).toHaveLength(8);
  });

  it('covers every category the priority ladder needs', () => {
    const cats = expected.mandates.map((m) => m.category);
    expect(cats).toContain('EMI');
    expect(cats).toContain('SIP');
    expect(cats).toContain('INSURANCE');
    expect(cats).toContain('UTILITY');
    expect(cats.filter((c) => c === 'OTT').length).toBeGreaterThanOrEqual(2);
  });

  it('each debits six times on the primary account', () => {
    for (const m of expected.mandates) {
      const hits = clean.filter((t) => narration(t).includes(m.vpa));
      expect(hits.length, m.displayName).toBe(m.expectedOccurrences);
    }
  });

  it('historical failures are extra rows, not missing debits', () => {
    // A bounced autopay names the same VPA but is not a successful occurrence.
    // detectMandates must still see six clean debits for each mandate, or the
    // "found from 6 statement rows" provenance line in the demo is wrong.
    for (const f of expected.historicalFailures) {
      const mandate = expected.mandates.find((m) => m.vpa === f.vpa);
      if (!mandate) continue;
      const all = DEMO_TXNS.filter((t) => narration(t).includes(f.vpa));
      const good = all.filter((t) => !t.isFailure);
      expect(all.length, f.vpa).toBeGreaterThan(good.length);
      expect(good.length, f.vpa).toBe(mandate.expectedOccurrences);
    }
  });

  it('detectMandates will have ≥3 occurrences to work with', () => {
    for (const m of expected.mandates) expect(m.expectedOccurrences).toBeGreaterThanOrEqual(3);
  });
});

describe('demo corpus — the arithmetic the demo depends on', () => {
  const byDay = (d: number) => expected.mandates.find((m) => m.dayOfMonth === d);

  it('debits on days 5–9 total ₹16,697', () => {
    const sum = expected.mandates
      .filter((m) => m.dayOfMonth >= 5 && m.dayOfMonth <= 9)
      .reduce((s, m) => s + m.amount, 0);
    expect(sum).toBe(16697);
  });

  it('leaves nothing on days 10–11, so the shift lands cleanly on the 9th', () => {
    expect(byDay(10)).toBeUndefined();
    expect(byDay(11)).toBeUndefined();
  });

  it('balance on the 9th is ₹4,900', () => {
    const spent = expected.mandates
      .filter((m) => m.dayOfMonth <= 9)
      .reduce((s, m) => s + m.amount, 0);
    expect(expected.anchorBalance - spent).toBe(expected.shortfall.balanceBeforeSip);
    expect(expected.shortfall.balanceBeforeSip).toBe(4900);
  });

  it('the SIP bounces by ₹100 — a real dip below zero', () => {
    const { balanceBeforeSip, sipAmount, balanceAfterSip } = expected.shortfall;
    expect(balanceBeforeSip - sipAmount).toBe(balanceAfterSip);
    expect(balanceAfterSip).toBeLessThan(0);
  });

  it('pausing Netflix is exactly enough to rescue it', () => {
    const { balanceAfterSip, lever } = expected.shortfall;
    expect(lever.amount).toBe(649);
    expect(balanceAfterSip + lever.amount).toBe(lever.resultingBalance);
    // Must clear the ₹500 guard buffer, or the curve stays amber after the tap.
    expect(lever.resultingBalance).toBeGreaterThanOrEqual(500);
  });

  it('the rescued mandate is a SIP, so ₹250 of penalty is avoided', () => {
    expect(expected.shortfall.sipAmount).toBe(5000);
    expect(expected.shortfall.penaltyAvoided).toBe(250);
  });

  it('a ₹8,000 payment pulls the shortfall from the 12th to the 9th', () => {
    const { amount, balanceOnNinth, shiftsShortfallTo } = expected.prePayment;
    expect(expected.shortfall.balanceBeforeSip - amount).toBe(balanceOnNinth);
    expect(balanceOnNinth).toBeLessThan(0);
    expect(shiftsShortfallTo).toBe('2026-03-09');
    expect(expected.shortfall.date).toBe('2026-03-12');
    expect(new Date(shiftsShortfallTo).getTime()).toBeLessThan(
      new Date(expected.shortfall.date).getTime(),
    );
  });
});

describe('demo corpus — income and failures', () => {
  it('has one salaried and one irregular stream', () => {
    expect(expected.income.salaried.amount).toBeGreaterThan(0);
    expect(expected.income.irregular.count).toBeGreaterThanOrEqual(6);
  });

  it('salary lands late enough to keep the month tight', () => {
    expect(expected.income.salaried.dayOfMonth).toBeGreaterThan(12);
  });

  it('has both failure causes for classifyFailure', () => {
    const causes = expected.historicalFailures.map((f) => f.expectedCause);
    expect(causes).toContain('LIQUIDITY');
    expect(causes).toContain('INTENTIONAL');
    expect(expected.historicalFailures.length).toBeGreaterThanOrEqual(3);
  });

  it('every declared failure actually appears in the statement', () => {
    for (const f of expected.historicalFailures) {
      const hit = DEMO_TXNS.find(
        (t) => narration(t).includes(f.vpa) && t.isFailure && FAILURE.test(narration(t)),
      );
      expect(hit, `${f.vpa} ${f.expectedCause}`).toBeDefined();
    }
  });
});

describe('demo statement — what a statement does NOT contain', () => {
  /**
   * The privacy dividend, asserted rather than claimed.
   *
   * An SMS inbox carries OTPs, promotions and personal messages, and any parser
   * pointed at one has to read all of it before deciding what to discard. A
   * statement carries transactions and nothing else — there is no OTP here to
   * ignore, because there is no OTP in the file.
   */
  it('carries no one-time passwords', () => {
    const otps = DEMO_TXNS.filter((t) => /\botp\b|one time password/i.test(narration(t)));
    expect(otps).toHaveLength(0);
  });

  it('carries no promotional content', () => {
    const promos = DEMO_TXNS.filter((t) =>
      /pre-approved|cashback offer|joining fee|t&c apply/i.test(narration(t)),
    );
    expect(promos).toHaveLength(0);
  });

  it('every row is a movement of money with an amount and a direction', () => {
    for (const t of DEMO_TXNS) {
      expect(t.amount).toBeGreaterThan(0);
      expect(['DEBIT', 'CREDIT']).toContain(t.direction);
      expect(t.source).toBe('STATEMENT');
    }
  });
});
