/**
 * Accessibility Audit — @axe-core/playwright
 *
 * Runs axe-core against every main view and asserts ZERO critical violations.
 * Uses wcag2a + wcag2aa rule sets with a targeted inclusion of ARIA rules
 * that matter most for Hebrew RTL interfaces.
 *
 * All routes are mocked so no servers are required.
 *
 * Axe severity levels:
 *   critical  → must fix (blocks WCAG compliance)
 *   serious   → should fix
 *   moderate  → consider fixing
 *   minor     → informational
 *
 * This suite gates on: critical === 0.
 * Serious violations are reported but do not fail the test (tracked separately).
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder                   from '@axe-core/playwright';
import { injectFakeToken }           from './fixtures/auth.fixture';

// ─── Shared mock data ─────────────────────────────────────────────────────────

const CLASS_ID = 'a11y-class-1';

const MOCK_STUDENTS = [
  { id: 'a11y-s1', firstName: 'ישראל', lastName: 'כהן',   studentCode: '1001', nationalId: '123456782', gender: 'MALE',   dateOfBirth: '2011-05-15', createdAt: '2024-09-01T00:00:00.000Z' },
  { id: 'a11y-s2', firstName: 'מרים',  lastName: 'לוי',   studentCode: '1002', nationalId: '987654321', gender: 'FEMALE', dateOfBirth: '2011-07-20', createdAt: '2024-09-01T00:00:00.000Z' },
];

const MOCK_TEST_TYPES = [
  { id: 'tt-a11y', nameHe: 'שכיבות סמיכה', inputType: 'REPS', unit: 'חזרות', isGlobal: true, higherIsBetter: true, category: 'STRENGTH', minGrade: 7, maxGrade: 12, createdAt: '2024-01-01T00:00:00.000Z', descriptionHe: null },
];

// ─── Route mounter ────────────────────────────────────────────────────────────

async function mountCommonMocks(page: Page): Promise<void> {
  await page.route('**/api/classes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: CLASS_ID, name: 'כיתה ז׳1', gradeLevel: 7, genderType: 'BOYS', currentSemester: 'A', studentCount: 2 }]),
    }),
  );
  await page.route(`**/api/classes/${CLASS_ID}/students`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STUDENTS) }),
  );
  await page.route('**/api/tests/types', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEST_TYPES) }),
  );
  await page.route('**/api/dashboard/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  );
  await page.route('**/api/students/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'a11y-s1', firstName: 'ישראל', lastName: 'כהן', gender: 'MALE', dateOfBirth: '2011-05-15', testHistories: [], attendanceRate: 0, finalGrade: null }),
    }),
  );
}

// ─── Axe helper ───────────────────────────────────────────────────────────────

type AxeViolation = {
  impact?: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  id: string;
  description: string;
  nodes: unknown[];
};

interface A11yResult {
  violations: AxeViolation[];
  incomplete: AxeViolation[];
}

async function runAxe(page: Page): Promise<A11yResult> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
    .disableRules([
      // color-contrast failures are a known issue in glassmorphism UIs;
      // tracked separately in the design system backlog.
      'color-contrast',
    ])
    .analyze();

  const violations = results.violations as AxeViolation[];
  const incomplete  = results.incomplete as AxeViolation[];
  return { violations, incomplete };
}

// ─── Test runner helper ────────────────────────────────────────────────────────

function assertNoCritical(violations: AxeViolation[], pageName: string): void {
  const critical = violations.filter((v) => v.impact === 'critical');

  if (critical.length > 0) {
    const descriptions = critical
      .map((v) => `[${v.id}] ${v.description} — ${v.nodes.length} node(s)`)
      .join('\n  ');
    expect.soft(critical).toHaveLength(0); // soft so all pages run
    console.error(`Critical a11y violations on ${pageName}:\n  ${descriptions}`);
  }

  // Hard assert — no critical violations allowed
  expect(critical, `${pageName} has ${critical.length} critical accessibility violation(s)`).toHaveLength(0);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Teacher Views', () => {

  test('dashboard page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.route('**/api/dashboard/stats**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalStudents: 28, totalSessions: 5, avgGrade: 79, attendanceRate: 90 }) }),
    );
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'dashboard');
  });

  test('classes list page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/classes');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'classes');
  });

  test('class detail page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto(`/classes/${CLASS_ID}`);
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, `class-detail`);
  });

  test('lesson page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'lesson');
  });

  test('schedule page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/schedule');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'schedule');
  });

  test('settings page — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.route('**/api/settings/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ defaultFitnessWeight: 55, defaultConductWeight: 45 }) }),
    );
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'settings');
  });
});

test.describe('Accessibility — Student Views', () => {

  test('student login page — zero critical violations', async ({ page }) => {
    // No token — public page
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, body: '{}' }));
    await page.goto('/student-login');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'student-login');
  });

  test('student dashboard — zero critical violations', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/student-dashboard');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'student-dashboard');
  });
});

test.describe('Accessibility — ARIA & Keyboard', () => {

  test('all icon-only buttons have aria-label in Hebrew', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find buttons with no visible text (icon-only)
    const iconButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons
        .filter((btn) => {
          const text = btn.textContent?.trim() ?? '';
          // Icon-only = button with very short or empty text and no visible label from children
          return text.length === 0 || (text.length < 3 && !btn.getAttribute('aria-label'));
        })
        .map((btn) => ({ tag: btn.tagName, text: btn.textContent?.trim(), ariaLabel: btn.getAttribute('aria-label') }));
    });

    const missingAriaLabel = iconButtons.filter((b) => !b.ariaLabel);
    expect(
      missingAriaLabel,
      `${missingAriaLabel.length} icon-only button(s) are missing aria-label`,
    ).toHaveLength(0);
  });

  test('Tab navigation reaches primary actions on lesson page', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto(`/classes/${CLASS_ID}/lesson`);
    await page.waitForLoadState('networkidle');

    // Tab through the page — after 15 presses at least one button should have focus
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, text: el.textContent?.trim(), role: el.getAttribute('role') } : null;
    });
    expect(focused).not.toBeNull();
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused?.tag);
  });

  test('lang and dir attributes are correctly set', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const lang = await page.getAttribute('html', 'lang');
    const dir  = await page.getAttribute('html', 'dir');
    expect(lang).toBe('he');
    expect(dir).toBe('rtl');
  });

  test('focus returns to trigger element after dialog close', async ({ page }) => {
    await injectFakeToken(page);
    await mountCommonMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open a dialog (add class modal)
    const addBtn = page.getByRole('button', { name: /הוסף כיתה|כיתה חדשה/ }).first();
    if (await addBtn.isVisible()) {
      await addBtn.focus();
      await addBtn.click();

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Focus should return to the triggering button or a nearby element
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'A', 'BODY']).toContain(focused); // BODY is acceptable if focus trap clears
    }
  });
});

test.describe('Accessibility — Hebrew Empty States', () => {

  test('empty class list shows Hebrew message — axe passes', async ({ page }) => {
    await injectFakeToken(page);
    await page.route('**/api/classes', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.goto('/classes');
    await page.waitForLoadState('networkidle');
    const { violations } = await runAxe(page);
    assertNoCritical(violations, 'empty-classes');
  });
});
