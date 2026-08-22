import type {
  Mandate,
  BalanceCurve,
  BalancePoint,
  Shortfall,
  Intervention,
  Recommendation,
  Card,
} from './index';

// Baseline demo start date: March 1, 2026
const BASE = new Date('2026-03-01T00:00:00.000Z');

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export const mockMandates: Mandate[] = [
  {
    id: 'm-hdfc-sip',
    normalizedVpa: 'hdfcmutual@hdfcbank',
    displayName: 'SIP • HDFC Mutual Fund',
    amount: 5000,
    cadence: 'MONTHLY',
    dayOfMonth: 12,
    nextDebit: new Date('2026-03-12T00:00:00.000Z'),
    confidence: 0.95,
    occurrences: 6,
    sourceTxnIds: ['tx-1', 'tx-2'],
    priority: 'CRITICAL',
    category: 'SIP',
    isPaused: false,
  },
  {
    id: 'm-netflix',
    normalizedVpa: 'netflix@icici',
    displayName: 'Netflix',
    amount: 649,
    cadence: 'MONTHLY',
    dayOfMonth: 12,
    nextDebit: new Date('2026-03-12T00:00:00.000Z'),
    confidence: 0.98,
    occurrences: 12,
    sourceTxnIds: ['tx-3'],
    priority: 'LOW',
    category: 'OTT',
    isPaused: false,
  },
  {
    id: 'm-bigbasket',
    normalizedVpa: 'bigbasket@ybl',
    displayName: 'BigBasket BB Star',
    amount: 1200,
    cadence: 'MONTHLY',
    dayOfMonth: 15,
    nextDebit: new Date('2026-03-15T00:00:00.000Z'),
    confidence: 0.85,
    occurrences: 8,
    sourceTxnIds: ['tx-4'],
    priority: 'HIGH',
    category: 'UTILITY',
    isPaused: false,
  },
  {
    id: 'm-phonepe-autopay',
    normalizedVpa: 'phonepe.autopay@ybl',
    displayName: 'PhonePe AutoPay (Wi-Fi)',
    amount: 999,
    cadence: 'MONTHLY',
    dayOfMonth: 16,
    nextDebit: new Date('2026-03-16T00:00:00.000Z'),
    confidence: 0.90,
    occurrences: 5,
    sourceTxnIds: ['tx-5'],
    priority: 'HIGH',
    category: 'UTILITY',
    isPaused: false,
  },
  {
    id: 'm-bescom-electricity',
    normalizedVpa: 'bescom@statebank',
    displayName: 'Electricity • BESCOM',
    amount: 1150,
    cadence: 'MONTHLY',
    dayOfMonth: 18,
    nextDebit: new Date('2026-03-18T00:00:00.000Z'),
    confidence: 0.88,
    occurrences: 7,
    sourceTxnIds: ['tx-6'],
    priority: 'MEDIUM',
    category: 'UTILITY',
    isPaused: false,
  },
  {
    id: 'm-lic-premium',
    normalizedVpa: 'licpremium@sbi',
    displayName: 'LIC Term Insurance',
    amount: 3400,
    cadence: 'MONTHLY',
    dayOfMonth: 22,
    nextDebit: new Date('2026-03-22T00:00:00.000Z'),
    confidence: 0.92,
    occurrences: 4,
    sourceTxnIds: ['tx-7'],
    priority: 'CRITICAL',
    category: 'INSURANCE',
    isPaused: false,
  },
];

/**
 * Baseline 30-day balance curve.
 * Starts around ₹12,450, peaks at ₹16,050 around day 4,
 * dips below zero on Day 12 (index 11, Mar 12) down to -₹3,200 (mockShortfall),
 * and recovers by Day 20 after month-end income events.
 * Exactly 30 BalancePoint elements.
 */
export const mockCurve: BalanceCurve = Array.from({ length: 30 }, (_, i) => {
  const date = addDays(BASE, i);
  let balance = 12450;
  if (i <= 4) {
    balance = 12450 + i * 900; // Day 0..4: 12450 -> 16050
  } else if (i <= 11) {
    balance = 16050 - (i - 4) * 2750; // Day 5..11: drops to -3200 on Day 12 (Mar 12)
  } else if (i <= 16) {
    balance = -3200 + (i - 11) * 1100; // Day 12..16: -3200 -> +2300
  } else {
    balance = 2300 + (i - 16) * 450; // Day 17..29: steady growth to ~8.1k
  }
  return {
    date,
    balance: Math.round(balance),
    events: [],
  };
});

/**
 * Resulting 30-day curves for interventions (each exactly 30 BalancePoints).
 */
export const mockResolvedCurvePauseNetflix: BalanceCurve = mockCurve.map((pt, i) => {
  let balance = pt.balance;
  if (i >= 11) {
    // Adding headroom and lifting out of negative deficit
    balance = pt.balance + 3849;
  }
  return {
    ...pt,
    balance: Math.max(649, balance),
  };
});

export const mockResolvedCurveShiftBigBasket: BalanceCurve = mockCurve.map((pt, i) => {
  let balance = pt.balance;
  if (i >= 11 && i <= 14) {
    balance = pt.balance + 4400; // shift buffer during crunch window
  } else if (i > 14) {
    balance = pt.balance + 3200;
  }
  return {
    ...pt,
    balance: Math.max(500, balance),
  };
});

export const mockResolvedCurveShiftElectricity: BalanceCurve = mockCurve.map((pt, i) => {
  let balance = pt.balance;
  if (i >= 11) {
    balance = pt.balance + 3500;
  }
  return {
    ...pt,
    balance: Math.max(450, balance),
  };
});

export const mockShortfall: Shortfall = {
  date: new Date('2026-03-12T00:00:00.000Z'),
  deficit: 3200,
  atRisk: [mockMandates[0]!, mockMandates[4]!], // SIP ₹5,000 + BESCOM Electricity ₹1,150
};

export const mockInterventions: Intervention[] = [
  {
    kind: 'PAUSE',
    label: 'Pause Netflix ₹649',
    target: mockMandates[1]!,
    amount: 649,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]!],
    resultingCurve: mockResolvedCurvePauseNetflix,
  },
  {
    kind: 'SHIFT',
    label: 'Delay BigBasket by 3 days',
    target: mockMandates[2]!,
    amount: 1200,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]!],
    resultingCurve: mockResolvedCurveShiftBigBasket,
  },
  {
    kind: 'SHIFT',
    label: 'Move Electricity Bill to Mar 15',
    target: mockMandates[4]!,
    amount: 1150,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]!],
    resultingCurve: mockResolvedCurveShiftElectricity,
  },
];

export const mockCards: Card[] = [
  {
    id: 'card-amex-gold',
    name: 'Amex SmartEarn',
    network: 'AMEX',
    upiLinkable: false,
    rewardRate: 2.5,
    categoryRates: { '5732': 5.0 },
    mccExclusions: [],
    feeWaiverThreshold: 100000,
    ytdSpend: 96000, // ₹4,000 to fee waiver!
  },
  {
    id: 'card-hdfc-rupay',
    name: 'HDFC Tata Neu RuPay',
    network: 'RUPAY',
    upiLinkable: true,
    rewardRate: 1.5,
    categoryRates: {},
    mccExclusions: [],
  },
];

export const mockRecommendation: Recommendation = {
  instrument: mockCards[0]!,
  rail: 'CARD_SWIPE',
  reason: "Pay with your Amex instead — you're ₹4,000 from your fee waiver",
  valueDelta: 1500,
  mccConfidence: 0.9,
  warnings: ['UPI not supported for Amex — swipe or tap card'],
};
