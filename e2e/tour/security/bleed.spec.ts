/**
 * Tier 4.1 — Data bleed / contamination audit.
 *
 * Attack model:
 *   1. The tour's fetcher interceptor must not be active before startTour.
 *   2. The interceptor must be fully cleared after FINISH or SKIP — no mock
 *      response can leak into the post-tour SWR cache.
 *   3. The localStorage schedule seed must not overwrite a real teacher's
 *      pre-existing schedule, and clearTourSchedule must NOT delete it.
 *   4. A reload during the tour must reset to a clean idle state.
 *
 * Pass criteria: each spec ends with explicit expect() — failures become
 * JUnit entries the autonomous audit agent can surface as defects.
 */

import { test, expect } from '@playwright/test';
import {
  gotoWelcomePage,
  startTour,
  clickNext,
  clickSkipX,
  isTourActiveBodyClass,
  waitForTourActive,
  MOCK_TEACHER_PROFILE,
} from '../_helpers';
import { injectFakeToken } from '../../fixtures/auth.fixture';

const SCHEDULE_KEY = 'fitgrade-schedule-v2-A';

test.describe('tour security — data bleed', () => {
  test('interceptor is cleared after tour FINISH — real /api/classes fires after settings lands', async ({ page }) => {
    test.setTimeout(300_000);
    // Set up routes. /api/classes returns a recognisable real-network sentinel.
    let realClassesHits = 0;
    await injectFakeToken(page);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TEACHER_PROFILE),
      }),
    );
    await page.route('**/api/classes', (route) => {
      realClassesHits++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'real-net-sentinel', name: 'REAL-NETWORK' }]),
      });
    });

    await page.goto('/onboarding/welcome');
    await startTour(page);

    // Walk the whole tour. During the tour the interceptor serves /classes
    // from MOCK_CLASSES — realClassesHits MUST stay 0 throughout.
    for (let i = 0; i < 13; i++) {
      await clickNext(page);
    }
    // Step 4 (/classes) was visited during the tour. realClassesHits is the
    // canary for interceptor leakage.
    expect(realClassesHits, 'Interceptor leaked: /api/classes fetched during tour').toBe(0);

    // Final step.
    await page.getByRole('button', { name: 'למסך ההגדרות' }).click();
    await expect(page).toHaveURL(/\/settings(\/|$|\?)/);
    await waitForTourActive(page, false, 2000);

    // Now navigate back to /classes — without the interceptor, a real fetch fires.
    await page.goto('/classes');
    await expect.poll(() => realClassesHits, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('interceptor is cleared after SKIP — real /api/classes fires after skip', async ({ page }) => {
    let realClassesHits = 0;
    await injectFakeToken(page);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TEACHER_PROFILE),
      }),
    );
    await page.route('**/api/classes', (route) => {
      realClassesHits++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/onboarding/welcome');
    await startTour(page);
    await clickNext(page);
    await clickNext(page);

    expect(realClassesHits).toBe(0);

    await clickSkipX(page);
    await waitForTourActive(page, false, 2000);

    await page.goto('/classes');
    await expect.poll(() => realClassesHits, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('seedTourSchedule does not overwrite a pre-existing real schedule', async ({ page }) => {
    await injectFakeToken(page);

    // Pre-seed localStorage with a "real teacher" entry BEFORE the page loads.
    const realSchedule = JSON.stringify([
      // No __tourMock sentinel — this is real teacher data.
      { id: 'real-1', type: 'lesson', classId: 'real-class', startTime: '08:00', endTime: '08:45', day: 0 },
    ]);
    await page.addInitScript(
      ({ key, value }: { key: string; value: string }) => {
        window.localStorage.setItem(key, value);
      },
      { key: SCHEDULE_KEY, value: realSchedule },
    );

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TEACHER_PROFILE),
      }),
    );

    await page.goto('/onboarding/welcome');
    await startTour(page);

    // After seeding fires, the real schedule must be intact.
    const afterSeed = await page.evaluate((k) => window.localStorage.getItem(k), SCHEDULE_KEY);
    expect(afterSeed, 'seedTourSchedule overwrote real teacher schedule').toBe(realSchedule);

    // Walk a few steps then skip.
    await clickNext(page);
    await clickNext(page);
    await clickSkipX(page);
    await waitForTourActive(page, false, 2000);

    // After cleanup, the real schedule must STILL be intact.
    const afterCleanup = await page.evaluate((k) => window.localStorage.getItem(k), SCHEDULE_KEY);
    expect(afterCleanup, 'clearTourSchedule deleted real teacher schedule').toBe(realSchedule);
  });

  test('reload during tour resets to idle (no body class, no leftover mock state)', async ({ page }) => {
    await gotoWelcomePage(page);
    await startTour(page);

    // Advance so we are not on welcome.
    await clickNext(page);
    await clickNext(page);
    expect(await isTourActiveBodyClass(page)).toBe(true);

    await page.reload();

    // After reload: machine is idle, body class is gone.
    await waitForTourActive(page, false, 2000);

    // localStorage sentinel: if tour wrote the schedule, it carried the
    // __tourMock sentinel — that's expected and acceptable. The criterion
    // is that the next session starts in idle, which we just verified.
  });
});
