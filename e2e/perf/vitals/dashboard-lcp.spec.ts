/**
 * P2 Vitals spec: Dashboard LCP.
 *
 * LCP candidate: the hero stat card (CountUp number inside the first
 * stat card at apps/web/app/(teacher)/dashboard/page.tsx:5).
 * 8 staggered widget cards + Recharts AreaChart mount simultaneously —
 * this is the heaviest single-page mount in the app.
 *
 * Statistical method: max LCP value within a run (LCP is monotonic —
 * the API only finalises after user interaction or page hide).
 * Median of 3 runs is asserted.
 *
 * SLA (1×): LCP ≤ 2000 ms warn 2400 / fail 2800
 * SLA (4×): LCP ≤ 4500 ms warn / fail 5000
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const TOKEN = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('Vitals — dashboard LCP', () => {
  test('LCP meets SLA (median of 3 runs)', async ({ perfPage, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['dashboard-lcp'];
    const { warn, fail } = thresholds.lcp!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const { median, runs } = await runMedianOf3(
      'dashboard LCP',
      async () => {
        // Full navigation — LCP requires a fresh navigation to fire correctly
        await perfPage.goto('/dashboard', { waitUntil: 'networkidle' });

        // LCP is finalised after a user interaction or idle. Trigger a click to
        // force the browser to report the final LCP entry.
        await perfPage.mouse.click(640, 360);
        await perfPage.waitForTimeout(300);

        const metrics = await readPerfMetrics(perfPage);

        // LCP is monotonic — take the last (highest) reported value
        const lcpEntries = metrics.lcp;
        const lcpValue = lcpEntries.length > 0
          ? Math.max(...lcpEntries.map((e) => e.value))
          : 0;

        return { lcpValue, metrics };
      },
      (result) => result.lcpValue,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('dashboard-lcp', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[dashboard-lcp] FAIL: LCP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[dashboard-lcp] WARN: LCP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
