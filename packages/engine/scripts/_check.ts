import inbox from '../fixtures/demo_inbox.json';
import expected from '../fixtures/demo_expectations.json';
import cards from '../data/cards.json';
import mccMap from '../data/mcc_map.json';
import { runPipeline } from '../src/pipeline';
import { evaluatePayment } from '../src/evaluate';
import { resolveMcc, recommendInstrument } from '../src/route';
import { classifyFailure } from '../src/attribute';
import { formatRupees, istDayKey } from '../src/time';
import type { Card, PaymentIntent, RawSms } from '../src/types';

const NOW = new Date(expected.now);
const r = runPipeline(inbox as RawSms[], NOW);
const CARDS = cards as unknown as Card[];

console.log('=== INTERVENTIONS ===');
for (const i of r.interventions) {
  const ok = i.resultingCurve.length === r.curve.length ? 'OK' : `BAD len=${i.resultingCurve.length}`;
  const d12 = i.resultingCurve.find((p) => istDayKey(p.date) === '2026-03-12');
  console.log(`[${i.kind}] ${i.label} | curve ${ok} | 12 Mar ${d12 ? formatRupees(d12.balance) : 'n/a'}`);
}

console.log('\n=== VERDICT: ₹8,000 to Croma (the headline beat) ===');
const intent: PaymentIntent = {
  vpa: 'croma.store@ybl', payeeName: 'Croma', amount: 8000,
  mcc: '5732', txnRef: 'TPDEMO', source: 'QR',
};
const t0 = performance.now();
const verdict = evaluatePayment(intent, r.ledger, r.mandates, r.income, CARDS, NOW);
const ms = performance.now() - t0;
console.log(`level     : ${verdict.level}`);
console.log(`headline  : ${verdict.headline}`);
console.log(`subline   : ${verdict.subline}`);
console.log(`atRisk    : ${verdict.atRisk.map((m) => `${m.displayName}(${m.priority})`).join(', ')}`);
console.log(`shifted   : ${verdict.shiftedShortfall ? `${istDayKey(verdict.shiftedShortfall.from)} -> ${istDayKey(verdict.shiftedShortfall.to)}` : 'none'}`);
console.log(`rec       : ${typeof verdict.recommendation?.instrument === 'string' ? verdict.recommendation.instrument : verdict.recommendation?.instrument.name} rail=${verdict.recommendation?.rail}`);
console.log(`rec reason: ${verdict.recommendation?.reason}`);
console.log(`mccConf   : ${verdict.recommendation?.mccConfidence}`);
console.log(`elapsed   : ${ms.toFixed(1)} ms  (budget 100)`);

console.log('\n=== MCC RESOLUTION ===');
for (const vpa of ['croma.store@ybl', 'swiggy.payu@hdfcbank', 'randomshop@ybl', 'bses.bill@axisbank']) {
  const res = resolveMcc(vpa);
  const label = (mccMap as Record<string, string>)[res.mcc];
  console.log(`${vpa.padEnd(24)} -> ${res.mcc} conf ${res.confidence}  label=${label ?? 'MISSING FROM mcc_map'}`);
}

console.log('\n=== REWARD CAP BEHAVIOUR ===');
const kotak = CARDS.find((c) => c.id === 'visa_kotak_league')!;
console.log(`${kotak.name}: monthlyRewardCap ₹${kotak.monthlyRewardCap}, fuel rate ${kotak.categoryRates['5541']}%`);
for (const spend of [0, 400, 5000, 20000]) {
  const rec = recommendInstrument('5541', 3000, [kotak], { visa_kotak_league: spend });
  console.log(`  mtdSpend ₹${String(spend).padStart(6)} -> ${rec.reason} warnings=${JSON.stringify(rec.warnings)}`);
}

console.log('\n=== FEE WAIVER ===');
const amex = CARDS.find((c) => c.id === 'amex_mrcc')!;
console.log(`${amex.name}: ytd ₹${amex.ytdSpend}, threshold ₹${amex.feeWaiverThreshold}, fee ₹${amex.annualFee}`);
const recAll = recommendInstrument('5732', 8000, CARDS, {});
console.log(`  best: ${typeof recAll.instrument === 'string' ? recAll.instrument : recAll.instrument.name}`);
console.log(`  rail: ${recAll.rail}`);
console.log(`  reason: ${recAll.reason}`);
console.log(`  valueDelta: ${formatRupees(recAll.valueDelta)}`);

console.log('\n=== CAUSE ATTRIBUTION ===');
for (const f of expected.historicalFailures) {
  const txn = r.txns.find(
    (t) => t.isFailure && t.vpa === f.vpa && istDayKey(t.timestamp) === f.date,
  );
  if (!txn) { console.log(`  ${f.vpa} ${f.date}: TXN NOT FOUND`); continue; }
  const got = classifyFailure(txn, r.ledger);
  const bal = r.ledger.balanceAt(txn.timestamp);
  const mark = got === f.expectedCause ? 'ok ' : 'XX ';
  console.log(`  ${mark}${f.vpa.padEnd(26)} ${f.date}  bal ${formatRupees(bal).padStart(11)}  want ${f.expectedCause.padEnd(12)} got ${got}`);
}
