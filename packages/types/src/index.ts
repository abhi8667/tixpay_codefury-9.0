/**
 * TiXPay shared contract & type definitions.
 */

export type Direction = 'DEBIT' | 'CREDIT';
export type BankCode = 'HDFC' | 'SBI' | 'ICICI' | 'KOTAK' | 'AXIS' | 'PNB';

export interface RawSms {
  address: string;
  body: string;
  date: number;
}

export interface Transaction {
  id: string;
  direction: Direction;
  amount: number;
  vpa?: string;
  merchantHint?: string;
  accountTail?: string;
  balanceHint?: number;
  refNo?: string;
  bank: BankCode;
  timestamp: Date;
  isFailure: boolean;
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
  amount: number;
  cadence: Cadence;
  dayOfMonth: number;
  nextDebit: Date;
  confidence: number;
  occurrences: number;
  sourceTxnIds: string[];
  priority: Priority;
  category: Category;
  isPaused: boolean;
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
  deficit: number;
  atRisk: Mandate[];
}

export type InterventionKind = 'SWEEP' | 'PAUSE' | 'SHIFT';

export interface Intervention {
  kind: InterventionKind;
  label: string;
  target?: Mandate;
  amount?: number;
  penaltyAvoided: number;
  savedMandates: Mandate[];
  resultingCurve: BalanceCurve;
}

export type FailureCause = 'LIQUIDITY' | 'INTENTIONAL' | 'UNKNOWN';

export type Network = 'RUPAY' | 'VISA' | 'MASTERCARD' | 'AMEX';

export interface Card {
  id: string;
  name: string;
  network: Network;
  upiLinkable: boolean;
  rewardRate: number;
  categoryRates: Record<string, number>;
  mccExclusions: string[];
  monthlyRewardCap?: number;
  feeWaiverThreshold?: number;
  annualFee?: number;
  ytdSpend?: number;
}

export type Rail = 'UPI' | 'CARD_SWIPE';

export interface Recommendation {
  instrument: Card | 'UPI_BANK_ACCOUNT';
  rail: Rail;
  reason: string;
  valueDelta: number;
  mccConfidence: number;
  warnings: string[];
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
  vpa: string;
  payeeName: string;
  amount: number;
  mcc?: string;
  txnRef: string;
  source: 'QR' | 'MANUAL' | 'CONTACT';
}

export type VerdictLevel = 'CLEAR' | 'ADVISORY' | 'WARNING';

export interface PaymentVerdict {
  level: VerdictLevel;
  newShortfall?: Shortfall;
  shiftedShortfall?: { from: Date; to: Date };
  atRisk: Mandate[];
  recommendation?: Recommendation;
  headline: string;
  subline?: string;
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
