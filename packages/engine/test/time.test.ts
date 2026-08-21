import { describe, it, expect } from 'vitest';
import {
  istDayKey, istDayOfMonth, startOfIstDay, addDays, daysBetween,
  isSameIstDay, formatIstDate, formatRupees,
} from '../src/time';

// 12 March 2026, 00:30 IST — the case a naive UTC read puts on the 11th.
const earlyIst = new Date('2026-03-12T00:30:00+05:30');
// 12 March 2026, 23:45 IST — still the 12th.
const lateIst = new Date('2026-03-12T23:45:00+05:30');

describe('IST day boundaries', () => {
  it('keeps a 00:30 IST debit on the correct day', () => {
    expect(istDayKey(earlyIst)).toBe('2026-03-12');
    expect(istDayOfMonth(earlyIst)).toBe(12);
  });

  it('keeps a 23:45 IST debit on the correct day', () => {
    expect(istDayKey(lateIst)).toBe('2026-03-12');
    expect(istDayOfMonth(lateIst)).toBe(12);
  });

  it('treats both as the same day', () => {
    expect(isSameIstDay(earlyIst, lateIst)).toBe(true);
  });

  it('snaps to midnight IST', () => {
    expect(startOfIstDay(lateIst).toISOString()).toBe('2026-03-11T18:30:00.000Z');
  });

  it('counts whole days across a boundary', () => {
    expect(daysBetween(earlyIst, lateIst)).toBe(0);
    expect(daysBetween(earlyIst, addDays(earlyIst, 3))).toBe(3);
    expect(daysBetween(lateIst, earlyIst)).toBe(0);
  });

  it('spans a month end correctly', () => {
    const feb28 = new Date('2026-02-28T20:00:00+05:30');
    const mar03 = new Date('2026-03-03T02:00:00+05:30');
    expect(daysBetween(feb28, mar03)).toBe(3);
  });
});

describe('stage formatting', () => {
  it('formats dates the way the headline reads', () => {
    expect(formatIstDate(new Date('2026-03-09T10:00:00+05:30'))).toBe('9 March');
    expect(formatIstDate(earlyIst)).toBe('12 March');
  });

  it('formats rupees with Indian grouping', () => {
    expect(formatRupees(3200)).toBe('₹3,200');
    expect(formatRupees(125000)).toBe('₹1,25,000');
    expect(formatRupees(649)).toBe('₹649');
    expect(formatRupees(18204.55)).toBe('₹18,204.55');
    expect(formatRupees(-250)).toBe('-₹250');
  });
});
