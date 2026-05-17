import * as fs from 'fs';
import * as path from 'path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for FitGrade performance specs.
 *
 * PRODUCTION-ONLY: refuses to run against `next dev`.
 * Before running, build the web app:
 *   pnpm --filter=@fitgrade/web build
 *
 * Then start both servers:
 *   $env:PORT = "3001"; pnpm --filter=@fitgrade/api start
 *   pnpm --filter=@fitgrade/web start
 *
 * Run:
 *   pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp
 *
 * 4× CPU lane:
 *   $env:PERF_CPU = "4"; pnpm exec playwright test -c e2e/perf/playwright.perf.config.ts e2e/perf/inp
 */

// Guard: refuse to run if there is no production build.
const BUILD_ID_PATH = path.join(__dirname, '..', '..', 'apps', 'web', '.next', 'BUILD_ID');
if (!fs.existsSync(BUILD_ID_PATH)) {
  throw new Error(
    '[perf] No production build found at apps/web/.next/BUILD_ID.\n' +
      'Run: pnpm --filter=@fitgrade/web build\n' +
      'Performance specs must run against a built production server, not next dev.',
  );
}

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: '**/*.spec.ts',

  fullyParallel: false,
  retries: 0,
  workers: 1,

  timeout: 120_000,
  expect: { timeout: 30_000 },

  reporter: [
    ['html', { outputFolder: path.join(__dirname, '..', '..', 'perf-report'), open: 'never' }],
    ['list'],
    ['junit', { outputFile: path.join(__dirname, '..', 'test-results', 'perf-junit.xml') }],
  ],

  outputDir: path.join(__dirname, '.results', 'artifacts'),

  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',

    // All perf runs capture full traces for bottleneck isolation
    trace: 'on',
    screenshot: 'only-on-failure',

    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'light',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium-perf',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
