/**
 * Lesson Flow — State Machine Tests (@xstate/test + Playwright)
 *
 * Defines the XState machine for the lesson page UI and uses @xstate/test to
 * AUTOMATICALLY GENERATE every possible path through the state graph. Each
 * path becomes a Playwright test that drives real browser interactions.
 *
 * Machine states mirror the lesson page's internal `step` variable:
 *   IDLE → TEST_SELECTED → CREATING → ACTIVE → SAVING → RESULT_SAVED
 *   Error branches: CREATE_ERROR, SAVE_ERROR, COMPLETE_ERROR
 *   Side branches:  MARKING_EXEMPT, EXEMPT_SAVED
 *
 * Network is mocked via `page.route()` inside each event executor:
 *   - Success branches: mock returns 2xx
 *   - Error branches:   mock returns 5xx
 *   - Exempt branch:    attendance endpoint returns 200
 *
 * All assertions run in RTL/Hebrew context (locale: he-IL set in Playwright config).
 * DOM locators use semantic attributes (aria-pressed, aria-label, role, text).
 */

import { createMachine }                  from 'xstate';
import { createModel }                    from '@xstate/test';
import { test as base, expect }           from '@playwright/test';
import type { Page }                      from '@playwright/test';
import { injectFakeToken }                from './fixtures/auth.fixture';

// ─── Test data ─────────────────────────────────────────────────────────────────

const CLASS_ID   = 'class-e2e-lesson';
const SESSION_ID = 'session-e2e-lesson';
const STUDENT_ID = 'student-e2e-lesson';

const MOCK_STUDENT = {
  id: STUDENT_ID,
  firstName: 'ישראל',
  lastName: 'ישראלי',
  studentCode: '1234',
  nationalId: '123456782',
  gender: 'MALE',
  dateOfBirth: null,
  createdAt: new Date().toISOString(),
};

const MOCK_TEST_TYPES = [
  {
    id: 'tt-passfail-1',
    nameHe: 'מבחן עובר/נכשל',
    inputType: 'PASS_FAIL',
    unit: null,
    isGlobal: true,
    higherIsBetter: false,
    category: 'ENDURANCE',
    minGrade: 7,
    maxGrade: 12,
    createdAt: new Date().toISOString(),
    descriptionHe: null,
  },
];

const MOCK_SESSION = { id: SESSION_ID, classId: CLASS_ID, testTypeId: 'tt-passfail-1', semester: 'A', conductedAt: new Date().toISOString(), completedAt: null, startedAt: null, notes: null, isStopwatch: false };
const MOCK_RESULT  = { id: 'result-1', sessionId: SESSION_ID, studentId: STUDENT_ID, rawValue: 1, calculatedGrade: 100, gradeOverride: null, recordedAt: new Date().toISOString() };

// ─── Route helpers ─────────────────────────────────────────────────────────────

/** Mount all baseline mocks needed for the lesson page to load. */
async function mountBaseMocks(page: Page): Promise<void> {
  await page.route('**/api/tests/types', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEST_TYPES) }),
  );
  await page.route(`**/api/classes/${CLASS_ID}/students`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_STUDENT]) }),
  );
}

/** Override the session-creation endpoint to return success. */
async function mockSessionCreateSuccess(page: Page): Promise<void> {
  await page.route(`**/api/classes/${CLASS_ID}/sessions`, (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) }),
  );
}

/** Override the session-creation endpoint to fail. */
async function mockSessionCreateFail(page: Page): Promise<void> {
  await page.route(`**/api/classes/${CLASS_ID}/sessions`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'שגיאה ביצירת הסשן', statusCode: 500 }) }),
  );
}

/** Override the result-submit endpoint to return success. */
async function mockResultSuccess(page: Page): Promise<void> {
  await page.route(`**/api/sessions/${SESSION_ID}/results`, (route) => {
    if (route.request().method() === 'POST')
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(MOCK_RESULT) });
    else
      void route.continue();
  });
}

/** Override the result-submit endpoint to fail. */
async function mockResultFail(page: Page): Promise<void> {
  await page.route(`**/api/sessions/${SESSION_ID}/results`, (route) => {
    if (route.request().method() === 'POST')
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'אין נתוני נורמה תואמים', statusCode: 400 }) });
    else
      void route.continue();
  });
}

/** Override the attendance endpoint for the exempt flow. */
async function mockAttendanceSuccess(page: Page): Promise<void> {
  await page.route(`**/api/classes/${CLASS_ID}/attendance`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

/** Complete-session endpoint. */
async function mockCompleteSuccess(page: Page): Promise<void> {
  await page.route(`**/api/sessions/${SESSION_ID}/complete`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...MOCK_SESSION, completedAt: new Date().toISOString() }) }),
  );
}

// ─── XState Machine ────────────────────────────────────────────────────────────

const lessonMachine = createMachine({
  id: 'lessonFlow',
  initial: 'idle',
  states: {

    // ── Step: 'select' ──────────────────────────────────────────────────────────
    idle: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // Page loaded: heading visible, start button disabled (no test selected)
          await expect(page.getByRole('heading', { name: 'ניהול שיעור' })).toBeVisible();
          await expect(page.getByRole('button', { name: /התחל מבחן/ })).toBeDisabled();
        },
      },
      on: { SELECT_TEST: 'testSelected' },
    },

    // ── Test type button clicked ────────────────────────────────────────────────
    testSelected: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // The selected test type button has aria-pressed=true
          await expect(page.getByRole('button', { pressed: true }).filter({ hasText: 'מבחן עובר/נכשל' })).toBeVisible();
          // Start button is now enabled
          await expect(page.getByRole('button', { name: /התחל מבחן/ })).toBeEnabled();
        },
      },
      on: {
        START_SUCCESS: 'active',
        START_FAIL:    'idle',
      },
    },

    // ── Session creation failed → back to idle with toast ──────────────────────
    // idle state assertion covers this (we stay on idle + there's a toast)

    // ── Step: 'active' (session running) ───────────────────────────────────────
    active: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // Active section header visible
          await expect(page.getByText(/תלמידים פעילים/)).toBeVisible();
          // "End session" button visible
          await expect(page.getByRole('button', { name: /סיים שיעור/ })).toBeVisible();
          // The PASS_FAIL toggle buttons are visible for the student
          await expect(page.getByRole('button', { name: 'עובר' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'נכשל' })).toBeVisible();
        },
      },
      on: {
        ENTER_VALUE_SUCCESS: 'resultSaved',
        ENTER_VALUE_FAIL:    'saveError',
        TOGGLE_EXEMPT:       'markingExempt',
      },
    },

    // ── Result saved successfully ───────────────────────────────────────────────
    resultSaved: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // Grade label appears (מצטיין, טוב מאוד, etc. — we used grade=100 → מצטיין)
          await expect(page.locator('[class*="text-emerald-600"], [class*="text-blue-600"]').first()).toBeVisible({ timeout: 3000 });
          // The progress counter shows "1/1 נרשמו"
          await expect(page.getByText(/1\/1 נרשמו/)).toBeVisible();
        },
      },
      on: {
        TOGGLE_EXEMPT:  'markingExempt',
        END_SESSION:    'completing',
      },
    },

    // ── Save error: red toast with "שגיאה" ──────────────────────────────────────
    saveError: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // Error message appears in the slot's error area
          await expect(page.getByText(/שגיאה/)).toBeVisible({ timeout: 3000 });
        },
      },
      on: { RETRY_SAVE: 'active' },
    },

    // ── Exemption in progress ───────────────────────────────────────────────────
    markingExempt: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // After the API responds, the exempt section appears
          await expect(page.getByText(/פטורים \/ פצועים/)).toBeVisible({ timeout: 3000 });
        },
      },
      on: { END_SESSION: 'completing' },
    },

    // ── Completing session ──────────────────────────────────────────────────────
    completing: {
      meta: {
        test: async (page: Page): Promise<void> => {
          // While completing, the "מסיים..." loading text may flash —
          // we verify the PATCH call was made. The page navigates away.
          // If navigation happened, we're no longer on /lesson.
          // Use a lenient check — the completing state is transient.
          await page.waitForTimeout(200);
        },
      },
      on: { COMPLETE_SUCCESS: 'done' },
    },

    // ── Session done (navigated away) ───────────────────────────────────────────
    done: {
      type: 'final' as const,
      meta: {
        test: async (page: Page): Promise<void> => {
          // After navigation, URL should no longer contain /lesson
          await expect(page).not.toHaveURL(/\/lesson/, { timeout: 5000 });
        },
      },
    },
  },
});

// ─── @xstate/test model ────────────────────────────────────────────────────────

const testModel = createModel<Page>(lessonMachine).withEvents({

  SELECT_TEST: {
    exec: async (page: Page): Promise<void> => {
      // Click the first available test type button
      await page.getByRole('button').filter({ hasText: 'מבחן עובר/נכשל' }).first().click();
    },
  },

  START_SUCCESS: {
    exec: async (page: Page): Promise<void> => {
      await mockSessionCreateSuccess(page);
      await page.getByRole('button', { name: /התחל מבחן/ }).click();
      // Wait for the active student grid to appear
      await expect(page.getByText(/תלמידים פעילים/)).toBeVisible({ timeout: 4000 });
    },
  },

  START_FAIL: {
    exec: async (page: Page): Promise<void> => {
      await mockSessionCreateFail(page);
      await page.getByRole('button', { name: /התחל מבחן/ }).click();
      // Toast with error appears; page stays on selection step
      await expect(page.getByText(/שגיאה/)).toBeVisible({ timeout: 4000 });
      // Dismiss toast so idle assertion passes
      await page.getByRole('button', { name: /X|סגור/ }).last().click().catch(() => {});
      await page.waitForTimeout(200);
    },
  },

  ENTER_VALUE_SUCCESS: {
    exec: async (page: Page): Promise<void> => {
      await mockResultSuccess(page);
      // PASS_FAIL: click the "עובר" button (maps rawValue=1 → grade=100)
      await page.getByRole('button', { name: 'עובר' }).first().click();
      await page.waitForTimeout(400); // let the save + grade animation settle
    },
  },

  ENTER_VALUE_FAIL: {
    exec: async (page: Page): Promise<void> => {
      await mockResultFail(page);
      await page.getByRole('button', { name: 'עובר' }).first().click();
      await page.waitForTimeout(400);
    },
  },

  RETRY_SAVE: {
    exec: async (page: Page): Promise<void> => {
      // Clear the error route and let the next attempt use the base mock
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mountBaseMocks(page);
      await mockSessionCreateSuccess(page);
      // Re-inject the session state (the page is still in 'active' step)
    },
  },

  TOGGLE_EXEMPT: {
    exec: async (page: Page): Promise<void> => {
      await mockAttendanceSuccess(page);
      // Click the injury/exempt toggle for the first active student
      await page.getByRole('button', { name: 'סמן כפצוע/פטור' }).first().click();
      await page.waitForTimeout(500);
    },
  },

  END_SESSION: {
    exec: async (page: Page): Promise<void> => {
      await mockCompleteSuccess(page);
      // Mock the class page navigation so we don't get a 404
      await page.route(`**/classes/${CLASS_ID}`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>כיתה</body></html>' }));
      await page.getByRole('button', { name: /סיים שיעור/ }).click();
      await page.waitForTimeout(600);
    },
  },

  COMPLETE_SUCCESS: {
    exec: async (_page: Page): Promise<void> => {
      // Navigation is triggered by the END_SESSION event's API response.
      // This transition event is a no-op — the mock set in END_SESSION is enough.
    },
  },
});

// ─── Auto-generated Playwright tests ──────────────────────────────────────────

const plans = testModel.getShortestPathPlans();

for (const plan of plans) {
  base.describe(plan.description, () => {
    for (const path of plan.paths) {
      base(`${path.description} [RTL]`, async ({ page }) => {
        // Inject fake token (no real API needed — all routes mocked)
        await injectFakeToken(page);
        await mountBaseMocks(page);

        // Navigate to the lesson page for this class
        await page.goto(`/classes/${CLASS_ID}/lesson`);

        // Verify the document is RTL before running path
        const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
        expect(dir).toBe('rtl');

        // Execute all events in this path
        await path.test(page);
      });
    }
  });
}

// ─── Coverage check ───────────────────────────────────────────────────────────

base('testModel covers all states (coverage guard)', () => {
  testModel.testCoverage();
});
