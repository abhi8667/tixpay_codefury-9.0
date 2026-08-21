import type { ShadowLedger, Transaction } from '../types';
import { toPaise, toRupees } from '../money';
import { startOfIstDay } from '../time';

/**
 * The shadow ledger.
 *
 * We cannot read the real account balance — that needs a UPI PIN inside a
 * licensed PSP app. So we reconstruct it: walk the transactions forward, and
 * whenever an SMS states a balance, snap to it and record how far our inferred
 * figure had drifted.
 *
 * `drift` is worth showing on stage. "Our inferred balance tracks the bank's
 * stated balance to within ₹X" is a much stronger claim than "we estimate your
 * balance", and it is measured, not asserted.
 */

export interface BuildLedgerOptions {
  /**
   * The account to build the ledger for. Auto-detected when omitted: the tail
   * carrying the most balance-stating messages, because the account the bank
   * keeps telling us the balance of is the one we can actually reconcile.
   */
  accountTail?: string;
}

interface Checkpoint {
  t: number; // epoch ms
  paise: number;
  reconciled: boolean;
}

/**
 * Pick the account to reconcile against.
 *
 * A real inbox holds several accounts plus credit cards. Mixing them produces a
 * balance that belongs to nobody. We choose the tail with the most balance
 * hints; ties break on transaction count.
 */
export function detectPrimaryAccount(txns: Transaction[]): string | undefined {
  const hints = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const t of txns) {
    if (!t.accountTail) continue;
    counts.set(t.accountTail, (counts.get(t.accountTail) ?? 0) + 1);
    if (t.balanceHint !== undefined) {
      hints.set(t.accountTail, (hints.get(t.accountTail) ?? 0) + 1);
    }
  }

  let best: string | undefined;
  let bestHints = -1;
  let bestCount = -1;

  // Sorted for determinism — Map iteration order is insertion order, which
  // depends on inbox ordering, and the demo must not vary between runs.
  for (const tail of [...counts.keys()].sort()) {
    const h = hints.get(tail) ?? 0;
    const c = counts.get(tail) ?? 0;
    if (h > bestHints || (h === bestHints && c > bestCount)) {
      best = tail;
      bestHints = h;
      bestCount = c;
    }
  }

  return best;
}

/**
 * Build a shadow ledger from parsed transactions.
 *
 * Failed transactions do not move the balance. That is the whole point of a
 * failure: the money never left. Counting a bounced ₹5,000 SIP as a debit
 * understates the balance by exactly the amount that did not move, and every
 * downstream projection inherits the error.
 */
export function buildLedger(
  txns: Transaction[],
  options: BuildLedgerOptions = {},
): ShadowLedger {
  const accountTail = options.accountTail ?? detectPrimaryAccount(txns);

  // Never mutate the caller's array — Person C's store re-renders on identity.
  const scoped = (accountTail ? txns.filter((t) => t.accountTail === accountTail) : [...txns])
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const checkpoints: Checkpoint[] = [];
  const hintTimestamps: number[] = [];
  const drifts: number[] = [];

  let paise = 0;
  let lastReconciledAt: Date | undefined;

  for (const t of scoped) {
    // A failure moves nothing.
    if (!t.isFailure) {
      paise += (t.direction === 'DEBIT' ? -1 : 1) * toPaise(t.amount);
    }

    let reconciled = false;
    if (t.balanceHint !== undefined) {
      const stated = toPaise(t.balanceHint);
      // The FIRST hint is not drift, it is bootstrap. We start from zero with no
      // idea what the account holds; the first stated balance is where we learn
      // it. Counting that gap as drift reports a ₹38,000 error on a ledger that
      // is in fact exact, and destroys the one honest number in the pitch.
      if (hintTimestamps.length > 0) drifts.push(Math.abs(paise - stated));
      paise = stated; // snap
      reconciled = true;
      lastReconciledAt = t.timestamp;
      hintTimestamps.push(t.timestamp.getTime());
    }

    checkpoints.push({ t: t.timestamp.getTime(), paise, reconciled });
  }

  const lastDrift = drifts.length ? drifts[drifts.length - 1]! : 0;

  /** Balance at the end of the IST day containing `date`. */
  function balanceAt(date: Date): number {
    if (checkpoints.length === 0) return 0;

    // End of the IST day, so a debit earlier the same day is included.
    const cutoff = startOfIstDay(date).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (cutoff < checkpoints[0]!.t) return 0;

    let lo = 0;
    let hi = checkpoints.length - 1;
    let found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (checkpoints[mid]!.t <= cutoff) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return toRupees(checkpoints[found]!.paise);
  }

  const ledger: ShadowLedger = {
    txns: scoped,
    currentBalance: toRupees(paise),
    drift: toRupees(lastDrift),
    balanceAt,
  };

  if (lastReconciledAt) ledger.lastReconciledAt = lastReconciledAt;
  if (accountTail) ledger.accountTail = accountTail;
  // Count every snap, including the bootstrap — that one reconciled too. It is
  // only excluded from the DRIFT statistics, where it would be meaningless.
  ledger.reconciliations = hintTimestamps.length;
  ledger.maxDrift = toRupees(drifts.length ? Math.max(...drifts) : 0);
  ledger.meanDrift = toRupees(
    drifts.length ? Math.round(drifts.reduce((s, d) => s + d, 0) / drifts.length) : 0,
  );
  ledger.hintTimestamps = hintTimestamps;

  return ledger;
}

/**
 * Whether the ledger had a recent balance statement near `date`.
 *
 * classifyFailure needs this: without a reconciliation nearby, our inferred
 * balance is a guess, and a confident wrong cause is worse than an honest gap.
 */
export function hasReliableBalanceAt(ledger: ShadowLedger, date: Date, withinDays = 7): boolean {
  const hints = ledger.hintTimestamps ?? [];
  if (hints.length === 0) return false;
  const window = withinDays * 24 * 60 * 60 * 1000;
  const t = date.getTime();
  return hints.some((h) => Math.abs(h - t) <= window);
}

/**
 * A copy of the ledger with one extra transaction applied.
 *
 * `evaluatePayment` needs this to answer "what would this payment do?" without
 * touching the real ledger. Cloning by rebuilding keeps the balance-hint
 * snapping logic in exactly one place.
 */
export function withTransaction(ledger: ShadowLedger, txn: Transaction): ShadowLedger {
  const options: BuildLedgerOptions = {};
  if (ledger.accountTail) options.accountTail = ledger.accountTail;
  // The hypothetical txn is on the ledger's account by definition.
  const hypothetical: Transaction = ledger.accountTail
    ? { ...txn, accountTail: ledger.accountTail }
    : txn;
  return buildLedger([...ledger.txns, hypothetical], options);
}
