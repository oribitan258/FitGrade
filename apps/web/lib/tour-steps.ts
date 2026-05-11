import type { Step } from 'react-joyride';

export interface TourStep extends Step {
  route?:           string;
  /** TourProvider resolves this to /classes/{TOUR_DEMO_CLASS_ID} at runtime. */
  dynamicRoute?:    boolean;
  spotlightClicks?: boolean;
  /** Disable the dark overlay for this specific step. */
  disableOverlay?:  boolean;
  /**
   * Identifier for the page this step lives on. The tour state machine
   * waits in 'awaiting-page-ready' until a useEffect inside that page calls
   * `useTour().signalPageReady(routeKey)` — this guarantees the page's data
   * hooks have populated before Joyride starts looking for the target.
   */
  routeKey:         string;
  /**
   * Legacy v2-named flag. react-joyride v3 renamed this to `skipBeacon`
   * (also true on every step). We carry both for belt-and-suspenders —
   * libraries occasionally retain legacy aliases, and an unknown prop is
   * silently ignored regardless. The structural beacon kill in globals.css
   * is the actual guarantee.
   */
  disableBeacon?:   boolean;
}

// Base step definitions — disableBeacon is injected uniformly via .map()
// below so a forgotten flag on a future step is structurally impossible.
const TOUR_STEPS_BASE: TourStep[] = [
  // ── 0: Dashboard — welcome ────────────────────────────────────────────
  {
    route:      '/dashboard',
    routeKey:   'dashboard',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'ברוכים לדשבורד שלך 👋',
    content:
      'זהו מרכז הפיקוד שלך — ריכוז מיידי של נתוני כל הכיתות: ממוצעי כושר, נוכחות, אירועים קרובים, ותלמידים הדורשים תשומת לב. הכל בעדכון שוטף.',
  },

  // ── 1: Dashboard — KPI stats ──────────────────────────────────────────
  {
    route:      '/dashboard',
    routeKey:   'dashboard',
    target:     '[data-tour="dashboard-stats"]',
    placement:  'bottom',
    skipBeacon: true,
    title:      'כרטיסי ביצועים (KPI)',
    content:
      'ארבעת הכרטיסים מסכמים את כלל הכיתות: ממוצע כושר מול נורמת משרד החינוך, אחוז נוכחות, מספר תלמידים מתחת לנורמה, ותוצאות חסרות. לחיצה על כרטיס פותחת רשימה מיידית לפעולה.',
  },

  // ── 2: Dashboard — alerts (large card — tooltip above so it never overlaps)
  {
    route:      '/dashboard',
    routeKey:   'dashboard',
    target:     '[data-tour="dashboard-alerts"]',
    placement:  'top',
    skipBeacon: true,
    title:      'תלמידים הדורשים טיפול',
    content:
      'המערכת מזהה אוטומטית תלמידים שציוניהם נמוכים מהנורמה וכיתות עם תוצאות שלא הוזנו. לחיצה על כל תא מציגה רשימה מפורטת — ללא חיפוש ידני.',
  },

  // ── 3: Dashboard — upcoming event (tooltip above the panel) ───────────
  {
    route:      '/dashboard',
    routeKey:   'dashboard',
    target:     '[data-tour="dashboard-event"]',
    placement:  'top',
    skipBeacon: true,
    title:      'אירוע בית-ספרי קרוב',
    content:
      'פאנל זה מציג את האירוע הספורטיבי הקרוב ביותר. ניתן לנהל את כל האירועים בדף "אירועים וטורנירים" ולקשר אותם לכיתות.',
  },

  // ── 4: Classes — overview ─────────────────────────────────────────────
  {
    route:      '/classes',
    routeKey:   'classes',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'ניהול הכיתות שלך 📚',
    content:
      'כאן מרוכזות כל הכיתות שאתה מלמד. תוכל ליצור כיתה חדשה, לייבא תלמידים מקובץ אקסל, ולראות בכל רגע את הסטטוס — כמה תלמידים, אחוז הזנת תוצאות, וממוצע ציונים.',
  },

  // ── 5: Classes — add class ────────────────────────────────────────────
  {
    route:      '/classes',
    routeKey:   'classes',
    target:     '[data-tour="add-class"]',
    placement:  'bottom',
    skipBeacon: true,
    title:      'יצירת כיתה חדשה',
    content:
      'לחיצה פותחת אשף יצירה מהיר: שם הכיתה (לדוג׳ "ח׳2"), שכבה, והרכב מגדרי. לאחר היצירה תוכל להוסיף תלמידים ידנית או לייבא מאקסל. התלמידים מתחברים למערכת באמצעות תעודת הזהות והסיסמה שלהם.',
  },

  // ── 6: Classes — class card ───────────────────────────────────────────
  {
    route:      '/classes',
    routeKey:   'classes',
    target:     '[data-tour="class-card"]',
    placement:  'bottom',
    skipBeacon: true,
    title:      'כרטיס הכיתה',
    content:
      'כל כרטיס מציג: שם, מספר תלמידים, ממוצע כושר נוכחי, ואחוז הזנת תוצאות. לחיצה על הכרטיס פותחת את דף הכיתה המלא עם ניהול תלמידים, נוכחות, ומבחנים.',
  },

  // ── 7: Class detail — deep-dive (dynamic route) ───────────────────────
  {
    dynamicRoute: true,          // TourProvider pushes to /classes/{TOUR_DEMO_CLASS_ID}
    routeKey:     'class-detail',
    target:       'body',
    placement:    'center',
    skipBeacon:   true,
    title:        'בתוך הכיתה — תלמידים ומבחנים 🎯',
    content:
      'כאן תמצא את רשימת תלמידי הכיתה עם הציון הנוכחי של כל אחד. לחץ "התחל מבחן" לפתיחת מפגש מדידות — בחר בין שעון עצר אוטומטי לבין הזנה ידנית לכל תלמיד.',
  },

  // ── 8: Test types ─────────────────────────────────────────────────────
  // Stays on the same dynamic class-detail route as step 7 — no regression
  // back to /classes. Target is the TestTypeDropdown ([data-tour="test-list"])
  // which is the permanently-visible test selector listing all 28 supported
  // tests categorised by ENDURANCE / STRENGTH / SPEED_AGILITY / FLEXIBILITY.
  // Because step 7 also has dynamicRoute: true, the state machine resolves
  // both to /classes/tour-demo-class and the Next click becomes a same-page
  // STEP_NEXT (no cross-route navigation, no awaiting-page-ready phase).
  {
    dynamicRoute: true,
    routeKey:     'class-detail',
    target:       '[data-tour="test-list"]',
    placement:    'top',
    skipBeacon:   true,
    title:        'סוגי המבחנים הנתמכים 🏃',
    content:
      'FitGrade תומכת בכל מבחני כושר משרד החינוך: ריצה 10×4 מ׳ (מהירות-זריזות), ריצה 800/1500/2000/3000 מ׳ (סיבולת), מבחן Beep — 20 מ׳ PACER, כוח ידיים, קפיצה לגובה, ו-BMI. הציונים מחושבים אוטומטית לפי טבלאות הנורמה לגיל ומגדר.',
  },

  // ── 9: Schedule ───────────────────────────────────────────────────────
  {
    route:      '/schedule',
    routeKey:   'schedule',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'מערכת שעות שבועית 📅',
    content:
      'בנה את מערכת השעות שלך: שבוע ישראלי של 6 ימים (א׳–ו׳) ועד 16 שיעורים ביום. לחיצה על תא עם כיתה פותחת ישירות את דף השיעור הפעיל.',
  },

  // ── 10: Lesson planner ────────────────────────────────────────────────
  {
    route:      '/exercise-bank',
    routeKey:   'exercise-bank',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'מתכנן השיעורים 📝',
    content:
      'בנה שיעורים מובנים בלחיצה אחת: בחר מטרה ורמת קושי וקבל תכנית שיעור מוכנה עם תרגילים, זמנים והנחיות. ניתן לשמור ולהשתמש שוב בכל עת.',
  },

  // ── 11: Norms ─────────────────────────────────────────────────────────

  {
    route:      '/norms',
    routeKey:   'norms',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'טבלאות הישגים — נורמות משרד החינוך 📊',
    content:
      'כאן תמצא את טבלאות הנורמה הרשמיות לכל גיל ומגדר. המערכת משתמשת בהן אוטומטית כשמחשבת ציון לתוצאה — אין צורך לחפש ידנית.',
  },

  // ── 12: Reports — overview ────────────────────────────────────────────
  {
    route:      '/reports',
    routeKey:   'reports',
    target:     'body',
    placement:  'center',
    skipBeacon: true,
    title:      'הפקת דוחות ותעודות 📄',
    content:
      'דף זה מרכז את כל אפשרויות הייצוא: גיליון אקסל מפורט לפי כיתה ותעודות ציון PDF — הכל בנוי לפי תקן משרד החינוך ומוכן להגשה.',
  },

  // ── 13: Reports — export button (FINAL) ──────────────────────────────
  {
    route:      '/reports',
    routeKey:   'reports',
    target:     '[data-tour="export-csv"]',
    placement:  'top',
    skipBeacon: true,
    title:      'ייצוא לאקסל בלחיצה אחת',
    content:
      'זהו! כעת נעבור למסך ההגדרות כדי להזין את פרטי בית הספר.',
  },
];

// Inject disableBeacon: true into every step. The .map() pattern guarantees
// uniformity — adding a new step to TOUR_STEPS_BASE without disableBeacon
// is structurally impossible because every entry in the exported array is
// the result of this transform.
export const TOUR_STEPS: TourStep[] = TOUR_STEPS_BASE.map((step) => ({
  ...step,
  disableBeacon: true,
}));
