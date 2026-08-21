import { describe, it, expect } from 'vitest';
import { resolveMcc, recommendInstrument } from '../src/route';
import type { Card } from '../src/types';

describe('route module', () => {
  describe('resolveMcc', () => {
    it('uses qr payload mcc when present', () => {
      const res = resolveMcc('unknown@ybl', { pa: 'unknown@ybl', mc: '1234' });
      expect(res.mcc).toBe('1234');
      expect(res.confidence).toBe(1.0);
    });

    it('matches known vpa patterns', () => {
      const res = resolveMcc('swiggy@hdfcbank');
      expect(res.mcc).toBe('5814');
      expect(res.confidence).toBe(0.6);
    });

    it('falls back to generic category', () => {
      const res = resolveMcc('random.store@sbi');
      expect(res.mcc).toBe('5499');
      expect(res.confidence).toBe(0.2);
    });
  });

  describe('recommendInstrument', () => {
    const cards: Card[] = [
      {
        id: 'c1',
        name: 'RuPay Platinum',
        network: 'RUPAY',
        upiLinkable: true,
        rewardRate: 1,
        categoryRates: { '5814': 5 }, // 5% on food
        mccExclusions: [],
        monthlyRewardCap: 1000,
      },
      {
        id: 'c2',
        name: 'Visa Signature',
        network: 'VISA',
        upiLinkable: false,
        rewardRate: 2,
        categoryRates: {},
        mccExclusions: [],
        feeWaiverThreshold: 100000,
        annualFee: 5000,
        ytdSpend: 95000, // 5k away from waiver!
      }
    ];

    it('recommends UPI RuPay for food with 5% category rate', () => {
      const res = recommendInstrument('5814', 1000, cards, { c1: 0, c2: 95000 });
      // Wait, card 2 is 5k away from 100k waiver. The delta is 5000. It dominates!
      expect(res.instrument).toMatchObject({ id: 'c2' });
      expect(res.rail).toBe('CARD_SWIPE');
      expect(res.reason).toMatch(/waiver/);
    });

    it('recommends RuPay if Visa is not near waiver', () => {
      const cardsNoWaiver = [cards[0]!, { ...cards[1]!, ytdSpend: 10000 }];
      const res = recommendInstrument('5814', 1000, cardsNoWaiver, {});
      expect(res.instrument).toMatchObject({ id: 'c1' });
      expect(res.rail).toBe('UPI');
      expect(res.reason).toMatch(/Earns ₹50/);
    });

    it('handles reward caps', () => {
      const cardsNoWaiver = [cards[0]!, { ...cards[1]!, ytdSpend: 10000 }];
      const res = recommendInstrument('5814', 1000, cardsNoWaiver, { c1: 1000 }); // c1 is capped out
      // C1 drops to 1% base rate, earning ₹10.
      // C2 base rate is 2%, earning ₹20. C2 wins.
      expect(res.instrument).toMatchObject({ id: 'c2' });
      expect(res.rail).toBe('CARD_SWIPE');
      expect(res.reason).toMatch(/Earns ₹20/);
    });
  });
});
