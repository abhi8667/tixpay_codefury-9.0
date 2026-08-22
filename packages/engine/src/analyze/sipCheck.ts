import type { Cadence, IncomeEvent, Mandate, ShadowLedger, Shortfall, VerdictLevel } from '../types';
import { findShortfalls } from '../guard';
import { projectBalance } from '../project/curve';
import { formatIstDate } from '../time';

export interface SipCheckResult {
  level: VerdictLevel;
  headline: string;
  subline?: string;
  /** Shortfall days introduced or deepened by adding this SIP. Empty on CLEAR. */
  newShortfalls: Shortfall[];
}

/**
 * "Can I afford this SIP?" — the same before/after shortfall diff
 * `evaluatePayment` runs for a one-off payment, applied to a recurring
 * commitment instead. Answers the theme brief's "students begin SIPs without
 * understanding risk" directly: this is evaluated against the user's actual
 * projected cash flow, not a rule of thumb.
 */
export function checkSipAffordability(
  amount: number,
  cadence: Cadence,
  dayOfMonth: number,
  ledger: ShadowLedger,
  mandates: Mandate[],
  income: IncomeEvent[],
  now: Date,
  days = 90,
): SipCheckResult {
  const originalCurve = projectBalance(ledger, mandates, income, now, days);
  const originalShortfalls = findShortfalls(originalCurve, mandates);

  const hypotheticalSip: Mandate = {
    id: `sip_hypothetical_${amount}`,
    normalizedVpa: 'hypothetical.sip',
    displayName: 'This SIP',
    amount,
    cadence,
    dayOfMonth,
    nextDebit: now,
    confidence: 1,
    occurrences: 0,
    sourceTxnIds: [],
    priority: 'CRITICAL',
    category: 'SIP',
    isPaused: false,
  };

  const hypotheticalMandates = [...mandates, hypotheticalSip];
  const hypotheticalCurve = projectBalance(ledger, hypotheticalMandates, income, now, days);
  const hypotheticalShortfalls = findShortfalls(hypotheticalCurve, hypotheticalMandates);

  const originalDates = new Set(originalShortfalls.map((s) => s.date.getTime()));
  const newShortfalls = hypotheticalShortfalls.filter((s) => !originalDates.has(s.date.getTime()));

  if (newShortfalls.length === 0) {
    return {
      level: 'CLEAR',
      headline: `Clear — a ₹${amount.toLocaleString('en-IN')} SIP fits your projected cash flow.`,
      newShortfalls: [],
    };
  }

  const first = newShortfalls[0]!;
  const isSevere = newShortfalls.length > 1 || first.deficit > amount * 0.5;

  return {
    level: isSevere ? 'WARNING' : 'ADVISORY',
    headline: `Starting this SIP causes ${newShortfalls.length} shortfall day${newShortfalls.length > 1 ? 's' : ''}, the first on ${formatIstDate(first.date)}.`,
    subline: `You'd be short by ₹${first.deficit.toLocaleString('en-IN')} that day.`,
    newShortfalls,
  };
}
