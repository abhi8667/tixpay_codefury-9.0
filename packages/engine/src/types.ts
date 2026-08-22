/**
 * TiXPay engine — shared contract.
 *
 * Mirrors §4 of TIXPAY_BUILD_SPEC.md. The engine owns and exports these so the
 * package drops into the app with no external types dependency.
 *
 * ADDITIVE-ONLY after hour 3. New fields must be optional. Renaming or removing
 * a field is a three-person decision.
 *
 * Two invariants hold across every declaration here:
 *   1. Money is in RUPEES at this boundary (2dp). Internal math uses paise
 *      integers — see src/money.ts.
 *   2. Anything that touches time takes `now: Date` as a parameter. No engine
 *      function calls `new Date()`.
 */

// ─── Transactions ────────────────────────────────────────────────────────────

export type Direction = 'DEBIT' | 'CREDIT';

/** 'OTHER' covers a statement whose bank we could not infer from the preamble. */
export type BankCode = 'HDFC' | 'SBI' | 'ICICI' | 'KOTAK' | 'AXIS' | 'PNB' | 'OTHER';

/**
 * Where a transaction came from.
 *
 *   STATEMENT — a row of a bank statement the user uploaded. The only real
 *               ingestion path; everything the app shows traces back to one.
 *   INTENT    — our own simulated payment, applied locally so the user can see
 *               what a payment would do. Never leaves the device.
 */
export type TransactionSource = 'STATEMENT' | 'INTENT';

export interface Transaction {
  id: string;
  direction: Direction;
  amount: number; // rupees
  /**
   * Counterparty grouping key. A real VPA ('swiggy@ybl') when the statement
   * narration carries one, otherwise a key synthesised from the merchant words
   * — see extractCounterparty. Recurring-debit detection buckets on this.
   */
  vpa?: string;
  /** The statement narration, verbatim. Drives categorisation and provenance. */
  merchantHint?: string;
  accountTail?: string; // '4471' — last four only; we never retain the full number
  balanceHint?: number; // the running balance the statement stated on this row
  refNo?: string;
  bank: BankCode;
  timestamp: Date;
  isFailure: boolean; // narration says returned / reversed / dishonoured
  source?: TransactionSource;
}

// ─── Mandates ────────────────────────────────────────────────────────────────

export type Cadence = 'MONTHLY' | 'WEEKLY' | 'QUARTERLY';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type Category = 'EMI' | 'SIP' | 'INSURANCE' | 'UTILITY' | 'OTT' | 'OTHER';

export interface Mandate {
  id: string;
  normalizedVpa: string;
  displayName: string;
  amount: number; // median, rupees
  cadence: Cadence;
  dayOfMonth: number; // or dayOfWeek for WEEKLY
  nextDebit: Date;
  confidence: number; // 0–1
  occurrences: number; // provenance: 'found from 6 statement rows'
  sourceTxnIds: string[];
  priority: Priority;
  category: Category;
  isPaused: boolean; // user intervention
}

// ─── Ledger, income, projection ──────────────────────────────────────────────

/** SWEEP is a user-initiated transfer proposed by an intervention, not inferred income. */
export type IncomeKind = 'SALARY' | 'IRREGULAR' | 'SWEEP';

export interface IncomeEvent {
  amount: number;
  date: Date;
  confidence: number;
  /** 'Salary' / 'Freelance income' — rendered as a marker on the curve. */
  label?: string;
  kind?: IncomeKind;
}

export interface LedgerEvent {
  kind: 'MANDATE' | 'INCOME' | 'PAYMENT';
  label: string;
  amount: number; // signed: negative = outflow
  mandateId?: string;
}

export interface BalancePoint {
  date: Date;
  balance: number;
  events: LedgerEvent[];
}

export type BalanceCurve = BalancePoint[];

export interface ShadowLedger {
  /** Chronological, oldest first. */
  txns: Transaction[];
  /** Inferred balance as of the most recent transaction. */
  currentBalance: number;
  /** |inferred − stated| at the last row that carried a balance. Zero on a
   *  statement with a running-balance column, which is the normal case. */
  drift: number;
  /** Timestamp of the last balance hint we snapped to, if any. */
  lastReconciledAt?: Date;
  /** The account this ledger reconciles. Other accounts and cards are excluded. */
  accountTail?: string;
  /** How many rows stated a balance we could snap to. */
  reconciliations?: number;
  /** Worst and average |inferred − stated| across all snaps. Pitch material. */
  maxDrift?: number;
  meanDrift?: number;
  /** Epoch ms of every balance-stating row. Used to judge whether a balance
   *  near a given date is trustworthy — see hasReliableBalanceAt. */
  hintTimestamps?: number[];
  /**
   * NOTE FOR PERSON C: this is a method, so the ledger does not survive
   * JSON serialisation. Derive it in a selector; never persist it to MMKV.
   */
  balanceAt(date: Date): number;
}

// ─── Guard ───────────────────────────────────────────────────────────────────

export interface Shortfall {
  date: Date;
  deficit: number; // positive: how short
  atRisk: Mandate[];
}

export type InterventionKind = 'SWEEP' | 'PAUSE' | 'SHIFT';

export interface Intervention {
  kind: InterventionKind;
  label: string; // 'Pause Netflix ₹649'
  target?: Mandate;
  amount?: number;
  penaltyAvoided: number; // rupees
  savedMandates: Mandate[];
  resultingCurve: BalanceCurve; // precomputed for instant animation
}

// ─── Attribution ─────────────────────────────────────────────────────────────

export type FailureCause = 'LIQUIDITY' | 'INTENTIONAL' | 'UNKNOWN';

// ─── Cards & routing ─────────────────────────────────────────────────────────

export type Network = 'RUPAY' | 'VISA' | 'MASTERCARD' | 'AMEX';

export interface Card {
  id: string;
  name: string;
  network: Network;
  upiLinkable: boolean; // only RuPay is true
  rewardRate: number; // % base
  categoryRates: Record<string, number>; // mcc → %
  mccExclusions: string[];
  monthlyRewardCap?: number;
  feeWaiverThreshold?: number; // annual spend
  annualFee?: number;
  /** Spend so far this year, for waiver proximity. */
  ytdSpend?: number;
}

export type Rail = 'UPI' | 'CARD_SWIPE';

export interface Recommendation {
  instrument: Card | 'UPI_BANK_ACCOUNT';
  rail: Rail;
  reason: string; // 'You are ₹4,000 from your fee waiver'
  valueDelta: number; // rupees vs next-best
  mccConfidence: number;
  warnings: string[];
}

// ─── Payment intent & verdict ────────────────────────────────────────────────

export interface UpiIntent {
  pa: string;
  pn?: string;
  am?: string;
  mc?: string;
  tr?: string;
  cu?: string;
  [param: string]: string | undefined;
}

export interface PaymentIntent {
  vpa: string; // pa
  payeeName: string; // pn
  amount: number; // am
  mcc?: string; // mc
  txnRef: string; // tr — we generate 'TP' + id
  source: 'QR' | 'MANUAL' | 'CONTACT';
}

export type VerdictLevel = 'CLEAR' | 'ADVISORY' | 'WARNING';

export interface PaymentVerdict {
  level: VerdictLevel;
  newShortfall?: Shortfall;
  shiftedShortfall?: { from: Date; to: Date };
  atRisk: Mandate[];
  recommendation?: Recommendation;
  headline: string; // 'This leaves you ₹3,200 short on 9 March'
  subline?: string; // 'Your ₹5,000 SIP will bounce · ₹250 charge'
}

// ─── Penalty model ───────────────────────────────────────────────────────────

/**
 * OTT is 0 on purpose: a failed UPI Autopay on Netflix costs nothing but a
 * service pause. The money is in NACH and EMI bounces. See §6 of the brief.
 */
export const PENALTY: Record<Category, number> = {
  EMI: 500,
  SIP: 250,
  INSURANCE: 250,
  UTILITY: 100,
  OTT: 0,
  OTHER: 100,
};

/** Intervention ranking order. Lower index = protect first. */
export const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
