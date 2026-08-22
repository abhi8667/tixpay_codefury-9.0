import { describe, it, expect } from 'vitest';
import { findShortfalls, proposeInterventions, rankByPriority } from '../src/guard';
import type { BalanceCurve, Mandate, ShadowLedger } from '../src/types';

describe('guard module', () => {
  const dummyMandate = (id: string, priority: any, amount: number, time = 1000): Mandate => ({
    id, priority, amount,
    normalizedVpa: id, displayName: id, cadence: 'MONTHLY',
    dayOfMonth: 1, nextDebit: new Date(time), confidence: 1,
    occurrences: 3, sourceTxnIds: [], category: 'OTHER', isPaused: false
  });

  describe('rankByPriority', () => {
    it('sorts by priority then amount', () => {
      const m1 = dummyMandate('m1', 'LOW', 1000);
      const m2 = dummyMandate('m2', 'HIGH', 500);
      const m3 = dummyMandate('m3', 'HIGH', 2000);

      const sorted = rankByPriority([m1, m2, m3]);
      expect(sorted[0]!.id).toBe('m3'); // High priority, larger amount
      expect(sorted[1]!.id).toBe('m2'); // High priority
      expect(sorted[2]!.id).toBe('m1'); // Low priority
    });
  });

  describe('findShortfalls', () => {
    it('finds contiguous shortfalls and reports the worst deficit', () => {
      const curve: BalanceCurve = [
        { date: new Date(1), balance: 1000, events: [] },
        { date: new Date(2), balance: 400, events: [{ kind: 'MANDATE', label: 'm1', amount: -600, mandateId: 'm1' }] },
        { date: new Date(3), balance: -100, events: [] },
        { date: new Date(4), balance: 600, events: [] }, // recovers
      ];

      const mandates = [dummyMandate('m1', 'LOW', 600)];

      const shortfalls = findShortfalls(curve, mandates, 500);
      expect(shortfalls).toHaveLength(1);
      expect(shortfalls[0]!.deficit).toBe(600); // 500 - (-100) = 600
      expect(shortfalls[0]!.atRisk[0]!.id).toBe('m1');
    });
  });

  describe('proposeInterventions', () => {
    it('generates sweep and pause options', () => {
      const shortfallDate = new Date(2000);
      const now = new Date(0);

      const m1 = dummyMandate('m1', 'LOW', 800, 1000);
      m1.category = 'OTT';
      const m2 = dummyMandate('m2', 'CRITICAL', 2000, 1500);
      m2.category = 'SIP';

      const shortfall = { date: shortfallDate, deficit: 600, atRisk: [m1, m2] };
      const ledger: ShadowLedger = {
        txns: [{
          id: 't0', direction: 'CREDIT', amount: 0, bank: 'HDFC', 
          timestamp: now, isFailure: false, balanceHint: 2700 
        }],
        currentBalance: 2700, drift: 0, balanceAt: () => 2700
      };

      const options = proposeInterventions(shortfall, [m1, m2], ledger, [], now);
      
      // Should propose SWEEP and PAUSE (because m1 is LOW priority and its amount > deficit)
      expect(options.length).toBeGreaterThanOrEqual(2);
      
      const sweep = options.find(o => o.kind === 'SWEEP')!;
      expect(sweep.amount).toBe(1500); // ceil((600+500)/500)*500 = 1500
      
      const pause = options.find(o => o.kind === 'PAUSE')!;
      expect(pause.target!.id).toBe('m1'); // Pauses the lowest priority mandate
    });
  });
});
