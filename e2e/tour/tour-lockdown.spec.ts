/**
 * Tier 3.4 — pointer-events lockdown.
 *
 * Verifies the body.tour-active gating: while the tour is active, normal app
 * chrome (sidebar links, top-level buttons, etc.) must not respond to clicks.
 *
 * Known limitations (NOT failure cases here — documented in the security tier):
 *   • Programmatic .click() from devtools bypasses pointer-events.
 *   • Keyboard activation (Tab + Enter) may bypass pointer-events on links.
 *   • A user with CSS-injection access (extensions, devtools) can disable the
 *     lock by overriding the rule. Out of scope.
 *
 * Scope of THIS spec:
 *   Real user-input clicks (page.click, page.locator.click) must be absorbed.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  isTourActiveBodyClass,
} from './_helpers';

test.describe('tour — pointer-events lockdown', () => {
  test('clicking a sidebar item during tour does not navigate', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    // Advance to step 1 — by then we are on /dashboard with the full layout
    // including sidebar visible (welcome page hides the sidebar).
    await clickNext(page);

    expect(await isTourActiveBodyClass(page)).toBe(true);
    const urlBefore = page.url();

    // Try clicking any nav link in the sidebar. Use first available sidebar link.
    // The teacher layout sidebar uses <a> tags. If pointer-events is off,
    // Playwright's click should be a no-op (the element receives the event
    // but the browser's hit-test sees the body's pointer-events:none).
    const navLinks = page.locator('nav a, aside a').filter({ hasText: /\S/ });
    const count = await navLinks.count();
    if (count === 0) {
      test.skip(true, 'No sidebar nav links visible — skipping');
    }

    // Click without throwing if the element is not actually clickable.
    await navLinks.first().click({ force: true, trial: false });

    // URL must not change.
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBefore);
  });

  test('main content elements behind the overlay are not clickable', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);

    expect(await isTourActiveBodyClass(page)).toBe(true);

    // Check the computed pointer-events on body during the tour.
    const bodyPointerEvents = await page.evaluate(() =>
      window.getComputedStyle(document.body).pointerEvents,
    );
    expect(bodyPointerEvents).toBe('none');
  });

  test('joyride portal itself remains interactive (pointer-events: auto exception)', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);

    // The CSS rule body.tour-active [id^="react-joyride"] { pointer-events: auto }
    // ensures the tooltip's buttons remain clickable.
    const portal = page.locator('[id^="react-joyride"]').first();
    if ((await portal.count()) > 0) {
      const pe = await portal.evaluate((el) => window.getComputedStyle(el).pointerEvents);
      expect(pe).toBe('auto');
    }
  });
});
