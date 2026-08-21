import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Engine purity guard.
 *
 * These are the two rules that, when broken, are found at hour 18 by someone
 * who isn't you:
 *
 *   1. A bare `new Date()` anywhere in the engine silently disables Person C's
 *      World Clock. The slider moves, nothing recomputes, and the bug looks
 *      like a UI problem for two hours.
 *   2. A platform import means the package no longer runs under vitest on a
 *      laptop, and the millisecond feedback loop is gone.
 *
 * Enforced on every run rather than grepped for before a commit, because the
 * commit you forget to grep is the one that breaks it.
 */

const SRC = resolve(__dirname, '../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** Strip comments and string literals so prose about `new Date()` doesn't trip. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

const files = sourceFiles(SRC);

describe('engine purity', () => {
  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s calls no bare new Date()',
    (_label, path) => {
      const hits = code(readFileSync(path, 'utf8')).match(/new\s+Date\s*\(\s*\)/g);
      expect(
        hits,
        'Take `now: Date` as a parameter instead — a bare new Date() breaks the World Clock',
      ).toBeNull();
    },
  );

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s calls no Date.now()',
    (_label, path) => {
      const hits = code(readFileSync(path, 'utf8')).match(/Date\s*\.\s*now\s*\(/g);
      expect(hits, 'Same problem as new Date() — inject `now`').toBeNull();
    },
  );

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s imports nothing platform-specific',
    (_label, path) => {
      const banned = /from\s+['"](react|react-native|expo[-/]|node:|fs|path|@react-native)/;
      const hits = code(readFileSync(path, 'utf8'))
        .split('\n')
        .filter((line) => banned.test(line));
      expect(hits, 'The engine must run under vitest with no platform deps').toEqual([]);
    },
  );

  it('uses no randomness — the demo must be byte-identical every run', () => {
    for (const path of files) {
      const hits = code(readFileSync(path, 'utf8')).match(/Math\s*\.\s*random\s*\(/g);
      expect(hits, `${path.slice(SRC.length + 1)} — derive deterministically instead`).toBeNull();
    }
  });
});
