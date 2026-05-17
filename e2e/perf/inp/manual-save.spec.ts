/**
 * P1 INP spec: manual result entry save.
 *
 * Flow: teacher navigates to the manual entry page, types a value into each
 * student's input, then presses Tab (or blur) to trigger the save handler.
 * This repeats 20 times across all visible inputs (cycling).
 *
 * Handler (from handoff):
 *   apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/manual/page.tsx:225
 *   handleSave triggered on input onBlur or Enter (lines 485–289)
 *
 * SLA (1×): p75 INP ≤ 150 ms warn / 220 ms fail
 * SLA (4×): p75 INP ≤ 350 ms warn / 400 ms fail
 */

import { test, expect } from '../_helpers/perf-fixtures';
import { readPerfMetrics, computeP75 } from '../_helpers/inject-web-vitals';
import { runMedianOf3 } from '../_helpers/median-of-3';
import { getThresholds } from '../_helpers/thresholds';

const INTERACTION_COUNT = 20;

const CLASS_ID   = process.env['PERF_CLASS_ID']   ?? 'perf-test-class';
const SESSION_ID = process.env['PERF_SESSION_ID'] ?? 'perf-test-session';
const TOKEN      = process.env['PERF_TEACHER_TOKEN'] ?? '';

test.describe('INP — manual result save', () => {
  test('p75 INP meets SLA (median of 3 runs)', async ({ perfPage, warmUp, attachPerfArtifacts }) => {
    const thresholds = getThresholds()['manual-save'];
    const { warn, fail } = thresholds.inpP75!;

    await perfPage.addInitScript(
      ({ token }: { token: string }) => {
        window.localStorage.setItem('fitgrade_token', token);
      },
      { token: TOKEN },
    );

    const manualUrl = `/classes/${CLASS_ID}/session/${SESSION_ID}/manual`;

    const { median, runs } = await runMedianOf3(
      'manual-save INP p75',
      async () => {
        await warmUp(manualUrl);

        await perfPage.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__perfMetrics.inp = [];
        });

        // Locate result input fields for students
        // The manual entry page renders an <input type="number"> per student row
        const inputs = perfPage.locator('input[type="number"], input[inputmode="numeric"]');
        const count = await inputs.count();

        if (count === 0) {
          throw new Error(
            `[manual-save] No numeric inputs found on ${manualUrl}. ` +
              'Check PERF_CLASS_ID / PERF_SESSION_ID and that the session has students.',
          );
        }

        for (let i = 0; i < INTERACTION_COUNT; i++) {
          const input = inputs.nth(i % count);

          // Type a value — use a valid-looking numeric result (e.g. 10.5 s for a sprint)
          await input.click();
          await input.fill('10.5');

          // Tab out to trigger onBlur → handleSave
          await input.press('Tab');

          // Wait for a brief settle so the optimistic update can land
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
    await attachPerfArtifacts('manual-save', { ...lastRun.metrics, p75: median });

    if (median >= fail) {
      throw new Error(
        `[manual-save] FAIL: p75 INP median ${median} ms ≥ hard-fail threshold ${fail} ms`,
      );
    }

    if (median >= warn) {
      console.warn(
        `[manual-save] WARN: p75 INP median ${median} ms ≥ warn threshold ${warn} ms`,
      );
    }

    expect(median).toBeLessThan(fail);
  });
});
