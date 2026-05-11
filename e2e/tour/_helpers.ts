/**
 * Shared utilities for the tour E2E suite.
 *
 * Auth strategy:
 *   The tour never hits the real API while running — its fetcher interceptor
 *   serves all traffic from synthetic mock data. We only need the web app to
 *   accept us as an authenticated teacher whose onboarding is incomplete, so
 *   the layout routes us to /onboarding/welcome.
 *
 * Network strategy:
 *   - /auth/me is always stubbed (the layout fires it on mount).
 *   - Other API endpoints may be stubbed per-spec. The bleed/isolation specs
 *     explicitly abort any /api/** call AFTER the tour starts to prove the
 *     interceptor truly handles everything.
 */

import { expect, type Page, type Route } from '@playwright/test';
import { injectFakeToken } from '../fixtures/auth.fixture';

/** Mock /auth/me response — first-time teacher (no onboarding done yet). */
export const MOCK_TEACHER_PROFILE = {
  id:                   'tour-teacher-e2e',
  email:                'tour@e2e.test',
  name:                 'מורה לסיור',
  school:               null,
  avatarUrl:            null,
  isOnboardingComplete: false,
  defaultMaleTestIds:   [] as string[],
  defaultFemaleTestIds: [] as string[],
};

/**
 * Stubs the minimal set of API routes required to reach /onboarding/welcome.
 * Specs that need additional routes can install more BEFORE calling
 * `gotoWelcomePage` or AFTER, depending on the timing they want to test.
 */
export async function stubBaseRoutes(page: Page): Promise<void> {
  await page.route('**/api/auth/me', (route: Route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify(MOCK_TEACHER_PROFILE),
    }),
  );
}

/**
 * Wait until the global SplashScreen overlay is fully unmounted.
 *
 * The splash (components/ui/splash-screen.tsx) sits at z-9999 and absorbs
 * every pointer event over the entire viewport. It has TWO hold mechanisms
 * we have to outlast:
 *
 *   1. MIN_DISPLAY_MS = 3500 — a hard floor enforced by the component itself
 *      even when isLoading flips to false (UX choice: avoid flash for fast
 *      loads). In dev mode with cold-compile this is the dominant cost.
 *   2. Exit animation — 600 ms opacity/scale fade after canHide=true. The
 *      <AnimatePresence> wrapper only unmounts the child after this completes.
 *
 * Total minimum: ~4.1 s in production, plus whatever cold-compile time the
 * dev server adds. We poll for the role="status" / aria-label match to be
 * fully detached from the DOM — that signal corresponds to the
 * AnimatePresence unmount, after which clicks behind the splash succeed.
 */
export async function waitForSplashGone(page: Page, timeout = 30_000): Promise<void> {
  await page.getByRole('status', { name: /טוען את FitGrade/ }).waitFor({
    state: 'detached',
    timeout,
  });
}

/**
 * Full per-test setup: fake token + stubbed /auth/me + navigation to welcome.
 * Returns once the SplashScreen has fully unmounted AND the welcome button
 * is visible. Both checks are required — the button is rendered in the DOM
 * before the splash exits, so visibility alone is not a signal of clickability.
 */
export async function gotoWelcomePage(page: Page): Promise<void> {
  await injectFakeToken(page);
  await stubBaseRoutes(page);
  await page.goto('/onboarding/welcome');
  await waitForSplashGone(page);
  await expect(page.getByRole('button', { name: /התחל סיור מודרך/ })).toBeVisible();
}

/**
 * Click the welcome page's primary CTA and wait for the tour to be fully
 * running on step 0.
 *
 * Four signals in sequence:
 *   1. The SplashScreen has fully unmounted (defence in depth — also waited
 *      for in gotoWelcomePage, but if this helper is called from another
 *      page.goto path, the wait covers that too).
 *   2. The startTour click resolves.
 *   3. body.tour-active appears — the machine has left 'idle'. This proves
 *      the dispatch landed even if the first route is still cold-compiling.
 *   4. The tooltip step counter renders — the machine reached 'running'.
 */
export async function startTour(page: Page): Promise<void> {
  await waitForSplashGone(page);
  await page.getByRole('button', { name: /התחל סיור מודרך/ }).click();
  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('tour-active')), {
      timeout: 10_000,
    })
    .toBe(true);
  await expectTooltipVisible(page);
}

/**
 * Tooltip selector — TourTooltip is rendered with dir="rtl" and contains the
 * step counter "שלב {N} מתוך {SIZE}". We match the counter pattern as the
 * stable signal that the tooltip is rendered (vs the spotlight overlay which
 * may exist transiently between steps).
 *
 * Inherits the global expect timeout (15 s) so a slow dev-compile crossing
 * has time to settle before this assertion gives up.
 */
export async function expectTooltipVisible(page: Page): Promise<void> {
  await expect(page.getByText(/שלב \d+ מתוך \d+/)).toBeVisible();
}

/** Returns the 1-based step counter shown in the tooltip. */
export async function readStepCounter(page: Page): Promise<{ index: number; size: number }> {
  const text = await page.getByText(/שלב \d+ מתוך \d+/).first().textContent();
  const m = text?.match(/שלב (\d+) מתוך (\d+)/);
  if (!m) throw new Error(`Could not parse step counter: ${text ?? '(empty)'}`);
  return { index: Number(m[1]), size: Number(m[2]) };
}

/**
 * Click the tooltip's primary action and wait until either the step counter
 * advances OR the URL lands on /settings (final step).
 *
 * The naive variant — click and return — assumes the next step's tooltip is
 * already in the DOM. In dev mode the destination route may still be
 * compiling when the click fires, so we must poll the post-click state.
 *
 * The wait resolves on one of:
 *   • counter index strictly greater than the pre-click index
 *   • URL pathname matches /settings (Joyride 'last' button fires here)
 */
export async function clickNext(page: Page): Promise<void> {
  // "הבא" or "למסך ההגדרות" — on the last step the primary action changes.
  const before = await readStepCounter(page).catch(() => null);
  const next = page.getByRole('button', { name: /^הבא$|^למסך ההגדרות$/ });
  await next.click();

  if (before === null) return;

  // 30s is a deliberately generous budget for Next.js dev-mode cold compile
  // of a cross-route destination. The seeding-phase router.prefetch in
  // TourProvider mitigates this, but a teacher's first walk over a fresh
  // dev server can still spike past 15s on routes like /reports and /norms.
  // CI builds use `next start` (no per-route compile) so this never bites
  // there — only local dev runs need the longer wait.
  await expect
    .poll(
      async (): Promise<'advanced' | 'settings' | 'unchanged'> => {
        if (/\/settings(\/|$|\?)/.test(page.url())) return 'settings';
        const counter = await readStepCounter(page).catch(() => null);
        if (counter !== null && counter.index !== before.index) return 'advanced';
        return 'unchanged';
      },
      { timeout: 30_000 },
    )
    .not.toBe('unchanged');
}

export async function clickBack(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^הקודם$/ }).click();
}

export async function clickSkipX(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'דלג על הסיור' }).click();
}

/** Returns true if document.body has the lockdown class. */
export async function isTourActiveBodyClass(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('tour-active'));
}

/** Waits up to `timeout` ms for the body class to reach `expected`. */
export async function waitForTourActive(
  page: Page,
  expected: boolean,
  timeout = 2000,
): Promise<void> {
  await expect.poll(
    async () => isTourActiveBodyClass(page),
    { timeout },
  ).toBe(expected);
}
