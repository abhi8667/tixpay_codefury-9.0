import { create } from 'zustand';
import type {
  Mandate,
  BalanceCurve,
  Shortfall,
  Intervention,
  Transaction,
  ShadowLedger,
  Card,
  PaymentIntent,
  PaymentVerdict,
} from '@tixpay/types';
import { mockCards } from '@tixpay/types/mocks';
import {
  runPipeline,
  projectBalance,
  parseStatementCsv,
  evaluatePayment,
  projectWithPaused,
  findShortfalls,
  proposeInterventions,
  computeSpendBreakdown,
  computeAvgMonthlySurplus,
  projectGoal,
  checkSipAffordability,
  auditSubscriptions,
  computeMoneyMap,
  computeHealthVerdict,
  computeRiskProfile,
  normalizeVpa,
  round2,
  type PipelineResult,
  type StatementMeta,
  type SpendBreakdown,
  type GoalProjection,
  type SipCheckResult,
  type Cadence,
  type SubscriptionAudit,
  type MoneyMap,
  type HealthVerdict,
  type RiskProfileResult,
} from '@tixpay/engine';
import { DEMO_STATEMENT_CSV } from '../src/data/demoStatement';
import { setRedactionEnabled } from '../src/utils/redaction';

export type ScenarioPreset = 'healthy' | 'tight' | 'bounce';

/** What the import screen shows after a file is read. The user's receipt. */
export interface ImportSummary {
  /** File name, or 'Sample statement' for the bundled one. */
  sourceName: string;
  isSample: boolean;
  bank: string;
  accountTail?: string;
  rows: number;
  parsed: number;
  columns: Record<string, string>;
  errors: string[];
  hasRunningBalance: boolean;
  periodFrom?: Date;
  periodTo?: Date;
}

export interface KeeperEntry {
  id: string;
  label: string;
  amount: number; // signed: negative leaves the jar
  date: Date;
}

export const KEEPER_GOAL = 50000;

/** Who the user said they are. Collected in onboarding, never pre-filled. */
export interface UserProfile {
  name: string;
  phone: string;
  pan: string;
}

const EMPTY_PROFILE: UserProfile = { name: '', phone: '', pan: '' };

/** A counterparty the account has paid before. */
export interface Payee {
  /** Grouping key — the statement's payment address. */
  id: string;
  name: string;
  vpa: string;
  lastPaid: Date;
  lastAmount: number;
  timesPaid: number;
  totalPaid: number;
}

/**
 * The outcome of moving money between the account and the jar.
 *
 * A void action forced the screen to re-derive whether the move had worked,
 * which it did with its own copy of the balance check — so the two could
 * disagree, and on a repeat tap they did.
 */
export interface TransferResult {
  ok: boolean;
  message: string;
}

export interface AppState {
  // ─── Raw state ─────────────────────────────────────────────────────────
  /** Transactions read from the imported statement. The only real input. */
  importedTxns: Transaction[];
  /** Simulated payments and sweeps applied on top. Never leaves the device. */
  simulatedTxns: Transaction[];
  imported: ImportSummary | null;
  importError: string | null;
  now: Date;
  pausedMandateIds: string[];
  /** Mandate id → the epoch ms its debit was shifted to by an intervention. */
  mandateShifts: Record<string, number>;
  redactionOn: boolean;
  activeScenario: ScenarioPreset;
  cardsList: Card[];
  /**
   * How far the projection looks ahead. The guard, the curve and every
   * intervention are recomputed against this, so it is raw state rather than a
   * view-level filter — a 90-day horizon that only restyled a 30-day curve
   * would be a lie told in the axis labels.
   */
  horizonDays: number;
  /** Risk questionnaire: question id → the chosen option's score (0–4). */
  riskAnswers: Record<string, number>;
  /** Whatever the user actually typed during onboarding. Nothing is pre-filled. */
  profile: UserProfile;
  /**
   * The 4-digit PIN chosen in onboarding.
   *
   * Null until then. Every PIN prompt in the app checks against this value, so
   * a screen that gates on the PIN genuinely gates — before this existed the
   * modal accepted any four digits, which made the balance privacy toggle
   * decorative.
   */
  upiPin: string | null;

  // ─── Keeper (the sweep reserve) ────────────────────────────────────────
  keeperBalance: number;
  keeperTxns: KeeperEntry[];

  // ─── Goal (what the Keeper jar is being saved toward) ─────────────────
  goalLabel: string;
  goalTargetAmount: number;
  goalTargetDate: Date | null;

  // ─── Cached pipeline result ────────────────────────────────────────────
  _pipelineCache: PipelineResult | null;
  /**
   * Monotonic counter behind every simulated transaction id.
   *
   * `now` is frozen during a session — that is the whole point of the World
   * Clock — so an id built from `now` and the amount collided the moment the
   * same action ran twice. Two ₹500 top-ups produced two transactions with one
   * id, which React then treated as one row. Sequence numbers are the fix, and
   * they keep ids deterministic within a run.
   */
  _simSeq: number;

  // ─── Selectors ─────────────────────────────────────────────────────────
  transactions: () => Transaction[];
  ledger: () => ShadowLedger | null;
  mandates: () => Mandate[];
  curve: () => BalanceCurve;
  shortfalls: () => Shortfall[];
  /**
   * Interventions for ONE shortfall. Omit the argument for the earliest.
   *
   * Returns a freshly filtered array, so it must NOT be called inside a
   * `useAppStore(selector)` — that re-renders forever. Select `_pipelineCache`
   * and wrap this in `useMemo`; see ShortfallSheet.
   */
  interventions: (shortfall?: Shortfall) => Intervention[];
  cards: () => Card[];
  hasData: () => boolean;
  keeperProgress: () => number;
  canFundSweep: (amount: number) => boolean;
  evaluate: (intent: PaymentIntent) => PaymentVerdict | null;
  /**
   * Category-wise spend for the trailing `windowDays`, vs the window before it.
   *
   * Returns a fresh object each call — same rule as `interventions`: select the
   * function reference, not the call, and wrap the call in `useMemo`.
   */
  spendBreakdown: (windowDays?: number) => SpendBreakdown | null;
  /** Where the Keeper jar stands against its goal, projected off real surplus. */
  goalStatus: () => GoalProjection | null;
  /** "Can I afford this SIP?" — evaluated against the actual projected curve. */
  checkSip: (amount: number, cadence: Cadence, dayOfMonth: number) => SipCheckResult | null;
  /** Everything charging this account on repeat, priced per year. */
  subscriptions: () => SubscriptionAudit | null;
  /** Commitments, run-rates and ratios consolidated into one picture. */
  moneyMap: () => MoneyMap | null;
  /** The one-line verdict the Money Map opens with. */
  healthVerdict: () => HealthVerdict | null;
  /** Attitude vs capacity, with the lower one binding. */
  riskProfile: () => RiskProfileResult | null;
  /**
   * Counterparties this account has actually paid, most recent first.
   *
   * The Pay screen used to open on one hardcoded merchant. These are the real
   * payees from the imported statement, which is both more useful and the only
   * version that is true.
   */
  payees: (limit?: number) => Payee[];

  // ─── Actions ───────────────────────────────────────────────────────────
  importStatement: (csv: string, sourceName: string, isSample?: boolean) => boolean;
  loadSampleStatement: () => void;
  clearData: () => void;
  setNow: (date: Date) => void;
  togglePauseMandate: (id: string) => void;
  /** Apply whatever the engine proposed — pause, sweep, or shift. */
  applyIntervention: (intervention: Intervention) => void;
  toggleRedaction: () => void;
  loadScenario: (preset: ScenarioPreset) => void;
  executePayment: (amount: number, payeeName?: string, vpa?: string) => void;
  /** Stage tool: append an arbitrary simulated movement and re-project. */
  injectSimulated: (direction: 'DEBIT' | 'CREDIT', amount: number, label: string) => void;
  applySweep: (amount: number) => void;
  /** Returns why it refused, so the screen can say it rather than guess. */
  addToKeeper: (amount: number) => TransferResult;
  withdrawFromKeeper: (amount: number) => TransferResult;
  setGoal: (label: string, targetAmount: number, targetDate: Date | null) => void;
  setHorizon: (days: number) => void;
  addCard: (card: Card) => void;
  /** Merge whatever onboarding step just collected into the profile. */
  setProfile: (patch: Partial<UserProfile>) => void;
  setUpiPin: (pin: string) => void;
  /** True only if the PIN matches the one set in onboarding. */
  verifyUpiPin: (pin: string) => boolean;
  setRiskAnswer: (questionId: string, score: number) => void;
  resetRiskAnswers: () => void;
  recompute: () => void;
}

/**
 * Where the demo opens.
 *
 * The sample statement ends in February 2026, so `now` has to be placed inside
 * the window the data covers. The 26th is the date where the guard has
 * something to NOT warn about — a guard that fires on every amount is a guard
 * nobody believes.
 */
export const INITIAL_DEMO_DATE = new Date('2026-03-26T00:00:00.000Z');

/**
 * Each scenario is a date, not a doctored statement.
 *
 * Moving `now` changes only which mandates are still ahead of the user, which
 * is exactly the variable the demo wants — and it keeps every number derived
 * from the one real file, with nothing fabricated to make a moment land.
 *
 *   bounce   1 Mar  — already short on the 11th; Insights opens on a red dip
 *   healthy  13 Mar — flat and clear; nothing warns
 *   tight    26 Mar — clear on open, and an ₹8,000 payment creates a fresh
 *                     shortfall that kills the LIC premium. The headline
 *                     intercept, so it is the default.
 */
const SCENARIO_DATE: Record<ScenarioPreset, Date> = {
  bounce: new Date('2026-03-01T00:00:00.000Z'),
  healthy: new Date('2026-03-13T00:00:00.000Z'),
  tight: INITIAL_DEMO_DATE,
};

const KEEPER_OPENING = 12450;

/**
 * Shared empty results.
 *
 * Zustand compares selector output by reference. A selector that ends in
 * `?? []` mints a new array on every render, so the store looks changed on
 * every render, which re-renders, which mints another array — React bails out
 * with "Maximum update depth exceeded" and the screen goes blank. One frozen
 * instance per shape keeps the identity stable.
 */
const NO_TXNS: Transaction[] = [];
const NO_MANDATES: Mandate[] = [];
const NO_CURVE: BalanceCurve = [];
const NO_SHORTFALLS: Shortfall[] = [];
const NO_INTERVENTIONS: Intervention[] = [];
const NO_PAYEES: Payee[] = [];

/**
 * A readable name for a counterparty the statement did not name.
 *
 * ICICI-style narrations carry the payee's name in their own field and land in
 * `merchantName`. HDFC-style ones do not — 'UPI-BIGBASKET-bigbasket.payu@
 * hdfcbank-HDFC-4123' states the merchant only inside the address. Rendering
 * the raw VPA there gave a payee list of 'bigbasket.payu@hdfcbank', which is
 * technically the truth and useless to read.
 *
 * `normalizeVpa` already strips the gateway handle and order id, so this is
 * just casing on top of it.
 */
function prettyVpa(vpa: string): string {
  const handle = normalizeVpa(vpa).split('@')[0] ?? vpa;
  const cleaned = handle.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return vpa;
  return cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Opening jar history. Labelled as the starting reserve, not invented activity. */
const KEEPER_SEED: KeeperEntry[] = [
  {
    id: 'keeper_opening',
    label: 'Opening reserve',
    amount: KEEPER_OPENING,
    date: new Date('2026-02-01T00:00:00.000Z'),
  },
];

/**
 * Run the analytical core over the current transactions.
 *
 * No mock fallback. An earlier version caught pipeline failures and swapped in
 * fixture mandates, which meant a broken engine rendered a plausible screen —
 * the worst possible failure on stage, because nothing looks wrong. If the
 * pipeline cannot run we return null and the UI says so.
 */
function computePipeline(
  txns: Transaction[],
  now: Date,
  pausedMandateIds: string[],
  mandateShifts: Record<string, number>,
  days: number,
): PipelineResult | null {
  if (txns.length === 0) return null;

  try {
    const result = runPipeline(txns, now, { days });
    const shiftIds = Object.keys(mandateShifts);

    const effective: Mandate[] = result.mandates.map((m) => {
      const shifted = mandateShifts[m.id];
      return {
        ...m,
        isPaused: pausedMandateIds.includes(m.id),
        ...(shifted ? { nextDebit: new Date(shifted) } : {}),
      };
    });

    // An accepted intervention has to move the CURVE, not just a flag.
    //
    // `runPipeline` knows nothing about pauses or shifts — it projects every
    // mandate on its detected date. Flipping `isPaused` on the returned objects
    // would change the Mandate Hub and nothing else: the curve, the shortfalls
    // and the follow-up interventions would all still assume the debit lands.
    // Re-projecting here is what makes "Pause Netflix" actually rescue the
    // balance rather than appear to.
    if (pausedMandateIds.length > 0 || shiftIds.length > 0) {
      const curve =
        pausedMandateIds.length > 0
          ? projectWithPaused(result.ledger, effective, result.income, now, pausedMandateIds, days)
          : projectBalance(result.ledger, effective, result.income, now, days);
      const shortfalls = findShortfalls(curve, effective);
      const interventions = shortfalls.flatMap((s) =>
        proposeInterventions(s, effective, result.ledger, result.income, now, { days }),
      );
      return { ...result, mandates: effective, curve, shortfalls, interventions };
    }

    return { ...result, mandates: effective };
  } catch (err) {
    console.warn('[useAppStore] Pipeline failed:', err);
    return null;
  }
}

/** A locally simulated movement on the reconciled account. */
function simulatedTxn(
  direction: 'DEBIT' | 'CREDIT',
  amount: number,
  label: string,
  now: Date,
  accountTail: string | undefined,
  seq: number,
  vpa?: string,
): Transaction {
  const txn: Transaction = {
    // Deterministic id: the engine is pure, and a demo that shows a different
    // reference on the second run invites a question with no good answer.
    //
    // `seq` is what makes it UNIQUE as well as deterministic. `now` is frozen
    // by the World Clock, so an id of direction + now + amount was identical
    // for every repeat of the same action — a second ₹500 top-up produced a
    // transaction React could not tell apart from the first.
    id: `sim_${direction}_${now.getTime()}_${Math.round(amount * 100)}_${seq}`,
    direction,
    amount,
    bank: 'HDFC',
    // One minute past `now` so it sorts after every statement row on the day.
    // One minute past `now`, then one second per movement, so repeat actions
    // keep the order they happened in when the ledger walks them.
    timestamp: new Date(now.getTime() + 60 * 1000 + seq * 1000),
    isFailure: false,
    merchantHint: label,
    source: 'INTENT',
  };
  // No balanceHint on purpose. Every statement row states a balance, so the
  // ledger snaps to the last one and then applies this delta — which is what
  // makes a simulated payment move the real curve.
  if (accountTail) txn.accountTail = accountTail;
  if (vpa) txn.vpa = vpa;
  return txn;
}

export const useAppStore = create<AppState>((set, get) => {
  // Redaction defaults on; sync the module flag `redact.*` reads.
  setRedactionEnabled(true);

  /** Recompute from whatever raw state is about to be committed. */
  const rebuild = (
    partial: Partial<AppState> & { importedTxns?: Transaction[]; simulatedTxns?: Transaction[] },
  ) => {
    const s = get();
    const importedTxns = partial.importedTxns ?? s.importedTxns;
    const simulatedTxns = partial.simulatedTxns ?? s.simulatedTxns;
    const now = partial.now ?? s.now;
    const paused = partial.pausedMandateIds ?? s.pausedMandateIds;
    const shifts = partial.mandateShifts ?? s.mandateShifts;
    const days = partial.horizonDays ?? s.horizonDays;
    set({
      ...partial,
      _pipelineCache: computePipeline(
        [...importedTxns, ...simulatedTxns],
        now,
        paused,
        shifts,
        days,
      ),
    } as Partial<AppState>);
  };

  /**
   * Mint the next simulated transaction, advancing the sequence.
   *
   * Every caller went through `simulatedTxn` directly and had to remember to
   * bump the counter; one that forgot reintroduced the collision. Handing back
   * both the transaction and the next sequence makes that impossible to skip.
   */
  const nextSim = (
    direction: 'DEBIT' | 'CREDIT',
    amount: number,
    label: string,
    vpa?: string,
  ): { txn: Transaction; seq: number } => {
    const st = get();
    const seq = st._simSeq + 1;
    const tail = st._pipelineCache?.ledger.accountTail;
    return {
      txn: simulatedTxn(direction, amount, label, st.now, tail, seq, vpa),
      seq,
    };
  };

  return {
    importedTxns: [],
    simulatedTxns: [],
    imported: null,
    importError: null,
    now: INITIAL_DEMO_DATE,
    pausedMandateIds: [],
    mandateShifts: {},
    redactionOn: true,
    activeScenario: 'tight',
    cardsList: mockCards,
    horizonDays: 30,
    riskAnswers: {},
    profile: EMPTY_PROFILE,
    upiPin: null,
    keeperBalance: KEEPER_OPENING,
    keeperTxns: KEEPER_SEED,
    goalLabel: 'Emergency fund',
    goalTargetAmount: KEEPER_GOAL,
    goalTargetDate: null,
    _pipelineCache: null,
    _simSeq: 0,

    // ─── Selectors ───────────────────────────────────────────────────────
    transactions: () => get()._pipelineCache?.txns ?? NO_TXNS,
    ledger: () => get()._pipelineCache?.ledger ?? null,
    mandates: () => get()._pipelineCache?.mandates ?? NO_MANDATES,
    curve: () => get()._pipelineCache?.curve ?? NO_CURVE,
    shortfalls: () => get()._pipelineCache?.shortfalls ?? NO_SHORTFALLS,
    cards: () => get().cardsList,
    hasData: () => (get()._pipelineCache?.txns.length ?? 0) > 0,

    /**
     * Interventions for one shortfall.
     *
     * The cache holds every shortfall's options flattened together, so handing
     * back the whole list offered the user remedies for a dip they had not
     * tapped — 'Pause Netflix' for a shortfall three weeks later. Match on the
     * mandates the intervention actually saves.
     */
    interventions: (shortfall?: Shortfall) => {
      const cache = get()._pipelineCache;
      if (!cache) return NO_INTERVENTIONS;

      const target = shortfall ?? cache.shortfalls[0];
      if (!target) return NO_INTERVENTIONS;

      const atRiskIds = new Set(target.atRisk.map((m) => m.id));
      const forThisDip = cache.interventions.filter((i) =>
        i.savedMandates.some((m) => atRiskIds.has(m.id)),
      );

      // A sweep large enough to clear the dip saves everything downstream of
      // it, so it may not name any at-risk mandate. Keep it rather than leave
      // the user with no option at all.
      return forThisDip.length > 0 ? forThisDip : cache.interventions;
    },

    keeperProgress: () => {
      const s = get();
      return s.goalTargetAmount > 0 ? Math.min(s.keeperBalance / s.goalTargetAmount, 1) : 1;
    },
    canFundSweep: (amount: number) => get().keeperBalance >= amount,

    evaluate: (intent: PaymentIntent) => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache?.ledger) return null;
      try {
        return evaluatePayment(
          intent,
          cache.ledger,
          cache.mandates,
          cache.income,
          s.cardsList,
          s.now,
        );
      } catch (err) {
        // Never let a verdict failure block the pay button — a judge tapping
        // Pay and getting a frozen screen is worse than a missing warning.
        console.warn('[useAppStore] evaluatePayment failed:', err);
        return null;
      }
    },

    spendBreakdown: (windowDays = 30) => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache) return null;
      try {
        return computeSpendBreakdown(cache.txns, s.now, windowDays);
      } catch (err) {
        console.warn('[useAppStore] computeSpendBreakdown failed:', err);
        return null;
      }
    },

    goalStatus: () => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache) return null;
      try {
        const avgMonthlySurplus = computeAvgMonthlySurplus(cache.txns, s.now, 3);
        return projectGoal(
          s.keeperBalance,
          s.goalTargetAmount,
          avgMonthlySurplus,
          s.now,
          s.goalTargetDate ?? undefined,
        );
      } catch (err) {
        console.warn('[useAppStore] projectGoal failed:', err);
        return null;
      }
    },

    checkSip: (amount: number, cadence: Cadence, dayOfMonth: number) => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache?.ledger) return null;
      try {
        return checkSipAffordability(
          amount,
          cadence,
          dayOfMonth,
          cache.ledger,
          cache.mandates,
          cache.income,
          s.now,
          90,
        );
      } catch (err) {
        console.warn('[useAppStore] checkSipAffordability failed:', err);
        return null;
      }
    },

    subscriptions: () => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache) return null;
      try {
        return auditSubscriptions(cache.txns, s.now);
      } catch (err) {
        console.warn('[useAppStore] auditSubscriptions failed:', err);
        return null;
      }
    },

    moneyMap: () => {
      const s = get();
      const cache = s._pipelineCache;
      if (!cache) return null;
      try {
        return computeMoneyMap(
          cache.txns,
          cache.mandates,
          cache.ledger,
          cache.income,
          s.keeperBalance,
          s.now,
        );
      } catch (err) {
        console.warn('[useAppStore] computeMoneyMap failed:', err);
        return null;
      }
    },

    healthVerdict: () => {
      const map = get().moneyMap();
      if (!map) return null;
      try {
        return computeHealthVerdict(map);
      } catch (err) {
        console.warn('[useAppStore] computeHealthVerdict failed:', err);
        return null;
      }
    },

    riskProfile: () => {
      const s = get();
      const map = s.moneyMap();
      if (!map) return null;
      try {
        return computeRiskProfile(s.riskAnswers, map);
      } catch (err) {
        console.warn('[useAppStore] computeRiskProfile failed:', err);
        return null;
      }
    },

    /**
     * Real payees, read off the statement.
     *
     * Debits only, and only ones the file gave us an address for: a payee row
     * we cannot actually address is a dead end at the amount screen. Ranked by
     * recency rather than value, because the person you paid yesterday is the
     * one you are most likely to pay again.
     */
    payees: (limit = 20) => {
      const cache = get()._pipelineCache;
      if (!cache) return NO_PAYEES;

      const byKey = new Map<string, Payee>();
      for (const t of cache.txns) {
        if (t.direction !== 'DEBIT' || t.isFailure || !t.vpa) continue;
        const existing = byKey.get(t.vpa);
        if (existing) {
          existing.timesPaid += 1;
          existing.totalPaid = round2(existing.totalPaid + t.amount);
          if (t.timestamp.getTime() > existing.lastPaid.getTime()) {
            existing.lastPaid = t.timestamp;
            existing.lastAmount = t.amount;
            if (t.merchantName) existing.name = t.merchantName;
          }
        } else {
          byKey.set(t.vpa, {
            id: t.vpa,
            name: t.merchantName ?? prettyVpa(t.vpa),
            vpa: t.vpa,
            lastPaid: t.timestamp,
            lastAmount: t.amount,
            timesPaid: 1,
            totalPaid: t.amount,
          });
        }
      }

      return [...byKey.values()]
        .sort((a, b) => b.lastPaid.getTime() - a.lastPaid.getTime())
        .slice(0, limit);
    },

    // ─── Actions ─────────────────────────────────────────────────────────

    /**
     * Read a statement. Returns false and populates `importError` on failure,
     * so the screen can say what went wrong instead of showing an empty curve.
     */
    importStatement: (csv: string, sourceName: string, isSample = false) => {
      const parsed = parseStatementCsv(csv);

      if (parsed.txns.length === 0) {
        set({
          importError:
            parsed.meta.errors[0] ??
            'No transactions found in that file. Export it as CSV from your net banking.',
        });
        return false;
      }

      const dates = parsed.txns.map((t) => t.timestamp.getTime());
      const periodTo = new Date(Math.max(...dates));

      // A real import is projected from today. The sample is projected from the
      // demo date, because its data ends in the past and a projection anchored
      // to today would show thirty empty days.
      const now = isSample ? INITIAL_DEMO_DATE : new Date();

      const summary: ImportSummary = {
        sourceName,
        isSample,
        bank: parsed.meta.bank,
        rows: parsed.meta.rows,
        parsed: parsed.meta.parsed,
        columns: parsed.meta.columns,
        errors: parsed.meta.errors,
        hasRunningBalance: parsed.meta.hasRunningBalance,
        periodFrom: new Date(Math.min(...dates)),
        periodTo,
      };
      if (parsed.meta.accountTail) summary.accountTail = parsed.meta.accountTail;

      // The jar opens empty on a real file.
      //
      // KEEPER_OPENING is ₹12,450 of scaffolding for the bundled demo, and
      // carrying it onto an imported statement meant the Goals screen greeted a
      // real user with money they do not have — and the bounce guard offered
      // sweeps funded by it. Everything else on every screen is derived from
      // the file; this has to be too.
      rebuild({
        importedTxns: parsed.txns,
        simulatedTxns: [],
        imported: summary,
        importError: null,
        now,
        pausedMandateIds: [],
        mandateShifts: {},
        keeperBalance: isSample ? KEEPER_OPENING : 0,
        keeperTxns: isSample ? KEEPER_SEED : [],
        _simSeq: 0,
      });
      return true;
    },

    loadSampleStatement: () => {
      get().importStatement(DEMO_STATEMENT_CSV, 'Sample statement (HDFC)', true);
    },

    clearData: () => {
      set({
        importedTxns: [],
        simulatedTxns: [],
        imported: null,
        importError: null,
        pausedMandateIds: [],
        mandateShifts: {},
        keeperBalance: KEEPER_OPENING,
        keeperTxns: KEEPER_SEED,
        _pipelineCache: null,
      });
    },

    setNow: (date: Date) => rebuild({ now: date }),

    togglePauseMandate: (id: string) => {
      const paused = get().pausedMandateIds;
      rebuild({
        pausedMandateIds: paused.includes(id)
          ? paused.filter((m) => m !== id)
          : [...paused, id],
      });
    },

    /**
     * Apply an intervention the engine proposed.
     *
     * One entry point for all three kinds. The confirm modal used to search the
     * mandate list by display name and call togglePauseMandate, which silently
     * did nothing for a SWEEP and the wrong thing for a SHIFT — the curve stayed
     * red after the user had accepted a fix.
     */
    applyIntervention: (intervention: Intervention) => {
      const s = get();
      switch (intervention.kind) {
        case 'PAUSE':
          if (intervention.target) s.togglePauseMandate(intervention.target.id);
          return;
        case 'SWEEP':
          if (intervention.amount) s.applySweep(intervention.amount);
          return;
        case 'SHIFT': {
          const target = intervention.target;
          if (!target) return;
          // The engine already computed the rescued curve for a specific date;
          // read it back off the mandate it handed us rather than recomputing.
          rebuild({
            mandateShifts: {
              ...s.mandateShifts,
              [target.id]: target.nextDebit.getTime(),
            },
          });
          return;
        }
      }
    },

    toggleRedaction: () => {
      const next = !get().redactionOn;
      // `redact.*` reads a module-level flag rather than taking the store as an
      // argument, so the two have to be kept in step here. Without this the
      // privacy toggle moves in the UI and masks nothing.
      setRedactionEnabled(next);
      set({ redactionOn: next });
    },

    loadScenario: (preset: ScenarioPreset) => {
      // Reset simulated activity: a previous run may have paid money.
      rebuild({
        activeScenario: preset,
        now: SCENARIO_DATE[preset],
        simulatedTxns: [],
        pausedMandateIds: [],
        mandateShifts: {},
        keeperBalance: KEEPER_OPENING,
        keeperTxns: KEEPER_SEED,
      });
    },

    /**
     * Apply a simulated payment.
     *
     * No money moves and no UPI rail is touched — this appends a debit to the
     * local ledger so the user can see what the payment would do to their
     * curve. That is the product; the rail is not.
     */
    executePayment: (amount: number, payeeName?: string, vpa?: string) => {
      const s = get();
      // Written in the structured UPI shape the statement parser reads, so a
      // simulated payment categorises and groups exactly like a real row does.
      const label = `UPI/${payeeName ?? 'MERCHANT'}/${vpa ?? 'merchant@ybl'}/UPI/TIXPAY`;
      const { txn, seq } = nextSim('DEBIT', amount, label, vpa);
      rebuild({ simulatedTxns: [...s.simulatedTxns, txn], _simSeq: seq });
    },

    injectSimulated: (direction: 'DEBIT' | 'CREDIT', amount: number, label: string) => {
      const s = get();
      const { txn, seq } = nextSim(direction, amount, label);
      rebuild({ simulatedTxns: [...s.simulatedTxns, txn], _simSeq: seq });
    },

    /**
     * Fund a shortfall from the Keeper jar.
     *
     * Both halves move: the jar is debited and the account credited, so the
     * rescued curve the intervention promised is the curve the user gets, and
     * the money visibly came from somewhere rather than appearing.
     */
    applySweep: (amount: number) => {
      const s = get();
      if (s.keeperBalance < amount) return;
      const { txn, seq } = nextSim('CREDIT', amount, 'TIXPAY KEEPER SWEEP');
      rebuild({
        simulatedTxns: [...s.simulatedTxns, txn],
        _simSeq: seq,
        keeperBalance: round2(s.keeperBalance - amount),
        keeperTxns: [
          { id: `keeper_sweep_${seq}`, label: 'Swept to account', amount: -amount, date: s.now },
          ...s.keeperTxns,
        ],
      });
    },

    /**
     * Move money from the account into the jar.
     *
     * Both halves move, and both are checked before either does. Refusing with
     * a reason rather than returning silently is what lets the Goals screen say
     * 'your account holds ₹320' instead of appearing to do nothing.
     */
    addToKeeper: (amount: number) => {
      const s = get();
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: 'Enter an amount above zero.' };
      }
      const available = s._pipelineCache?.ledger.currentBalance ?? 0;
      if (available < amount) {
        return {
          ok: false,
          message: `Your account holds ₹${Math.floor(available).toLocaleString('en-IN')} — not enough to move ₹${amount.toLocaleString('en-IN')}.`,
        };
      }
      const { txn, seq } = nextSim('DEBIT', amount, 'TIXPAY KEEPER TOP-UP');
      rebuild({
        simulatedTxns: [...s.simulatedTxns, txn],
        _simSeq: seq,
        keeperBalance: round2(s.keeperBalance + amount),
        keeperTxns: [
          { id: `keeper_add_${seq}`, label: 'Added from account', amount, date: s.now },
          ...s.keeperTxns,
        ],
      });
      return { ok: true, message: `₹${amount.toLocaleString('en-IN')} moved into your goal.` };
    },

    withdrawFromKeeper: (amount: number) => {
      const s = get();
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: 'Enter an amount above zero.' };
      }
      if (s.keeperBalance < amount) {
        return {
          ok: false,
          message: `This goal holds ₹${Math.floor(s.keeperBalance).toLocaleString('en-IN')} — not enough to take out ₹${amount.toLocaleString('en-IN')}.`,
        };
      }
      // Same movement as a sweep, different intent — and the jar's history is
      // the one place that distinction is visible, so it gets its own label.
      const { txn, seq } = nextSim('CREDIT', amount, 'TIXPAY KEEPER WITHDRAWAL');
      rebuild({
        simulatedTxns: [...s.simulatedTxns, txn],
        _simSeq: seq,
        keeperBalance: round2(s.keeperBalance - amount),
        keeperTxns: [
          { id: `keeper_withdraw_${seq}`, label: 'Withdrawn to account', amount: -amount, date: s.now },
          ...s.keeperTxns,
        ],
      });
      return { ok: true, message: `₹${amount.toLocaleString('en-IN')} moved back to your account.` };
    },

    setGoal: (label: string, targetAmount: number, targetDate: Date | null) => {
      set({ goalLabel: label, goalTargetAmount: Math.max(0, targetAmount), goalTargetDate: targetDate });
    },

    setHorizon: (days: number) => rebuild({ horizonDays: Math.max(7, Math.min(365, days)) }),

    addCard: (card: Card) => {
      set({ cardsList: [...get().cardsList, card] });
    },

    setRiskAnswer: (questionId: string, score: number) => {
      set({ riskAnswers: { ...get().riskAnswers, [questionId]: score } });
    },

    setProfile: (patch: Partial<UserProfile>) =>
      set({ profile: { ...get().profile, ...patch } }),

    setUpiPin: (pin: string) => set({ upiPin: pin }),

    /**
     * A PIN check with nothing set is a pass, not a lockout.
     *
     * Onboarding can be skipped straight to the demo, which never reaches the
     * PIN step. Failing closed there would make the balance permanently
     * unreachable with no way to recover it from inside the app.
     */
    verifyUpiPin: (pin: string) => {
      const expected = get().upiPin;
      return expected === null ? true : pin === expected;
    },

    resetRiskAnswers: () => set({ riskAnswers: {} }),

    recompute: () => rebuild({}),
  };
});
