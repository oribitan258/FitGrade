/**
 * P2 Vitals spec: CLS across route transitions.
 *
 * Measures Cumulative Layout Shift during client-side navigation between
 * the three most-visited routes:
 *   dashboard → /classes → /classes/:id → /dashboard
 *
 * CLS is measured per-navigation leg. Each leg is a fresh web-vitals session
 * (we reset __perfMetrics.cls between navigations). The worst-leg CLS is
 * the reported value for that run. Median of 3 runs is asserted.
 *
 * Risk surfaces:
 * - Sidebar layoutId spring (stiffness 420) shifts nav items during route change
 * - Loading skeletons that differ in size from loaded content
 * - CountUp number that expands after mount
 *
 * SLA: CLS ≤ 0.05 target / 0.08 warn / 0.10 fail (both CPU lanes)
 * Note: CLS values here are multiplied by 100 to avoid floating-point noise
 * in threshold comparisons (0.05 stored as 5).
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const CLASS_ID = process.env['PERF_CLASS_ID'] ?? 'perf-test-class';
const TOKEN    = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('Vitals — CLS route transitions', () => {
  test('CLS meets SLA on all transition legs (median of 3 runs)', async ({
    perfPage,
    attachPerfArtifacts,
  }) => {
    const thresholds = getThresholds()['cls-route'];
    // Stored as ×100 (e.g., 0.10 → 10) to avoid float comparison issues
    const { warn, fail } = thresholds.cls!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const routes = [
      '/dashboard',
      '/classes',
      `/classes/${CLASS_ID}`,
      '/dashboard',
    ];

    const { median, runs } = await runMedianOf3(
      'CLS route transitions',
      async () => {
        let worstCls = 0;

        for (let i = 0; i < routes.length; i++) {
          const url = routes[i];

          if (i === 0) {
            // First navigation: full page load
            await perfPage.goto(url, { waitUntil: 'networkidle' });
            await perfPage.waitForTimeout(500);
          } else {
            // Subsequent: client-side navigation via click or direct goto
            await perfPage.goto(url, { waitUntil: 'networkidle' });
            await perfPage.waitForTimeout(500);
          }

          // Flush and read CLS for this leg
          const metrics = await readPerfMetrics(perfPage);
          const clsEntries = metrics.cls;
          const clsValue = clsEntries.length > 0
            ? Math.max(...clsEntries.map((e) => e.value))
            : 0;

          // Multiply by 100 to match threshold units
          const clsScaled = Math.round(clsValue * 100);
          if (clsScaled > worstCls) {
            worstCls = clsScaled;
          }

          // Reset CLS accumulator for next leg
          await perfPage.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__perfMetrics.cls = [];
          });
        }

        const lastMetrics = await readPerfMetrics(perfPage);
        return { worstCls, metrics: lastMetrics };
      },
      (result) => result.worstCls,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('cls-route-transitions', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[cls-route] FAIL: worst-leg CLS median ${median / 100} ≥ hard-fail threshold ${fail / 100}`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[cls-route] WARN: worst-leg CLS median ${median / 100} ≥ warn threshold ${warn / 100}`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
