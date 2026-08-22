import { readFileSync } from 'node:fs';
import { parseStatementCsv } from '../src/index';
const csv = readFileSync(process.argv[2]!, 'utf8');
const { txns } = parseStatementCsv(csv);
const groups = new Map<string, { n: number; amts: number[]; dates: string[] }>();
for (const t of txns) {
  if (t.direction !== 'DEBIT') continue;
  const k = t.vpa ?? '?';
  const g = groups.get(k) ?? { n: 0, amts: [], dates: [] };
  g.n++; g.amts.push(t.amount); g.dates.push(t.timestamp.toISOString().slice(5, 10));
  groups.set(k, g);
}
const sorted = [...groups.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25);
for (const [k, g] of sorted) console.log(g.n, '|', k.slice(0,40), '|', g.amts.slice(0,10).join(','), '|', g.dates.slice(0,10).join(' '));
console.log('groups', groups.size, 'debits', txns.filter(t=>t.direction==='DEBIT').length);
const cr = txns.filter(t=>t.direction==='CREDIT');
console.log('credits', cr.length, 'top:', cr.filter(t=>t.amount>2000).map(t=>t.amount+'@'+t.timestamp.toISOString().slice(5,10)).join(' '));
