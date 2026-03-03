/**
 * Metro bundler configuration for pnpm monorepo.
 *
 * Metro does not follow symlinks by default. In a pnpm workspace,
 * packages like @fitgrade/types are symlinked into node_modules.
 * This config tells Metro to:
 *   1. Watch the entire workspace root (so changes in packages/types are picked up)
 *   2. Resolve node_modules from both the app directory AND the workspace root
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all workspace packages so hot-reload works across the monorepo
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then fall back to the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
