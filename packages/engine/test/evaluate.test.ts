import { describe, it, expect } from 'vitest';
import { evaluatePayment } from '../src/evaluate';
import type { Card, ShadowLedger, Mandate } from '../src/types';

describe('evaluate module', () => {
  const dummyCard: Card = {
    id: 'c1', name: 'RuPay', network: 'RUPAY', upiLinkable: true,
    rewardRate: 1, categoryRates: {}, mccExclusions: []
  };

  const dummyLedger: ShadowLedger = {
    txns: [{
      id: 't0', direction: 'CREDIT', amount: 0, bank: 'HDFC', 
      timestamp: new Date(), isFailure: false, balanceHint: 10000, 
      raw: { address: '', body: '', date: 0 }
    }],
    currentBalance: 10000,
    drift: 0,
    balanceAt: () => 10000
  };

  const dummyMandate = (amount: number): Mandate => ({
    id: 'm1', priority: 'CRITICAL', amount, category: 'SIP',
    normalizedVpa: 'sip', displayName: 'SIP', cadence: 'MONTHLY',
    dayOfMonth: 5, nextDebit: new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000), 
    confidence: 1, occurrences: 3, sourceTxnIds: [], isPaused: false
  });

  it('returns CLEAR if payment does not cause a shortfall', () => {
    const intent = { vpa: 'shop@ybl', payeeName: 'Shop', amount: 500, txnRef: 'TP1', source: 'QR' as const };
    
    // Ledger has 10k, mandate is 5k, payment is 500. Total 5.5k. Leaves 4.5k. Safe.
    const verdict = evaluatePayment(intent, dummyLedger, [dummyMandate(5000)], [], [dummyCard], new Date());
    
    expect(verdict.level).toBe('CLEAR');
    expect(verdict.newShortfall).toBeUndefined();
    expect(verdict.headline).toBe('Clear to pay.');
  });

  it('returns WARNING if payment creates a shortfall hitting a critical mandate', () => {
    const intent = { vpa: 'shop@ybl', payeeName: 'Shop', amount: 6000, txnRef: 'TP1', source: 'QR' as const };
    
    // Ledger has 10k, mandate is 5k, payment is 6k. Total 11k. Deficit of 1k!
    const verdict = evaluatePayment(intent, dummyLedger, [dummyMandate(5000)], [], [dummyCard], new Date());
    
    expect(verdict.level).toBe('WARNING');
    expect(verdict.newShortfall).toBeDefined();
    expect(verdict.headline).toMatch(/short/);
    expect(verdict.subline).toMatch(/SIP will bounce/);
  });
});
