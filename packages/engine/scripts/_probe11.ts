import { readFileSync } from 'node:fs';
import { useAppStore } from '../../../apps/mobile/store/useAppStore';
const s = () => useAppStore.getState();
s().importStatement(readFileSync(process.argv[2]!, 'utf8'), 'icici.xls', false);
const c = s()._pipelineCache!;
console.log('mandates', JSON.stringify(s().mandates().map(m=>({n:m.displayName,a:m.amount,cad:m.cadence,conf:m.confidence,occ:m.occurrences}))));
const byKey = new Map<string, {n:number, amts:number[], dates:string[]}>();
for (const t of c.txns) { if (t.direction!=='DEBIT'||!t.vpa) continue; const g=byKey.get(t.vpa)??{n:0,amts:[],dates:[]}; g.n++; g.amts.push(t.amount); g.dates.push(t.timestamp.toISOString().slice(5,10)); byKey.set(t.vpa,g); }
for (const [k,g] of [...byKey].filter(([,g])=>g.n>=3)) console.log(g.n,'|',k,'|',g.amts.join(','),'|',g.dates.join(' '));
