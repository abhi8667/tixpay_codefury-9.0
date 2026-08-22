import type { Transaction, Cadence } from '../types';
import { daysBetween, istDayOfMonth } from '../time';
import { categorizeTransaction, type SpendCategory } from './spend';
import { prettyCounterparty } from '../detect/mandates';

/**
 * The subscription audit: everything that charges this account again and again,
 * priced per year.
 *
 * This is deliberately NOT `detectMandates`. That function answers a question
 * the bounce guard asks — "which debit will fail, and when" — so it is strict:
 * three occurrences, amounts within 5%, a median gap inside a tight band. Being
 * strict is right there, because a false mandate puts a fabricated debit on the
 * projected curve and every downstream rupee inherits it.
 *
 * The question here is different and cheaper to be wrong about: "what are you
 * paying for on repeat?" A gym that charges ₹1,499 one month and ₹1,650 the
 * next is still a subscription, and leaving it out of the annual total is a
 * worse error than including it with a stated confidence. So the tolerances are
 * looser, nothing detected here ever touches the projection, and every row
 * carries the occurrence count that produced it.
 *
 * On a statement with no auto-debits at all — a student's UPI account, which is
 * the common case and the one the strict detector returns nothing for — this is
 * the feature that still has something true to say.
 */
export interface RecurringCharge {
  /** Counterparty key, as `Transaction.vpa`. */
  key: string;
  label: string;
  category: SpendCategory;
  /** Median charge, rupees. */
  amount: number;
  cadence: Cadence;
  /** Median days between charges. Shown so the cadence is checkable. */
  medianGapDays: number;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  /** Calendar day the charge tends to land on. */
  dayOfMonth: number;
  /** What this costs over twelve months at the observed cadence. */
  annualCost: number;
  /** Normalised to a month, so unlike cadences can be summed and compared. */
  monthlyCost: number;
  /** 0–1. Occurrence count and gap regularity, same shape as the detector's. */
  confidence: number;
  /**
   * The bank itself labelled this row as a standing instruction.
   *
   * Worth its own field because it is evidence of a different kind. Everything
   * else here is inferred from a pattern across rows; this is the bank stating
   * outright that a mandate executed — 'MandateExe' on an ICICI UPI Autopay
   * line, 'VSI/' on a Visa standing instruction, 'NACH DR' on the ECS rail.
   */
  viaAutopay: boolean;
  /**
   * True when the cadence was assumed rather than measured.
   *
   * A single autopay row proves a mandate exists but says nothing about its
   * rhythm. Monthly is the overwhelming default for UPI Autopay, so that is
   * what we assume — and we say we assumed it rather than presenting a made-up
   * annual figure as measured.
   */
  cadenceAssumed: boolean;
  /** Total actually charged inside the statement window. */
  totalPaid: number;
  sourceTxnIds: string[];
}

export interface SubscriptionAudit {
  charges: RecurringCharge[];
  /** Sum of `monthlyCost` across every charge. */
  totalMonthly: number;
  /** Sum of `annualCost`. The number worth putting on a screen. */
  totalAnnual: number;
  /** Charges not seen for more than two of their own cycles — likely dead. */
  dormant: RecurringCharge[];
}

/** Charges per year at each cadence. */
const PER_YEAR: Record<Cadence, number> = { WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4 };

/**
 * Narration markers by which a bank names a standing instruction outright.
 *
 * These are the highest-quality signal available and the pattern pass cannot
 * see them. A statement covering three months catches a subscription that
 * started six weeks ago exactly once, so requiring three occurrences drops it —
 * even though the bank wrote 'MandateExe' next to it and told us plainly that
 * it will charge again.
 *
 *   MandateExe   ICICI, on a UPI Autopay execution
 *   VSI/         Visa standing instruction on a card-on-file charge
 *   NACH / ACH   the ECS rail, where EMIs and insurance premiums live
 *   SI / E-MANDATE / AUTOPAY  the wording other banks use for the same thing
 */
const AUTOPAY_MARKER =
  /mandate\s?exe|mandateexecution|^vsi[/]|\bnach\b|\bach\s?d\b|\becs\b|e-?mandate|auto\s?pay|standing\s?instruction|\bsi[-/]/i;

/** True when any row in the group carries an autopay marker. */
function anyAutopay(txns: Transaction[]): boolean {
  return txns.some((t) => AUTOPAY_MARKER.test(t.merchantHint ?? ''));
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stdDev(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.sqrt(numbers.reduce((a, b) => a + (b - mean) ** 2, 0) / numbers.length);
}

function classifyGap(gap: number): { cadence: Cadence; gapDays: number } | null {
  if (gap >= 25 && gap <= 35) return { cadence: 'MONTHLY', gapDays: 30 };
  if (gap >= 6 && gap <= 8) return { cadence: 'WEEKLY', gapDays: 7 };
  if (gap >= 80 && gap <= 100) return { cadence: 'QUARTERLY', gapDays: 91 };
  return null;
}

/**
 * Find everything charging this account on a repeating schedule.
 *
 * Pure. `now` decides only which charges count as dormant.
 */
export function auditSubscriptions(txns: Transaction[], now: Date): SubscriptionAudit {
  const debits = txns.filter((t) => t.direction === 'DEBIT' && !t.isFailure && t.vpa);

  const byKey = new Map<string, Transaction[]>();
  for (const t of debits) {
    const list = byKey.get(t.vpa!) ?? [];
    list.push(t);
    byKey.set(t.vpa!, list);
  }

  const charges: RecurringCharge[] = [];

  for (const [key, all] of byKey) {
    all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const autopay = anyAutopay(all);

    // Bank-flagged autopay with too few charges to measure a rhythm: take the
    // bank's word that a mandate exists, assume the monthly default, and label
    // both facts on the row.
    if (all.length < 3) {
      if (!autopay) continue;
      const last = all[all.length - 1]!;
      const amount = Math.round(median(all.map((x) => x.amount)) * 100) / 100;
      charges.push({
        key,
        label: last.merchantName ?? prettyCounterparty(key),
        category: categorizeTransaction(last),
        amount,
        cadence: 'MONTHLY',
        medianGapDays: 30,
        occurrences: all.length,
        firstSeen: all[0]!.timestamp,
        lastSeen: last.timestamp,
        dayOfMonth: istDayOfMonth(last.timestamp),
        annualCost: Math.round(amount * 12),
        monthlyCost: Math.round(amount),
        // Capped low on purpose: the mandate is certain, the cadence is not.
        confidence: 0.5,
        totalPaid: Math.round(all.reduce((s, x) => s + x.amount, 0) * 100) / 100,
        viaAutopay: true,
        cadenceAssumed: true,
        sourceTxnIds: all.map((x) => x.id),
      });
      continue;
    }

    // Keep only the charges clustered around the median amount. A merchant you
    // both subscribe to and buy from ad hoc — Amazon, say — otherwise reports a
    // meaningless "median" somewhere between the two behaviours.
    const medianAmt = median(all.map((t) => t.amount));
    if (medianAmt <= 0) continue;
    const group = all.filter((t) => Math.abs(t.amount - medianAmt) / medianAmt <= 0.15);
    if (group.length < 3) continue;

    const gaps: number[] = [];
    for (let i = 1; i < group.length; i++) {
      gaps.push(daysBetween(group[i - 1]!.timestamp, group[i]!.timestamp));
    }
    const medGap = median(gaps);
    const classified = classifyGap(medGap);
    if (!classified) continue;

    const first = group[0]!;
    const last = group[group.length - 1]!;
    const amount = Math.round(median(group.map((t) => t.amount)) * 100) / 100;
    const perYear = PER_YEAR[classified.cadence];

    const countScore = Math.min(group.length / 6, 1);
    // Gap spread is judged against the cadence itself: three days of drift is
    // noise on a monthly charge and a different schedule entirely on a weekly.
    const varScore = 1 - Math.min(stdDev(gaps) / Math.max(classified.gapDays * 0.25, 2), 1);

    charges.push({
      key,
      label: first.merchantName ?? prettyCounterparty(key),
      category: categorizeTransaction(first),
      amount,
      cadence: classified.cadence,
      medianGapDays: Math.round(medGap),
      occurrences: group.length,
      firstSeen: first.timestamp,
      lastSeen: last.timestamp,
      dayOfMonth: istDayOfMonth(last.timestamp),
      annualCost: Math.round(amount * perYear),
      monthlyCost: Math.round((amount * perYear) / 12),
      confidence: Math.round((0.6 * countScore + 0.4 * varScore) * 100) / 100,
      totalPaid: Math.round(group.reduce((s, t) => s + t.amount, 0) * 100) / 100,
      viaAutopay: autopay,
      cadenceAssumed: false,
      sourceTxnIds: group.map((t) => t.id),
    });
  }

  charges.sort((a, b) => b.annualCost - a.annualCost);

  // Dormant: more than two cycles have passed with no charge. Two rather than
  // one because a monthly charge landing on the 31st legitimately skips a
  // month, and calling that cancelled would be wrong on a quarter of them.
  //
  // Rows whose cadence we assumed are excluded: calling a charge dormant means
  // comparing its silence against a rhythm, and we do not know theirs.
  const dormant = charges.filter((c) => {
    if (c.cadenceAssumed) return false;
    const gapDays = PER_YEAR[c.cadence] === 52 ? 7 : PER_YEAR[c.cadence] === 12 ? 30 : 91;
    return daysBetween(c.lastSeen, now) > gapDays * 2;
  });

  return {
    charges,
    totalMonthly: charges.reduce((s, c) => s + c.monthlyCost, 0),
    totalAnnual: charges.reduce((s, c) => s + c.annualCost, 0),
    dormant,
  };
}
