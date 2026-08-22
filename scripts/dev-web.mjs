/**
 * Starts the Expo web dev server with apps/mobile as the working directory.
 *
 * `pnpm --filter ... exec` runs a deps-status check that re-resolves the
 * lockfile, and `npx expo` from the repo root resolves the wrong project. This
 * just chdirs and spawns the CLI, which is all either of those was trying to do.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'node_modules/@expo/cli/build/bin/cli');

// NOT CI=1. That silences Expo's interactive prompts, but it also puts Metro in
// CI mode, which disables watch mode — the server then serves the bundle it
// built at startup and every later edit is invisible. Pass an explicitly free
// port instead so there is no prompt to silence.
spawn(process.execPath, [cli, 'start', '--web', ...process.argv.slice(2)], {
  cwd: resolve(root, 'apps/mobile'),
  stdio: 'inherit',
  env: { ...process.env, CI: undefined, EXPO_NO_TELEMETRY: '1' },
}).on('exit', (code) => process.exit(code ?? 0));
