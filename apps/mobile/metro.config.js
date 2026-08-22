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

// Resolve strictly from the paths above rather than walking parent dirs —
// pnpm's non-flat layout makes hierarchical lookup unreliable.
config.resolver.disableHierarchicalLookup = true;

// pnpm links workspace packages as symlinks; Metro must follow them.
config.resolver.unstable_enableSymlinks = true;

// Expo detects the pnpm workspace and defaults the server root to the monorepo
// root. The Gradle bundle task passes the entry as `./index.js` relative to
// apps/mobile, which then resolves against the monorepo root and fails. Pin the
// server root to this app so that relative entry path resolves correctly.
// watchFolders above still lets Metro read packages/ outside this directory.
config.server = { ...config.server, unstable_serverRoot: projectRoot };

module.exports = config;
