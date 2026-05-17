/**
 * P3 FPS spec: sidebar mount Total Blocking Time.
 *
 * The sidebar (apps/web/components/layout/sidebar.tsx) mounts with:
 *   - backdrop-filter: blur(40px) saturate(200%)
 *   - 4 animated radial glows (repeat: Infinity CSS keyframes)
 *   - 10-item nav stagger (Framer Motion)
 *   - layoutId semester pill spring stiffness 420
 *
 * These run simultaneously with dashboard widget stagger and block the main
 * thread. We measure TBT in the 3-second window immediately after navigation.
 *
 * TBT = sum of (duration - 50ms) for all longtasks > 50ms
 * (matches Lighthouse TBT definition)
 *
 * Measurement:
 *   - Navigate to dashboard (sidebar mounts)
 *   - Read longtasks accumulated during the 3 s mount window
 *   - Compute TBT
 *
 * SLA (1×): TBT < 200 ms / warn 300 / fail 400
 * SLA (4×): TBT < 600 ms / warn 600 / fail 800
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readLongTasks, computeTBT, resetLongTasks } from '../_helpers/long-task-observer';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const MOUNT_WINDOW_MS = 3_000;
const TOKEN = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('FPS — sidebar mount TBT', () => {
  test('TBT meets SLA (median of 3 runs)', async ({ perfPage, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['sidebar-mount'];
    const { warn, fail } = thresholds.tbt!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const { median, runs } = await runMedianOf3(
      'sidebar-mount TBT',
      async () => {
        // Fresh navigation — longtask observer is buffered from page load.
        // We navigate from an unrelated origin so the sidebar mounts cold.
        await resetLongTasks(perfPage).catch(() => {});
        await perfPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });

        // Measure for MOUNT_WINDOW_MS from navigation start
        await perfPage.waitForTimeout(MOUNT_WINDOW_MS);

        const tasks = await readLongTasks(perfPage);
        const tbt = computeTBT(tasks);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metrics = await perfPage.evaluate(() => (window as any).__perfMetrics);
        return { tbt, metrics, taskCount: tasks.length };
      },
      (result) => result.tbt,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('sidebar-mount', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[sidebar-mount] FAIL: TBT median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[sidebar-mount] WARN: TBT median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
