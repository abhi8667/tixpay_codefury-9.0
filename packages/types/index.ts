/**
 * TiXPay Data Model Contract & Type Definitions
 * Verbatim from Section 4 & Section 5 of TIXPAY_BUILD_SPEC.md
 */

export type Direction = 'DEBIT' | 'CREDIT';
export type BankCode = 'HDFC' | 'SBI' | 'ICICI' | 'KOTAK' | 'AXIS' | 'PNB';

export interface RawSms {
  address: string;        // e.g. 'AD-HDFCBK'
  body: string;
  date: number;           // epoch ms
}

export interface Transaction {
  id: string;
  direction: Direction;
  amount: number;         // rupees
  vpa?: string;           // 'swiggy@ybl'
  merchantHint?: string;  // free text from SMS
  accountTail?: string;   // '4471'
  balanceHint?: number;   // if SMS stated 'Avl Bal'
  refNo?: string;
  bank: BankCode;
  timestamp: Date;
  isFailure: boolean;     // 'could not be processed' / 'insufficient'
  raw: RawSms;
  source?: 'SMS' | 'INTENT';
}

export type Cadence = 'MONTHLY' | 'WEEKLY' | 'QUARTERLY';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Category = 'EMI' | 'SIP' | 'INSURANCE' | 'UTILITY' | 'OTT' | 'OTHER';

export interface Mandate {
  id: string;
  normalizedVpa: string;
  displayName: string;
  amount: number;         // median
  cadence: Cadence;
  dayOfMonth: number;     // or dayOfWeek
  nextDebit: Date;
  confidence: number;     // 0–1
  occurrences: number;    // provenance: 'found from 6 SMS'
  sourceTxnIds: string[];
  priority: Priority;
  category: Category;
  isPaused: boolean;      // user intervention
}

export type IncomeKind = 'SALARY' | 'IRREGULAR' | 'SWEEP';

export interface IncomeEvent {
  amount: number;
  date: Date;
  confidence: number;
  label?: string;
  kind?: IncomeKind;
}

export interface LedgerEvent {
  kind: 'MANDATE' | 'INCOME' | 'PAYMENT';
  label: string;
  amount: number;
  mandateId?: string;
}

export interface BalancePoint {
  date: Date;
  balance: number;
  events: LedgerEvent[];
}

export type BalanceCurve = BalancePoint[];

export interface ShadowLedger {
  txns: Transaction[];
  currentBalance: number;
  drift: number;
  lastReconciledAt?: Date;
  accountTail?: string;
  reconciliations?: number;
  maxDrift?: number;
  meanDrift?: number;
  hintTimestamps?: number[];
  balanceAt(date: Date): number;
}

export interface Shortfall {
  date: Date;
  deficit: number;        // positive number, how short
  atRisk: Mandate[];      // debits that would fail
}

export type InterventionKind = 'SWEEP' | 'PAUSE' | 'SHIFT';

export interface Intervention {
  kind: InterventionKind;
  label: string;          // 'Pause Netflix ₹649'
  target?: Mandate;
  amount?: number;
  penaltyAvoided: number; // ₹
  savedMandates: Mandate[];
  resultingCurve: BalanceCurve;  // precomputed for instant animation
}

export type FailureCause = 'LIQUIDITY' | 'INTENTIONAL' | 'UNKNOWN';

export type Network = 'RUPAY' | 'VISA' | 'MASTERCARD' | 'AMEX';

export interface Card {
  id: string;
  name: string;
  network: Network;
  upiLinkable: boolean;
  rewardRate: number;           // % base
  categoryRates: Record<string, number>;  // mcc → %
  mccExclusions: string[];
  monthlyRewardCap?: number;
  feeWaiverThreshold?: number;  // annual spend
  annualFee?: number;
  ytdSpend?: number;
}

export type Rail = 'UPI' | 'CARD_SWIPE';

export interface Recommendation {
  instrument: Card | 'UPI_BANK_ACCOUNT';
  rail: Rail;
  reason: string;               // 'You are ₹4,000 from fee waiver'
  valueDelta: number;           // ₹ vs next-best
  mccConfidence: number;
  warnings: string[];           // 'This MCC is excluded on your Infinia'
}

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
  vpa: string;          // pa
  payeeName: string;    // pn
  amount: number;       // am
  mcc?: string;         // mc — present on many real QRs
  txnRef: string;       // tr — e.g. 'TP' + nanoid
  source: 'QR' | 'MANUAL' | 'CONTACT';
}

export type VerdictLevel = 'CLEAR' | 'ADVISORY' | 'WARNING';

export interface PaymentVerdict {
  level: VerdictLevel;
  newShortfall?: Shortfall;      // created by this payment
  shiftedShortfall?: {           // existing shortfall pulled earlier
    from: Date;
    to: Date;
  };
  atRisk: Mandate[];
  recommendation?: Recommendation;
  headline: string;              // 'This leaves you ₹3,200 short on the 9th'
  subline?: string;              // 'Your ₹5,000 SIP will bounce'
}

export interface InboxSource {
  read(since: Date): Promise<RawSms[]>;
}

export const PENALTY: Record<Category, number> = {
  EMI: 500,
  SIP: 250,
  INSURANCE: 250,
  UTILITY: 100,
  OTT: 0,
  OTHER: 100,
};

export const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export * from './mocks';
