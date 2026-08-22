import { describe, it, expect } from 'vitest';
import { classifyFailure } from '../src/attribute';
import type { ShadowLedger, Transaction } from '../src/types';

describe('attribute module', () => {
  const dummyTxn = (amount: number, time: number): Transaction => ({
    id: 't1',
    direction: 'DEBIT',
    amount,
    bank: 'HDFC',
    timestamp: new Date(time),
    isFailure: true
  });

  it('returns UNKNOWN if no reliable balance hints exist within 7 days', () => {
    const ledger: ShadowLedger = {
      txns: [], currentBalance: 0, drift: 0,
      hintTimestamps: [1000], // day 0
      balanceAt: () => 10000
    };
    // Txn happens on day 10
    const res = classifyFailure(dummyTxn(500, 10 * 24 * 60 * 60 * 1000 + 1000), ledger);
    expect(res).toBe('UNKNOWN');
  });

  it('returns LIQUIDITY if balance < amount', () => {
    const ledger: ShadowLedger = {
      txns: [], currentBalance: 0, drift: 0,
      hintTimestamps: [1000],
      balanceAt: () => 400
    };
    const res = classifyFailure(dummyTxn(500, 1000), ledger);
    expect(res).toBe('LIQUIDITY');
  });

  it('returns INTENTIONAL if balance >= amount', () => {
    const ledger: ShadowLedger = {
      txns: [], currentBalance: 0, drift: 0,
      hintTimestamps: [1000],
      balanceAt: () => 600
    };
    const res = classifyFailure(dummyTxn(500, 1000), ledger);
    expect(res).toBe('INTENTIONAL');
  });
});
