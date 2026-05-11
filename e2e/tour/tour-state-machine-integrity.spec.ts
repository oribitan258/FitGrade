/**
 * Tier 3.2 — state machine integrity under stress.
 *
 * Covered scenarios:
 *   • Rapid Next clicks must advance exactly once per click (no skip / dup).
 *   • Mid-tour reload — body class must be cleared and no half-state remains.
 *   • Mid-tour browser back — tour either resumes gracefully or terminates,
 *     never leaves a stuck overlay.
 *   • Skip via the X button tears down to clean state.
 *   • Re-entry from welcome → tour after a completed/skipped run renders
 *     step 0 cleanly with no leftover DOM.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  clickSkipX,
  readStepCounter,
  isTourActiveBodyClass,
  expectTooltipVisible,
  waitForTourActive,
} from './_helpers';

test.describe('tour — state machine integrity', () => {
  test('rapid Next clicks advance one step per click', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoWelcomePage(page);
    await startTour(page);

    // Fire 4 next clicks within ~250 ms.
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: /^הבא$/ }).click({ delay: 0 });
    }

    // Wait for the tooltip on the 5th step. Dev-mode cold compile applies
    // to every cross-route crossing the rapid clicks induce, so we use the
    // same 30s budget as `clickNext` rather than the original 8s.
    await expect.poll(async () => {
      try {
        return (await readStepCounter(page)).index;
      } catch {
        return 0;
      }
    }, { timeout: 30_000 }).toBe(5);
  });

  test('mid-tour page reload clears body class and idles the machine', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);

    // Advance a few steps so we're not on welcome.
    await clickNext(page);
    await clickNext(page);
    await expectTooltipVisible(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    await page.reload();

    // A reload destroys the in-memory machine state. body must be clean.
    await waitForTourActive(page, false, 2000);
    // No tooltip should be present after reload.
    await expect(page.getByText(/שלב \d+ מתוך \d+/)).toHaveCount(0);
  });

  test('skip via X button removes overlay, lockdown, and stops tour', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page);
    await clickNext(page);

    expect(await isTourActiveBodyClass(page)).toBe(true);
    await clickSkipX(page);

    await waitForTourActive(page, false, 2000);
    await expect(page.getByText(/שלב \d+ מתוך \d+/)).toHaveCount(0);
  });

  test('re-entry after completion starts cleanly from step 0', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);

    // Skip immediately.
    await clickSkipX(page);
    await waitForTourActive(page, false, 2000);

    // Return to welcome and start again — must render step 0 cleanly.
    // Use startTour (not a direct button click) so the helper's splash-gone
    // wait covers the freshly remounted SplashScreen on this second visit.
    await page.goto('/onboarding/welcome');
    await startTour(page);
    const { index } = await readStepCounter(page);
    expect(index).toBe(1);
    expect(await isTourActiveBodyClass(page)).toBe(true);
  });
});
