/**
 * Tier 3.5 — network isolation for tour-mocked endpoints.
 *
 * Contract under test: every endpoint that appears in TOUR_MOCK_HANDLERS
 * must be served from the in-browser interceptor during the tour. Real
 * network fetches for those URL patterns are a bleed and must not occur.
 *
 * Out of scope: endpoints NOT in the tour mock handler set (e.g.
 * /auth/me, /settings/*, /reports/*, /tests/types/norms) are *expected*
 * to fall through to the real API. The tour intentionally does not mock
 * the full read surface — pages like /norms, /reports, and /settings
 * tolerate empty responses and rely on real backend data when present.
 * A broad `**\/api\/**` abort would mask the real claim and also shadow
 * the /auth/me stub installed by `stubBaseRoutes` (Playwright resolves
 * route handlers LIFO — the most recently registered wins).
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  expectTooltipVisible,
} from './_helpers';

/**
 * Playwright glob patterns that must be 1:1 with the regex set in
 * TOUR_MOCK_HANDLERS. If a leak appears for any of these during the
 * tour, the interceptor failed for that URL.
 */
const TOUR_MOCKED_PATTERNS = [
  '**/api/classes',
  '**/api/classes/tour-demo-class',
  '**/api/classes/tour-demo-class/**',
  '**/api/tests/types',
  '**/api/dashboard/**',
  '**/api/events',
  '**/api/events/upcoming',
];

test.describe('tour — network isolation', () => {
  test('no tour-mocked endpoint leaks to real API during the tour', async ({ page }) => {
    test.setTimeout(1_500_000);
    await gotoWelcomePage(page);

    // After the welcome page is up, install *narrow* abort handlers for
    // exactly the URL patterns the in-browser interceptor is supposed to
    // own. Non-mocked endpoints fall through to their existing stubs
    // (e.g. /auth/me) or to the real API.
    const aborted: string[] = [];
    for (const pattern of TOUR_MOCKED_PATTERNS) {
      await page.route(pattern, (route) => {
        aborted.push(route.request().url());
        route.abort();
      });
    }

    await startTour(page);

    // Walk the whole tour.
    for (let i = 0; i < 13; i++) {
      await clickNext(page);
      await expectTooltipVisible(page);
    }

    // Finish.
    await page.getByRole('button', { name: 'למסך ההגדרות' }).click();
    await expect(page).toHaveURL(/\/settings(\/|$|\?)/);

    expect(
      aborted,
      `Tour-mocked endpoints leaked to real fetch during the tour:\n${aborted.join('\n')}`,
    ).toEqual([]);
  });
});
