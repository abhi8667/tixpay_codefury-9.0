import { readFileSync } from 'node:fs';
import { parseStatementCsv, computeSpendBreakdown, computeAvgMonthlySurplus, runPipeline } from '../src/index';
const { txns } = parseStatementCsv(readFileSync(process.argv[2]!, 'utf8'));
const now = new Date(Math.max(...txns.map((t) => t.timestamp.getTime())));
const res = runPipeline(txns, now);
const sb = computeSpendBreakdown(res.txns, now, 30);
console.log(JSON.stringify(sb, null, 1));
console.log('surplus', computeAvgMonthlySurplus(res.txns, now, 3));
