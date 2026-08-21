import type {
  Mandate,
  BalanceCurve,
  BalancePoint,
  Shortfall,
  Intervention,
  Recommendation,
  Card,
} from './index';

// Baseline date: March 1, 2026
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
    confidence: 0.82,
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
    confidence: 0.95,
    occurrences: 12,
    sourceTxnIds: ['tx-3'],
    priority: 'LOW',
    category: 'OTT',
    isPaused: false,
  },
  {
    id: 'm-bigbasket',
    normalizedVpa: 'bigbasket@ybl',
    displayName: 'BigBasket',
    amount: 1200,
    cadence: 'MONTHLY',
    dayOfMonth: 15,
    nextDebit: new Date('2026-03-15T00:00:00.000Z'),
    confidence: 0.75,
    occurrences: 12,
    sourceTxnIds: ['tx-4'],
    priority: 'HIGH',
    category: 'UTILITY',
    isPaused: false,
  },
  {
    id: 'm-phonepe-autopay',
    normalizedVpa: 'phonepe.autopay@ybl',
    displayName: 'PhonePe AutoPay',
    amount: 199,
    cadence: 'MONTHLY',
    dayOfMonth: 16,
    nextDebit: new Date('2026-03-16T00:00:00.000Z'),
    confidence: 0.85,
    occurrences: 5,
    sourceTxnIds: ['tx-5'],
    priority: 'HIGH',
    category: 'OTHER',
    isPaused: false,
  },
  {
    id: 'm-electricity',
    normalizedVpa: 'bescom@statebank',
    displayName: 'Electricity Bill',
    amount: 1150,
    cadence: 'MONTHLY',
    dayOfMonth: 18,
    nextDebit: new Date('2026-03-18T00:00:00.000Z'),
    confidence: 0.70,
    occurrences: 7,
    sourceTxnIds: ['tx-6'],
    priority: 'MEDIUM',
    category: 'UTILITY',
    isPaused: false,
  },
];

// Generate 30 daily sample points for baseline curve (dips negative on day 12)
export const mockCurve: BalanceCurve = Array.from({ length: 30 }, (_, i) => {
  const date = addDays(BASE, i);
  // Start around 12,450. Peak ~16k around day 4, decline to -3,200 on day 11 (Mar 12), recover by day 20.
  let balance = 12450;
  if (i <= 4) {
    balance = 12450 + i * 900; // 12450 -> 16050
  } else if (i <= 11) {
    balance = 16050 - (i - 4) * 2750; // dips to -3200 on day 11 (Mar 12)
  } else if (i <= 16) {
    balance = -3200 + (i - 11) * 1100; // -3200 to +2300
  } else {
    balance = 2300 + (i - 16) * 450; // steady recovery -> ~8k
  }
  return {
    date,
    balance: Math.round(balance),
    events: [],
  };
});

// Resuming curve after pausing Netflix (+₹649 + avoiding ₹3,200 deficit threshold)
export const mockResolvedCurve: BalanceCurve = mockCurve.map((pt, i) => {
  let balance = pt.balance;
  if (i >= 11) {
    balance = pt.balance + 3849; // Lift entire curve well above 0 to +649 safe minimum
  }
  return {
    ...pt,
    balance: Math.max(649, balance),
  };
});

export const mockShortfall: Shortfall = {
  date: new Date('2026-03-12T00:00:00.000Z'),
  deficit: 3200,
  atRisk: [mockMandates[0], mockMandates[4]], // SIP ₹5,000 + Electricity ₹1,150
};

export const mockInterventions: Intervention[] = [
  {
    kind: 'PAUSE',
    label: 'Pause Netflix ₹649',
    target: mockMandates[1],
    amount: 649,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]],
    resultingCurve: mockResolvedCurve,
  },
  {
    kind: 'SHIFT',
    label: 'Delay BigBasket by 3 days',
    target: mockMandates[2],
    amount: 1200,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]],
    resultingCurve: mockResolvedCurve,
  },
  {
    kind: 'SHIFT',
    label: 'Move Electricity Bill to Mar 15',
    target: mockMandates[4],
    amount: 1150,
    penaltyAvoided: 250,
    savedMandates: [mockMandates[0]],
    resultingCurve: mockResolvedCurve,
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
  instrument: mockCards[0],
  rail: 'CARD_SWIPE',
  reason: "Pay with your Amex instead — you're ₹4,000 from your fee waiver",
  valueDelta: 1500,
  mccConfidence: 0.9,
  warnings: ['UPI not supported for Amex — swipe or tap card'],
};
