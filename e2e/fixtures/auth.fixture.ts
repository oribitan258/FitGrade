/**
 * Playwright auth fixture for FitGrade.
 *
 * Injects a teacher JWT into the browser's localStorage before each test,
 * enabling navigation to any teacher-protected route without Google OAuth.
 *
 * Token lifecycle:
 *   1. `beforeAll`: calls POST /api/auth/dev-login → stores access token in
 *      the fixture so all tests within the suite share one login round-trip.
 *   2. `beforeEach`: calls `page.addInitScript()` to seed localStorage with
 *      the token BEFORE the page loads (so the app's `getToken()` finds it).
 *   3. All outbound API calls in the web app attach `Authorization: Bearer <token>`
 *      from localStorage key `fitgrade_token`.
 *
 * For fully mocked tests (no real API), call `injectFakeToken` and provide all
 * routes via `page.route()`.
 */

import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';

const API_URL    = process.env['API_URL']    ?? 'http://localhost:3000/api';
const TOKEN_KEY  = 'fitgrade_token';

// ─── Fixture types ─────────────────────────────────────────────────────────────

export interface AuthFixtures {
  /** The teacher access token obtained via dev-login. */
  teacherToken: string;
  /** Navigates to a URL with the teacher token already in localStorage. */
  authedPage: Page;
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Calls the API's dev-login endpoint and returns the access token.
 * Requires the NestJS server to be running on API_URL.
 */
export async function fetchTeacherToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_URL}/auth/dev-login`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json() as { accessToken: string };
  return body.accessToken;
}

/**
 * Seeds `localStorage.fitgrade_token` before the page loads.
 * Call this before `page.goto()` so the token is available on first render.
 */
export async function injectToken(page: Page, token: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: TOKEN_KEY, value: token },
  );
}

/**
 * Injects a sentinel fake token for fully-mocked tests that don't need a
 * real JWT. All API routes must be stubbed via `page.route()`.
 */
export async function injectFakeToken(page: Page): Promise<void> {
  await injectToken(page, 'e2e-fake-token-for-mocked-tests');
}

// ─── Extended test fixture ─────────────────────────────────────────────────────

export const test = base.extend<AuthFixtures>({
  teacherToken: async ({ request }, use) => {
    const token = await fetchTeacherToken(request);
    await use(token);
  },

  authedPage: async ({ page, teacherToken }, use) => {
    await injectToken(page, teacherToken);
    await use(page);
  },
});

export { expect } from '@playwright/test';
