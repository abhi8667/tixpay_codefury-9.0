import type { IncomeEvent, Mandate, ShadowLedger, Transaction } from '../types';
import { addDays, startOfIstDay, daysBetween } from '../time';

/**
 * Portfolio consolidation, from the one file the user handed us.
 *
 * The theme brief asks for "investments spread across multiple platforms"
 * pulled into one view. We cannot see holdings — no Account Aggregator consent,
 * no broker login, and inventing a portfolio value would be the single most
 * dishonest thing this app could do.
 *
 * What a statement does show, exactly and checkably, is the CASH FLOW into and
 * out of every one of those platforms: the ₹5,000 that leaves for Nippon on the
 * 12th, the ₹1,899 LIC premium, the ₹12,450 Bajaj EMI. So this consolidates
 * commitments and run-rates rather than balances, and says so on the screen.
 * "You are investing ₹7,000 a month across 2 platforms" is a true sentence we
 * can defend; "your portfolio is worth ₹4.2 lakh" is not.
 */
export interface MoneyMapLine {
  label: string;
  /** Rupees per month. Cadences are normalised so the lines are comparable. */
  monthly: number;
  /** How many distinct commitments rolled into this line. */
  count: number;
  /** Named so the UI can show provenance instead of a bare figure. */
  items: string[];
}

export interface MoneyMap {
  /** Reconciled balance on the imported account. */
  liquidBalance: number;
  /** The Keeper jar / goal reserve. Passed in — it is app state, not statement. */
  reserve: number;
  /** Monthly money going into investments (SIP mandates). */
  investing: MoneyMapLine;
  /** Monthly protection spend (insurance premiums). */
  protection: MoneyMapLine;
  /** Monthly debt servicing (EMIs). */
  debt: MoneyMapLine;
  /** Monthly fixed running costs (utilities, subscriptions). */
  fixed: MoneyMapLine;
  /** Every committed rupee per month — the four lines above, summed. */
  totalCommitted: number;
  /** Mean monthly credit inflow over the trailing window. */
  monthlyIncome: number;
  /** Mean monthly debit outflow over the trailing window. */
  monthlySpend: number;
  /**
   * What a typical month costs, with one-off outliers held down.
   *
   * The mean is the honest figure for cash that actually left, and it is what
   * `monthlySurplus` uses. It is the wrong figure for "how long would this
   * money last", because a single ₹2.1 lakh purchase inside the window drags
   * the mean to ₹1.29 lakh a month and reports an emergency buffer of 0.3
   * months for an account that comfortably covers its recurring costs.
   *
   * So the buffer is measured against the median spending DAY scaled to a
   * month. A person's ordinary days are many and their extraordinary ones are
   * few, which is exactly the shape a median is for.
   */
  typicalMonthlySpend: number;
  /** income − spend. Negative means the account is draining. */
  monthlySurplus: number;
  /** surplus / income, 0–1. Null when no income was observed. */
  savingsRate: number | null;
  /** committed / income, 0–1. Null when no income was observed. */
  commitmentRatio: number | null;
  /** How many months the liquid balance plus reserve covers current spending. */
  bufferMonths: number | null;
  /** Days of statement the figures are computed over. Honesty about sample size. */
  observedDays: number;
}

const PER_MONTH = { MONTHLY: 1, WEEKLY: 52 / 12, QUARTERLY: 1 / 3 } as const;

function line(label: string, mandates: Mandate[]): MoneyMapLine {
  return {
    label,
    monthly: Math.round(mandates.reduce((s, m) => s + m.amount * PER_MONTH[m.cadence], 0)),
    count: mandates.length,
    items: mandates.map((m) => m.displayName),
  };
}

/**
 * Consolidate the account into one picture.
 *
 * Pure. `windowDays` bounds the flow averages; commitments come from the
 * detected mandates and are already cadence-normalised.
 */
export function computeMoneyMap(
  txns: Transaction[],
  mandates: Mandate[],
  ledger: ShadowLedger | null,
  income: IncomeEvent[],
  reserve: number,
  now: Date,
  windowDays = 90,
): MoneyMap {
  const to = startOfIstDay(now);
  const from = addDays(to, -windowDays);
  const inWindow = txns.filter(
    (t) => t.timestamp.getTime() >= from.getTime() && t.timestamp.getTime() < to.getTime(),
  );

  // Measure over the days actually covered, not the days requested. A statement
  // three weeks long divided by ninety days reports a third of the real spend,
  // and every ratio built on it inherits the error.
  const stamps = inWindow.map((t) => t.timestamp.getTime());
  const observedDays =
    stamps.length > 0
      ? Math.max(1, daysBetween(new Date(Math.min(...stamps)), new Date(Math.max(...stamps))) + 1)
      : 0;
  const months = observedDays > 0 ? observedDays / 30.44 : 0;

  const credits = inWindow.filter((t) => t.direction === 'CREDIT' && !t.isFailure);
  const debits = inWindow.filter((t) => t.direction === 'DEBIT' && !t.isFailure);

  const totalIn = credits.reduce((s, t) => s + t.amount, 0);
  const totalOut = debits.reduce((s, t) => s + t.amount, 0);

  const monthlyIncome = months > 0 ? Math.round(totalIn / months) : 0;
  const monthlySpend = months > 0 ? Math.round(totalOut / months) : 0;
  const monthlySurplus = monthlyIncome - monthlySpend;

  // Median spending day → a typical month. Days with no spending are excluded:
  // including them would halve the figure for anyone who shops twice a week,
  // which is a different distortion in the opposite direction.
  const byDay = new Map<number, number>();
  for (const d of debits) {
    const day = startOfIstDay(d.timestamp).getTime();
    byDay.set(day, (byDay.get(day) ?? 0) + d.amount);
  }
  const spendingDays = [...byDay.values()].sort((a, b) => a - b);
  const medianDay =
    spendingDays.length > 0 ? spendingDays[Math.floor(spendingDays.length / 2)]! : 0;
  // Scale by the share of days that actually saw spending, so someone who
  // spends on ten days a month is not billed for thirty.
  const activeShare = observedDays > 0 ? spendingDays.length / observedDays : 0;
  const typicalMonthlySpend =
    // Below a week of spending days the median is not a median, it is a
    // coin toss. Fall back to the mean and let it be imprecise honestly.
    spendingDays.length >= 7 ? Math.round(medianDay * activeShare * 30.44) : monthlySpend;

  const active = mandates.filter((m) => !m.isPaused);
  const investing = line('Investing', active.filter((m) => m.category === 'SIP'));
  const protection = line('Protection', active.filter((m) => m.category === 'INSURANCE'));
  const debt = line('Debt servicing', active.filter((m) => m.category === 'EMI'));
  const fixed = line(
    'Fixed running costs',
    active.filter((m) => m.category === 'UTILITY' || m.category === 'OTT' || m.category === 'OTHER'),
  );

  const totalCommitted = investing.monthly + protection.monthly + debt.monthly + fixed.monthly;
  const liquidBalance = ledger?.currentBalance ?? 0;

  // Income inference is a separate engine estimate; prefer the measured inflow
  // and fall back to it only when the window carried no credits at all.
  const inferredMonthlyIncome =
    monthlyIncome > 0
      ? monthlyIncome
      : Math.round(income.reduce((s, e) => s + e.amount, 0) / Math.max(1, income.length));

  return {
    liquidBalance,
    reserve,
    investing,
    protection,
    debt,
    fixed,
    totalCommitted,
    monthlyIncome: inferredMonthlyIncome,
    monthlySpend,
    typicalMonthlySpend,
    monthlySurplus,
    savingsRate:
      inferredMonthlyIncome > 0
        ? Math.round((monthlySurplus / inferredMonthlyIncome) * 1000) / 1000
        : null,
    commitmentRatio:
      inferredMonthlyIncome > 0
        ? Math.round((totalCommitted / inferredMonthlyIncome) * 1000) / 1000
        : null,
    bufferMonths:
      typicalMonthlySpend > 0
        ? Math.round(((liquidBalance + reserve) / typicalMonthlySpend) * 10) / 10
        : null,
    observedDays,
  };
}

/**
 * The one-line verdict the Money Map opens with.
 *
 * Thresholds are the conventional personal-finance ones — three months of
 * buffer, a commitment ratio under 50%, a positive savings rate — stated here
 * rather than buried in the UI so they can be argued with.
 */
export interface HealthVerdict {
  /** 0–100. Equal weight to buffer, savings rate and commitment load. */
  score: number;
  grade: 'STRONG' | 'STEADY' | 'STRETCHED' | 'AT_RISK';
  headline: string;
  /** Ordered, most-material first. Each names the figure it is based on. */
  findings: Array<{ ok: boolean; text: string }>;
}

export function computeHealthVerdict(map: MoneyMap): HealthVerdict {
  const findings: Array<{ ok: boolean; text: string }> = [];

  // Buffer: months of current spending covered by liquid balance + reserve.
  const buffer = map.bufferMonths;
  const bufferScore = buffer === null ? 50 : Math.max(0, Math.min(1, buffer / 6)) * 100;
  if (buffer !== null) {
    findings.push({
      ok: buffer >= 3,
      text:
        buffer >= 3
          ? `${buffer} months of spending covered by cash on hand.`
          : `Only ${buffer} months of spending covered — three is the usual floor.`,
    });
  }

  const rate = map.savingsRate;
  const savingScore = rate === null ? 50 : Math.max(0, Math.min(1, rate / 0.3)) * 100;
  if (rate !== null) {
    const pct = Math.round(rate * 100);
    findings.push({
      ok: rate > 0,
      text:
        rate > 0
          ? `Keeping ${pct}% of what comes in, about ₹${map.monthlySurplus.toLocaleString('en-IN')} a month.`
          : `Spending ₹${Math.abs(map.monthlySurplus).toLocaleString('en-IN')} a month more than comes in.`,
    });
  }

  const ratio = map.commitmentRatio;
  const commitScore = ratio === null ? 50 : Math.max(0, Math.min(1, (0.7 - ratio) / 0.5)) * 100;
  if (ratio !== null && map.totalCommitted > 0) {
    const pct = Math.round(ratio * 100);
    findings.push({
      ok: ratio < 0.5,
      text:
        ratio < 0.5
          ? `${pct}% of income is committed before you spend anything.`
          : `${pct}% of income is already committed — over half is tight.`,
    });
  }

  if (map.investing.monthly > 0) {
    findings.push({
      ok: true,
      text: `Investing ₹${map.investing.monthly.toLocaleString('en-IN')} a month across ${map.investing.count} ${map.investing.count === 1 ? 'plan' : 'plans'}.`,
    });
  } else {
    findings.push({ ok: false, text: 'No recurring investment found in this statement.' });
  }

  const score = Math.round((bufferScore + savingScore + commitScore) / 3);
  const grade: HealthVerdict['grade'] =
    score >= 75 ? 'STRONG' : score >= 55 ? 'STEADY' : score >= 35 ? 'STRETCHED' : 'AT_RISK';

  const headline =
    grade === 'STRONG'
      ? 'Your cash flow has room in it.'
      : grade === 'STEADY'
        ? 'Steady, with one thing worth tightening.'
        : grade === 'STRETCHED'
          ? 'Workable, but there is little slack.'
          : 'This account has no margin for a surprise.';

  return { score, grade, headline, findings };
}
