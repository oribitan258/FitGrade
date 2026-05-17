/**
 * P2 INP spec: modal open (AddClassModal).
 *
 * Flow: teacher is on /classes, clicks "הוסף כיתה" 20 times, closes the modal
 * between each open via Escape. Measures p75 INP for the click→dialog-visible
 * interaction.
 *
 * Trigger (from handoff): `apps/web/components/classes/add-class-modal.tsx:176`
 * Button label: "הוסף כיתה" on the classes page (motion.button, no aria-label;
 * matched by text content).
 *
 * SLA (1×): p75 INP ≤ 150 ms warn 200 / fail 250
 * SLA (4×): p75 INP ≤ 400 ms warn / fail 450
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics, computeP75 } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const INTERACTION_COUNT = 20;
const TOKEN = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('INP — modal open (AddClassModal)', () => {
  test('p75 INP meets SLA (median of 3 runs)', async ({ perfPage, warmUp, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['modal-open'];
    const { warn, fail } = thresholds.inpP75!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const { median, runs } = await runMedianOf3(
      'modal-open INP p75',
      async () => {
        await warmUp('/classes');

        await perfPage.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__perfMetrics.inp = [];
        });

        const triggerBtn = perfPage.getByRole('button', { name: 'הוסף כיתה' }).first();

        const isTriggerVisible = await triggerBtn.isVisible({ timeout: 5000 }).catch(() => false);
        if (!isTriggerVisible) {
          throw new Error(
            '[modal-open] "הוסף כיתה" button not found on /classes. ' +
              'Check PERF_TEACHER_TOKEN and that the classes page renders.',
          );
        }

        for (let i = 0; i < INTERACTION_COUNT; i++) {
          // Open the modal
          await triggerBtn.click();

          // Wait for dialog to appear (DialogContent becomes visible)
          await perfPage
            .getByRole('dialog')
            .waitFor({ state: 'visible', timeout: 3000 })
            .catch(() => {});

          await perfPage.waitForTimeout(150);

          // Close via Escape
          await perfPage.keyboard.press('Escape');

          // Wait for dialog to close
          await perfPage
            .getByRole('dialog')
            .waitFor({ state: 'hidden', timeout: 2000 })
            .catch(() => {});

          await perfPage.waitForTimeout(200);
        }

        const metrics = await readPerfMetrics(perfPage);
        const inpValues = metrics.inp.map((m) => m.value);
        const p75 = computeP75(inpValues);

        return { p75, metrics, interactionCount: inpValues.length };
      },
      (result) => result.p75,
    );

    const lastRun = runs[runs.length - 1];
    await attachPerfArtifacts('modal-open', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[modal-open] FAIL: p75 INP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }
    if (median >= warn) {
      console.warn(
        `[modal-open] WARN: p75 INP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
