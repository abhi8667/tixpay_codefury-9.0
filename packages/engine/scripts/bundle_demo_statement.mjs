/**
 * Regenerates apps/mobile/src/data/demoStatement.ts from the CSV fixture.
 *
 * The app cannot import the .csv directly — Metro does not bundle arbitrary
 * text files, and an import that resolves in the dev server but 404s in a
 * release APK is exactly the failure you discover on stage. So the fixture is
 * mirrored into a TypeScript module, and this script is the only thing allowed
 * to write it.
 *
 *   node scripts/bundle_demo_statement.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../fixtures/demo_statement.csv');
const out = resolve(here, '../../../apps/mobile/src/data/demoStatement.ts');

const csv = readFileSync(src, 'utf-8');

// Escape only what a template literal actually treats as syntax.
const escaped = csv
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const header = `/**
 * The bundled sample statement.
 *
 * A synthetic HDFC savings export — six months, one account. Nobody's real
 * data: it is generated, and it is the same file the engine test suite asserts
 * against, so what a judge sees in the app is what CI checks.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: packages/engine/fixtures/demo_statement.csv
 * Regenerate: node packages/engine/scripts/bundle_demo_statement.mjs
 */
export const DEMO_STATEMENT_CSV = \``;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${header}${escaped}\`;\n`, 'utf-8');

console.log(`Wrote ${csv.length} chars to ${out}`);
