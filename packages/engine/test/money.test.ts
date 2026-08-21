import { describe, it, expect } from 'vitest';
import { toPaise, toRupees, round2, roundUpTo500, parseAmount } from '../src/money';

describe('money', () => {
  it('survives the classic float problem', () => {
    // 0.1 + 0.2 in rupees is what puts ₹3,199.9999 on the projector.
    expect(toRupees(toPaise(0.1) + toPaise(0.2))).toBe(0.3);
  });

  it('accumulates a long walk without drift', () => {
    let paise = 0;
    for (let i = 0; i < 1000; i++) paise += toPaise(19.99);
    expect(toRupees(paise)).toBe(19990);
  });

  it('rounds to 2dp', () => {
    expect(round2(18204.5549)).toBe(18204.55);
    expect(round2(1 / 3)).toBe(0.33);
  });

  it('rounds sweeps up to a figure a human would transfer', () => {
    expect(roundUpTo500(3247)).toBe(3500);
    expect(roundUpTo500(3500)).toBe(3500);
    expect(roundUpTo500(1)).toBe(500);
  });

  describe('parseAmount', () => {
    it('handles lakh grouping', () => {
      expect(parseAmount('1,25,000.00')).toBe(125000);
      expect(parseAmount('18,204.55')).toBe(18204.55);
      expect(parseAmount('649')).toBe(649);
    });

    it('returns null instead of NaN on garbage', () => {
      expect(parseAmount('abc')).toBeNull();
      expect(parseAmount('')).toBeNull();
      expect(parseAmount('12.345')).toBeNull();
    });
  });
});
