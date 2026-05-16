import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright config for FitGrade UI (Phase 3 — State Machine + E2E tests).
 *
 * Servers (must match apps/web and apps/api package.json `dev` scripts):
 *   - Next.js web app:  http://localhost:3000  (apps/web — `next dev --port 3000`)
 *   - NestJS API:       http://localhost:3001  (apps/api)
 *
 * In CI: both servers are started by Turborepo (`pnpm turbo dev`) before
 * the test run. In local development, start them manually first.
 *
 * Auth strategy: all tests inject the JWT directly into localStorage via
 * `addInitScript`. The API's `/auth/dev-login` endpoint issues a real token;
 * the fixture stores it in `localStorage.fitgrade_token` (the key used by
 * `apps/web/lib/api-client.ts`).
 */
export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: '**/*.spec.ts',

  /* Run tests in parallel within each file */
  fullyParallel: false,
  /* Retry failed tests once in CI */
  retries: process.env['CI'] ? 1 : 0,
  /* One worker so tests don't interfere with shared DB state */
  workers: 1,

  /* Per-test timeout — generous so Next.js dev-mode cold compilation of a
     freshly-visited tour route doesn't trip the default 30s ceiling. CI
     builds compile once up-front so this only bites in local dev. */
  timeout: 60_000,

  /* Per-`expect()` timeout — used by `expect(locator).toBeVisible()`,
     `expect.poll()`, and similar. 30s covers worst-case dev-mode cold compile
     (typically 5-25s) plus the 2s page-ready fallback in TourProvider. */
  expect: {
    timeout: 30_000,
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    // JUnit output enables the autonomous security audit agent to parse the
    // Tier 4 outcomes (e2e/tour/security/*) into a defect summary.
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    /* Base URL for all page.goto() calls. Defaults to the web dev server port
       (3000). Override with PLAYWRIGHT_BASE_URL when running against a built
       production server on a different port. */
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',

    /* Capture screenshot + trace on first retry */
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',

    /* Hebrew RTL context */
    locale: 'he-IL',

    /* Viewport: standard desktop (1280×720) */
    viewport: { width: 1280, height: 720 },

    /* Always include credentials for the httpOnly refresh-token cookie */
    extraHTTPHeaders: {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Optional: start servers automatically in local dev */
  // webServer: [
  //   { command: 'pnpm turbo dev --filter=api', port: 3000, reuseExistingServer: true },
  //   { command: 'pnpm turbo dev --filter=web', port: 3001, reuseExistingServer: true },
  // ],
});
