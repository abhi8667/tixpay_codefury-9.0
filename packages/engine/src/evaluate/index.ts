import type { Card, IncomeEvent, Mandate, PaymentIntent, PaymentVerdict, ShadowLedger, Shortfall, Transaction, VerdictLevel } from '../types';
import { resolveMcc, recommendInstrument } from '../route';
import { findShortfalls } from '../guard';
import { projectBalance } from '../project/curve';
import { withTransaction } from '../project/ledger';
import { formatIstDate, istDayKey } from '../time';

/**
 * Headline feature: intercepts a payment before confirmation, evaluates its
 * blast radius on the balance curve, and recommends the best card.
 */
export function evaluatePayment(
  intent: PaymentIntent,
  ledger: ShadowLedger,
  mandates: Mandate[],
  income: IncomeEvent[],
  cards: Card[],
  now: Date
): PaymentVerdict {
  // 1. Resolve MCC and get recommendation
  const { mcc, confidence } = resolveMcc(intent.vpa, intent.mcc ? { pa: intent.vpa, mc: intent.mcc } : undefined);
  const recommendation = recommendInstrument(mcc, intent.amount, cards, {});
  recommendation.mccConfidence = confidence;

  // 2. Original timeline vs Hypothetical timeline
  const originalCurve = projectBalance(ledger, mandates, income, now, 30, { minMandateConfidence: 0.6 });
  const originalShortfalls = findShortfalls(originalCurve, mandates);
  
  const hypotheticalTxn: Transaction = {
    id: `intent_${now.getTime()}`,
    direction: 'DEBIT',
    amount: intent.amount,
    bank: 'HDFC', // Default placeholder
    timestamp: now,
    isFailure: false,
    source: 'INTENT',
    vpa: intent.vpa,
    raw: { address: '', body: 'intent', date: now.getTime() },
  };

  const hypotheticalLedger = withTransaction(ledger, hypotheticalTxn);
  const hypotheticalCurve = projectBalance(hypotheticalLedger, mandates, income, now, 30, { minMandateConfidence: 0.6 });
  const hypotheticalShortfalls = findShortfalls(hypotheticalCurve, mandates);

  // 3. Analyze differences
  let newShortfall: Shortfall | undefined;
  let shiftedShortfall: { from: Date; to: Date } | undefined;
  let atRisk: Mandate[] = [];
  let level: VerdictLevel = 'CLEAR';
  let headline = 'Clear to pay.';
  let subline: string | undefined;

  const getEarliest = (s: Shortfall[]) => [...s].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const origEarliest = getEarliest(originalShortfalls);
  const hypoEarliest = getEarliest(hypotheticalShortfalls);

  if (hypoEarliest) {
    const isCriticalOrHigh = hypoEarliest.atRisk.some(m => m.priority === 'CRITICAL' || m.priority === 'HIGH');
    const targetLevel: VerdictLevel = isCriticalOrHigh ? 'WARNING' : 'ADVISORY';

    if (!origEarliest) {
      newShortfall = hypoEarliest;
      atRisk = hypoEarliest.atRisk;
      level = targetLevel;
      const dateStr = formatIstDate(hypoEarliest.date);
      headline = `This leaves you ₹${hypoEarliest.deficit.toLocaleString('en-IN')} short on ${dateStr}.`;
      
      const critical = atRisk.find(m => m.priority === 'CRITICAL' || m.priority === 'HIGH');
      if (critical) {
        subline = `Your ₹${critical.amount.toLocaleString('en-IN')} ${critical.displayName} will bounce.`;
      }
    } else {
      const origKey = istDayKey(origEarliest.date);
      const hypoKey = istDayKey(hypoEarliest.date);
      
      if (hypoKey < origKey) {
        shiftedShortfall = { from: origEarliest.date, to: hypoEarliest.date };
        atRisk = hypoEarliest.atRisk;
        level = targetLevel;
        
        const fromStr = formatIstDate(origEarliest.date);
        const toStr = formatIstDate(hypoEarliest.date);
        headline = `This moves your shortfall from ${fromStr} to ${toStr}.`;
        
        const critical = atRisk.find(m => m.priority === 'CRITICAL' || m.priority === 'HIGH');
        if (critical) {
          subline = `Your ₹${critical.amount.toLocaleString('en-IN')} ${critical.displayName} will bounce earlier.`;
        }
      } else if (hypoEarliest.deficit > origEarliest.deficit + 10) {
        // Same day or later, but deepens an existing shortfall
        newShortfall = hypoEarliest;
        atRisk = hypoEarliest.atRisk;
        level = targetLevel;
        
        const dateStr = formatIstDate(hypoEarliest.date);
        headline = `This deepens your shortfall on ${dateStr} to ₹${hypoEarliest.deficit.toLocaleString('en-IN')}.`;
        
        const critical = atRisk.find(m => m.priority === 'CRITICAL' || m.priority === 'HIGH');
        if (critical) {
          subline = `Your ₹${critical.amount.toLocaleString('en-IN')} ${critical.displayName} is at risk.`;
        }
      }
    }
  }

  // 4. Advisory fallback
  if (level === 'CLEAR' && recommendation && recommendation.rail === 'CARD_SWIPE') {
    level = 'ADVISORY';
    headline = 'Better paid by card.';
    subline = recommendation.reason;
  }

  return {
    level,
    newShortfall,
    shiftedShortfall,
    atRisk,
    recommendation,
    headline,
    subline
  };
}
