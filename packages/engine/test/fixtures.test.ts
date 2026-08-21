import { describe, it, expect } from 'vitest';
import cases from '../fixtures/sms_cases.json';

/**
 * Guards the fixture corpus itself. If a hand-edited case is malformed, this
 * fails loudly here rather than producing a confusing failure in parse.test.ts.
 */

const BANKS = ['HDFC', 'SBI', 'ICICI', 'KOTAK', 'AXIS', 'PNB'];

describe('sms_cases fixtures', () => {
  it('has enough cases to be meaningful', () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it('has unique case names', () => {
    const names = cases.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers every bank in the registry', () => {
    const covered = new Set(
      cases.filter((c) => c.expect).map((c) => (c.expect as { bank: string }).bank),
    );
    for (const bank of BANKS) expect([...covered]).toContain(bank);
  });

  it('includes negative cases — OTP, promo, future notice, non-financial', () => {
    const nulls = cases.filter((c) => c.expect === null);
    expect(nulls.length).toBeGreaterThanOrEqual(8);
  });

  it('every raw message is well formed', () => {
    for (const c of cases) {
      expect(c.raw.address, c.name).toMatch(/^[A-Z]{2}-[A-Z0-9]{6}(-[STP])?$/);
      expect(c.raw.body.length, c.name).toBeGreaterThan(20);
      expect(Number.isInteger(c.raw.date), c.name).toBe(true);
      expect(c.raw.date, c.name).toBeGreaterThan(1_600_000_000_000);
    }
  });

  it('every expectation states a direction and a failure flag', () => {
    for (const c of cases) {
      if (!c.expect) continue;
      const want = c.expect as { direction: string; isFailure: boolean; amount: number };
      expect(['DEBIT', 'CREDIT'], c.name).toContain(want.direction);
      expect(typeof want.isFailure, c.name).toBe('boolean');
      expect(want.amount, c.name).toBeGreaterThan(0);
    }
  });

  it('covers at least three failure cases for classifyFailure', () => {
    const failures = cases.filter((c) => c.expect && (c.expect as { isFailure: boolean }).isFailure);
    expect(failures.length).toBeGreaterThanOrEqual(3);
  });
});
