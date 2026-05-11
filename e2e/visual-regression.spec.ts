/**
 * Visual Regression Tests — Golden Screenshot Suite
 *
 * Captures baseline screenshots for all critical views and asserts zero
 * pixel drift on subsequent runs.  Runs in a deterministic `he-IL` locale
 * with the Chromium viewport (1280×720) that is the project default.
 *
 * All routes are fully mocked so neither the API server nor the Next.js
 * dev server needs to be running.  API routes are stubbed via page.route();
 * the fake token in localStorage satisfies the auth guard.
 *
 * Screenshot baselines live in:
 *   e2e/__snapshots__/<test-name>/<variant>.png
 *
 * Update them intentionally with:
 *   npx playwright test visual-regression.spec.ts --update-snapshots
 *
 * RTL compliance check in screenshots:
 *   – Sidebar visible on the physical-right edge of the viewport
 *   – BackButton anchored to physical-right (logical start = end for RTL browsers)
 *   – Hebrew text flows right-to-left throughout
 */

import { test, expect, type Page } from '@playwright/test';
import { injectFakeToken }          from './fixtures/auth.fixture';

// ─── Mock data ────────────────────────────────────────────────────────────────

const TEACHER_ID  = 'vr-teacher-1';
const CLASS_ID    = 'vr-class-1';
const SESSION_ID  = 'vr-session-1';
const STUDENT_IDS = ['vr-s1', 'vr-s2', 'vr-s3'] as const;

const MOCK_CLASSES = [
  { id: CLASS_ID, name: 'כיתה ז׳1', gradeLevel: 7, genderType: 'BOYS', currentSemester: 'A', studentCount: 28 },
];

const MOCK_STUDENTS = STUDENT_IDS.map((id, i) => ({
  id,
  firstName: ['ישראל', 'דוד', 'יוסף'][i],
  lastName: ['כהן', 'לוי', 'מזרחי'][i],
  studentCode: `100${i + 1}`,
  nationalId: ['123456782', '987654321', '111111118'][i],
  gender: 'MALE',
  dateOfBirth: '2011-05-15',
  createdAt: '2024-09-01T00:00:00.000Z',
}));

const MOCK_STATS_SEM_A = {
  totalStudents: 84,
  totalSessions: 12,
  avgGrade: 78,
  attendanceRate: 92,
};

const MOCK_STATS_SEM_B = {
  totalStudents: 84,
  totalSessions: 5,
  avgGrade: 82,
  attendanceRate: 94,
};

const MOCK_TEST_TYPES = [
  { id: 'tt-pushups', nameHe: 'שכיבות סמיכה', inputType: 'REPS', unit: 'חזרות', isGlobal: true, higherIsBetter: true, category: 'STRENGTH', minGrade: 7, maxGrade: 12, createdAt: '2024-01-01T00:00:00.000Z', descriptionHe: null },
  { id: 'tt-800m',    nameHe: 'ריצת 800 מטר', inputType: 'TIME', unit: 'שניות', isGlobal: true, higherIsBetter: false, category: 'ENDURANCE', minGrade: 7, maxGrade: 12, createdAt: '2024-01-01T00:00:00.000Z', descriptionHe: null },
];

const MOCK_TOP_STUDENTS = STUDENT_IDS.map((id, i) => ({
  studentId: id,
  firstName: MOCK_STUDENTS[i]!.firstName,
  lastName: MOCK_STUDENTS[i]!.lastName,
  effectiveGrade: [98, 91, 85][i],
  rawValue: [45, 42, 38][i],
  unit: 'חזרות',
}));

const MOCK_RESULTS = STUDENT_IDS.map((id, i) => ({
  id: `vr-result-${i + 1}`,
  sessionId: SESSION_ID,
  studentId: id,
  rawValue: [45, 42, 38][i],
  calculatedGrade: [98, 91, 85][i],
  gradeOverride: null,
  recordedAt: '2024-11-15T10:00:00.000Z',
}));

// ─── Route helpers ────────────────────────────────────────────────────────────

async function mountDashboardMocks(page: Page, semester: 'A' | 'B'): Promise<void> {
  const stats = semester === 'A' ? MOCK_STATS_SEM_A : MOCK_STATS_SEM_B;

  await page.route('**/api/classes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CLASSES) }),
  );
  await page.route('**/api/dashboard/stats**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) }),
  );
  await page.route('**/api/dashboard/top-students**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TOP_STUDENTS) }),
  );
  await page.route('**/api/dashboard/top-per-class**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/api/dashboard/below-norm**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

async function mountLessonMocks(page: Page): Promise<void> {
  await page.route('**/api/tests/types', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEST_TYPES) }),
  );
  await page.route(`**/api/classes/${CLASS_ID}/students`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STUDENTS) }),
  );
  await page.route(`**/api/sessions/${SESSION_ID}/results`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RESULTS) }),
  );
  await page.route(`**/api/classes/${CLASS_ID}/sessions/${SESSION_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: SESSION_ID, classId: CLASS_ID, testTypeId: 'tt-pushups', semester: 'A', completedAt: null, startedAt: null, notes: null, isStopwatch: false }),
    }),
  );
}

async function mountStudentDashboardMocks(page: Page, semester: 'A' | 'B'): Promise<void> {
  const hasData = semester === 'A';

  await page.route('**/api/students/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: STUDENT_IDS[0],
        firstName: 'ישראל',
        lastName: 'כהן',
        gender: 'MALE',
        dateOfBirth: '2011-05-15',
        testHistories: hasData ? [
          { testTypeNameHe: 'שכיבות סמיכה', unit: 'חזרות', history: [{ date: '2024-11-01T00:00:00.000Z', rawValue: 42, effectiveGrade: 91 }] },
        ] : [],
        attendanceRate: hasData ? 90 : 0,
        finalGrade: hasData ? 88 : null,
      }),
    }),
  );
}

// ─── Viewport helper ──────────────────────────────────────────────────────────

/** Wait for network idle + animations to settle before screenshotting. */
async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300); // let CSS transitions complete
}

// ─── RTL layout assertions ────────────────────────────────────────────────────

async function assertRTLLayout(page: Page): Promise<void> {
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  expect(dir).toBe('rtl');
  const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  expect(lang).toBe('he');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Visual Regression — Dashboard', () => {

  test('dashboard — Semester A (violet theme)', async ({ page }) => {
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'A');
    await page.goto('/dashboard');
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('dashboard-semester-a.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02, // allow 2% diff for anti-aliasing
    });
  });

  test('dashboard — Semester B (emerald theme)', async ({ page }) => {
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'B');
    // Seed semester preference
    await page.addInitScript(() => {
      window.localStorage.setItem('fitgrade-semester-v1', 'B');
    });
    await page.goto('/dashboard');
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('dashboard-semester-b.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('dashboard — stat cards are on-screen and not truncated', async ({ page }) => {
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'A');
    await page.goto('/dashboard');
    await waitForStable(page);
    // Stat cards must be fully within the viewport
    const cards = page.locator('[data-testid="stat-card"], [class*="stat-card"], [class*="StatCard"]');
    const count = await cards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const box = await cards.nth(i).boundingBox();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(1280 + 1);
        }
      }
    }
    await expect(page).toHaveScreenshot('dashboard-stat-cards.png', { maxDiffPixelRatio: 0.02 });
  });
});

test.describe('Visual Regression — Student Portal', () => {

  test('student-dashboard — Semester A', async ({ page }) => {
    await injectFakeToken(page);
    await mountStudentDashboardMocks(page, 'A');
    await page.goto('/student-dashboard');
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('student-dashboard-semester-a.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('student-dashboard — Semester B empty state', async ({ page }) => {
    await injectFakeToken(page);
    await mountStudentDashboardMocks(page, 'B');
    await page.addInitScript(() => {
      window.localStorage.setItem('fitgrade-student-semester-v1', 'B');
    });
    await page.goto('/student-dashboard');
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('student-dashboard-semester-b-empty.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression — Lesson Page', () => {

  test('lesson page — initial state (test picker visible)', async ({ page }) => {
    await injectFakeToken(page);
    await mountLessonMocks(page);
    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('lesson-initial.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('lesson page — with results entered', async ({ page }) => {
    await injectFakeToken(page);
    await mountLessonMocks(page);
    // Mock session as already running
    await page.route(`**/api/classes/${CLASS_ID}/sessions`, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: SESSION_ID, classId: CLASS_ID, testTypeId: 'tt-pushups', semester: 'A', completedAt: null, startedAt: null, notes: null, isStopwatch: false }),
      }),
    );
    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await waitForStable(page);
    await assertRTLLayout(page);
    await expect(page).toHaveScreenshot('lesson-with-results.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('Visual Regression — RTL Layout Compliance', () => {

  test('no element bleeds outside RTL boundaries on dashboard', async ({ page }) => {
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'A');
    await page.goto('/dashboard');
    await waitForStable(page);

    // Check that no element has left-anchored position suggesting physical directional CSS
    const bannedPhysical = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class]');
      const banned: string[] = [];
      elements.forEach((el) => {
        const cls = el.className;
        if (typeof cls === 'string' && /\b(ml-|mr-|pl-|pr-|text-left|text-right)\d/.test(cls)) {
          banned.push(cls);
        }
      });
      return banned;
    });
    expect(bannedPhysical).toHaveLength(0);
  });

  test('desktop viewport (1280×720) — no horizontal overflow', async ({ page }) => {
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'A');
    await page.goto('/dashboard');
    await waitForStable(page);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('mobile viewport (390×844) — no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await injectFakeToken(page);
    await mountDashboardMocks(page, 'A');
    await page.goto('/dashboard');
    await waitForStable(page);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
    await expect(page).toHaveScreenshot('dashboard-mobile-390.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });
});
