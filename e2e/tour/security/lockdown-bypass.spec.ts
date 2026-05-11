/**
 * Tier 4.3 — Lockdown bypass attempts.
 *
 * Threat model: a determined user opens DevTools mid-tour and tries to
 * interact with the underlying app (sidebar links, modals, form fields)
 * while mock data is in the SWR cache. Successful bypass could corrupt
 * mock writes back into the real cache, or surface mock data after the
 * tour cleans up.
 *
 * History: the plan predicted three of these vectors would succeed
 * (DevTools class-strip, keyboard Tab+Enter, programmatic .click()).
 * TourProvider now ships a three-layer defense — body.tour-active CSS,
 * `inert` attribute on the [data-tour-inert-root] wrapper, and a
 * capture-phase event listener that blocks click/keydown/touchstart
 * originating outside the Joyride portal. A MutationObserver re-applies
 * the body class and inert attribute if they're stripped externally.
 *
 * All five tests below now assert the *desired* blocked behaviour. A
 * regression in any layer will surface here.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  isTourActiveBodyClass,
} from '../_helpers';

test.describe('tour security — lockdown bypass', () => {
  test('user click on a sidebar link is absorbed (no navigation)', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page); // get past welcome (sidebar hidden there)

    expect(await isTourActiveBodyClass(page)).toBe(true);
    const urlBefore = page.url();

    const navLinks = page.locator('nav a, aside a').filter({ hasText: /\S/ });
    const count = await navLinks.count();
    test.skip(count === 0, 'No sidebar nav links visible — skipping');

    await navLinks.first().click({ force: true });
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBefore);
  });

  test('manually removing body.tour-active is reverted by the MutationObserver', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    // Strip the lockdown class from the outside.
    await page.evaluate(() => document.body.classList.remove('tour-active'));

    // The MutationObserver in TourProvider re-applies the class within the
    // same microtask. Poll briefly to confirm it has been restored.
    await expect.poll(() => isTourActiveBodyClass(page), { timeout: 1000 }).toBe(true);

    // Even if the attacker times the click between strip and re-apply, the
    // capture-phase listener still blocks the navigation.
    const urlBefore = page.url();
    const navLinks = page.locator('nav a, aside a').filter({ hasText: /\S/ });
    if ((await navLinks.count()) === 0) {
      test.skip(true, 'No sidebar nav links visible');
    }
    await navLinks.first().click({ force: true });
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBefore);
  });

  test('keyboard Tab+Enter on a sidebar link is blocked by the inert wrapper', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    const urlBefore = page.url();

    const link = page.locator('nav a, aside a').filter({ hasText: /\S/ }).first();
    if ((await link.count()) === 0) {
      test.skip(true, 'No sidebar nav links to focus');
    }
    // Inside an inert subtree, focus() is rejected by the user agent. Even if
    // focus did transfer, the capture-phase keydown listener stops Enter
    // from activating the link.
    await link.focus().catch(() => undefined);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    expect(page.url()).toBe(urlBefore);
  });

  test('programmatic .click() on an underlying button is blocked by the capture-phase listener', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    const urlBefore = page.url();

    // Synthetic click — would bypass pointer-events:none and inert pointer
    // semantics. The capture-phase listener intercepts it before the click
    // bubbles to the anchor's default-action handler.
    const navigated = await page.evaluate((): boolean => {
      const a = document.querySelector('nav a, aside a') as HTMLAnchorElement | null;
      if (!a) return false;
      a.click();
      return true;
    });
    if (!navigated) {
      test.skip(true, 'No nav anchor reachable via programmatic click');
    }
    await page.waitForTimeout(400);

    expect(page.url()).toBe(urlBefore);
  });

  test('direct address-bar navigation mid-tour cleans up without leaving a half-state', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);
    await clickNext(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    // User types a URL into the address bar — Playwright's page.goto.
    await page.goto('/dashboard?bypass=1');

    // The full-page navigation discards the React tree (machine reset to idle)
    // and unmounts TourProvider, which removes the body class via cleanup.
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('tour-active')), {
      timeout: 3000,
    }).toBe(false);
  });
});
