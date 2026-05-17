/**
 * P3 FPS spec: semester pill switch animation.
 *
 * The sidebar semester switcher (apps/web/components/layout/sidebar.tsx)
 * uses a Framer Motion `layoutId="semester-pill-sidebar"` spring animation
 * with stiffness 420, damping 36 — approximately 1.2 s settling time.
 * Simultaneously the sidebar has backdrop-filter: blur(40px) + 4 radial glows.
 *
 * Measurement: CDP frame snapshots around a מחצית א' ↔ מחצית ב' toggle.
 * Window: 1.2 s (spring settling time).
 *
 * SLA (1×): dropped < 3 / warn 5 / fail 8
 * SLA (4×): dropped < 10 / warn 10 / fail 15
 *
 * Selector: pill buttons inside aria-label="בחירת תצוגה" container
 *   button with text "מחצית א'" / "מחצית ב'"
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { snapshotFrameMetrics, droppedFrames, enablePerformance } from '../_helpers/cdp-fps';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const ANIMATION_SETTLE_MS = 1_200;
const TOGGLE_COUNT = 10; // 10 toggles = 5 A→B + 5 B→A

const TOKEN = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('FPS — semester pill switch', () => {
  test('dropped frames meet SLA (median of 3 runs)', async ({
    perfPage,
    cdpSession,
    warmUp,
    attachPerfArtifacts,
  }) => {
    const thresholds = getThresholds()['semester-switch'];
    const { warn, fail } = thresholds.droppedFrames!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    await enablePerformance(cdpSession);

    const { median, runs } = await runMedianOf3(
      'semester-switch dropped frames',
      async () => {
        await warmUp('/dashboard');

        // Locate the semester switcher
        const switcher = perfPage.locator('[aria-label="בחירת תצוגה"]');
        const switcherVisible = await switcher.isVisible({ timeout: 5000 }).catch(() => false);
        if (!switcherVisible) {
          throw new Error(
            '[semester-switch] Semester switcher aria-label="בחירת תצוגה" not found. ' +
              'Check PERF_TEACHER_TOKEN and that the sidebar is mounted.',
          );
        }

        const pillA = switcher.getByRole('button', { name: "מחצית א'" });
        const pillB = switcher.getByRole('button', { name: "מחצית ב'" });

        // Ensure we start from A
        await pillA.click();
        await perfPage.waitForTimeout(ANIMATION_SETTLE_MS);

        const before = await snapshotFrameMetrics(cdpSession);

        // Toggle A → B → A ... TOGGLE_COUNT times
        for (let i = 0; i < TOGGLE_COUNT; i++) {
          const target = i % 2 === 0 ? pillB : pillA;
          await target.click();
          await perfPage.waitForTimeout(ANIMATION_SETTLE_MS);
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
    await attachPerfArtifacts('semester-switch', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[semester-switch] FAIL: dropped frames median ${median} ≥ hard-fail threshold ${fail}`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[semester-switch] WARN: dropped frames median ${median} ≥ warn threshold ${warn}`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
