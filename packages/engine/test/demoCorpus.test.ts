import { describe, it, expect } from 'vitest';
import inbox from '../fixtures/demo_inbox.json';
import expected from '../fixtures/demo_expectations.json';
import { entityCode } from '../src/parse/sms';

/**
 * Guards the demo corpus.
 *
 * The whole stage performance rests on a handful of numbers agreeing: ₹21,597
 * at `now`, ₹16,697 of debits by the 9th, a ₹5,000 SIP against ₹4,900 on the
 * 12th, and ₹649 of Netflix being exactly enough to rescue it. If someone
 * "tidies up" a mandate amount at hour 17, this fails immediately instead of
 * on the projector.
 */

const BANKS = ['HDFCBK', 'SBIINB', 'ICICIB', 'KOTAKB', 'AXISBK', 'PNBSMS'];

describe('demo corpus — shape', () => {
  it('is large enough to look like a real inbox', () => {
    expect(inbox.length).toBeGreaterThanOrEqual(400);
  });

  it('matches the generator manifest', () => {
    expect(inbox.length).toBe(expected.messageCount);
  });

  it('exercises all six bank parsers', () => {
    const seen = new Set(inbox.map((m) => entityCode(m.address)));
    for (const bank of BANKS) expect([...seen], bank).toContain(bank);
  });

  it('is sorted chronologically', () => {
    for (let i = 1; i < inbox.length; i++) {
      expect(inbox[i]!.date).toBeGreaterThanOrEqual(inbox[i - 1]!.date);
    }
  });

  it('ends before the anchor `now`', () => {
    const now = new Date(expected.now).getTime();
    expect(inbox.at(-1)!.date).toBeLessThan(now);
  });

  it('spans six months, so every mandate has six occurrences', () => {
    const months = new Set(inbox.map((m) => new Date(m.date).toISOString().slice(0, 7)));
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

  const FAILURE = /could not be processed|declined|insufficient|failed/i;

  it('each debits six times on the primary account', () => {
    for (const m of expected.mandates) {
      const hits = inbox.filter(
        (s) =>
          s.body.includes(m.vpa) &&
          s.body.includes(`**${expected.primaryAccount}`) &&
          !FAILURE.test(s.body),
      );
      expect(hits.length, m.displayName).toBe(m.expectedOccurrences);
    }
  });

  it('historical failures are extra messages, not missing debits', () => {
    // A bounced autopay names the same VPA but is not a successful occurrence.
    // detectMandates must still see six clean debits for each mandate, or the
    // "found from 6 SMS" provenance line in the demo script is wrong.
    for (const f of expected.historicalFailures) {
      const mandate = expected.mandates.find((m) => m.vpa === f.vpa);
      if (!mandate) continue;
      const all = inbox.filter((s) => s.body.includes(f.vpa));
      const clean = all.filter((s) => !FAILURE.test(s.body));
      expect(all.length, f.vpa).toBeGreaterThan(clean.length);
      expect(clean.length, f.vpa).toBe(mandate.expectedOccurrences);
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

  it('every declared failure actually appears in the inbox', () => {
    for (const f of expected.historicalFailures) {
      const hit = inbox.find(
        (s) =>
          s.body.includes(f.vpa) &&
          /could not be processed|declined|insufficient|failed/i.test(s.body),
      );
      expect(hit, `${f.vpa} ${f.expectedCause}`).toBeDefined();
    }
  });
});

describe('demo corpus — noise', () => {
  it('carries OTPs, promos and enquiries that must parse to null', () => {
    const otps = inbox.filter((m) => /\bOTP\b/i.test(m.body));
    const promos = inbox.filter((m) => /pre-approved|cashback|joining fee|T&C/i.test(m.body));
    expect(otps.length).toBeGreaterThanOrEqual(30);
    expect(promos.length).toBeGreaterThanOrEqual(25);
  });

  it('includes future-debit notices, which are not transactions', () => {
    expect(inbox.some((m) => /will be debited/i.test(m.body))).toBe(true);
  });

  it('includes card spends, which must not hit the account ledger', () => {
    expect(inbox.some((m) => /spent on Card/i.test(m.body))).toBe(true);
  });
});
