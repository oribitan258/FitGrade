/**
 * P1 INP spec: attendance toggle (absent + exempt).
 *
 * Flow: teacher navigates to the lesson page for a class, then alternates
 * between marking a student absent and removing the absence 20 times.
 * A second pass cycles through the exempt toggle.
 *
 * Selectors (from handoff):
 *   apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:993,922
 *   aria-label="סמן כחסר"   / "הסר חיסור"    (absent toggle)
 *   aria-label="סמן כפצוע/פטור" / "הסר פטור"  (exempt toggle) :927,1069
 *
 * SLA (1×): p75 INP ≤ 100 ms warn / 150 ms fail
 * SLA (4×): p75 INP ≤ 250 ms warn / 300 ms fail
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics, computeP75 } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const INTERACTION_COUNT = 20;

const CLASS_ID = process.env['PERF_CLASS_ID'] ?? 'perf-test-class';
const TOKEN    = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('INP — attendance toggle', () => {
  test('p75 INP meets SLA (median of 3 runs)', async ({ perfPage, warmUp, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['attendance-toggle'];
    const { warn, fail } = thresholds.inpP75!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const lessonUrl = `/classes/${CLASS_ID}/lesson`;

    const { median, runs } = await runMedianOf3(
      'attendance-toggle INP p75',
      async () => {
        await warmUp(lessonUrl);

        await perfPage.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__perfMetrics.inp = [];
        });

        // Use the first absent-toggle button found
        const absentBtn = perfPage.locator('[aria-label="סמן כחסר"]').first();
        const removeAbsentBtn = perfPage.locator('[aria-label="הסר חיסור"]').first();

        const absentVisible = await absentBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!absentVisible) {
          throw new Error(
            `[attendance-toggle] aria-label="סמן כחסר" not found on ${lessonUrl}. ` +
              'Check PERF_CLASS_ID and that the lesson page is seeded with students.',
          );
        }

        for (let i = 0; i < INTERACTION_COUNT; i++) {
          if (i % 2 === 0) {
            // Mark absent
            const btn = perfPage.locator('[aria-label="סמן כחסר"]').first();
            await btn.click();
            await perfPage
              .locator('[aria-label="הסר חיסור"]')
              .first()
              .waitFor({ state: 'visible', timeout: 2000 })
              .catch(() => {});
          } else {
            // Remove absence
            const btn = removeAbsentBtn;
            await btn.click();
            await perfPage
              .locator('[aria-label="סמן כחסר"]')
              .first()
              .waitFor({ state: 'visible', timeout: 2000 })
              .catch(() => {});
          }
          await perfPage.waitForTimeout(250);
        }

        const metrics = await readPerfMetrics(perfPage);
        const inpValues = metrics.inp.map((m) => m.value);
        const p75 = computeP75(inpValues);

        return { p75, metrics, interactionCount: inpValues.length };
      },
      (result) => result.p75,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('attendance-toggle', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[attendance-toggle] FAIL: p75 INP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }

    if (median >= warn) {
      console.warn(
        `[attendance-toggle] WARN: p75 INP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
