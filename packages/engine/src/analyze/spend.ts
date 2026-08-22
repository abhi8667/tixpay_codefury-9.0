import type { Transaction } from '../types';
import { startOfIstDay, addDays } from '../time';

/**
 * Spend categories for the Insights breakdown.
 *
 * Deliberately a separate type from `Category` (types.ts): that one exists to
 * rank mandates for the guard (EMI/SIP/INSURANCE/UTILITY/OTT/OTHER) and is
 * ADDITIVE-ONLY by contract. General spend needs buckets a recurring-debit
 * detector never sees — a one-off Swiggy order, a Flipkart purchase — so this
 * widens the vocabulary instead of overloading the guard's type.
 */
export type SpendCategory =
  | 'EMI' | 'SIP' | 'INSURANCE' | 'UTILITY' | 'OTT'
  | 'FOOD' | 'SHOPPING' | 'TRAVEL' | 'GROCERIES' | 'TRANSFER' | 'OTHER';

const SPEND_CATEGORY_RULES: Array<[RegExp, SpendCategory]> = [
  [/\bemi\b|loan|finserv|bajaj|hdb/i, 'EMI'],
  [/\bsip\b|mutual|groww|zerodha|kuvera|nippon/i, 'SIP'],
  [/insur|lic|policy|premium|term/i, 'INSURANCE'],
  [/electric|gas|water|broadband|bses|jio|bill|utility/i, 'UTILITY'],
  [/netflix|hotstar|prime video|spotify|zee|apple music|youtube/i, 'OTT'],
  [/swiggy|zomato|dominos|mcdonald|kfc|restaurant|eatery|cafe/i, 'FOOD'],
  [/amazon|flipkart|myntra|ajio|nykaa|shop|mall|store/i, 'SHOPPING'],
  [/uber|ola|irctc|indigo|redbus|petrol|fuel|metro|fastag/i, 'TRAVEL'],
  [/bigbasket|grofers|blinkit|zepto|dmart|grocery|supermarket/i, 'GROCERIES'],
  [/upi\/|transfer|neft|imps|rtgs|p2p/i, 'TRANSFER'],
];

/** Classify one transaction's narration for the spend breakdown. */
export function categorizeTransaction(txn: Transaction): SpendCategory {
  const text = `${txn.merchantHint ?? ''} ${txn.vpa ?? ''}`;
  for (const [pattern, category] of SPEND_CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return 'OTHER';
}

export interface CategorySpend {
  category: SpendCategory;
  amount: number;
  count: number;
  pctOfTotal: number;
}

export interface SpendBreakdown {
  periodFrom: Date;
  periodTo: Date;
  totalSpend: number;
  categories: CategorySpend[];
  /** Same window, immediately prior. Undefined categories mean no prior data. */
  previousPeriodTotal: number | null;
  /** (total − previous) / previous, as a fraction. Null with no prior period. */
  changePct: number | null;
}

function sumDebitsByCategory(txns: Transaction[]): { total: number; byCat: Map<SpendCategory, { amount: number; count: number }> } {
  const byCat = new Map<SpendCategory, { amount: number; count: number }>();
  let total = 0;
  for (const t of txns) {
    if (t.direction !== 'DEBIT' || t.isFailure) continue;
    const cat = categorizeTransaction(t);
    const entry = byCat.get(cat) ?? { amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    byCat.set(cat, entry);
    total += t.amount;
  }
  return { total, byCat };
}

/**
 * Category-wise spend for the `windowDays` ending at `now`, compared against
 * the equal-length window immediately before it.
 *
 * Pure and windowed by IST calendar day, matching how the rest of the engine
 * buckets time — a debit at 00:30 IST counts on the day the user would say it
 * landed on.
 */
export function computeSpendBreakdown(
  txns: Transaction[],
  now: Date,
  windowDays = 30,
): SpendBreakdown {
  const periodTo = startOfIstDay(now);
  const periodFrom = addDays(periodTo, -windowDays);
  const prevFrom = addDays(periodFrom, -windowDays);

  const inWindow = txns.filter(
    (t) => t.timestamp.getTime() >= periodFrom.getTime() && t.timestamp.getTime() < periodTo.getTime(),
  );
  const inPrevWindow = txns.filter(
    (t) => t.timestamp.getTime() >= prevFrom.getTime() && t.timestamp.getTime() < periodFrom.getTime(),
  );

  const { total, byCat } = sumDebitsByCategory(inWindow);
  const { total: prevTotal } = sumDebitsByCategory(inPrevWindow);

  const categories: CategorySpend[] = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      pctOfTotal: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const hadPrevData = inPrevWindow.some((t) => t.direction === 'DEBIT' && !t.isFailure);

  return {
    periodFrom,
    periodTo,
    totalSpend: total,
    categories,
    previousPeriodTotal: hadPrevData ? prevTotal : null,
    changePct: hadPrevData && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 1000 : null,
  };
}
