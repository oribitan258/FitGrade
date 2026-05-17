/**
 * P2 Vitals spec: Class detail page LCP.
 *
 * The class detail page renders the grade matrix (30×8 cells unvirtualized),
 * student cards, and semester tabs — this is the second-heaviest mount.
 * LCP candidate: the first student row or the grade matrix header.
 *
 * SLA: uses dashboard-lcp thresholds (2000 ms target / 2800 ms fail @ 1×).
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const CLASS_ID = process.env['PERF_CLASS_ID'] ?? 'perf-test-class';
const TOKEN    = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('Vitals — class detail LCP', () => {
  test('LCP meets SLA (median of 3 runs)', async ({ perfPage, attachPerfArtifacts }) => {
    // Class detail shares the dashboard-lcp SLA
    const thresholds = getThresholds()['dashboard-lcp'];
    const { warn, fail } = thresholds.lcp!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const classUrl = `/classes/${CLASS_ID}`;

    const { median, runs } = await runMedianOf3(
      'class-detail LCP',
      async () => {
        await perfPage.goto(classUrl, { waitUntil: 'networkidle' });

        await perfPage.mouse.click(640, 360);
        await perfPage.waitForTimeout(300);

        const metrics = await readPerfMetrics(perfPage);
        const lcpEntries = metrics.lcp;
        const lcpValue = lcpEntries.length > 0
          ? Math.max(...lcpEntries.map((e) => e.value))
          : 0;

        return { lcpValue, metrics };
      },
      (result) => result.lcpValue,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('class-detail-lcp', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[class-detail-lcp] FAIL: LCP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[class-detail-lcp] WARN: LCP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
