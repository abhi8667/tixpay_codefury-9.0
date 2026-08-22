// Metro config for a pnpm workspace.
//
// Without this, Metro walks up and treats the monorepo root as the project
// root, then fails to resolve the `./index.js` entry. It also cannot follow
// pnpm's symlinked store, so `@tixpay/engine` and hoisted deps go missing.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in packages/engine and packages/types
// trigger a rebuild.
config.watchFolders = [workspaceRoot];

// pnpm hoists to the workspace root, so both locations must be searched.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Hierarchical lookup must stay ON.
//
// .npmrc pins node-linker=hoisted, so node_modules is flat at the workspace
// root — but the entries there are symlinks into the .pnpm store, and once
// Metro follows one it needs to walk parent directories to resolve that
// package's own dependencies. Disabling hierarchical lookup breaks exactly
// that step: `expo` resolves, then its internal `./launch/registerRootComponent`
// import fails and the bundle 500s.
config.resolver.disableHierarchicalLookup = false;

// pnpm links workspace packages as symlinks; Metro must follow them.
config.resolver.unstable_enableSymlinks = true;

// NOTE: do NOT pin `unstable_serverRoot` to projectRoot here.
//
// Expo computes the entry path the client asks for relative to the WORKSPACE
// root, so a device requests /apps/mobile/index.bundle. Pinning the server root
// to apps/mobile makes Metro resolve that as apps/mobile/apps/mobile/index and
// every device request 404s, even though a hand-made request to /index.bundle
// succeeds. Leave the default (workspace root) so both halves agree.
//
// Gradle is unaffected: android/app/build.gradle resolves entryFile to an
// ABSOLUTE path via expo/scripts/resolveAppEntry, so it never depended on this.

module.exports = config;
