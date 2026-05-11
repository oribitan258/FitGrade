# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tour\tour-network-isolation.spec.ts >> tour — network isolation >> no tour-mocked endpoint leaks to real API during the tour
- Location: e2e\tour\tour-network-isolation.spec.ts:42:7

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
  57  |  *   2. Exit animation — 600 ms opacity/scale fade after canHide=true. The
  58  |  *      <AnimatePresence> wrapper only unmounts the child after this completes.
  59  |  *
  60  |  * Total minimum: ~4.1 s in production, plus whatever cold-compile time the
  61  |  * dev server adds. We poll for the role="status" / aria-label match to be
  62  |  * fully detached from the DOM — that signal corresponds to the
  63  |  * AnimatePresence unmount, after which clicks behind the splash succeed.
  64  |  */
  65  | export async function waitForSplashGone(page: Page, timeout = 30_000): Promise<void> {
  66  |   await page.getByRole('status', { name: /טוען את FitGrade/ }).waitFor({
  67  |     state: 'detached',
  68  |     timeout,
  69  |   });
  70  | }
  71  | 
  72  | /**
  73  |  * Full per-test setup: fake token + stubbed /auth/me + navigation to welcome.
  74  |  * Returns once the SplashScreen has fully unmounted AND the welcome button
  75  |  * is visible. Both checks are required — the button is rendered in the DOM
  76  |  * before the splash exits, so visibility alone is not a signal of clickability.
  77  |  */
  78  | export async function gotoWelcomePage(page: Page): Promise<void> {
  79  |   await injectFakeToken(page);
  80  |   await stubBaseRoutes(page);
  81  |   await page.goto('/onboarding/welcome');
  82  |   await waitForSplashGone(page);
  83  |   await expect(page.getByRole('button', { name: /התחל סיור מודרך/ })).toBeVisible();
  84  | }
  85  | 
  86  | /**
  87  |  * Click the welcome page's primary CTA and wait for the tour to be fully
  88  |  * running on step 0.
  89  |  *
  90  |  * Four signals in sequence:
  91  |  *   1. The SplashScreen has fully unmounted (defence in depth — also waited
  92  |  *      for in gotoWelcomePage, but if this helper is called from another
  93  |  *      page.goto path, the wait covers that too).
  94  |  *   2. The startTour click resolves.
  95  |  *   3. body.tour-active appears — the machine has left 'idle'. This proves
  96  |  *      the dispatch landed even if the first route is still cold-compiling.
  97  |  *   4. The tooltip step counter renders — the machine reached 'running'.
  98  |  */
  99  | export async function startTour(page: Page): Promise<void> {
  100 |   await waitForSplashGone(page);
  101 |   await page.getByRole('button', { name: /התחל סיור מודרך/ }).click();
  102 |   await expect
  103 |     .poll(() => page.evaluate(() => document.body.classList.contains('tour-active')), {
  104 |       timeout: 10_000,
  105 |     })
  106 |     .toBe(true);
  107 |   await expectTooltipVisible(page);
  108 | }
  109 | 
  110 | /**
  111 |  * Tooltip selector — TourTooltip is rendered with dir="rtl" and contains the
  112 |  * step counter "שלב {N} מתוך {SIZE}". We match the counter pattern as the
  113 |  * stable signal that the tooltip is rendered (vs the spotlight overlay which
  114 |  * may exist transiently between steps).
  115 |  *
  116 |  * Inherits the global expect timeout (15 s) so a slow dev-compile crossing
  117 |  * has time to settle before this assertion gives up.
  118 |  */
  119 | export async function expectTooltipVisible(page: Page): Promise<void> {
  120 |   await expect(page.getByText(/שלב \d+ מתוך \d+/)).toBeVisible();
  121 | }
  122 | 
  123 | /** Returns the 1-based step counter shown in the tooltip. */
  124 | export async function readStepCounter(page: Page): Promise<{ index: number; size: number }> {
  125 |   const text = await page.getByText(/שלב \d+ מתוך \d+/).first().textContent();
  126 |   const m = text?.match(/שלב (\d+) מתוך (\d+)/);
  127 |   if (!m) throw new Error(`Could not parse step counter: ${text ?? '(empty)'}`);
  128 |   return { index: Number(m[1]), size: Number(m[2]) };
  129 | }
  130 | 
  131 | /**
  132 |  * Click the tooltip's primary action and wait until either the step counter
  133 |  * advances OR the URL lands on /settings (final step).
  134 |  *
  135 |  * The naive variant — click and return — assumes the next step's tooltip is
  136 |  * already in the DOM. In dev mode the destination route may still be
  137 |  * compiling when the click fires, so we must poll the post-click state.
  138 |  *
  139 |  * The wait resolves on one of:
  140 |  *   • counter index strictly greater than the pre-click index
  141 |  *   • URL pathname matches /settings (Joyride 'last' button fires here)
  142 |  */
  143 | export async function clickNext(page: Page): Promise<void> {
  144 |   // "הבא" or "למסך ההגדרות" — on the last step the primary action changes.
  145 |   const before = await readStepCounter(page).catch(() => null);
  146 |   const next = page.getByRole('button', { name: /^הבא$|^למסך ההגדרות$/ });
  147 |   await next.click();
  148 | 
  149 |   if (before === null) return;
  150 | 
  151 |   // 30s is a deliberately generous budget for Next.js dev-mode cold compile
  152 |   // of a cross-route destination. The seeding-phase router.prefetch in
  153 |   // TourProvider mitigates this, but a teacher's first walk over a fresh
  154 |   // dev server can still spike past 15s on routes like /reports and /norms.
  155 |   // CI builds use `next start` (no per-route compile) so this never bites
  156 |   // there — only local dev runs need the longer wait.
> 157 |   await expect
      |   ^ Error: Timeout 30000ms exceeded while waiting on the predicate
  158 |     .poll(
  159 |       async (): Promise<'advanced' | 'settings' | 'unchanged'> => {
  160 |         if (/\/settings(\/|$|\?)/.test(page.url())) return 'settings';
  161 |         const counter = await readStepCounter(page).catch(() => null);
  162 |         if (counter !== null && counter.index !== before.index) return 'advanced';
  163 |         return 'unchanged';
  164 |       },
  165 |       { timeout: 30_000 },
  166 |     )
  167 |     .not.toBe('unchanged');
  168 | }
  169 | 
  170 | export async function clickBack(page: Page): Promise<void> {
  171 |   await page.getByRole('button', { name: /^הקודם$/ }).click();
  172 | }
  173 | 
  174 | export async function clickSkipX(page: Page): Promise<void> {
  175 |   await page.getByRole('button', { name: 'דלג על הסיור' }).click();
  176 | }
  177 | 
  178 | /** Returns true if document.body has the lockdown class. */
  179 | export async function isTourActiveBodyClass(page: Page): Promise<boolean> {
  180 |   return page.evaluate(() => document.body.classList.contains('tour-active'));
  181 | }
  182 | 
  183 | /** Waits up to `timeout` ms for the body class to reach `expected`. */
  184 | export async function waitForTourActive(
  185 |   page: Page,
  186 |   expected: boolean,
  187 |   timeout = 2000,
  188 | ): Promise<void> {
  189 |   await expect.poll(
  190 |     async () => isTourActiveBodyClass(page),
  191 |     { timeout },
  192 |   ).toBe(expected);
  193 | }
  194 | 
```