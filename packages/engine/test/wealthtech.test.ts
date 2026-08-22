import { describe, it, expect } from 'vitest';
import type { Transaction } from '../src/types';
import { auditSubscriptions } from '../src/analyze/recurring';
import { computeMoneyMap, computeHealthVerdict } from '../src/analyze/health';
import { computeRiskProfile, computeRiskCapacity, RISK_QUESTIONS } from '../src/analyze/riskProfile';
import { categorizeTransaction } from '../src/analyze/spend';
import { parseUpiNarration, extractDisplayName, extractCounterparty, parseStatementCsv } from '../src/parse/statement';
import { detectMandates } from '../src/detect/mandates';
import { buildLedger } from '../src/project/ledger';

const NOW = new Date('2026-08-22T00:00:00.000Z');

let seq = 0;
function txn(over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    direction: 'DEBIT',
    amount: 100,
    bank: 'ICICI',
    timestamp: NOW,
    isFailure: false,
    source: 'STATEMENT',
    ...over,
  };
}

/** A charge repeating every `gap` days, ending `endOffset` days before NOW. */
function repeating(
  vpa: string,
  amount: number,
  count: number,
  gap: number,
  narration = '',
  endOffset = 0,
): Transaction[] {
  const out: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = endOffset + (count - 1 - i) * gap;
    out.push(
      txn({
        vpa,
        amount,
        merchantHint: narration,
        timestamp: new Date(NOW.getTime() - daysAgo * 86400000),
      }),
    );
  }
  return out;
}

// ─── The ICICI narration layout ──────────────────────────────────────────────

describe('parseUpiNarration', () => {
  const ICICI = 'UPI/Dominos Pi/dominospizzaon/UPI/YES BANK L/614226137716/PYTM6052280376';

  it('reads name, handle, remark and PSP out of the structured layout', () => {
    const parsed = parseUpiNarration(ICICI);
    expect(parsed).toBeDefined();
    expect(parsed!.payeeName).toBe('Dominos Pi');
    expect(parsed!.handle).toBe('dominospizzaon');
    expect(parsed!.remark).toBe('UPI');
    expect(parsed!.psp).toBe('YES BANK L');
  });

  it('declines the HDFC layout, which states a real VPA at the end', () => {
    // Field 1 is a rail marker there, not a counterparty.
    expect(parseUpiNarration('UPI/DR/412345678901/Swiggy/HDFC/swiggy.payu@hdfcbank'))
      .toBeUndefined();
  });

  it('declines anything that is not slash-delimited UPI', () => {
    expect(parseUpiNarration('NACH DR-BAJAJ FINANCE LTD-4412998877')).toBeUndefined();
    expect(parseUpiNarration('')).toBeUndefined();
  });
});

describe('extractCounterparty on truncated ICICI addresses', () => {
  it('groups one merchant under one key regardless of the payer remark', () => {
    // These differ only in the remark field and the reference numbers. Before
    // the structured parser they produced two different keys, which split a
    // 91-charge merchant in half and hid it from every downstream feature.
    const a = extractCounterparty('UPI/JUSTVEND P/justvendprivat/payjustven/ICICI BANK/614571563502/ici6595d9c7');
    const b = extractCounterparty('UPI/justvend p/justvendprivat/payjustve/ICICI Bank/651233872946/icif48e92f6');
    expect(a).toBe('justvendprivat');
    expect(b).toBe(a);
  });

  it('still prefers a real VPA when the narration carries one', () => {
    expect(extractCounterparty('UPI/Netflix/netflix.bd@axi/MandateExe/AXIS BANK/967121612276'))
      .toBe('netflix.bd@axi');
  });
});

describe('extractDisplayName', () => {
  it('title-cases an upper-case bank name', () => {
    expect(extractDisplayName('UPI/SAISH AMBA/ambarsaish@okh/UPI/HDFC BANK/650948837935'))
      .toBe('Saish Amba');
  });

  it('leaves mixed case as the bank wrote it', () => {
    expect(extractDisplayName('UPI/Dominos Pi/dominospizzaon/UPI/YES BANK L/6142261377'))
      .toBe('Dominos Pi');
  });

  it('reads a Visa standing instruction, whose fields are otherwise numeric', () => {
    expect(extractDisplayName('VSI/ANTHROPIC  /202607291919/621013379737//TCS Rs0.00'))
      .toBe('Anthropic');
  });

  it('returns undefined rather than guessing at free-form narration', () => {
    expect(extractDisplayName('NEFT CR-a/c **4471 on 25-09-25 towards SALARY')).toBeUndefined();
  });
});

// ─── The detector's two gates ────────────────────────────────────────────────

describe('detectMandates rejects high-frequency merchants', () => {
  it('does not call a shop with several charges a day a weekly mandate', () => {
    // A campus vending operator: many charges, wildly irregular, and repeatedly
    // on the same day. Its median gap can land inside the weekly band by pure
    // coincidence, which is exactly how it used to be reported as a mandate.
    const gaps = [1, 1, 12, 3, 7, 0, 0, 14, 7, 0, 21, 2];
    let daysAgo = 90;
    const txns = gaps.map((g) => {
      daysAgo -= g;
      return txn({
        vpa: 'justvendprivat',
        amount: 40,
        timestamp: new Date(NOW.getTime() - daysAgo * 86400000),
      });
    });

    expect(detectMandates(txns, NOW)).toEqual([]);
  });

  it('still finds a genuine monthly debit', () => {
    const txns = repeating('sip.nippon@hdfcbank', 5000, 5, 30, 'UPI-SIP-sip.nippon@hdfcbank');
    const found = detectMandates(txns, NOW);
    expect(found).toHaveLength(1);
    expect(found[0]!.cadence).toBe('MONTHLY');
    expect(found[0]!.amount).toBe(5000);
  });
});

// ─── Spend categorisation ────────────────────────────────────────────────────

describe('categorizeTransaction', () => {
  it('does not file every UPI payment as a transfer', () => {
    // The rail a payment travelled on is not a spending category. This exact
    // narration used to land in TRANSFER along with 62% of a real statement.
    expect(
      categorizeTransaction(
        txn({ merchantHint: 'UPI/Dominos Pi/dominospizzaon/UPI/YES BANK L/61422', vpa: 'dominospizzaon' }),
      ),
    ).toBe('FOOD');
  });

  it('reads a merchant-QR address as a shop, not a person', () => {
    expect(categorizeTransaction(txn({ vpa: 'paytmqr1to4u9c', merchantHint: 'UPI/PANCHALING/paytmqr1to4u9c/UPI' })))
      .toBe('OTHER');
  });

  it('reads a personal handle as a person', () => {
    expect(categorizeTransaction(txn({ vpa: 'ambarsaish@okh', merchantHint: 'UPI/SAISH AMBA/ambarsaish@okh/UPI' })))
      .toBe('PEOPLE');
  });

  it('files software subscriptions with the streaming ones', () => {
    expect(categorizeTransaction(txn({ merchantHint: 'VSI/ANTHROPIC  /2026072919', vpa: 'vsianthropictcs' })))
      .toBe('OTT');
  });

  it('does not read "lic" inside another word as insurance', () => {
    // 'uplicici' is a UPI Lite load. The old rule matched /lic/ anywhere and
    // reported it as a ₹1,000 insurance premium.
    expect(categorizeTransaction(txn({ merchantHint: 'UPL/620364979885/UPI/0100710', vpa: 'uplicici' })))
      .not.toBe('INSURANCE');
  });
});

// ─── Subscription audit ──────────────────────────────────────────────────────

describe('auditSubscriptions', () => {
  it('annualises a monthly charge', () => {
    const audit = auditSubscriptions(repeating('netflix.rzp@icici', 649, 5, 30), NOW);
    expect(audit.charges).toHaveLength(1);
    expect(audit.charges[0]!.cadence).toBe('MONTHLY');
    expect(audit.charges[0]!.annualCost).toBe(649 * 12);
    expect(audit.totalAnnual).toBe(649 * 12);
    expect(audit.charges[0]!.cadenceAssumed).toBe(false);
  });

  it('tolerates amounts the strict detector would reject', () => {
    // ±12% swing: a mandate for projection purposes, no; a subscription you are
    // paying for, yes.
    const txns = [
      txn({ vpa: 'gym@ybl', amount: 1499, timestamp: new Date(NOW.getTime() - 90 * 86400000) }),
      txn({ vpa: 'gym@ybl', amount: 1650, timestamp: new Date(NOW.getTime() - 60 * 86400000) }),
      txn({ vpa: 'gym@ybl', amount: 1560, timestamp: new Date(NOW.getTime() - 30 * 86400000) }),
    ];
    expect(auditSubscriptions(txns, NOW).charges).toHaveLength(1);
    expect(detectMandates(txns, NOW)).toEqual([]);
  });

  it('trusts a bank autopay marker even with a single charge', () => {
    const txns = [
      txn({
        vpa: 'netflix.bd@axi',
        amount: 499,
        merchantHint: 'UPI/Netflix/netflix.bd@axi/MandateExe/AXIS BANK/967121612276',
        timestamp: new Date(NOW.getTime() - 7 * 86400000),
      }),
    ];
    const audit = auditSubscriptions(txns, NOW);
    expect(audit.charges).toHaveLength(1);
    expect(audit.charges[0]!.viaAutopay).toBe(true);
    expect(audit.charges[0]!.cadenceAssumed).toBe(true);
    expect(audit.charges[0]!.annualCost).toBe(499 * 12);
  });

  it('ignores a one-off with no autopay marker', () => {
    const txns = [txn({ vpa: 'shop@ybl', amount: 499 })];
    expect(auditSubscriptions(txns, NOW).charges).toEqual([]);
  });

  it('never marks an assumed-cadence charge dormant', () => {
    // We do not know its rhythm, so we cannot say it has missed one.
    const txns = [
      txn({
        vpa: 'netflix.bd@axi',
        amount: 499,
        merchantHint: 'UPI/Netflix/netflix.bd@axi/MandateExe/AXIS/9671',
        timestamp: new Date(NOW.getTime() - 200 * 86400000),
      }),
    ];
    expect(auditSubscriptions(txns, NOW).dormant).toEqual([]);
  });

  it('flags a measured charge that has missed two cycles', () => {
    const audit = auditSubscriptions(
      repeating('spotify@icici', 119, 4, 30, '', 95),
      NOW,
    );
    expect(audit.dormant).toHaveLength(1);
  });
});

// ─── Money map ───────────────────────────────────────────────────────────────

const STATEMENT = `Date,Narration,Withdrawal Amt,Deposit Amt,Closing Balance
01/06/2026,NEFT CR-a/c **4471 towards SALARY,,60000,60000
02/06/2026,UPI-SIP-sip.nippon@hdfcbank-HDFC-1,5000,,55000
05/06/2026,UPI-SWIGGY-swiggy.payu@hdfcbank-HDFC-2,400,,54600
01/07/2026,NEFT CR-a/c **4471 towards SALARY,,60000,114600
02/07/2026,UPI-SIP-sip.nippon@hdfcbank-HDFC-3,5000,,109600
05/07/2026,UPI-SWIGGY-swiggy.payu@hdfcbank-HDFC-4,400,,109200
20/07/2026,UPI-CROMA-croma.rzp@icici-ICIC-5,80000,,29200
01/08/2026,NEFT CR-a/c **4471 towards SALARY,,60000,89200
02/08/2026,UPI-SIP-sip.nippon@hdfcbank-HDFC-6,5000,,84200
05/08/2026,UPI-SWIGGY-swiggy.payu@hdfcbank-HDFC-7,400,,83800
`;

describe('computeMoneyMap', () => {
  const parsed = parseStatementCsv(STATEMENT);
  const ledger = buildLedger(parsed.txns);
  const mandates = detectMandates(ledger.txns, NOW);
  const map = computeMoneyMap(parsed.txns, mandates, ledger, [], 10000, NOW, 90);

  it('reports the reconciled balance and the reserve it was handed', () => {
    expect(map.liquidBalance).toBe(83800);
    expect(map.reserve).toBe(10000);
  });

  it('rolls the detected SIP into the investing line', () => {
    expect(map.investing.monthly).toBe(5000);
    expect(map.investing.count).toBe(1);
  });

  it('separates the typical month from the mean one', () => {
    // ₹80,000 of what left this account is one Croma purchase. The mean carries
    // it into every month; the median spending day does not.
    expect(map.typicalMonthlySpend).toBeLessThan(map.monthlySpend / 2);
  });

  it('falls back to the mean when there are too few spending days to take a median', () => {
    // Under a week of spending days a median is a coin toss, so the figure
    // stays the mean and is imprecise honestly rather than confidently.
    const thin = [
      txn({ amount: 500, vpa: 'a@ybl', timestamp: new Date(NOW.getTime() - 10 * 86400000) }),
      txn({ amount: 700, vpa: 'b@ybl', timestamp: new Date(NOW.getTime() - 20 * 86400000) }),
      txn({
        direction: 'CREDIT',
        amount: 5000,
        vpa: 'c@ybl',
        timestamp: new Date(NOW.getTime() - 30 * 86400000),
      }),
    ];
    const thinMap = computeMoneyMap(thin, [], buildLedger(thin), [], 0, NOW, 90);
    expect(thinMap.typicalMonthlySpend).toBe(thinMap.monthlySpend);
  });

  it('holds one large purchase out of the typical monthly spend', () => {
    // Sixty ordinary ₹300 days plus one ₹2,00,000 purchase. The mean says this
    // person spends about ₹1 lakh a month and reports a fortnight of buffer;
    // the median spending day says ₹9,000, which is what they actually live on.
    const ordinary: Transaction[] = [];
    for (let i = 1; i <= 60; i++) {
      ordinary.push(
        txn({ amount: 300, vpa: 'shop@ybl', timestamp: new Date(NOW.getTime() - i * 86400000) }),
      );
    }
    ordinary.push(
      txn({ amount: 200000, vpa: 'croma.rzp@icici', timestamp: new Date(NOW.getTime() - 30 * 86400000) }),
    );
    ordinary.push(
      txn({
        direction: 'CREDIT',
        amount: 300000,
        vpa: 'salary@hdfc',
        timestamp: new Date(NOW.getTime() - 61 * 86400000),
      }),
    );

    const bigLedger = buildLedger(ordinary);
    const skewed = computeMoneyMap(ordinary, [], bigLedger, [], 0, NOW, 90);

    expect(skewed.monthlySpend).toBeGreaterThan(skewed.typicalMonthlySpend * 5);
    // Same balance, same reserve — only the denominator differs, and it is the
    // difference between "you have two weeks" and "you have months".
    const meanBuffer = (skewed.liquidBalance + skewed.reserve) / skewed.monthlySpend;
    expect(skewed.bufferMonths!).toBeGreaterThan(meanBuffer * 3);
  });

  it('measures over the days the statement actually covers', () => {
    expect(map.observedDays).toBeGreaterThan(60);
    expect(map.observedDays).toBeLessThanOrEqual(90);
  });

  it('is pure — same inputs, same output', () => {
    const again = computeMoneyMap(parsed.txns, mandates, ledger, [], 10000, NOW, 90);
    expect(again).toEqual(map);
  });
});

describe('computeHealthVerdict', () => {
  it('grades an account with no buffer and no surplus as at risk', () => {
    const verdict = computeHealthVerdict({
      liquidBalance: 500,
      reserve: 0,
      investing: { label: 'Investing', monthly: 0, count: 0, items: [] },
      protection: { label: 'Protection', monthly: 0, count: 0, items: [] },
      debt: { label: 'Debt servicing', monthly: 20000, count: 1, items: ['EMI'] },
      fixed: { label: 'Fixed running costs', monthly: 0, count: 0, items: [] },
      totalCommitted: 20000,
      monthlyIncome: 30000,
      monthlySpend: 32000,
      typicalMonthlySpend: 32000,
      monthlySurplus: -2000,
      savingsRate: -0.067,
      commitmentRatio: 0.667,
      bufferMonths: 0,
      observedDays: 90,
    });
    expect(verdict.grade).toBe('AT_RISK');
    expect(verdict.findings.some((f) => !f.ok)).toBe(true);
  });

  it('grades a funded, saving account as strong', () => {
    const verdict = computeHealthVerdict({
      liquidBalance: 300000,
      reserve: 50000,
      investing: { label: 'Investing', monthly: 10000, count: 2, items: ['A', 'B'] },
      protection: { label: 'Protection', monthly: 0, count: 0, items: [] },
      debt: { label: 'Debt servicing', monthly: 0, count: 0, items: [] },
      fixed: { label: 'Fixed running costs', monthly: 2000, count: 1, items: ['C'] },
      totalCommitted: 12000,
      monthlyIncome: 100000,
      monthlySpend: 40000,
      typicalMonthlySpend: 40000,
      monthlySurplus: 60000,
      savingsRate: 0.6,
      commitmentRatio: 0.12,
      bufferMonths: 8.75,
      observedDays: 90,
    });
    expect(verdict.grade).toBe('STRONG');
    expect(verdict.score).toBeGreaterThanOrEqual(75);
  });
});

// ─── Risk profile ────────────────────────────────────────────────────────────

const THIN_MAP = {
  liquidBalance: 2000,
  reserve: 0,
  investing: { label: 'Investing', monthly: 0, count: 0, items: [] },
  protection: { label: 'Protection', monthly: 0, count: 0, items: [] },
  debt: { label: 'Debt servicing', monthly: 18000, count: 1, items: ['EMI'] },
  fixed: { label: 'Fixed running costs', monthly: 0, count: 0, items: [] },
  totalCommitted: 18000,
  monthlyIncome: 30000,
  monthlySpend: 29000,
  typicalMonthlySpend: 29000,
  monthlySurplus: 1000,
  savingsRate: 0.033,
  commitmentRatio: 0.6,
  bufferMonths: 0.07,
  observedDays: 90,
};

const FAT_MAP = {
  ...THIN_MAP,
  liquidBalance: 400000,
  totalCommitted: 3000,
  debt: { label: 'Debt servicing', monthly: 0, count: 0, items: [] },
  monthlyIncome: 100000,
  monthlySpend: 40000,
  typicalMonthlySpend: 40000,
  monthlySurplus: 60000,
  savingsRate: 0.6,
  commitmentRatio: 0.03,
  bufferMonths: 10,
};

/** Every question answered with its bravest option. */
const BOLD = Object.fromEntries(RISK_QUESTIONS.map((q) => [q.id, 4]));

describe('computeRiskProfile', () => {
  it('caps a bold answer set at what the account can absorb', () => {
    const result = computeRiskProfile(BOLD, THIN_MAP);
    expect(result.attitudeScore).toBe(100);
    expect(result.capacityScore).toBeLessThan(50);
    expect(result.score).toBe(result.capacityScore);
    expect(result.cappedByCapacity).toBe(true);
    expect(result.profile).not.toBe('AGGRESSIVE');
  });

  it('lets the same answers through on an account that can take it', () => {
    const result = computeRiskProfile(BOLD, FAT_MAP);
    expect(result.cappedByCapacity).toBe(false);
    expect(result.profile).toBe('AGGRESSIVE');
  });

  it('does not treat an unanswered form as maximum caution', () => {
    const result = computeRiskProfile({}, FAT_MAP);
    expect(result.attitudeScore).toBe(0);
    // The headline has to say the form is empty rather than claim the two
    // scores agree — they cannot agree when one was never given.
    expect(result.headline).toMatch(/Answer the questions/);
    expect(result.cappedByCapacity).toBe(false);
  });

  it('scores a partly finished form on what was answered', () => {
    const half = { [RISK_QUESTIONS[0]!.id]: 4, [RISK_QUESTIONS[1]!.id]: 4 };
    const result = computeRiskProfile(half, FAT_MAP);
    expect(result.attitudeScore).toBe(100);
    expect(result.headline).toMatch(/2 of 5/);
  });

  it('suggests half the observed surplus, rounded to ₹500', () => {
    expect(computeRiskProfile(BOLD, FAT_MAP).suggestedMonthlySip).toBe(30000);
    expect(computeRiskProfile(BOLD, THIN_MAP).suggestedMonthlySip).toBeNull();
  });

  it('allocations always sum to 100', () => {
    for (const map of [THIN_MAP, FAT_MAP]) {
      for (const score of [0, 1, 2, 3, 4]) {
        const answers = Object.fromEntries(RISK_QUESTIONS.map((q) => [q.id, score]));
        const { equity, debt, gold, cash } = computeRiskProfile(answers, map).allocation;
        expect(equity + debt + gold + cash).toBe(100);
      }
    }
  });
});

describe('computeRiskCapacity', () => {
  it('names the figure behind each of its three inputs', () => {
    const { reasons } = computeRiskCapacity(FAT_MAP);
    expect(reasons).toHaveLength(3);
    expect(reasons.join(' ')).toMatch(/months of spending/);
    expect(reasons.join(' ')).toMatch(/Saving 60%/);
  });
});
