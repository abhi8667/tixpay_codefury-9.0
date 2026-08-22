import type { IncomeEvent, Transaction } from '../types';
import { normalizeVpa } from '../detect/mandates';
import { addDays, istDayOfMonth, nextOccurrence, startOfIstDay } from '../time';
import { round2 } from '../money';

/**
 * Income inference.
 *
 * Two patterns, because a real inbox has both and they behave nothing alike:
 *
 *   SALARIED   — same amount, same day of month. Predictable, high confidence.
 *   IRREGULAR  — freelance invoices. Variable amount, variable date. We project
 *                the rolling mean at the median gap, and we mark it uncertain.
 *
 * The confidence figure is not decoration. Person C can raise
 * `minIncomeConfidence` on the projection to see the curve a cautious user
 * should see — one that does not assume the freelance cheque arrives.
 */

/** A credit below this is a refund or a friend paying you back, not income. */
const MIN_INCOME_AMOUNT = 5000;

/** Below this many observations we cannot tell a pattern from a coincidence. */
const MIN_OCCURRENCES = 3;

/** Amount spread at or under this reads as a fixed salary. */
const SALARY_AMOUNT_CV = 0.05;

/** Day-of-month spread at or under this reads as a fixed pay date. */
const SALARY_DAY_SPREAD = 2;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[]): number {
  if (xs.length <= 1) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Group key for a credit.
 *
 * A salary credit carries no VPA — the narration reads "NEFT CR-ACME TECH PVT
 * LTD-SALARY MAR2026" — so we fall back to the narration with digits stripped,
 * which makes MAR2026 and FEB2026 land in the same bucket.
 */
function sourceKey(t: Transaction): string {
  if (t.vpa) return normalizeVpa(t.vpa);
  const hint = (t.merchantHint ?? '').toLowerCase();
  const cleaned = hint
    .replace(/\b(?:a\/c|acct|ac|no|on|from|vpa|towards|by|transfer|upi)\b/g, ' ')
    // Digits go BEFORE month names. 'SALARY SEP25' will not match /\bsep\b/
    // while the 25 is still attached — a digit is a word character, so there is
    // no boundary after 'sep'. Strip to letters first, then the month falls out.
    .replace(/[^a-z\s]/g, ' ')
    // Month names must go too, or each payslip becomes its own bucket, never
    // reaches three occurrences, and the salary is silently never detected.
    // Exact alternatives, not a `mar[a-z]*` prefix — that eats 'marketing'.
    .replace(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || `bank:${t.bank}`;
}

function labelFor(key: string, kind: 'SALARY' | 'IRREGULAR'): string {
  if (kind === 'SALARY') return 'Salary';
  if (/client|invoice|payout|freelance/.test(key)) return 'Freelance income';
  return 'Recurring income';
}

export interface InferIncomeOptions {
  /** How far ahead to project. Match the projection window. */
  days?: number;
  /** Ignore credits under this. Defaults to ₹5,000. */
  minAmount?: number;
}

/**
 * Recurring credits → projected future income events.
 *
 * Takes `now` because it projects forward. Nothing here reads the system clock,
 * so Person C's World Clock moves these events exactly as it moves everything
 * else.
 */
export function inferIncomeEvents(
  txns: Transaction[],
  now: Date,
  options: InferIncomeOptions = {},
): IncomeEvent[] {
  const days = options.days ?? 45;
  const minAmount = options.minAmount ?? MIN_INCOME_AMOUNT;

  const credits = txns.filter(
    (t) => t.direction === 'CREDIT' && !t.isFailure && t.amount >= minAmount,
  );

  const groups = new Map<string, Transaction[]>();
  for (const t of credits) {
    const key = sourceKey(t);
    const bucket = groups.get(key);
    if (bucket) bucket.push(t);
    else groups.set(key, [t]);
  }

  const windowStart = startOfIstDay(now);
  const windowEnd = addDays(windowStart, days);
  const events: IncomeEvent[] = [];

  // Sorted keys keep the output order stable run to run.
  for (const key of [...groups.keys()].sort()) {
    const group = groups
      .get(key)!
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (group.length < MIN_OCCURRENCES) continue;

    const amounts = group.map((t) => t.amount);
    const last = group[group.length - 1]!;

    const gaps: number[] = [];
    for (let i = 1; i < group.length; i++) {
      gaps.push(
        Math.round(
          (group[i]!.timestamp.getTime() - group[i - 1]!.timestamp.getTime()) / 86_400_000,
        ),
      );
    }

    const amountMean = mean(amounts);
    const cv = amountMean ? stdDev(amounts) / amountMean : 1;

    const daysOfMonth = group.map((t) => istDayOfMonth(t.timestamp));
    const daySpread = Math.max(...daysOfMonth) - Math.min(...daysOfMonth);

    const salaried = cv <= SALARY_AMOUNT_CV && daySpread <= SALARY_DAY_SPREAD;
    const countScore = Math.min(group.length / 6, 1);

    if (salaried) {
      const amount = round2(median(amounts));
      const dayOfMonth = Math.round(median(daysOfMonth));
      // Fixed amount on a fixed day is about as predictable as income gets.
      const confidence = round2(Math.min(0.6 + 0.35 * countScore, 0.95));

      let next = nextOccurrence(last.timestamp, 'MONTHLY', dayOfMonth, now);
      for (let guard = 0; guard < 24 && next.getTime() < windowEnd.getTime(); guard++) {
        if (next.getTime() >= windowStart.getTime()) {
          events.push({
            amount,
            date: next,
            confidence,
            label: labelFor(key, 'SALARY'),
            kind: 'SALARY',
          });
        }
        next = nextOccurrence(addDays(next, 1), 'MONTHLY', dayOfMonth, addDays(next, 1));
      }
      continue;
    }

    // Irregular: a rolling mean at the median gap, and we say it is uncertain.
    const gapMedian = median(gaps);
    if (gapMedian < 3 || gapMedian > 120) continue;

    const recent = group.filter(
      (t) => t.timestamp.getTime() >= last.timestamp.getTime() - 90 * 86_400_000,
    );
    const amount = round2(mean((recent.length >= 2 ? recent : group).map((t) => t.amount)));

    // Variable amounts and dates cap out well below salary. A guard that treats
    // a freelance cheque as certain is the guard that lets you bounce.
    const regularity = 1 - Math.min(stdDev(gaps) / Math.max(gapMedian, 1), 1);
    const confidence = round2(Math.max(0.2, Math.min(0.25 + 0.3 * countScore + 0.2 * regularity, 0.6)));

    let next = addDays(last.timestamp, Math.round(gapMedian));
    for (let guard = 0; guard < 40 && next.getTime() < windowEnd.getTime(); guard++) {
      if (next.getTime() >= windowStart.getTime()) {
        events.push({
          amount,
          date: next,
          confidence,
          label: labelFor(key, 'IRREGULAR'),
          kind: 'IRREGULAR',
        });
      }
      next = addDays(next, Math.round(gapMedian));
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
