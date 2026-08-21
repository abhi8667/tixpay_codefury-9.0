import type { Mandate, Transaction, Cadence, Priority, Category } from '../types';
import { daysBetween, istDayOfMonth, istDayOfWeek, nextOccurrence } from '../time';

/** Keyword rules for categorisation and priority ranking */
const CATEGORY_RULES: Array<[RegExp, Category, Priority]> = [
  [/\bemi\b|loan|finserv|bajaj|hdb/i, 'EMI', 'CRITICAL'],
  [/\bsip\b|mutual|groww|zerodha|kuvera|nippon/i, 'SIP', 'CRITICAL'],
  [/insur|lic|policy|premium|term/i, 'INSURANCE', 'HIGH'],
  [/electric|gas|water|broadband|bses|jio|bill|utility/i, 'UTILITY', 'MEDIUM'],
  [/netflix|hotstar|prime|spotify|zee|apple|youtube/i, 'OTT', 'LOW'],
];

/** Standardize display names for known merchants */
const DISPLAY_NAMES: Array<[RegExp, string]> = [
  [/bajaj/i, 'Bajaj Finserv EMI'],
  [/jiofiber|jio/i, 'JioFiber'],
  [/lic/i, 'LIC Premium'],
  [/netflix/i, 'Netflix'],
  [/bses|electric/i, 'BESCOM Electricity'],
  [/nippon/i, 'Nippon India SIP'],
  [/hotstar/i, 'Disney+ Hotstar'],
  [/groww/i, 'Groww SIP'],
  [/spotify/i, 'Spotify'],
  [/swiggy/i, 'Swiggy'],
  [/zomato/i, 'Zomato'],
];

/**
 * Normalise a VPA for grouping: lowercase, strip numeric order/transaction IDs.
 * E.g., 'swiggy.payu.98241@hdfcbank' → 'swiggy.payu@hdfcbank'
 */
export function normalizeVpa(vpa: string): string {
  const parts = vpa.toLowerCase().trim().split('@');
  if (parts.length !== 2) return vpa.toLowerCase();
  const handle = parts[0]!.replace(/\.\d+$/g, '').replace(/\b[0-9a-f]{8,}\b/g, '');
  return `${handle}@${parts[1]}`;
}

/** Standard deviation helper for gap variance */
function stdDev(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

/** Median helper */
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Detect recurring auto-debit mandates from parsed transactions.
 *
 * Algorithm:
 * 1. Filter to DEBIT transactions.
 * 2. Bucket by (normalizedVpa, amount ±2%).
 * 3. Sort chronologically, compute inter-arrival gap in days.
 * 4. Take median gap: 28-31 → MONTHLY, 6-8 → WEEKLY, 89-92 → QUARTERLY.
 * 5. Require ≥3 occurrences.
 * 6. Calculate nextDebit projected forward past `now`.
 */
export function detectMandates(txns: Transaction[], now: Date): Mandate[] {
  const debits = txns.filter(t => t.direction === 'DEBIT' && !t.isFailure && t.vpa);

  // Group into buckets
  interface Bucket {
    vpa: string;
    normalizedVpa: string;
    txns: Transaction[];
    amounts: number[];
  }

  const buckets: Bucket[] = [];

  for (const t of debits) {
    const normVpa = normalizeVpa(t.vpa!);
    const existing = buckets.find(b => {
      if (b.normalizedVpa !== normVpa) return false;
      const medianAmt = median(b.amounts);
      return Math.abs(t.amount - medianAmt) / medianAmt <= 0.05;
    });

    if (existing) {
      existing.txns.push(t);
      existing.amounts.push(t.amount);
    } else {
      buckets.push({
        vpa: t.vpa!,
        normalizedVpa: normVpa,
        txns: [t],
        amounts: [t.amount],
      });
    }
  }

  const mandates: Mandate[] = [];

  for (const b of buckets) {
    if (b.txns.length < 3) continue;

    // Sort chronologically
    b.txns.sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());

    // Calculate inter-arrival gaps
    const gaps: number[] = [];
    for (let i = 1; i < b.txns.length; i++) {
      const g = daysBetween(b.txns[i - 1]!.timestamp, b.txns[i]!.timestamp);
      gaps.push(g);
    }

    const medGap = median(gaps);
    let cadence: Cadence | null = null;
    let gapDays = 30;

    if (medGap >= 27 && medGap <= 33) {
      cadence = 'MONTHLY';
      gapDays = 30;
    } else if (medGap >= 6 && medGap <= 8) {
      cadence = 'WEEKLY';
      gapDays = 7;
    } else if (medGap >= 85 && medGap <= 95) {
      cadence = 'QUARTERLY';
      gapDays = 90;
    }

    if (!cadence) continue;

    // Confidence
    const occurrences = b.txns.length;
    const countScore = Math.min(occurrences / 6, 1);
    const varScore = gaps.length > 0 ? 1 - Math.min(stdDev(gaps) / 5, 1) : 1;
    const confidence = Math.round((0.6 * countScore + 0.4 * varScore) * 100) / 100;

    // Category & Priority
    let category: Category = 'OTHER';
    let priority: Priority = 'LOW';
    const textToMatch = `${b.normalizedVpa} ${b.txns[0]?.merchantHint || ''}`;
    for (const [pattern, cat, prio] of CATEGORY_RULES) {
      if (pattern.test(textToMatch)) {
        category = cat;
        priority = prio;
        break;
      }
    }

    // Display Name
    let displayName = b.normalizedVpa.split('@')[0]!;
    for (const [pattern, name] of DISPLAY_NAMES) {
      if (pattern.test(textToMatch)) {
        displayName = name;
        break;
      }
    }
    // Capitalize first letter if default fallback
    if (displayName === b.normalizedVpa.split('@')[0]!) {
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }

    // Last debit date and next debit calculation.
    //
    // dayOfMonth is read in IST, not UTC: a debit at 00:30 IST is 19:00 UTC on
    // the *previous* day, and getUTCDate() would file it under the wrong date.
    //
    // nextDebit advances by calendar month anchored to dayOfMonth. Adding the
    // median gap instead walks the mandate forward — months are 28–31 days, so
    // a day-5 mandate with a 31-day median lands on the 8th.
    const lastTxn = b.txns[b.txns.length - 1]!;
    const dayOfMonth = cadence === 'WEEKLY'
      ? istDayOfWeek(lastTxn.timestamp)
      : istDayOfMonth(lastTxn.timestamp);
    const nextDebit = nextOccurrence(lastTxn.timestamp, cadence, dayOfMonth, now);

    const medianAmt = Math.round(median(b.amounts));

    mandates.push({
      id: `mandate_${b.normalizedVpa}_${medianAmt}`,
      normalizedVpa: b.normalizedVpa,
      displayName,
      amount: medianAmt,
      cadence,
      dayOfMonth,
      nextDebit,
      confidence,
      occurrences,
      sourceTxnIds: b.txns.map(t => t.id),
      priority,
      category,
      isPaused: false,
    });
  }

  // Sort by priority rank then nextDebit date
  const PRIO_RANK: Record<Priority, number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
  mandates.sort((a, b) => {
    if (PRIO_RANK[a.priority] !== PRIO_RANK[b.priority]) {
      return PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
    }
    return a.nextDebit.getTime() - b.nextDebit.getTime();
  });

  return mandates;
}
