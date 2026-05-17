/**
 * P2 Vitals spec: Live stopwatch page LCP.
 *
 * This page is the most time-critical in the app — teacher opens it mid-test.
 * LCP candidate: the student list or the stopwatch timer display.
 *
 * SLA (1×): LCP ≤ 1500 ms warn 1800 / fail 2200
 * SLA (4×): LCP ≤ 3500 ms warn / fail 4000
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const CLASS_ID   = process.env['PERF_CLASS_ID']   ?? 'perf-test-class';
const SESSION_ID = process.env['PERF_SESSION_ID'] ?? 'perf-test-session';
const TOKEN      = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('Vitals — live page LCP', () => {
  test('LCP meets SLA (median of 3 runs)', async ({ perfPage, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['live-page-lcp'];
    const { warn, fail } = thresholds.lcp!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const liveUrl = `/classes/${CLASS_ID}/session/${SESSION_ID}/live`;

    const { median, runs } = await runMedianOf3(
      'live-page LCP',
      async () => {
        await perfPage.goto(liveUrl, { waitUntil: 'networkidle' });

        // Force LCP finalisation
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
    await attachPerfArtifacts('live-page-lcp', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[live-page-lcp] FAIL: LCP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[live-page-lcp] WARN: LCP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
