import { describe, it, expect } from 'vitest';
import { DEMO_TXNS } from './_corpus';
import { detectMandates, normalizeVpa } from '../src/detect';
import demoExpectations from '../fixtures/demo_expectations.json';
import type { Transaction } from '../src/types';

describe('normalizeVpa', () => {
  it('strips gateway handles, numeric suffixes, and handles lowercase', () => {
    expect(normalizeVpa('swiggy.payu.98241@hdfcbank')).toBe('swiggy');
    expect(normalizeVpa('NETFLIX.RZP@ICICI')).toBe('netflix');
  });
});

describe('detectMandates against demo corpus', () => {
  const now = new Date(demoExpectations.now);
  const txns: Transaction[] = DEMO_TXNS;

  it('detects all expected mandates from the statement', () => {
    const mandates = detectMandates(txns, now);

    expect(mandates.length).toBeGreaterThanOrEqual(8);

    for (const exp of demoExpectations.mandates) {
      const found = mandates.find(m => exp.vpa.includes(m.normalizedVpa) || m.normalizedVpa === exp.vpa);
      expect(found, `Mandate ${exp.displayName} (${exp.vpa}) must be detected`).toBeDefined();
      expect(found!.amount).toBe(exp.amount);
      expect(found!.category).toBe(exp.category);
      expect(found!.occurrences).toBeGreaterThanOrEqual(3);
      expect(found!.nextDebit.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });

  it('never returns duplicate mandate IDs', () => {
    const mandates = detectMandates(txns, now);
    const ids = mandates.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});
