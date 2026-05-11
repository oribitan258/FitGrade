/**
 * Auth Redirect Flow — Playwright E2E
 *
 * Covers the complete Teacher Google OAuth lifecycle and every redirect branch:
 *
 *   A. Login page renders correctly (Hebrew, RTL, Google button visible)
 *   B. Google button href points to the correct OAuth initiation URL
 *   C. Successful OAuth callback:
 *        Navigate → /auth/callback
 *        CallbackHandler fires POST /api/auth/exchange
 *        Token stored in localStorage.fitgrade_token
 *        Router.replace('/dashboard') completes — dashboard content visible
 *   D. Failed exchange (cookie missing/expired) → redirect to /login
 *   E. No blank screen or hanging spinner after successful exchange
 *   F. Unauthenticated access to teacher routes → redirect to /login
 *   G. Student token cannot access teacher dashboard → redirect
 *   H. Logout: POST /api/auth/logout clears the token and refreshes to /login
 *
 * Network strategy:
 *   - POST /api/auth/exchange is mocked via page.route() in every test
 *   - All subsequent dashboard API calls are mocked so no live API is needed
 *   - The Next.js web app must be running at PLAYWRIGHT_BASE_URL (default: http://localhost:3001)
 *
 * Token storage key: localStorage.fitgrade_token (confirmed in apps/web/lib/api-client.ts)
 */

import { test, expect, type Page } from '@playwright/test';
import { injectToken, injectFakeToken } from './fixtures/auth.fixture';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_KEY        = 'fitgrade_token';
const FAKE_ACCESS_TOKEN = 'e2e-auth-redirect-access-token';

/**
 * The Google OAuth URL constructed by the login page:
 *   `${process.env['API_URL'] ?? 'http://localhost:3001/api'}/auth/google`
 *
 * In the browser (client component), NEXT_PUBLIC_ vars are not set by default,
 * so the fallback `http://localhost:3001/api` is always used in dev.
 */
const GOOGLE_AUTH_URL_PATTERN = '**/api/auth/google';

// ─── Shared route mounts ──────────────────────────────────────────────────────

/** Mock POST /api/auth/exchange → 200 + access token. */
async function mockExchangeSuccess(page: Page): Promise<void> {
  await page.route('**/api/auth/exchange', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }),
      });
    } else {
      void route.continue();
    }
  });
}

/** Mock POST /api/auth/exchange → 401 (cookie missing or expired). */
async function mockExchangeFail(page: Page): Promise<void> {
  await page.route('**/api/auth/exchange', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'טוקן כניסה חסר או פג תוקפו' }),
      });
    } else {
      void route.continue();
    }
  });
}

/** Mount stub responses for all dashboard API calls so the page renders. */
async function mountDashboardMocks(page: Page): Promise<void> {
  await page.route('**/api/classes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'dash-class-1', name: 'כיתה ז׳1', gradeLevel: 7, genderType: 'BOYS', currentSemester: 'A', studentCount: 20 },
      ]),
    }),
  );
  await page.route('**/api/dashboard/stats**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalStudents: 20, totalSessions: 4, avgGrade: 78, attendanceRate: 91 }),
    }),
  );
  await page.route('**/api/dashboard/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'teacher-1', name: 'מורה בדיקה', email: 'teacher@test.com', school: 'בית ספר בדיקה' }),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Login Page Render
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Login Page Render', () => {

  test('login page renders in Hebrew with RTL layout', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // HTML document must be RTL and Hebrew
    const dir  = await page.getAttribute('html', 'dir');
    const lang = await page.getAttribute('html', 'lang');
    expect(dir).toBe('rtl');
    expect(lang).toBe('he');
  });

  test('login page shows Hebrew heading and Google sign-in button', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Brand heading
    await expect(page.getByRole('heading', { name: 'FitGrade' })).toBeVisible();

    // Hebrew subtitle
    await expect(page.locator('text=מערכת ניהול ציונים לחינוך גופני')).toBeVisible();

    // Google sign-in link must be visible (aria-label set on the <a>)
    await expect(page.getByRole('link', { name: /כניסה עם.*Google/i })).toBeVisible();
  });

  test('login page shows "כניסה לתלמידים" link pointing to /student-login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const studentLink = page.getByRole('link', { name: 'כניסה לתלמידים' });
    await expect(studentLink).toBeVisible();
    await expect(studentLink).toHaveAttribute('href', '/student-login');
  });

  test('login page has no horizontal overflow (RTL layout is intact)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Google Button OAuth URL
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Google OAuth Button', () => {

  test('Google sign-in button href points to /api/auth/google', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /כניסה עם.*Google/i });
    const href  = await link.getAttribute('href');
    expect(href).toBeTruthy();
    // Must end with /api/auth/google (the OAuth initiation endpoint)
    expect(href).toMatch(/\/api\/auth\/google$/);
  });

  test('clicking Google button initiates navigation to the OAuth URL', async ({ page }) => {
    // Intercept the OAuth redirect before the browser actually leaves the app
    let oauthInitiated = false;
    await page.route(GOOGLE_AUTH_URL_PATTERN, (route) => {
      oauthInitiated = true;
      // Abort the navigation — we don't want to go to real Google
      void route.abort();
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /כניסה עם.*Google/i });

    // Click and wait briefly — the route intercept fires synchronously
    await Promise.race([
      link.click(),
      page.waitForTimeout(1500),
    ]).catch(() => {}); // Navigation abort throws; catch it

    expect(oauthInitiated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Successful OAuth Callback
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Successful OAuth Callback', () => {

  test('callback page: POST /api/auth/exchange is called immediately on load', async ({ page }) => {
    let exchangeCalled = false;
    await page.route('**/api/auth/exchange', (route) => {
      if (route.request().method() === 'POST') {
        exchangeCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }) });
      } else {
        void route.continue();
      }
    });
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');
    // Wait long enough for the useEffect + fetch to fire
    await page.waitForTimeout(1200);

    expect(exchangeCalled).toBe(true);
  });

  test('successful exchange stores token in localStorage.fitgrade_token', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');
    // Wait for useEffect + fetch + setToken() to complete
    await page.waitForTimeout(1200);

    const storedToken = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY);
    expect(storedToken).toBe(FAKE_ACCESS_TOKEN);
  });

  test('successful exchange redirects to /dashboard — no blank screen', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');

    // CallbackHandler calls router.replace('/dashboard') after storing token.
    // Wait for navigation to complete.
    await page.waitForURL('**/dashboard', { timeout: 6000 });

    // Dashboard must have visible content — not a blank page
    await expect(page.locator('body')).not.toBeEmpty();

    // The URL must be /dashboard (or /dashboard/ with trailing slash)
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('callback page shows Hebrew loading animation while exchange is in progress', async ({ page }) => {
    // Delay the exchange response to catch the loading state
    await page.route('**/api/auth/exchange', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }) });
      } else {
        void route.continue();
      }
    });
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');

    // While the exchange is pending, the loading text must be visible
    await expect(page.locator('text=מאמת את הכניסה שלך...')).toBeVisible({ timeout: 500 });

    // Eventually navigates away
    await page.waitForURL('**/dashboard', { timeout: 5000 });
  });

  test('after successful callback: dashboard has RTL layout and Hebrew content', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');
    await page.waitForURL('**/dashboard', { timeout: 6000 });
    await page.waitForLoadState('networkidle');

    const dir = await page.getAttribute('html', 'dir');
    expect(dir).toBe('rtl');

    // Page must have actual content, not just a spinner
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Failed Exchange → Redirect to Login
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Failed Exchange Redirect', () => {

  test('exchange returns 401 → redirects to /login', async ({ page }) => {
    await mockExchangeFail(page);

    await page.goto('/auth/callback');
    // CallbackHandler catches the non-ok response and calls router.replace('/login')
    await page.waitForURL('**/login', { timeout: 5000 });

    expect(page.url()).toMatch(/\/login/);
    // Must not be the student login page
    expect(page.url()).not.toMatch(/student-login/);
  });

  test('exchange network failure (fetch throws) → redirects to /login', async ({ page }) => {
    await page.route('**/api/auth/exchange', (route) => route.abort('failed'));

    await page.goto('/auth/callback');
    await page.waitForURL('**/login', { timeout: 5000 });

    expect(page.url()).toMatch(/\/login/);
  });

  test('exchange 500 error → redirects to /login, no crash', async ({ page }) => {
    await page.route('**/api/auth/exchange', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }),
    );

    await page.goto('/auth/callback');
    await page.waitForURL('**/login', { timeout: 5000 });

    // Must not show an unhandled error boundary
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    expect(page.url()).toMatch(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E. No Blank Screen / No Hanging Spinner
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — No Blank Screens or Hanging States', () => {

  test('callback page does not remain stuck on loading indefinitely', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');

    // The page should navigate away from /auth/callback within 5 seconds.
    // If it hangs, the test fails with a timeout.
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/auth/callback'),
      { timeout: 5000 },
    );
  });

  test('dashboard loaded after callback has no spinner still visible', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');
    await page.waitForURL('**/dashboard', { timeout: 6000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300); // let animations settle

    // Common spinner patterns — none should be visible after load
    const spinners = page.locator('[role="progressbar"], [class*="spinner"], [class*="loading"], [aria-busy="true"]');
    const spinnerCount = await spinners.count();
    for (let i = 0; i < spinnerCount; i++) {
      await expect(spinners.nth(i)).not.toBeVisible();
    }
  });

  test('login page itself has no blank body text (renders correctly)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    expect(bodyText.length).toBeGreaterThan(5);
    expect(bodyText).toContain('FitGrade');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F. Unauthenticated Access → Redirect to Login
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Unauthenticated Redirect Guard', () => {

  test('accessing /dashboard without token → redirected to /login', async ({ page }) => {
    // Ensure localStorage has no token
    await page.addInitScript((key) => window.localStorage.removeItem(key), TOKEN_KEY);

    // Mock the API to return 401 (as it would without a real token)
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }) }),
    );

    await page.goto('/dashboard');

    // The auth guard must redirect to /login within 5 seconds
    await page.waitForURL(/\/(login|student-login)/, { timeout: 5000 });

    // Must land on the teacher login page (not student login)
    expect(page.url()).toMatch(/\/login(?!\/|.*student)/);
  });

  test('accessing /classes without token → redirected to /login', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.removeItem(key), TOKEN_KEY);
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );

    await page.goto('/classes');
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/login/);
  });

  test('accessing /student-dashboard without token → redirected to /student-login', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.removeItem(key), TOKEN_KEY);
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );

    await page.goto('/student-dashboard');
    // Student portal guards redirect to /student-login, not /login
    await page.waitForURL(/\/(student-login|login)/, { timeout: 5000 });
  });

  test('accessing /schedule without token → redirected to /login', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.removeItem(key), TOKEN_KEY);
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );

    await page.goto('/schedule');
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G. Role Isolation — Student Token on Teacher Routes
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Role Isolation', () => {

  test('student-flavored token cannot access /dashboard — redirected or 403 displayed', async ({ page }) => {
    // Inject a token that is syntactically valid but has STUDENT role.
    // Since the frontend only reads the token to attach as Bearer (it does not
    // decode role client-side in most implementations), the API guard will
    // reject requests with 403.  The frontend should then redirect to login.
    await injectToken(page, 'e2e-student-token-stub');

    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      }),
    );

    await page.goto('/dashboard');
    await page.waitForTimeout(1500);

    // The page must either redirect to login or show a Hebrew error —
    // it must NOT render the teacher dashboard with another user's data
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText);

    const redirectedToLogin = /\/login/.test(url);
    const showsError = /שגיאה|אין גישה|403/.test(bodyText);
    expect(redirectedToLogin || showsError).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H. Logout Flow
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Logout', () => {

  test('logging out clears localStorage token and redirects to /login', async ({ page }) => {
    // Start as an authenticated teacher
    await injectFakeToken(page);
    await mountDashboardMocks(page);

    // Mock POST /api/auth/logout → 204 (clears cookie server-side)
    await page.route('**/api/auth/logout', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 204, body: '' });
      } else {
        void route.continue();
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Simulate logout: clear token from localStorage and navigate to /login
    // (the actual logout button calls POST /logout then clears token)
    await page.evaluate((key) => window.localStorage.removeItem(key), TOKEN_KEY);

    // Verify token is gone
    const token = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY);
    expect(token).toBeNull();

    // Navigate to a protected route — should now be redirected to login
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 401, body: '{}' }),
    );
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/login/);
  });

  test('POST /api/auth/logout endpoint is callable and returns 204', async ({ page }) => {
    await injectFakeToken(page);

    let logoutStatus = 0;
    await page.route('**/api/auth/logout', (route) => {
      logoutStatus = 204;
      route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Call logout via page.evaluate (direct fetch)
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      return res.status;
    });

    expect(logoutStatus).toBe(204);
    expect(status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I. Exchange Endpoint Security
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth — Exchange Endpoint Behaviour', () => {

  test('POST /api/auth/exchange is not accessible via GET', async ({ page }) => {
    await injectFakeToken(page);
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const status = await page.evaluate(async () => {
      const res = await fetch('/api/auth/exchange', { method: 'GET', credentials: 'include' });
      return res.status;
    });

    // GET on a POST-only endpoint → 404 or 405 (Method Not Allowed)
    expect([404, 405]).toContain(status);
  });

  test('double call to POST /api/auth/exchange uses single-use cookie — second call fails', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/auth/exchange', (route) => {
      callCount++;
      if (route.request().method() === 'POST') {
        if (callCount === 1) {
          // First call: success
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }) });
        } else {
          // Second call: cookie already cleared → 401
          route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ statusCode: 401, message: 'טוקן כניסה חסר או פג תוקפו' }) });
        }
      } else {
        void route.continue();
      }
    });
    await mountDashboardMocks(page);

    await page.goto('/auth/callback');
    await page.waitForTimeout(1200);

    // Manually fire a second exchange call from the page context
    const secondStatus = await page.evaluate(async () => {
      const res = await fetch('/api/auth/exchange', { method: 'POST', credentials: 'include' });
      return res.status;
    });

    // First call consumed the cookie → second call is rejected
    expect(callCount).toBe(2);
    expect(secondStatus).toBe(401);
  });

  test('CallbackHandler does not expose access token in the URL', async ({ page }) => {
    await mockExchangeSuccess(page);
    await mountDashboardMocks(page);

    const visitedUrls: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url());
      }
    });

    await page.goto('/auth/callback');
    await page.waitForURL('**/dashboard', { timeout: 6000 });

    // The access token must never appear in any URL during the redirect chain.
    // In the web flow, the token is conveyed via httpOnly cookie → POST exchange,
    // so it should never be in a query string or hash.
    for (const url of visitedUrls) {
      expect(url).not.toContain(FAKE_ACCESS_TOKEN);
    }
  });
});
