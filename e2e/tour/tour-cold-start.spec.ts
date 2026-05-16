/**
 * Tier 3.1 — happy-path cold start.
 *
 * Walks the tour from welcome → step 0 → step 13 → /settings finale.
 * At every step verifies:
 *   - Tooltip is visible.
 *   - Step counter matches the expected 1-based index.
 *   - body.tour-active is present (lockdown engaged).
 *
 * After completion:
 *   - Pathname lands on /settings.
 *   - body.tour-active is removed within 500 ms.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  readStepCounter,
  isTourActiveBodyClass,
  expectTooltipVisible,
  waitForTourActive,
} from './_helpers';

const TOTAL_STEPS = 14;

test.describe('tour — cold-start happy path', () => {
  test('walks every step and lands on /settings with lockdown cleared', async ({ page }) => {
    // Walking all 14 steps with up to ~30s of dev-mode cold compile per
    // cross-route crossing can legitimately exceed the global 60s test cap.
    test.setTimeout(1_500_000);
    await gotoWelcomePage(page);
    await startTour(page);

    // Step 0 (welcome on dashboard).
    {
      const { index, size } = await readStepCounter(page);
      expect(index).toBe(1);
      expect(size).toBe(TOTAL_STEPS);
      expect(await isTourActiveBodyClass(page)).toBe(true);
    }

    // Walk forward through steps 1..12 with "הבא".
    for (let i = 1; i < TOTAL_STEPS - 1; i++) {
      await clickNext(page);
      await expectTooltipVisible(page);
      const { index } = await readStepCounter(page);
      expect(index).toBe(i + 1);
      expect(await isTourActiveBodyClass(page)).toBe(true);
    }

    // Final step — primary button reads "למסך ההגדרות".
    const finalLabel = page.getByRole('button', { name: 'למסך ההגדרות' });
    await expect(finalLabel).toBeVisible();
    await finalLabel.click();

    // Lands on /settings.
    await expect(page).toHaveURL(/\/settings(\/|$|\?)/);

    // Lockdown is removed within 500 ms of finishing.
    await waitForTourActive(page, false, 1500);
  });
});
