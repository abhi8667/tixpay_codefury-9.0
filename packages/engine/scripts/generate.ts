/**
 * Synthetic SMS corpus generator.
 *
 *   pnpm generate                       # seed 42 -> fixtures/demo_inbox.json
 *   pnpm tsx scripts/generate.ts --seed 42 --out fixtures/demo_inbox.json
 *
 * Deterministic by construction: a seeded PRNG and a fixed anchor date. The
 * demo must be byte-identical on the second run — a stage demo that produces
 * different numbers when you re-run it is a demo that gets a question you
 * cannot answer.
 *
 * ── The arithmetic this file exists to guarantee ────────────────────────────
 *
 * Anchor `now` = 1 March 2026, 09:00 IST. Ledger balance at `now` = ₹21,597,
 * pinned by a balance hint on the last historical SMS so the figure does not
 * depend on six months of accumulated history being exactly right.
 *
 * Debits, days 5–9:  EMI 12,450 + Jio 249 + LIC 1,899 + Netflix 649 + BSES 1,450
 *                    = ₹16,697   →   balance on the 9th = ₹4,900
 *
 *   No action      : 12th, SIP ₹5,000 debits against ₹4,900  → −₹100, BOUNCES
 *   Pause Netflix  : 12th, SIP debits against ₹5,549         → ₹549, SURVIVES
 *   Pay ₹8,000 now : 9th,  ₹4,900 − ₹8,000                   → −₹3,100
 *
 * That last line is demo beat 8: the ₹8,000 payment pulls the shortfall from
 * the 12th to the 9th. Nothing sits on days 10–11, which is what makes the
 * shift land cleanly on the 9th rather than smearing.
 *
 * Freelance income of ₹22,000 on the 14th lifts the curve back out, so there
 * is exactly ONE dip in the 30-day window. One dip is one story.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RawSms } from '../src/types';

// ─── CLI ─────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const SEED = Number(arg('seed', '42'));
const OUT = arg('out', 'fixtures/demo_inbox.json');

// ─── Deterministic PRNG ──────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

// ─── Dates ───────────────────────────────────────────────────────────────────

const IST = '+05:30';
const at = (iso: string) => new Date(`${iso}${IST}`).getTime();
const pad = (n: number) => String(n).padStart(2, '0');

/** epoch ms for a given IST calendar day + time. */
function day(year: number, month: number, date: number, hh = 9, mm = 0): number {
  return at(`${year}-${pad(month)}-${pad(date)}T${pad(hh)}:${pad(mm)}:00`);
}

/** '15-03-26' — the format most Indian bank SMS use. */
function ddmmyy(ms: number): string {
  const d = new Date(ms + 5.5 * 3600 * 1000);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${String(d.getUTCFullYear()).slice(2)}`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '12-Mar-26' — ICICI's format. */
function ddMonyy(ms: number): string {
  const d = new Date(ms + 5.5 * 3600 * 1000);
  return `${pad(d.getUTCDate())}-${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}

/** '1,25,000.00' — Indian digit grouping. */
function inr(n: number): string {
  const fixed = n.toFixed(2);
  const [whole = '0', frac = '00'] = fixed.split('.');
  const head = whole.slice(0, -3);
  const tail = whole.slice(-3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}` : tail;
  return `${grouped}.${frac}`;
}

const ref = () => String(between(500_000_000_000, 999_999_999_999));

// ─── The demo world ──────────────────────────────────────────────────────────

const NOW = day(2026, 3, 1, 9, 0); // anchor: 1 March 2026, 09:00 IST
const ANCHOR_BALANCE = 21597; // ledger balance at NOW, pinned by a balance hint

const ACCOUNT = '4471'; // the primary account — everything ledger-affecting is here
const CARD_TAIL = '8812'; // credit card spends: NOT a debit on the account
const SECONDARY = '9032'; // second account — exercises the other five parsers

interface MandateSpec {
  key: string;
  display: string;
  vpa: string;
  amount: number;
  dayOfMonth: number;
  category: 'EMI' | 'SIP' | 'INSURANCE' | 'UTILITY' | 'OTT';
}

/** The 8 seeded mandates. Days 5–9 sum to ₹16,697; nothing on days 10–11. */
const MANDATES: MandateSpec[] = [
  { key: 'emi', display: 'Bajaj Finserv EMI', vpa: 'bajajfinserv.emi@kotak', amount: 12450, dayOfMonth: 5, category: 'EMI' },
  { key: 'jio', display: 'JioFiber', vpa: 'jiofiber.bill@pnb', amount: 249, dayOfMonth: 6, category: 'UTILITY' },
  { key: 'lic', display: 'LIC Premium', vpa: 'lic.premium@axisbank', amount: 1899, dayOfMonth: 7, category: 'INSURANCE' },
  { key: 'netflix', display: 'Netflix', vpa: 'netflix.rzp@icici', amount: 649, dayOfMonth: 8, category: 'OTT' },
  { key: 'bses', display: 'BESCOM Electricity', vpa: 'bses.bill@axisbank', amount: 1450, dayOfMonth: 9, category: 'UTILITY' },
  { key: 'sip_nippon', display: 'Nippon India SIP', vpa: 'sip.nippon@hdfcbank', amount: 5000, dayOfMonth: 12, category: 'SIP' },
  { key: 'hotstar', display: 'Disney+ Hotstar', vpa: 'hotstar.rzp@icici', amount: 299, dayOfMonth: 15, category: 'OTT' },
  { key: 'sip_groww', display: 'Groww SIP', vpa: 'sip.groww@icici', amount: 2000, dayOfMonth: 20, category: 'SIP' },
];

/** Six months of history → six occurrences each → the "found from 6 SMS" line. */
const HISTORY = [
  { y: 2025, m: 9 }, { y: 2025, m: 10 }, { y: 2025, m: 11 },
  { y: 2025, m: 12 }, { y: 2026, m: 1 }, { y: 2026, m: 2 },
];

const SALARY = 82000;
const SALARY_DAY = 25;

/** Irregular freelance credits — variable amount, variable date, low confidence. */
const FREELANCE: Array<{ y: number; m: number; d: number; amount: number }> = [
  { y: 2025, m: 9, d: 18, amount: 24500 },
  { y: 2025, m: 10, d: 9, amount: 17800 },
  { y: 2025, m: 10, d: 27, amount: 21200 },
  { y: 2025, m: 11, d: 14, amount: 19600 },
  { y: 2025, m: 12, d: 6, amount: 26400 },
  { y: 2025, m: 12, d: 23, amount: 15900 },
  { y: 2026, m: 1, d: 11, amount: 22800 },
  { y: 2026, m: 2, d: 3, amount: 18300 },
  { y: 2026, m: 2, d: 19, amount: 23100 },
];

// ─── Bank SMS templates ──────────────────────────────────────────────────────
// Six sender formats. Ledger-affecting messages are all on HDFC **4471; the
// other five banks carry card spends, promos, OTPs and enquiries — which is
// realistic, and keeps the shadow ledger single-account.

const out: RawSms[] = [];
const push = (address: string, body: string, date: number) => out.push({ address, body, date });

const hdfcSender = () => pick(['AD-HDFCBK', 'VM-HDFCBK-S', 'JD-HDFCBK-T']);

function hdfcDebit(amount: number, vpa: string, date: number, balance: number | null) {
  const bal = balance === null ? '' : ` Avl Bal Rs.${inr(balance)}.`;
  push(
    hdfcSender(),
    `Rs.${inr(amount)} debited from a/c **${ACCOUNT} on ${ddmmyy(date)} to VPA ${vpa}. Ref ${ref()}.${bal} Not you? Call 18002586161`,
    date,
  );
}

function hdfcCredit(amount: number, from: string, date: number, balance: number | null, tag = '') {
  const bal = balance === null ? '' : ` Avl Bal Rs.${inr(balance)}`;
  push(
    hdfcSender(),
    `Rs.${inr(amount)} credited to a/c **${ACCOUNT} on ${ddmmyy(date)} from VPA ${from}.${tag} Ref ${ref()}.${bal}`,
    date,
  );
}

function hdfcSalary(amount: number, date: number, balance: number) {
  const month = `${MON[new Date(date + 5.5 * 3600 * 1000).getUTCMonth()]}${String(
    new Date(date + 5.5 * 3600 * 1000).getUTCFullYear(),
  ).slice(2)}`.toUpperCase();
  push(
    hdfcSender(),
    `INR ${inr(amount)} credited to a/c **${ACCOUNT} on ${ddmmyy(date)} towards SALARY ${month} ACME TECH PVT LTD. Avl Bal INR ${inr(balance)}`,
    date,
  );
}

function hdfcAutopayFailed(amount: number, vpa: string, date: number) {
  push(
    'AD-HDFCBK',
    `Your UPI Autopay mandate of Rs.${inr(amount)} to ${vpa} could not be processed due to insufficient funds. a/c **${ACCOUNT}. Ref ${ref()}`,
    date,
  );
}

function hdfcMandateDeclined(amount: number, vpa: string, date: number) {
  push(
    'AD-HDFCBK',
    `Your mandate debit of Rs.${inr(amount)} to ${vpa} on ${ddmmyy(date)} was declined. a/c **${ACCOUNT}. Ref ${ref()}`,
    date,
  );
}

/** Credit-card spend — hits the card, NOT the savings account. */
function cardSpend(merchant: string, amount: number, date: number) {
  push(
    pick(['AD-HDFCBK', 'AX-KOTAKB', 'VK-AXISBK']),
    `Rs.${inr(amount)} spent on Card **${CARD_TAIL} at ${merchant} on ${ddmmyy(date)}. Not you? Call 18002586161`,
    date,
  );
}

// ─── Secondary account ───────────────────────────────────────────────────────
// Onboarding says "Found 2 accounts — select one". The second account is what
// makes the other five bank parsers earn their keep: without it, every
// ledger-affecting message is HDFC and `parseSms` is only ever proven on one
// format. The shadow ledger filters to the primary account tail.

function sbiDebit(amount: number, vpa: string, date: number) {
  push(
    pick(['VM-SBIINB', 'VK-SBIINB-P']),
    `Dear Customer, Rs.${inr(amount)} debited from A/c no. XX${SECONDARY} on ${ddmmyy(date)} transfer to ${vpa} Ref No ${ref()} -SBI`,
    date,
  );
}

function iciciDebit(amount: number, vpa: string, date: number) {
  push(
    pick(['JD-ICICIB', 'JD-ICICIB-S']),
    `ICICI Bank Acct XX${SECONDARY} debited with Rs ${inr(amount)} on ${ddMonyy(date)} towards UPI ${vpa}. Ref ${ref()}. Avl Bal Rs ${inr(between(3000, 40000))}`,
    date,
  );
}

function kotakDebit(amount: number, vpa: string, date: number) {
  push(
    pick(['AX-KOTAKB', 'AX-KOTAKB-T']),
    `Sent Rs.${inr(amount)} from Kotak Bank AC X${SECONDARY} to ${vpa} on ${ddmmyy(date)}. UPI Ref ${ref()}. Avl Bal Rs.${inr(between(3000, 40000))}`,
    date,
  );
}

function axisDebit(amount: number, vpa: string, date: number) {
  push(
    pick(['VK-AXISBK', 'VK-AXISBK-S']),
    `INR ${inr(amount)} debited from A/c no. XX${SECONDARY} on ${ddmmyy(date)} to ${vpa} UPI Ref ${ref()}. Available Balance INR ${inr(between(3000, 40000))}`,
    date,
  );
}

function pnbDebit(amount: number, vpa: string, date: number) {
  push(
    pick(['BP-PNBSMS', 'BP-PNBSMS-P']),
    `Rs.${inr(amount)} debited from Ac XX${SECONDARY} on ${ddmmyy(date)} to ${vpa} Ref ${ref()}. Bal Rs.${inr(between(3000, 40000))} -PNB`,
    date,
  );
}

const SECONDARY_BANKS = [sbiDebit, iciciDebit, kotakDebit, axisDebit, pnbDebit];

// Noise — every one of these must parse to null.

const OTP_SENDERS = ['AD-HDFCBK', 'VM-SBIINB', 'JD-ICICIB', 'AX-KOTAKB', 'VK-AXISBK', 'BP-PNBSMS'];

function otp(date: number) {
  const code = String(between(100000, 999999));
  push(
    pick(OTP_SENDERS),
    pick([
      `${code} is your OTP for a transaction of Rs.${inr(between(200, 9000))} at ${pick(['CROMA', 'AMAZON', 'MYNTRA', 'BIGBASKET'])}. Valid for 10 mins. Do not share with anyone.`,
      `OTP ${code} for your net banking login. Never share this code. Valid 5 minutes.`,
      `Use OTP ${code} to authorise your UPI registration. Do not share. Rs.1.00 verification.`,
    ]),
    date,
  );
}

function promo(date: number) {
  push(
    pick(OTP_SENDERS),
    pick([
      `Congratulations! You are pre-approved for a Personal Loan of Rs.${between(2, 15)},00,000 at ${(8 + rand() * 5).toFixed(1)}% p.a. Click bit.ly/offer to apply. T&C apply`,
      `Get a Credit Card with zero joining fee. Earn upto 5% cashback on dining. Apply now. T&C apply`,
      `Flat ${between(10, 40)}% off on dining with your Card this weekend. Min spend Rs.1,500. Offer valid till month end. T&C`,
      `Your account is eligible for an instant overdraft of Rs.${between(20, 90)},000. Activate in the app. T&C apply`,
    ]),
    date,
  );
}

function enquiry(date: number) {
  push(
    pick(OTP_SENDERS),
    pick([
      `Your A/c **${ACCOUNT} balance as on ${ddmmyy(date)} is Rs.${inr(between(4000, 60000))}. Thank you for banking with us.`,
      `Your account statement for last month is ready. Download from the mobile app. Do not reply.`,
      `Dear Customer, your KYC is up to date. No action required. Do not reply to this message.`,
      `Your a/c **${ACCOUNT} will be debited with Rs.${inr(pick(MANDATES).amount)} on ${ddmmyy(date + 2 * 86400000)} towards UPI Autopay mandate. Ensure sufficient balance.`,
    ]),
    date,
  );
}

// ─── One-off spending ────────────────────────────────────────────────────────

const MERCHANTS: Array<[string, string, number, number]> = [
  // vpa, display, min, max
  ['swiggy.payu@hdfcbank', 'Swiggy', 180, 620],
  ['zomato.rzp@icici', 'Zomato', 150, 580],
  ['blinkit.rzp@axisbank', 'Blinkit', 120, 900],
  ['bigbasket.payu@hdfcbank', 'BigBasket', 400, 2200],
  ['uber.rzp@icici', 'Uber', 80, 460],
  ['rapido.rzp@ybl', 'Rapido', 45, 180],
  ['apollo.pharmacy@ybl', 'Apollo Pharmacy', 120, 1400],
  ['chaipoint@okhdfcbank', 'Chai Point', 40, 180],
  ['meghana.foods@paytm', 'Meghana Foods', 260, 900],
  ['indianoil.hp@ybl', 'Indian Oil', 500, 2500],
];

const CARD_MERCHANTS = ['CROMA BENGALURU', 'AMAZON IN', 'MYNTRA', 'RELIANCE DIGITAL', 'DECATHLON'];

// ─── Build the corpus ────────────────────────────────────────────────────────

// A rough running balance for the *historical* messages. It only needs to look
// plausible — the ledger is pinned to ANCHOR_BALANCE by the final hint below,
// so history being a few hundred rupees off never reaches the demo.
let running = 38000;

for (const { y, m } of HISTORY) {
  // Salary
  running += SALARY;
  hdfcSalary(SALARY, day(y, m, SALARY_DAY, 6, between(10, 50)), running);

  // The 8 mandates
  for (const md of MANDATES) {
    running -= md.amount;
    const ts = day(y, m, md.dayOfMonth, between(7, 10), between(0, 59));
    // Occasionally omit the balance line — real SMS are not uniform.
    hdfcDebit(md.amount, md.vpa, ts, rand() < 0.75 ? running : null);
  }

  // 20–28 one-off UPI spends
  const spends = between(28, 38);
  for (let i = 0; i < spends; i++) {
    const [vpa, , lo, hi] = pick(MERCHANTS);
    const amount = between(lo, hi);
    running -= amount;
    hdfcDebit(amount, vpa, day(y, m, between(1, 27), between(8, 22), between(0, 59)), rand() < 0.6 ? running : null);
  }

  // 8–12 spends on the secondary account, spread across the other five banks
  for (let i = 0; i < between(8, 12); i++) {
    const [vpa, , lo, hi] = pick(MERCHANTS);
    pick(SECONDARY_BANKS)(between(lo, hi), vpa, day(y, m, between(1, 27), between(8, 22), between(0, 59)));
  }

  // 2–4 credit-card spends (card, not account — no ledger effect)
  for (let i = 0; i < between(2, 4); i++) {
    cardSpend(pick(CARD_MERCHANTS), between(800, 9000), day(y, m, between(1, 27), between(11, 21), between(0, 59)));
  }

  // Noise
  for (let i = 0; i < between(7, 11); i++) otp(day(y, m, between(1, 27), between(9, 22), between(0, 59)));
  for (let i = 0; i < between(6, 9); i++) promo(day(y, m, between(1, 27), between(10, 19), between(0, 59)));
  for (let i = 0; i < between(2, 4); i++) enquiry(day(y, m, between(1, 27), between(9, 20), between(0, 59)));
}

// Irregular freelance income
for (const f of FREELANCE) {
  running += f.amount;
  hdfcCredit(f.amount, 'client.payouts@icici', day(f.y, f.m, f.d, between(11, 17), between(0, 59)), running, ' Freelance invoice.');
}

// ─── The three historical failures (for classifyFailure) ─────────────────────

// 1. LIQUIDITY — balance was genuinely low when the SIP tried to debit.
//    Preceded by a large spend that drained the account.
const liqDrain = day(2025, 12, 10, 19, 30);
hdfcDebit(31000, 'croma.rzp@icici', liqDrain, 3120.45);
hdfcAutopayFailed(5000, 'sip.nippon@hdfcbank', day(2025, 12, 12, 8, 5));

// 2. INTENTIONAL — balance was healthy; the user had cancelled the service.
hdfcCredit(48000, 'client.payouts@icici', day(2026, 1, 8, 12, 0), 61840.2, ' Freelance invoice.');
hdfcMandateDeclined(299, 'hotstar.rzp@icici', day(2026, 1, 15, 7, 40));

// 3. LIQUIDITY — a utility bounce late in a tight month.
hdfcDebit(19500, 'bigbasket.payu@hdfcbank', day(2026, 2, 20, 18, 15), 1980.0);
hdfcAutopayFailed(1450, 'bses.bill@axisbank', day(2026, 2, 22, 9, 10));

// ─── Pin the ledger ──────────────────────────────────────────────────────────
// The last message before NOW states the balance explicitly. buildLedger snaps
// to balance hints, so this fixes B(now) = ANCHOR_BALANCE and every downstream
// number in the demo becomes exact regardless of history drift.

hdfcCredit(1200, 'anita.k@oksbi', day(2026, 2, 28, 20, 15), ANCHOR_BALANCE, ' Split payment.');

// ─── Emit ────────────────────────────────────────────────────────────────────

out.sort((a, b) => a.date - b.date);

const outPath = resolve(process.cwd(), OUT);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

// The ground truth the pipeline must reproduce. test/demoCorpus.test.ts asserts
// against this, so a refactor at hour 17 cannot silently move the shortfall.
const expectations = {
  seed: SEED,
  now: new Date(NOW).toISOString(),
  primaryAccount: ACCOUNT,
  secondaryAccount: SECONDARY,
  anchorBalance: ANCHOR_BALANCE,
  messageCount: out.length,
  mandates: MANDATES.map((m) => ({
    displayName: m.display,
    vpa: m.vpa,
    amount: m.amount,
    dayOfMonth: m.dayOfMonth,
    category: m.category,
    expectedOccurrences: HISTORY.length,
  })),
  income: {
    salaried: { amount: SALARY, dayOfMonth: SALARY_DAY },
    irregular: { count: FREELANCE.length, meanAmount: Math.round(FREELANCE.reduce((s, f) => s + f.amount, 0) / FREELANCE.length) },
  },
  shortfall: {
    date: '2026-03-12',
    balanceBeforeSip: 4900,
    sipAmount: 5000,
    balanceAfterSip: -100,
    lever: { displayName: 'Netflix', amount: 649, resultingBalance: 549 },
    penaltyAvoided: 250,
  },
  prePayment: {
    amount: 8000,
    shiftsShortfallTo: '2026-03-09',
    balanceOnNinth: -3100,
  },
  historicalFailures: [
    { vpa: 'sip.nippon@hdfcbank', date: '2025-12-12', expectedCause: 'LIQUIDITY' },
    { vpa: 'hotstar.rzp@icici', date: '2026-01-15', expectedCause: 'INTENTIONAL' },
    { vpa: 'bses.bill@axisbank', date: '2026-02-22', expectedCause: 'LIQUIDITY' },
  ],
};

const expPath = resolve(process.cwd(), 'fixtures/demo_expectations.json');
writeFileSync(expPath, JSON.stringify(expectations, null, 2) + '\n');

// ─── Report ──────────────────────────────────────────────────────────────────

const senders = new Set(out.map((m) => m.address));
console.log(`seed ${SEED} → ${OUT}`);
console.log(`  ${out.length} messages`);
console.log(`  ${senders.size} distinct sender headers`);
console.log(`  ${MANDATES.length} seeded mandates × ${HISTORY.length} occurrences`);
console.log(`  span ${new Date(out[0]!.date).toISOString().slice(0, 10)} → ${new Date(out.at(-1)!.date).toISOString().slice(0, 10)}`);
console.log(`  anchor balance at now: ₹${ANCHOR_BALANCE.toLocaleString('en-IN')}`);
console.log(`  → fixtures/demo_expectations.json`);
