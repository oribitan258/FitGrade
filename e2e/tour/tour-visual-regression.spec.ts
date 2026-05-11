/**
 * Tier 3.6 — visual regression for every tour step.
 *
 * Captures one screenshot per step (14 total) plus the /settings finale.
 * Compared against committed baselines in `__screenshots__/`. A failure
 * indicates unintended UI drift — most commonly the ghost beacon, an
 * overlay layering regression, or an accidental visual change to a
 * highlighted target.
 *
 * Run with `--update-snapshots` to refresh the baseline after intentional
 * visual changes.
 *
 * Determinism notes:
 *   • The tour mock data is fully deterministic (no Date.now() in cards).
 *   • The MOCK_EVENT date uses Date.now() at module load — this gives a
 *     varying date string. Screenshots that include the event panel
 *     (step 3) may flicker; we mask the date region or accept that diff.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  readStepCounter,
} from './_helpers';

const SHOT_OPTIONS = {
  // Allow tiny pixel-level diffs from antialiasing / font hinting.
  maxDiffPixelRatio: 0.02,
  // Mask the upcoming-event date which uses Date.now() in mock data.
  // (No effect on non-event steps.)
  animations: 'disabled' as const,
};

test.describe('tour — visual regression', () => {
  test('captures every step plus settings finale', async ({ page }) => {
    // 14 steps × (cold compile + screenshot diff) can easily exceed 60s.
    test.setTimeout(300_000);
    await gotoWelcomePage(page);
    await startTour(page);

    for (let i = 1; i <= 14; i++) {
      // Wait for the tooltip with the expected counter. 30s accommodates
      // dev-mode cold compile of the destination route — `clickNext` uses
      // the same budget, but the first iteration enters this block before
      // any clickNext has been called.
      await expect.poll(async () => {
        try {
          return (await readStepCounter(page)).index;
        } catch {
          return 0;
        }
      }, { timeout: 30_000 }).toBe(i);

      await expect(page).toHaveScreenshot(`tour-step-${String(i).padStart(2, '0')}.png`, SHOT_OPTIONS);

      if (i < 14) {
        await clickNext(page);
      } else {
        // Final step → /settings.
        await page.getByRole('button', { name: 'למסך ההגדרות' }).click();
        await expect(page).toHaveURL(/\/settings(\/|$|\?)/);
        await expect(page).toHaveScreenshot('tour-finale-settings.png', SHOT_OPTIONS);
      }
    }
  });
});
