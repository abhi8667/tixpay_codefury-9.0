import type {
  BalanceCurve, BalancePoint, IncomeEvent, LedgerEvent, Mandate, ShadowLedger,
} from '../types';
import { toPaise, toRupees } from '../money';
import { addDays, istDayKey, nextOccurrence, startOfIstDay } from '../time';

/**
 * Forward balance projection.
 *
 * Steps one IST day at a time from `now`, applying every mandate occurrence and
 * income event that lands on that day. Emits exactly `days` points — Person A's
 * morph animation interpolates point by point and requires both curves to have
 * identical length, so this is a hard guarantee, not a best effort.
 *
 * All accumulation is in paise. A 30-point curve built from float rupees
 * accumulates visible error, and the number on the projector is the product.
 */

/**
 * Confidence floor for projecting a mandate.
 *
 * A genuinely regular mandate with the minimum three occurrences scores
 * 0.6·(3/6) + 0.4·1 = 0.70. Coincidental buckets — three Swiggy orders that
 * happened to fall near each other — score 0.3–0.5 because their gap variance
 * is high. 0.6 sits in the gap and separates them cleanly.
 *
 * This matters more than it looks: projecting six phantom mandates moves the
 * balance curve by thousands of rupees and the shortfall lands on the wrong day.
 */
export const MIN_PROJECT_CONFIDENCE = 0.6;

export interface ProjectOptions {
  /** Ignore mandates below this confidence. Defaults to MIN_PROJECT_CONFIDENCE. */
  minMandateConfidence?: number;
  /**
   * Ignore income below this confidence. Defaults to 0 — all inferred income
   * counts. Raise it to see the curve a cautious user should see, one that does
   * not assume the freelance cheque arrives.
   */
  minIncomeConfidence?: number;
}

/** Every occurrence of a mandate within [from, to], inclusive. */
export function occurrencesInWindow(mandate: Mandate, from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const floor = startOfIstDay(from);

  // nextDebit is computed at detection time; the World Clock can move `now`
  // past it, so re-anchor rather than trusting the stored date.
  let cursor = nextOccurrence(mandate.nextDebit, mandate.cadence, mandate.dayOfMonth, floor);

  for (let guard = 0; guard < 64; guard++) {
    if (cursor.getTime() > to.getTime()) break;
    if (cursor.getTime() >= floor.getTime()) dates.push(cursor);
    const step = addDays(cursor, 1);
    cursor = nextOccurrence(step, mandate.cadence, mandate.dayOfMonth, step);
  }

  return dates;
}

/**
 * Project the balance forward `days` days from `now`.
 *
 * Paused mandates are skipped — that is how an intervention's `resultingCurve`
 * gets built: flip `isPaused`, re-project, hand the result to Person A
 * precomputed so the tap-to-animate has nothing to wait for.
 */
export function projectBalance(
  ledger: ShadowLedger,
  mandates: Mandate[],
  income: IncomeEvent[],
  now: Date,
  days = 30,
  options: ProjectOptions = {},
): BalanceCurve {
  const minMandate = options.minMandateConfidence ?? MIN_PROJECT_CONFIDENCE;
  const minIncome = options.minIncomeConfidence ?? 0;

  const start = startOfIstDay(now);
  const end = addDays(start, Math.max(0, days - 1));

  // Bucket every future event by IST day key, so a debit at 00:30 IST lands on
  // the day the user would say it landed on.
  const byDay = new Map<string, LedgerEvent[]>();
  const add = (date: Date, event: LedgerEvent) => {
    const key = istDayKey(date);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  };

  for (const m of mandates) {
    if (m.isPaused) continue;
    if (m.confidence < minMandate) continue;
    for (const date of occurrencesInWindow(m, start, end)) {
      add(date, {
        kind: 'MANDATE',
        label: m.displayName,
        amount: -m.amount,
        mandateId: m.id,
      });
    }
  }

  for (const e of income) {
    if (e.confidence < minIncome) continue;
    if (e.date.getTime() < start.getTime() || e.date.getTime() > end.getTime()) continue;
    add(e.date, {
      kind: 'INCOME',
      label: e.label ?? 'Income',
      amount: e.amount,
    });
  }

  let paise = toPaise(ledger.balanceAt(now));
  const curve: BalancePoint[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const events = byDay.get(istDayKey(date)) ?? [];

    // Outflows before inflows on the same day. A bank that debits a mandate in
    // the morning does not know a credit is coming at 6pm, and neither should
    // our projection — ordering them the other way hides real bounces.
    const ordered = [...events].sort((a, b) => a.amount - b.amount);
    for (const e of ordered) paise += toPaise(e.amount);

    curve.push({ date, balance: toRupees(paise), events: ordered });
  }

  return curve;
}

/** Re-project with one mandate paused. The core of every PAUSE intervention. */
export function projectWithPaused(
  ledger: ShadowLedger,
  mandates: Mandate[],
  income: IncomeEvent[],
  now: Date,
  pausedMandateIds: string[],
  days = 30,
  options: ProjectOptions = {},
): BalanceCurve {
  const paused = new Set(pausedMandateIds);
  const patched = mandates.map((m) => (paused.has(m.id) ? { ...m, isPaused: true } : m));
  return projectBalance(ledger, patched, income, now, days, options);
}
