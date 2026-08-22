import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStatementCsv } from '../src/parse/statement';
import type { Transaction } from '../src/types';

/**
 * The demo statement, parsed once and shared by every suite that needs a
 * realistic account history. Vitest imports modules once per file, so this is
 * read once per suite rather than once per test.
 */
const here = dirname(fileURLToPath(import.meta.url));

export const DEMO_CSV: string = readFileSync(
  resolve(here, '../fixtures/demo_statement.csv'),
  'utf-8',
);

const parsed = parseStatementCsv(DEMO_CSV);

export const DEMO_TXNS: Transaction[] = parsed.txns;
export const DEMO_META = parsed.meta;
