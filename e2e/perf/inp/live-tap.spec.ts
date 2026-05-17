/**
 * P1 INP spec: live stopwatch tap.
 *
 * Flow: teacher navigates to the live stopwatch page, starts the timer,
 * then taps each student button 20 times (cycling through the list).
 * We measure the p75 INP across all 20 interactions via web-vitals v4.
 *
 * Selector (from handoff): aria-label="רשום זמן עבור {firstName} {lastName}"
 * on the motion.button at apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:912
 *
 * SLA (1×): p75 INP ≤ 100 ms warn / 150 ms fail
 * SLA (4×): p75 INP ≤ 250 ms warn / 300 ms fail
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics, computeP75 } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const INTERACTION_COUNT = 20;

const CLASS_ID  = process.env['PERF_CLASS_ID']   ?? 'perf-test-class';
const SESSION_ID = process.env['PERF_SESSION_ID'] ?? 'perf-test-session';
const TOKEN      = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('INP — live stopwatch tap', () => {
  test('p75 INP meets SLA (median of 3 runs)', async ({ perfPage, warmUp, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['live-tap'];
    const { warn, fail } = thresholds.inpP75!;

    // Inject auth token before navigation
    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const liveUrl = `/classes/${CLASS_ID}/session/${SESSION_ID}/live`;

    const { median, runs } = await runMedianOf3(
      'live-tap INP p75',
      async () => {
        // Warm-up: navigate, wait for networkidle + 500 ms, discard measurements
        await warmUp(liveUrl);

        // Clear previously accumulated metrics from warm-up
        await perfPage.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__perfMetrics.inp = [];
        });

        // Wait for the start-timer button and click it
        const startBtn = perfPage.getByRole('button', { name: /התחל|הפעל שעון|start/i });
        if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await startBtn.click();
          await perfPage.waitForTimeout(300);
        }

        // Collect all student tap buttons
        const tapButtons = perfPage.locator('[aria-label^="רשום זמן עבור"]');
        const count = await tapButtons.count();

        if (count === 0) {
          throw new Error(
            `[live-tap] No tap buttons found on ${liveUrl}. ` +
              'Check PERF_CLASS_ID / PERF_SESSION_ID env vars and that the test DB is seeded.',
          );
        }

        // Drive N interactions, cycling through available buttons
        for (let i = 0; i < INTERACTION_COUNT; i++) {
          const btn = tapButtons.nth(i % count);
          await btn.click();

          // Wait for optimistic DOM update: button should change state (disabled/completed)
          // or a sibling "completed" region updates.
          // We accept up to 2 s for the optimistic update to land.
          await perfPage
            .waitForFunction(
              (selector: string) => {
                const el = document.querySelector(selector);
                return el !== null; // presence check; richer signal added in later iterations
              },
              '[aria-label^="רשום זמן עבור"]',
              { timeout: 2000 },
            )
            .catch(() => {
              // If the optimistic-update signal is absent, just settle
            });

          await perfPage.waitForTimeout(250);
        }

        const metrics = await readPerfMetrics(perfPage);
        const inpValues = metrics.inp.map((m) => m.value);
        const p75 = computeP75(inpValues);

        return { p75, metrics, interactionCount: inpValues.length };
      },
      (result) => result.p75,
    );

    // Attach artifact from last run
    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('live-tap', { ...lastRun.metrics, p75: median });

    // Assertions
    if (median >= fail) {
      throw new Error(
        `[live-tap] FAIL: p75 INP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }

    if (median >= warn) {
      console.warn(
        `[live-tap] WARN: p75 INP median ${median} ms ≥ warn threshold ${warn} ms (< fail ${fail} ms)`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
