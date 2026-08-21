import type { Card, Recommendation, UpiIntent } from '../types';
import vpaPatterns from '../../data/vpa_patterns.json';

/**
 * Resolve an MCC for a payment intent.
 * 1. Intent `mc` param is gold standard (1.0).
 * 2. Regex matching against known VPAs (0.6).
 * 3. Fallback to generic merchant (0.2).
 */
export function resolveMcc(vpa: string, qrPayload?: UpiIntent): { mcc: string; confidence: number } {
  if (qrPayload?.mc) {
    return { mcc: qrPayload.mc, confidence: 1.0 };
  }

  for (const [pattern, mcc] of Object.entries(vpaPatterns)) {
    if (new RegExp(pattern, 'i').test(vpa)) {
      return { mcc: mcc as string, confidence: 0.6 };
    }
  }

  // 5499 = Misc Food Store / Convenience, a safe generic fallback
  return { mcc: '5499', confidence: 0.2 };
}

/**
 * Evaluate cards and recommend the best instrument.
 */
export function recommendInstrument(
  mcc: string,
  amount: number,
  cards: Card[],
  mtdSpend: Record<string, number>
): Recommendation {
  if (cards.length === 0) {
    return {
      instrument: 'UPI_BANK_ACCOUNT',
      rail: 'UPI',
      reason: 'No cards available.',
      valueDelta: 0,
      mccConfidence: 1.0,
      warnings: []
    };
  }

  interface ScoredCard {
    card: Card;
    value: number;
    reason: string;
    warnings: string[];
  }

  const scored: ScoredCard[] = [];

  for (const card of cards) {
    if (card.mccExclusions.includes(mcc)) {
      continue;
    }

    let rate = card.categoryRates[mcc] ?? card.rewardRate;
    let value = (amount * rate) / 100;
    let reason = `Earns ₹${value.toFixed(1)} reward.`;
    const warnings: string[] = [];

    // Cap checking
    const spend = mtdSpend[card.id] ?? 0;
    if (card.monthlyRewardCap) {
      const remaining = card.monthlyRewardCap - spend;
      if (remaining <= 0) {
        rate = card.rewardRate; // Fall back to base rate if capped
        value = (amount * rate) / 100;
        warnings.push('Category reward cap reached.');
        reason = `Earns ₹${value.toFixed(1)} (capped).`;
      }
    }

    // Fee waiver proximity
    if (card.feeWaiverThreshold && card.ytdSpend !== undefined && card.annualFee) {
      const delta = card.feeWaiverThreshold - card.ytdSpend;
      if (delta > 0 && delta <= 10000) { // e.g., within 10k of waiver
        // This dominates everything.
        value += card.annualFee; // Massive artificial boost to ensure it wins
        reason = `You're ₹${delta.toLocaleString('en-IN')} from your fee waiver.`;
      }
    }

    scored.push({ card, value, reason, warnings });
  }

  if (scored.length === 0) {
    return {
      instrument: 'UPI_BANK_ACCOUNT',
      rail: 'UPI',
      reason: 'All cards exclude this category.',
      valueDelta: 0,
      mccConfidence: 1.0,
      warnings: []
    };
  }

  scored.sort((a, b) => b.value - a.value);
  const best = scored[0]!;
  const nextBest = scored[1];
  const valueDelta = best.value - (nextBest ? nextBest.value : 0);

  return {
    instrument: best.card,
    rail: best.card.upiLinkable ? 'UPI' : 'CARD_SWIPE',
    reason: best.reason,
    valueDelta,
    mccConfidence: 1.0, // Filled in by caller who knows the MCC source
    warnings: best.warnings
  };
}
