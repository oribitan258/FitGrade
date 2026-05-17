import * as fs from 'fs';
import * as path from 'path';
import { test as base, type Page, type CDPSession, type TestInfo } from '@playwright/test';
import { injectWebVitals, type PerfMetrics } from './inject-web-vitals';

const RESULTS_DIR = path.join(__dirname, '..', '.results');
const CPU_RATE = process.env['PERF_CPU'] === '4' ? 4 : 1;

export interface PerfFixtures {
  /** Page with web-vitals injected and CPU throttle applied (if PERF_CPU=4). */
  perfPage: Page;
  /** Active CDP session for the perfPage (use for FPS metrics in P3). */
  cdpSession: CDPSession;
  /** Navigate to url, wait for networkidle + 500 ms settle. */
  warmUp: (url: string) => Promise<void>;
  /** Write metrics JSON to e2e/perf/.results/<name>.json */
  attachPerfArtifacts: (name: string, metrics: PerfMetrics & { p75?: number }) => Promise<void>;
}

export const test = base.extend<PerfFixtures>({
  perfPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
      colorScheme: 'light',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Inject web-vitals BEFORE any navigation
    await injectWebVitals(page);

    // Apply CPU throttle if requested
    if (CPU_RATE > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    }

    await use(page);
    await context.close();
  },

  cdpSession: async ({ perfPage }, use) => {
    const cdp = await perfPage.context().newCDPSession(perfPage);
    await cdp.send('Performance.enable');
    await use(cdp);
    await cdp.detach();
  },

  warmUp: async ({ perfPage }, use) => {
    await use(async (url: string) => {
      await perfPage.goto(url, { waitUntil: 'networkidle' });
      await perfPage.waitForTimeout(500);
    });
  },

  attachPerfArtifacts: async ({}, use, testInfo: TestInfo) => {
    await use(async (name: string, metrics: PerfMetrics & { p75?: number }) => {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      const file = path.join(RESULTS_DIR, `${name}-${Date.now()}.json`);
      const payload = {
        spec: name,
        cpuLane: `${CPU_RATE}x`,
        timestamp: new Date().toISOString(),
        testTitle: testInfo.title,
        ...metrics,
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    });
  },
});

export { expect } from '@playwright/test';
