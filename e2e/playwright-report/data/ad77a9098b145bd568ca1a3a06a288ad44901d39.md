# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tour\tour-state-machine-integrity.spec.ts >> tour — state machine integrity >> rapid Next clicks advance one step per click
- Location: e2e\tour\tour-state-machine-integrity.spec.ts:27:7

# Error details

```
Error: Timeout 30000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]: "50"
  - main [ref=e4]:
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic:
      - img
    - generic [ref=e6]:
      - generic [ref=e7]:
        - img "FitGrade" [ref=e8]
        - heading "FitGrade" [level=1] [ref=e9]
        - paragraph [ref=e10]: מערכת ניהול ציונים לחינוך גופני
      - generic [ref=e11]:
        - generic [ref=e12]:
          - paragraph [ref=e13]: כניסה למורים
          - heading "ברוכים הבאים" [level=2] [ref=e14]
          - paragraph [ref=e15]: התחברו עם חשבון Google שלכם
        - link "כניסה עם חשבון Google" [ref=e16] [cursor=pointer]:
          - /url: http://localhost:3001/api/auth/google
          - img [ref=e17]
          - text: כניסה עם Google
        - generic [ref=e24]: או
        - generic [ref=e26]:
          - button "Dev Login (Bypass)" [ref=e27] [cursor=pointer]
          - generic [ref=e28] [cursor=pointer]:
            - checkbox "Simulate First Login (resets onboarding)" [ref=e29]
            - text: Simulate First Login (resets onboarding)
        - paragraph [ref=e30]:
          - link "כניסה לתלמידים" [ref=e31] [cursor=pointer]:
            - /url: /student-login
```

# Test source

```ts
  1  | /**
  2  |  * Tier 3.2 — state machine integrity under stress.
  3  |  *
  4  |  * Covered scenarios:
  5  |  *   • Rapid Next clicks must advance exactly once per click (no skip / dup).
  6  |  *   • Mid-tour reload — body class must be cleared and no half-state remains.
  7  |  *   • Mid-tour browser back — tour either resumes gracefully or terminates,
  8  |  *     never leaves a stuck overlay.
  9  |  *   • Skip via the X button tears down to clean state.
  10 |  *   • Re-entry from welcome → tour after a completed/skipped run renders
  11 |  *     step 0 cleanly with no leftover DOM.
  12 |  */
  13 | 
  14 | import { test, expect } from '@playwright/test';
  15 | import {
  16 |   gotoWelcomePage,
  17 |   startTour,
  18 |   clickNext,
  19 |   clickSkipX,
  20 |   readStepCounter,
  21 |   isTourActiveBodyClass,
  22 |   expectTooltipVisible,
  23 |   waitForTourActive,
  24 | } from './_helpers';
  25 | 
  26 | test.describe('tour — state machine integrity', () => {
  27 |   test('rapid Next clicks advance one step per click', async ({ page }) => {
  28 |     test.setTimeout(120_000);
  29 |     await gotoWelcomePage(page);
  30 |     await startTour(page);
  31 | 
  32 |     // Fire 4 next clicks within ~250 ms.
  33 |     for (let i = 0; i < 4; i++) {
  34 |       await page.getByRole('button', { name: /^הבא$/ }).click({ delay: 0 });
  35 |     }
  36 | 
  37 |     // Wait for the tooltip on the 5th step. Dev-mode cold compile applies
  38 |     // to every cross-route crossing the rapid clicks induce, so we use the
  39 |     // same 30s budget as `clickNext` rather than the original 8s.
> 40 |     await expect.poll(async () => {
     |     ^ Error: Timeout 30000ms exceeded while waiting on the predicate
  41 |       try {
  42 |         return (await readStepCounter(page)).index;
  43 |       } catch {
  44 |         return 0;
  45 |       }
  46 |     }, { timeout: 30_000 }).toBe(5);
  47 |   });
  48 | 
  49 |   test('mid-tour page reload clears body class and idles the machine', async ({ page }) => {
  50 |     await gotoWelcomePage(page);
  51 |     await startTour(page);
  52 | 
  53 |     // Advance a few steps so we're not on welcome.
  54 |     await clickNext(page);
  55 |     await clickNext(page);
  56 |     await expectTooltipVisible(page);
  57 |     expect(await isTourActiveBodyClass(page)).toBe(true);
  58 | 
  59 |     await page.reload();
  60 | 
  61 |     // A reload destroys the in-memory machine state. body must be clean.
  62 |     await waitForTourActive(page, false, 2000);
  63 |     // No tooltip should be present after reload.
  64 |     await expect(page.getByText(/שלב \d+ מתוך \d+/)).toHaveCount(0);
  65 |   });
  66 | 
  67 |   test('skip via X button removes overlay, lockdown, and stops tour', async ({ page }) => {
  68 |     await gotoWelcomePage(page);
  69 |     await startTour(page);
  70 |     await clickNext(page);
  71 |     await clickNext(page);
  72 | 
  73 |     expect(await isTourActiveBodyClass(page)).toBe(true);
  74 |     await clickSkipX(page);
  75 | 
  76 |     await waitForTourActive(page, false, 2000);
  77 |     await expect(page.getByText(/שלב \d+ מתוך \d+/)).toHaveCount(0);
  78 |   });
  79 | 
  80 |   test('re-entry after completion starts cleanly from step 0', async ({ page }) => {
  81 |     await gotoWelcomePage(page);
  82 |     await startTour(page);
  83 | 
  84 |     // Skip immediately.
  85 |     await clickSkipX(page);
  86 |     await waitForTourActive(page, false, 2000);
  87 | 
  88 |     // Return to welcome and start again — must render step 0 cleanly.
  89 |     // Use startTour (not a direct button click) so the helper's splash-gone
  90 |     // wait covers the freshly remounted SplashScreen on this second visit.
  91 |     await page.goto('/onboarding/welcome');
  92 |     await startTour(page);
  93 |     const { index } = await readStepCounter(page);
  94 |     expect(index).toBe(1);
  95 |     expect(await isTourActiveBodyClass(page)).toBe(true);
  96 |   });
  97 | });
  98 | 
```