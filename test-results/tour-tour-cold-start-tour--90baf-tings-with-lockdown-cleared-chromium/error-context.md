# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tour\tour-cold-start.spec.ts >> tour — cold-start happy path >> walks every step and lands on /settings with lockdown cleared
- Location: e2e\tour\tour-cold-start.spec.ts:29:7

# Error details

```
Error: Timeout 90000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active]:
  - generic:
    - generic:
      - generic:
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
        - generic:
          - img
        - generic:
          - img
        - img
      - generic:
        - complementary:
          - generic:
            - generic:
              - generic: FitGrade
              - generic:
                - generic: מדדים, לא ניחושים
            - img
          - generic:
            - generic:
              - generic: ●
              - generic: סמסטר פעיל
            - radiogroup "בחירת תצוגה":
              - radio "מחצית א'" [checked]:
                - generic: מחצית א'
              - radio "מחצית ב'":
                - generic: מחצית ב'
          - navigation "ניווט ראשי":
            - generic:
              - generic:
                - generic:
                  - link "ראשי":
                    - /url: /dashboard
                    - generic: ראשי
                    - img
                - generic:
                  - link "הכיתות שלי":
                    - /url: /classes
                    - generic: הכיתות שלי
                    - img
                - generic:
                  - link "מערכת שעות":
                    - /url: /schedule
                    - generic: מערכת שעות
                    - img
              - generic:
                - paragraph: כלים
              - generic:
                - generic:
                  - link "טבלאות הישגים":
                    - /url: /norms
                    - generic: טבלאות הישגים
                    - img
                - generic:
                  - link "הפקת דוחות":
                    - /url: /reports
                    - generic: הפקת דוחות
                    - img
              - generic:
                - paragraph: חינוך גופני
              - generic:
                - generic:
                  - link "פטורים":
                    - /url: /exemptions
                    - generic: פטורים
                    - img
                - generic:
                  - link "תלמידים מצטיינים":
                    - /url: /outstanding-students
                    - generic: תלמידים מצטיינים
                    - img
                - generic:
                  - link "אירועים וטורנירים":
                    - /url: /events
                    - generic: אירועים וטורנירים
                    - img
                - generic:
                  - link "מתכנן שיעור":
                    - /url: /exercise-bank
                    - generic: מתכנן שיעור
                    - img
            - generic:
              - generic:
                - link "הגדרות":
                  - /url: /settings
                  - generic: הגדרות
                  - img
          - generic:
            - button "התנתק מהמערכת":
              - generic: התנתק
              - img
      - main:
        - generic:
          - generic:
            - generic:
              - generic:
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
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - heading "שלום, מורה!" [level=1]
                      - generic:
                        - generic:
                          - button "הוסף תלמיד":
                            - generic:
                              - img
                            - generic: הוסף תלמיד
                          - button "תכנן שיעור":
                            - generic:
                              - img
                            - generic: תכנן שיעור
                          - button "הוסף כיתה":
                            - generic:
                              - img
                            - generic: הוסף כיתה
                    - generic:
                      - generic:
                        - img
                        - generic: אין שיעור פעיל
                  - generic:
                    - generic:
                      - generic:
                        - generic: "23"
                        - generic: ":"
                        - generic: "02"
                      - generic:
                        - img
                        - generic: יום שבת, 16 במאי 2026
                      - generic:
                        - generic: מחצית א׳ פעילה
                    - generic:
                      - generic:
                        - generic:
                          - img
                          - generic: לוח שיעורים היום
                      - generic:
                        - generic:
                          - paragraph: אין שיעורים מתוכננים להיום
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - img
                          - generic: דורש טיפול
                        - generic:
                          - generic:
                            - img
                            - generic: 3 תלמידים נעדרו השבוע מכיתה ז' 2
                          - generic:
                            - img
                            - generic: 2 תלמידים חדשים מחכים לשיבוץ
                      - generic:
                        - generic:
                          - img
                          - generic: תזכורות
                          - button "הוסף תזכורת":
                            - img
                        - generic:
                          - generic:
                            - generic:
                              - generic: לערוך מבחן ריצה לכיתה ט' 1
                            - generic: בעוד 3 ימים
                          - generic:
                            - generic:
                              - generic: לעדכן ציונים לסמסטר ב'
                            - generic: בעוד 5 ימים
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - paragraph: ממוצע כושר כללי
                          - generic:
                            - img
                        - generic:
                          - text: "78"
                          - generic:
                            - img
                            - generic: +4 מנורמה
                      - generic:
                        - generic:
                          - paragraph: נוכחות ממוצעת
                          - generic:
                            - img
                        - generic:
                          - text: 92%
                          - generic:
                            - generic: יציב לאורך הסמסטר
                      - generic:
                        - generic:
                          - paragraph: תלמידים לטיפול
                          - generic:
                            - img
                        - generic:
                          - text: "3"
                          - generic:
                            - img
                            - generic: לחץ לרשימה המלאה
                        - paragraph:
                          - text: לחץ לפרטים
                          - img
                      - generic:
                        - generic:
                          - paragraph: תוצאות חסרות
                          - generic:
                            - img
                        - generic:
                          - text: "5"
                          - generic:
                            - generic: לחץ לרשימה המלאה
                        - paragraph:
                          - text: לחץ לפרטים
                          - img
                  - generic:
                    - generic:
                      - generic:
                        - img
                      - generic:
                        - heading "אירוע קרוב" [level=2]
                        - paragraph: לוח אירועים בית-ספרי
                    - generic:
                      - generic:
                        - generic: "23"
                        - generic:
                          - paragraph: יום ספורט בית-ספרי
                          - paragraph: מאי 2026 · מגרש בית הספר
                      - generic: עוד 7 ימים
                    - link "לכל האירועים":
                      - /url: /events
                      - img
                      - text: לכל האירועים
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - generic:
                              - generic: מגמת שיפור
                            - heading "ממוצעי כיתות - מגמת שיפור" [level=2]
                            - paragraph: ביצועים לפי חודש
                          - generic:
                            - generic:
                              - generic: ח'5
                            - generic:
                              - generic: ח'2
                            - generic:
                              - generic: ט'1
                        - generic:
                          - generic:
                            - generic:
                              - img:
                                - generic:
                                  - generic:
                                    - generic:
                                      - generic: ספט׳
                                    - generic:
                                      - generic: אוק׳
                                    - generic:
                                      - generic: נוב׳
                                    - generic:
                                      - generic: דצמ׳
                                    - generic:
                                      - generic: "13"
                                    - generic:
                                      - generic: "14"
                                - generic:
                                  - generic:
                                    - generic:
                                      - generic: "50"
                                    - generic:
                                      - generic: "65"
                                    - generic:
                                      - generic: "80"
                                    - generic:
                                      - generic: "100"
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - img
                          - generic:
                            - heading "דורש טיפול" [level=2]
                            - paragraph: מבט כולל מהיר
                        - generic:
                          - button "3 מתחת לנורמה":
                            - text: "3"
                            - paragraph: מתחת לנורמה
                          - button "5 לא הוזנו":
                            - text: "5"
                            - paragraph: לא הוזנו
                          - generic:
                            - text: "74"
                            - paragraph: פעילים סה"כ
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - img
                          - generic:
                            - heading "מפגשי מבחן אחרונים" [level=2]
                            - paragraph: 5 המפגשים האחרונים שנערכו
                        - list:
                          - listitem:
                            - generic:
                              - generic: "15"
                              - generic: 05/
                            - generic:
                              - paragraph: ריצת 60 מטר
                              - paragraph: ח'5 · שישי
                            - generic: הושלם
                          - listitem:
                            - generic:
                              - generic: "14"
                              - generic: 05/
                            - generic:
                              - paragraph: קפיצה לגובה
                              - paragraph: ח'2 · חמישי
                            - generic: הושלם
  - generic:
    - alert
  - generic: "50"
  - generic:
    - generic:
      - img
```

# Test source

```ts
  55  |  *      even when isLoading flips to false (UX choice: avoid flash for fast
  56  |  *      loads). In dev mode with cold-compile this is the dominant cost.
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
  151 |   // 90s per-step budget covers the absolute worst-case dev-mode cold compile
  152 |   // (typically 5-25s per route, but can spike on first access). The seeding-
  153 |   // phase router.prefetch helps but doesn't eliminate the cost. CI runs use
  154 |   // `next start` (pre-compiled) so this only applies to local dev.
> 155 |   await expect
      |   ^ Error: Timeout 90000ms exceeded while waiting on the predicate
  156 |     .poll(
  157 |       async (): Promise<'advanced' | 'settings' | 'unchanged'> => {
  158 |         if (/\/settings(\/|$|\?)/.test(page.url())) return 'settings';
  159 |         const counter = await readStepCounter(page).catch(() => null);
  160 |         if (counter !== null && counter.index !== before.index) return 'advanced';
  161 |         return 'unchanged';
  162 |       },
  163 |       { timeout: 90_000 },
  164 |     )
  165 |     .not.toBe('unchanged');
  166 | }
  167 | 
  168 | export async function clickBack(page: Page): Promise<void> {
  169 |   await page.getByRole('button', { name: /^הקודם$/ }).click();
  170 | }
  171 | 
  172 | export async function clickSkipX(page: Page): Promise<void> {
  173 |   await page.getByRole('button', { name: 'דלג על הסיור' }).click();
  174 | }
  175 | 
  176 | /** Returns true if document.body has the lockdown class. */
  177 | export async function isTourActiveBodyClass(page: Page): Promise<boolean> {
  178 |   return page.evaluate(() => document.body.classList.contains('tour-active'));
  179 | }
  180 | 
  181 | /** Waits up to `timeout` ms for the body class to reach `expected`. */
  182 | export async function waitForTourActive(
  183 |   page: Page,
  184 |   expected: boolean,
  185 |   timeout = 2000,
  186 | ): Promise<void> {
  187 |   await expect.poll(
  188 |     async () => isTourActiveBodyClass(page),
  189 |     { timeout },
  190 |   ).toBe(expected);
  191 | }
  192 | 
```