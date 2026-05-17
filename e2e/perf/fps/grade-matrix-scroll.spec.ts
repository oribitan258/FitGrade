/**
 * P3 FPS spec: grade matrix scroll.
 *
 * The grade matrix at apps/web/components/classes/grade-matrix.tsx renders
 * an unvirtualized table — 30 students × 8 test columns = 240 cells, each
 * with per-cell grade state and color coding. It is the highest-risk surface
 * for scroll jank in the entire app.
 *
 * Measurement:
 *   - Navigate to class detail page (grade matrix renders on load)
 *   - Take CDP frame snapshot before
 *   - Drive a 3-second continuous mouse-wheel scroll across the table
 *   - Take CDP frame snapshot after
 *   - Assert: dropped frames ≤ threshold over the 3 s window
 *
 * SLA (1×): dropped < 6 / warn 10 / fail 15
 * SLA (4×): dropped < 15 / warn 20 / fail 30
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { snapshotFrameMetrics, droppedFrames, enablePerformance } from '../_helpers/cdp-fps';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const SCROLL_DURATION_MS = 3_000;
const SCROLL_STEP_MS = 100;
const SCROLL_DELTA_PX = 120;

const CLASS_ID = process.env['PERF_CLASS_ID']   ?? 'perf-test-class';
const TOKEN    = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('FPS — grade matrix scroll', () => {
  test('dropped frames meet SLA (median of 3 runs)', async ({
    perfPage,
    cdpSession,
    warmUp,
    attachPerfArtifacts,
  }) => {
    const thresholds = getThresholds()['grade-matrix-scroll'];
    const { warn, fail } = thresholds.droppedFrames!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    await enablePerformance(cdpSession);

    const classUrl = `/classes/${CLASS_ID}`;

    const { median, runs } = await runMedianOf3(
      'grade-matrix-scroll dropped frames',
      async () => {
        await warmUp(classUrl);

        // Scroll table into view — find the overflow-x-auto table container
        const table = perfPage.locator('table').first();
        const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
        if (!tableVisible) {
          throw new Error(
            `[grade-matrix-scroll] No <table> found on ${classUrl}. ` +
              'Check PERF_CLASS_ID and that the class has test results.',
          );
        }

        await table.scrollIntoViewIfNeeded();
        const box = await table.boundingBox();
        const cx = box ? box.x + box.width / 2 : 640;
        const cy = box ? box.y + box.height / 2 : 360;

        // Hover over table so wheel events target it
        await perfPage.mouse.move(cx, cy);
        await perfPage.waitForTimeout(100);

        const before = await snapshotFrameMetrics(cdpSession);

        // Drive wheel scrolls for SCROLL_DURATION_MS
        const steps = SCROLL_DURATION_MS / SCROLL_STEP_MS;
        for (let i = 0; i < steps; i++) {
          // Alternate direction to stay in view
          const dir = i < steps / 2 ? 1 : -1;
          await perfPage.mouse.wheel(SCROLL_DELTA_PX * dir, SCROLL_DELTA_PX * dir);
          await perfPage.waitForTimeout(SCROLL_STEP_MS);
        }

        const after = await snapshotFrameMetrics(cdpSession);
        const dropped = droppedFrames(before, after);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metrics = await perfPage.evaluate(() => (window as any).__perfMetrics);
        return { dropped, metrics };
      },
      (result) => result.dropped,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('grade-matrix-scroll', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[grade-matrix-scroll] FAIL: dropped frames median ${median} ≥ hard-fail threshold ${fail}`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[grade-matrix-scroll] WARN: dropped frames median ${median} ≥ warn threshold ${warn}`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
