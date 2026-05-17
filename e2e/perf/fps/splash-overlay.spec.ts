/**
 * P3 FPS spec: splash screen overlay max longtask.
 *
 * The splash screen (apps/web/components/ui/splash-screen.tsx) sits at
 * z-9999, absorbs all pointer events, and runs:
 *   - blur(28–40px) backdrop-filter on the overlay itself
 *   - AnimatePresence (opacity/scale fade) on exit
 *   - MIN_DISPLAY_MS = 3500 ms forced hold + 600 ms exit animation
 *
 * The five parallel CSS keyframes in globals.css also fire during this window
 * (glass-ripple, prismatic-sweep, shimmer, ticker-scroll, orb animations).
 *
 * We measure the maximum single longtask during the splash display window.
 * A longtask > 100 ms during this phase makes the app appear frozen before
 * the teacher can interact.
 *
 * INP MEASUREMENT TRAP: The splash absorbs pointer events. We wait for it
 * to fully unmount (role="status" detached from DOM) before any INP-relevant
 * interaction — reuse the waitForSplashGone pattern from tour/_helpers.ts.
 *
 * SLA (1×): max longtask < 100 ms / warn 150 / fail 200
 * SLA (4×): max longtask < 300 ms / warn 300 / fail 400
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readLongTasks, maxLongtask, resetLongTasks } from '../_helpers/long-task-observer';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const SPLASH_TIMEOUT_MS = 10_000; // generous — MIN_DISPLAY_MS(3500) + exit(600) + margin
const TOKEN = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('FPS — splash overlay max longtask', () => {
  test('max longtask meets SLA (median of 3 runs)', async ({ perfPage, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['splash-overlay'];
    const { warn, fail } = thresholds.maxLongtask!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const { median, runs } = await runMedianOf3(
      'splash-overlay max longtask',
      async () => {
        await resetLongTasks(perfPage).catch(() => {});

        // Navigate — splash appears immediately on page load
        await perfPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Wait for splash to fully unmount (AnimatePresence completes)
        // role="status" aria-label="טוען את FitGrade…" must leave the DOM
        await perfPage
          .getByRole('status', { name: /טוען את FitGrade/ })
          .waitFor({ state: 'detached', timeout: SPLASH_TIMEOUT_MS });

        // Read all longtasks that accumulated during the splash window
        const tasks = await readLongTasks(perfPage);
        const maxTask = maxLongtask(tasks);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metrics = await perfPage.evaluate(() => (window as any).__perfMetrics);
        return { maxTask, metrics, taskCount: tasks.length };
      },
      (result) => result.maxTask,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('splash-overlay', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[splash-overlay] FAIL: max longtask median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[splash-overlay] WARN: max longtask median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
