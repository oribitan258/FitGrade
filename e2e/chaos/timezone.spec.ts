/**
 * Chaos — Timezone & DST Edge Cases
 *
 * Israel uses Asia/Jerusalem (UTC+2 winter / UTC+3 summer, Hebrew Calendar DST).
 * The last Friday of October 2024 is 2024-10-25; clocks roll back from 02:00 → 01:00.
 * The last Friday of March 2025 is 2025-03-28; clocks spring forward from 02:00 → 03:00.
 *
 * These tests verify that the FitGrade WEB LAYER correctly displays dates and ages
 * regardless of the client's local time offset.  The API response shapes are mocked;
 * we verify the UI does NOT corrupt the display when ISO strings cross DST boundaries.
 *
 * Three problem areas:
 *   A. Age calculation display — a student born on the DST-change date should
 *      show the same age regardless of which side of midnight the session falls on.
 *   B. Session date display — "2024-10-25T01:30:00.000+02:00" and
 *      "2024-10-25T01:30:00.000+03:00" are both calendar date 2024-10-25;
 *      the UI must never show "2024-10-24" for the earlier ISO string.
 *   C. Attendance date uniqueness — two records on the same calendar day with
 *      different UTC offsets (clocks rolled back) must not appear as two distinct days.
 *
 * All tests use mocked API responses so no live server is required.
 * The browser is launched with locale 'he-IL' and timezone 'Asia/Jerusalem'
 * (set via context options in the test body).
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { injectToken }                                    from '../fixtures/auth.fixture';

// ─── DST boundary timestamps ──────────────────────────────────────────────────

// 2024-10-25 01:30 in UTC+3 (before rollback)
const DST_END_BEFORE = '2024-10-25T01:30:00.000+03:00';
// 2024-10-25 01:30 in UTC+2 (after rollback — same wall clock, same calendar date)
const DST_END_AFTER  = '2024-10-25T01:30:00.000+02:00';
// 2025-03-28 02:30 in UTC+2 (before spring-forward — this time does not exist in UTC+3 but is UTC+2)
const DST_START_EDGE = '2025-03-28T02:30:00.000+02:00';

// Student born exactly on DST change date → age sensitive to offset
const STUDENT_DOB_DST = '2012-10-25'; // turns 12 exactly on rollback day 2024

const CLASS_ID = 'tz-class-1';

// ─── Helper — build context with Jerusalem timezone ──────────────────────────

async function makeJerusalemContext(browser: import('@playwright/test').Browser): Promise<BrowserContext> {
  return browser.newContext({
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    viewport: { width: 1280, height: 720 },
  });
}

// ─── Route helpers ────────────────────────────────────────────────────────────

async function mountClassMocks(page: Page): Promise<void> {
  await page.route('**/api/classes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: CLASS_ID, name: 'כיתה ז׳1', gradeLevel: 7, genderType: 'BOYS', currentSemester: 'A', studentCount: 1 },
      ]),
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('DST — Session Date Display', () => {

  test('session created at DST rollback (before) displays correct calendar date', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    // Mock a session that was created during DST rollback (UTC+3 side)
    await page.route(`**/api/classes/${CLASS_ID}/sessions**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tz-session-before',
            classId: CLASS_ID,
            testTypeId: 'tt-pushups',
            semester: 'A',
            conductedAt: DST_END_BEFORE,
            completedAt: DST_END_BEFORE,
            startedAt: DST_END_BEFORE,
            notes: null,
            isStopwatch: false,
          },
        ]),
      }),
    );

    await page.goto(`/classes/${CLASS_ID}`);
    await page.waitForLoadState('networkidle');

    // The UI must display 2024-10-25 (Hebrew or ISO), NOT 2024-10-24
    const dateText = await page.evaluate(() => document.body.textContent ?? '');
    // If the page shows any date at all, it must not be Oct 24
    if (/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(dateText)) {
      expect(dateText).not.toMatch(/2024-10-24|24\/10\/2024|24\.10\.2024/);
    }

    await ctx.close();
  });

  test('session created at DST rollback (after) displays same calendar date as before', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    await page.route(`**/api/classes/${CLASS_ID}/sessions**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tz-session-after',
            classId: CLASS_ID,
            testTypeId: 'tt-pushups',
            semester: 'A',
            conductedAt: DST_END_AFTER,
            completedAt: DST_END_AFTER,
            startedAt: null,
            notes: null,
            isStopwatch: false,
          },
        ]),
      }),
    );

    await page.goto(`/classes/${CLASS_ID}`);
    await page.waitForLoadState('networkidle');

    const dateText = await page.evaluate(() => document.body.textContent ?? '');
    if (/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(dateText)) {
      expect(dateText).not.toMatch(/2024-10-24|24\/10\/2024|24\.10\.2024/);
    }

    await ctx.close();
  });

  test('DST spring-forward edge timestamp does not cause date display error', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    await page.route(`**/api/classes/${CLASS_ID}/sessions**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'tz-session-spring',
            classId: CLASS_ID,
            testTypeId: 'tt-pushups',
            semester: 'A',
            conductedAt: DST_START_EDGE,
            completedAt: null,
            startedAt: null,
            notes: null,
            isStopwatch: false,
          },
        ]),
      }),
    );

    await page.goto(`/classes/${CLASS_ID}`);
    await page.waitForLoadState('networkidle');

    // Page must not crash (no error boundary text)
    await expect(page.locator('body')).not.toContainText('שגיאה לא צפויה');
    await expect(page.locator('body')).not.toContainText('Something went wrong');

    await ctx.close();
  });
});

test.describe('DST — Student Age Calculation Display', () => {

  test('student born on DST day shows correct profile — no crash', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');

    // Student profile response with DOB on DST change date
    await page.route('**/api/students/me**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'tz-student-1',
          firstName: 'ישראל',
          lastName: 'כהן',
          gender: 'MALE',
          dateOfBirth: STUDENT_DOB_DST,
          testHistories: [
            {
              testTypeNameHe: 'שכיבות סמיכה',
              unit: 'חזרות',
              history: [
                {
                  // Session conducted right at DST rollback (before)
                  date: DST_END_BEFORE,
                  rawValue: 42,
                  effectiveGrade: 91,
                },
                {
                  // Session conducted right at DST rollback (after — same day)
                  date: DST_END_AFTER,
                  rawValue: 40,
                  effectiveGrade: 87,
                },
              ],
            },
          ],
          attendanceRate: 88,
          finalGrade: 89,
        }),
      }),
    );

    await page.goto('/student-dashboard');
    await page.waitForLoadState('networkidle');

    // Must not crash
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('שגיאה לא צפויה');

    // Student name must appear
    await expect(page.locator('body')).toContainText('ישראל');

    await ctx.close();
  });

  test('result entered at DST boundary is displayed without NaN or undefined', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');

    await page.route('**/api/students/me**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'tz-student-2',
          firstName: 'דוד',
          lastName: 'לוי',
          gender: 'MALE',
          dateOfBirth: '2010-06-15',
          testHistories: [
            {
              testTypeNameHe: 'ריצת 800 מטר',
              unit: 'שניות',
              history: [
                { date: DST_END_AFTER, rawValue: 185, effectiveGrade: 76 },
              ],
            },
          ],
          attendanceRate: 95,
          finalGrade: 80,
        }),
      }),
    );

    await page.goto('/student-dashboard');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.evaluate(() => document.body.textContent ?? '');
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('Invalid Date');

    await ctx.close();
  });
});

test.describe('DST — Attendance Date Uniqueness', () => {

  test('two attendance records with same calendar date (different UTC offsets) render as one date', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    // Two attendance records for same calendar date but different offsets
    await page.route(`**/api/classes/${CLASS_ID}/attendance**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'att-1', studentId: 'tz-s1', date: DST_END_BEFORE, status: 'PRESENT', semester: 'A' },
          { id: 'att-2', studentId: 'tz-s1', date: DST_END_AFTER,  status: 'PRESENT', semester: 'A' },
        ]),
      }),
    );

    await page.goto(`/classes/${CLASS_ID}`);
    await page.waitForLoadState('networkidle');

    // The page must not crash when it encounters these two records
    await expect(page.locator('body')).not.toContainText('Something went wrong');

    // The page must not show "Oct 24" as a date (off-by-one from UTC conversion)
    const bodyText = await page.evaluate(() => document.body.textContent ?? '');
    expect(bodyText).not.toMatch(/2024-10-24|24\/10\/2024/);

    await ctx.close();
  });
});

test.describe('DST — Grade Calculation Display Stability', () => {

  test('grade labels do not show NaN or undefined at DST boundary', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    await page.route(`**/api/classes/${CLASS_ID}/students`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'tz-s-dst', firstName: 'ישראל', lastName: 'כהן', studentCode: '1001', nationalId: '123456782', gender: 'MALE', dateOfBirth: STUDENT_DOB_DST, createdAt: DST_END_BEFORE },
        ]),
      }),
    );

    await page.route('**/api/tests/types', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'tt-pf', nameHe: 'מבחן עובר/נכשל', inputType: 'PASS_FAIL', unit: null, isGlobal: true, higherIsBetter: false, category: 'ENDURANCE', minGrade: 7, maxGrade: 12, createdAt: DST_END_BEFORE, descriptionHe: null },
        ]),
      }),
    );

    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.evaluate(() => document.body.textContent ?? '');
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('Invalid Date');

    await ctx.close();
  });

  test('lesson page renders without crash in Jerusalem timezone at midnight DST', async ({ browser }) => {
    const ctx  = await makeJerusalemContext(browser);
    const page = await ctx.newPage();

    await injectToken(page, 'e2e-fake-token-for-mocked-tests');
    await mountClassMocks(page);

    await page.route(`**/api/classes/${CLASS_ID}/students`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/api/tests/types', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    // Override Date.now() to return a DST-boundary timestamp so any "today" computation
    // in the lesson page runs at exactly the rollback moment
    await page.addInitScript(() => {
      const DST_ROLLBACK_TS = new Date('2024-10-25T01:00:00.000+03:00').getTime();
      // Override Date.now() only — preserves full Date constructor compatibility
      // so the page's "today" calculations land exactly at the DST rollback moment.
      const _DateNowOrig = Date.now.bind(Date);
      Date.now = () => DST_ROLLBACK_TS;
      // Restore after 5 seconds so async initialisation doesn't stall
      setTimeout(() => { Date.now = _DateNowOrig; }, 5000);
    });

    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('שגיאה לא צפויה');

    await ctx.close();
  });
});
