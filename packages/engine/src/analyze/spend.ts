import type { Transaction } from '../types';
import { startOfIstDay, addDays } from '../time';
import { prettyCounterparty } from '../detect/mandates';

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
  | 'FOOD' | 'GROCERIES' | 'SHOPPING' | 'TRAVEL'
  | 'HEALTH' | 'ENTERTAINMENT' | 'EDUCATION'
  | 'PEOPLE' | 'TRANSFER' | 'OTHER';

/**
 * Merchant-QR address shapes.
 *
 * Every UPI acquirer mints collect addresses to a house pattern — Paytm writes
 * `paytmqr1to4u9c…`, PhonePe writes `q738014012@ybl`, Google Pay writes
 * `gpay-1126414…`, Vyapar and BharatPe stamp their own name in. Recognising the
 * ACQUIRER tells us the counterparty is a shop even when we have never heard of
 * the shop, which is the difference between "₹9,070 of transfers" and "₹9,070
 * across 57 shops" on the Insights screen.
 */
const MERCHANT_ADDRESS =
  /paytmqr|^q\d{6,}@|gpay-\d{6,}|vyapar\.|bharatpe|\.rzp|razorpay|payu|billdesk|ccavenue|@axl$|merchant|\bqr\b/i;

/**
 * Personal-address shapes: a bare mobile number, or one of the handles the
 * consumer apps hand to individuals.
 */
const PERSON_ADDRESS = /^\d{10}|@ok[a-z]*$|@ibl$|@apl$|@aixs$|^[a-z][a-z.]+\d{2,6}@/i;

/** Rails that are unambiguously a transfer rather than a purchase. */
const TRANSFER_RAIL =
  /\b(?:neft|imps|rtgs|ift|self|own account|fund transfer|acct transfer|sweep|a\/c transfer)\b/i;

/**
 * Keyword rules, most specific first.
 *
 * The tokens are the ones that actually turn up in Indian bank narrations,
 * including the truncated fourteen-character forms UPI narrations carry —
 * 'justvendprivat', 'apollopharmacy', 'landmarkmaxret'. Matching the truncated
 * form matters: the full merchant name is frequently not in the file at all.
 */
const SPEND_CATEGORY_RULES: Array<[RegExp, SpendCategory]> = [
  [/\bemi\b|loan|finserv|bajaj|hdb\b|creditcard|cred\b|moneyview|fullerton/i, 'EMI'],
  [/\bsip\b|mutual|groww|zerodha|kuvera|nippon|smallcase|indmoney|upstox|coin\b|etmoney/i, 'SIP'],
  [/insur|\blic\b|policy|premium|hdfclife|maxlife|starhealth|policybazaar/i, 'INSURANCE'],
  [/electric|bescom|bses|torrent power|water bill|gas bill|broadband|jiofiber|airtel|actfibernet|recharge|postpaid|utility|\bbill\b/i, 'UTILITY'],
  // Software subscriptions belong with the streaming ones: the screen calls
  // this bucket 'Subscriptions', and a ₹2,357 AI tool renewing every month is
  // exactly the sort of standing charge it exists to surface.
  [/netflix|hotstar|prime ?video|spotify|zee5|sonyliv|jiocinema|youtubeprem|apple ?music|audible|anthropic|openai|chatgpt|github|figma|adobe|notion|canva|icloud|google ?one|googleplay|playstore|microsoft|dropbox|linkedin/i, 'OTT'],
  [/swiggy|zomato|eatsure|dominos|mcdonald|burgerking|kfc\b|pizza|subway|starbucks|chai|coffee|cafe|baker|biryani|restaurant|dhaba|darshini|mess\b|juice|brew|foods?\b|kitchen|canteen|justvend|vending/i, 'FOOD'],
  [/bigbasket|blinkit|zepto|instamart|jiomart|dmart|bbdaily|grocer|supermarket|kirana|fresh\b|mart\b|stores?\b|milk|dairy|aavin|nandini/i, 'GROCERIES'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|tatacliq|croma|reliancedigital|decathlon|lifestyle|landmark|maxret|shoppers|westside|retail/i, 'SHOPPING'],
  [/uber|\bola\b|rapido|namma|irctc|indigo|vistara|akasa|redbus|bmtc|ksrtc|metro\b|petrol|diesel|fuel|hpcl|iocl|bpcl|indianoil|nayara|shell|fastag|parking|toll|makemytrip|goibibo|cleartrip|oyo|\bka\d{2}[a-z]/i, 'TRAVEL'],
  [/apollo|pharmac|pharmeasy|netmeds|1mg\b|medplus|hospital|clinic|diagnostic|labs?\b|dental|practo|cult\.?fit|gym\b/i, 'HEALTH'],
  [/bookmyshow|pvr\b|inox|cinepolis|cinema|multiplex|gaming|steam ?games|playstation/i, 'ENTERTAINMENT'],
  [/byjus|unacademy|vedantu|physicswallah|coursera|udemy|college|university|tuition|school|academy|exam ?fee/i, 'EDUCATION'],
];

/**
 * Classify one transaction for the spend breakdown.
 *
 * Order of evidence: a known merchant keyword beats the address shape, because
 * 'zptmktp1@kotak' is a merchant address AND a grocery run and the second fact
 * is the one worth showing. Only when no keyword matches do we fall back to
 * "who is this" — a person, a shop we cannot name, or a bank transfer.
 *
 * An earlier version ended its rule list with `/upi\//  → TRANSFER`, which on a
 * real ICICI export matched every single row: 62% of one statement's spend was
 * filed as "Transfers", including every restaurant and every pharmacy. The rail
 * a payment travelled on is not a spending category.
 */
export function categorizeTransaction(txn: Transaction): SpendCategory {
  const text = `${txn.merchantName ?? ''} ${txn.merchantHint ?? ''} ${txn.vpa ?? ''}`;

  for (const [pattern, category] of SPEND_CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }

  if (TRANSFER_RAIL.test(text)) return 'TRANSFER';

  const address = txn.vpa ?? '';
  if (MERCHANT_ADDRESS.test(address)) return 'OTHER';
  if (PERSON_ADDRESS.test(address)) return 'PEOPLE';

  return 'OTHER';
}

export interface CategorySpend {
  category: SpendCategory;
  amount: number;
  count: number;
  pctOfTotal: number;
  /** Same category, previous window. Null when there was no prior data. */
  previousAmount: number | null;
  /** (amount − previousAmount) / previousAmount. Null without a prior figure. */
  changePct: number | null;
}

/** One counterparty's spend in the window. Drives the "where it went" list. */
export interface MerchantSpend {
  /** The grouping key — a VPA or truncated handle. Stable, not pretty. */
  key: string;
  /** What to show a human. Falls back to the key when the file named nobody. */
  label: string;
  amount: number;
  count: number;
  category: SpendCategory;
  lastSeen: Date;
}

/** One IST day's total outflow. Enough to draw a trend without the raw rows. */
export interface DailySpend {
  date: Date;
  amount: number;
}

export interface SpendBreakdown {
  periodFrom: Date;
  periodTo: Date;
  totalSpend: number;
  categories: CategorySpend[];
  /** Counterparties, largest first. Capped — see computeSpendBreakdown. */
  merchants: MerchantSpend[];
  /** Every day in the window, oldest first, zero-filled. */
  daily: DailySpend[];
  /** Debits counted. Lets the UI say "across 57 payments" honestly. */
  txnCount: number;
  /** Mean spend per day over the window. */
  dailyAverage: number;
  /** The single largest debit in the window, if there was one. */
  largest: MerchantSpend | null;
  /** Same window, immediately prior. Null means no prior data. */
  previousPeriodTotal: number | null;
  /** (total − previous) / previous, as a fraction. Null with no prior period. */
  changePct: number | null;
}

interface Tally {
  amount: number;
  count: number;
}

function tallyByCategory(txns: Transaction[]): { total: number; byCat: Map<SpendCategory, Tally> } {
  const byCat = new Map<SpendCategory, Tally>();
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

/** Round to paise so a sum of floats does not surface as 9070.480000000001. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Category-wise spend for the `windowDays` ending at `now`, compared against
 * the equal-length window immediately before it, plus the counterparty and
 * per-day detail the Insights screen drills into.
 *
 * Pure and windowed by IST calendar day, matching how the rest of the engine
 * buckets time — a debit at 00:30 IST counts on the day the user would say it
 * landed on.
 */
export function computeSpendBreakdown(
  txns: Transaction[],
  now: Date,
  windowDays = 30,
  merchantLimit = 12,
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

  const { total, byCat } = tallyByCategory(inWindow);
  const { total: prevTotal, byCat: prevByCat } = tallyByCategory(inPrevWindow);
  const hadPrevData = inPrevWindow.some((t) => t.direction === 'DEBIT' && !t.isFailure);

  const categories: CategorySpend[] = [...byCat.entries()]
    .map(([category, v]) => {
      const previousAmount = hadPrevData ? r2(prevByCat.get(category)?.amount ?? 0) : null;
      return {
        category,
        amount: r2(v.amount),
        count: v.count,
        pctOfTotal: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
        previousAmount,
        changePct:
          previousAmount !== null && previousAmount > 0
            ? Math.round(((v.amount - previousAmount) / previousAmount) * 1000) / 1000
            : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // ─── Counterparties ────────────────────────────────────────────────────
  const byMerchant = new Map<string, MerchantSpend>();
  let largest: MerchantSpend | null = null;

  for (const t of inWindow) {
    if (t.direction !== 'DEBIT' || t.isFailure) continue;
    const key = t.vpa ?? t.merchantName ?? t.merchantHint ?? 'unknown';
    const label = t.merchantName ?? (t.vpa ? prettyCounterparty(t.vpa) : undefined) ?? t.merchantHint ?? 'Unknown';
    const existing = byMerchant.get(key);
    if (existing) {
      existing.amount = r2(existing.amount + t.amount);
      existing.count += 1;
      if (t.timestamp.getTime() > existing.lastSeen.getTime()) existing.lastSeen = t.timestamp;
    } else {
      byMerchant.set(key, {
        key,
        label,
        amount: r2(t.amount),
        count: 1,
        category: categorizeTransaction(t),
        lastSeen: t.timestamp,
      });
    }

    if (!largest || t.amount > largest.amount) {
      largest = {
        key,
        label,
        amount: r2(t.amount),
        count: 1,
        category: categorizeTransaction(t),
        lastSeen: t.timestamp,
      };
    }
  }

  const merchants = [...byMerchant.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, merchantLimit);

  // ─── Daily trend ───────────────────────────────────────────────────────
  const dailyMap = new Map<number, number>();
  for (const t of inWindow) {
    if (t.direction !== 'DEBIT' || t.isFailure) continue;
    const day = startOfIstDay(t.timestamp).getTime();
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + t.amount);
  }
  const daily: DailySpend[] = [];
  for (let i = 0; i < windowDays; i++) {
    const date = addDays(periodFrom, i);
    daily.push({ date, amount: r2(dailyMap.get(date.getTime()) ?? 0) });
  }

  const txnCount = inWindow.filter((t) => t.direction === 'DEBIT' && !t.isFailure).length;

  return {
    periodFrom,
    periodTo,
    totalSpend: r2(total),
    categories,
    merchants,
    daily,
    txnCount,
    dailyAverage: windowDays > 0 ? r2(total / windowDays) : 0,
    largest,
    previousPeriodTotal: hadPrevData ? r2(prevTotal) : null,
    changePct:
      hadPrevData && prevTotal > 0
        ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 1000
        : null,
  };
}
