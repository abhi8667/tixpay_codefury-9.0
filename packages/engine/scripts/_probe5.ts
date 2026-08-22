import { readFileSync } from 'node:fs';
import { useAppStore } from '../../../apps/mobile/store/useAppStore';
const csv = readFileSync(process.argv[2]!, 'utf8');
const s = () => useAppStore.getState();
console.log('import ok?', s().importStatement(csv, 'icici.xls', false), s().importError);
console.log('bal', s().ledger()?.currentBalance, 'mandates', s().mandates().length, 'curve', s().curve().length, 'shortfalls', s().shortfalls().length);
console.log('now', s().now.toISOString());
console.log('curve sample', s().curve().slice(0,3).map(p=>({d:p.date.toISOString().slice(0,10),b:p.balance})));
for (let i = 0; i < 3; i++) { s().addToKeeper(500); console.log('add', i, s().keeperBalance, s().ledger()?.currentBalance); }
for (let i = 0; i < 3; i++) { s().withdrawFromKeeper(500); console.log('wd', i, s().keeperBalance, s().ledger()?.currentBalance); }
console.log('goalStatus', JSON.stringify(s().goalStatus()));
console.log('spend', JSON.stringify(s().spendBreakdown(30)?.categories?.slice(0,3)));
console.log('sip', JSON.stringify(s().checkSip(5000,'MONTHLY',5)));
