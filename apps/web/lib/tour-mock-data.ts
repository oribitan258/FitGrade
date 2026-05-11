/**
 * Tour Mock Mode — synthetic data injected into the SWR cache while the
 * onboarding tour runs.  All data is cleared and real fetches are triggered
 * the moment the tour ends (finish or skip).
 *
 * Nothing here is imported by page components — only TourProvider uses it.
 */

import type {
  ClassData,
  ClassDetails,
  DashboardStats,
  EventData,
  StudentData,
  TopAchievementItem,
  TopStudentItem,
  TopStudentPerClassItem,
} from '@fitgrade/types';
import type { MonthlyClassAverage } from '@/hooks/use-class-averages';
import type { TestType } from '@/hooks/use-test-types';

// ─── Demo identifiers ─────────────────────────────────────────────────────────

export const TOUR_DEMO_CLASS_ID = 'tour-demo-class';

const DEMO_CLASS_ID_1 = TOUR_DEMO_CLASS_ID;
const DEMO_CLASS_ID_2 = 'tour-demo-class-2';
const DEMO_CLASS_ID_3 = 'tour-demo-class-3';

// ─── Mock classes ─────────────────────────────────────────────────────────────

export const MOCK_CLASSES: ClassData[] = [
  {
    id:                 DEMO_CLASS_ID_1,
    name:               "ח'5",
    academicYear:       '2024-2025',
    genderType:         'BOYS',
    joinCode:           'DEMO01',
    joinCodeExpiresAt:  null,
    studentCount:       24,
    createdAt:          '2024-09-01T07:00:00.000Z',
    gradeLevel:         8,
    testWeight:         null,
    talmidautWeight:    null,
    semester:           'A',
  },
  {
    id:                 DEMO_CLASS_ID_2,
    name:               "ח'2",
    academicYear:       '2024-2025',
    genderType:         'GIRLS',
    joinCode:           'DEMO02',
    joinCodeExpiresAt:  null,
    studentCount:       22,
    createdAt:          '2024-09-01T07:00:00.000Z',
    gradeLevel:         8,
    testWeight:         null,
    talmidautWeight:    null,
    semester:           'A',
  },
  {
    id:                 DEMO_CLASS_ID_3,
    name:               "ט'1",
    academicYear:       '2024-2025',
    genderType:         'MIXED',
    joinCode:           'DEMO03',
    joinCodeExpiresAt:  null,
    studentCount:       28,
    createdAt:          '2024-09-01T07:00:00.000Z',
    gradeLevel:         9,
    testWeight:         null,
    talmidautWeight:    null,
    semester:           'A',
  },
];

// ─── Mock students ────────────────────────────────────────────────────────────

export const MOCK_STUDENTS: StudentData[] = [
  { id: 'ts1', firstName: 'אורי',    lastName: 'כהן',    studentCode: 'S001', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-03-15', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts2', firstName: 'יונתן',   lastName: 'לוי',    studentCode: 'S002', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-07-22', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts3', firstName: 'נועם',    lastName: 'מזרחי',  studentCode: 'S003', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-01-08', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts4', firstName: 'עמית',    lastName: 'פרץ',    studentCode: 'S004', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-11-30', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts5', firstName: 'דוד',     lastName: 'אברהם',  studentCode: 'S005', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-05-19', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts6', firstName: 'רון',     lastName: 'שפירא',  studentCode: 'S006', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-09-04', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts7', firstName: 'ליאור',   lastName: 'ביטון',  studentCode: 'S007', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-02-27', createdAt: '2024-09-01T07:00:00.000Z' },
  { id: 'ts8', firstName: 'גיל',     lastName: 'אלון',   studentCode: 'S008', nationalId: null, gender: 'MALE',   dateOfBirth: '2010-08-13', createdAt: '2024-09-01T07:00:00.000Z' },
];

// ─── Mock class details ───────────────────────────────────────────────────────

export const MOCK_CLASS_DETAILS_A: ClassDetails = {
  attendancePct: 91,
  testSummaries: [
    {
      testTypeId:   'mock-sprint',
      nameHe:       'ריצת 60 מטר',
      unit:         'שניות',
      progressData: [
        { month: "ספט'", classAvg: 68 },
        { month: "אוק'", classAvg: 72 },
        { month: "נוב'", classAvg: 76 },
      ],
      distribution: { excellent: 5, good: 9, pass: 7, fail: 3 },
      studentGrades: MOCK_STUDENTS.map((s, i) => ({
        studentId:     s.id,
        effectiveGrade: 65 + (i * 5) % 35,
        rawValue:       9.8 - i * 0.15,
        gradeOverride:  null,
      })),
    },
  ],
};

export const MOCK_CLASS_DETAILS_B: ClassDetails = {
  attendancePct: 88,
  testSummaries: [
    {
      testTypeId:   'mock-sprint',
      nameHe:       'ריצת 60 מטר',
      unit:         'שניות',
      progressData: [
        { month: "ינו'", classAvg: 74 },
        { month: "פבר'", classAvg: 77 },
        { month: "מרץ'", classAvg: 80 },
      ],
      distribution: { excellent: 7, good: 10, pass: 5, fail: 2 },
      studentGrades: MOCK_STUDENTS.map((s, i) => ({
        studentId:     s.id,
        effectiveGrade: 70 + (i * 4) % 30,
        rawValue:       9.5 - i * 0.12,
        gradeOverride:  null,
      })),
    },
  ],
};

// ─── Mock dashboard stats ─────────────────────────────────────────────────────

export const MOCK_STATS_A: DashboardStats = {
  overallFitnessAvg:    78,
  overallAttendancePct: 92,
  totalBelowNormCount:  3,
  totalStudents:        74,
  pendingResultsCount:  5,
  classStats: [
    { classId: DEMO_CLASS_ID_1, fitnessAvg: 76, attendancePct: 91, belowNormCount: 1 },
    { classId: DEMO_CLASS_ID_2, fitnessAvg: 80, attendancePct: 94, belowNormCount: 1 },
    { classId: DEMO_CLASS_ID_3, fitnessAvg: 77, attendancePct: 90, belowNormCount: 1 },
  ],
  recentSessions: [
    { sessionId: 'mock-s1', classId: DEMO_CLASS_ID_1, className: "ח'5", testNameHe: 'ריצת 60 מטר', conductedAt: new Date(Date.now() - 86400000).toISOString() },
    { sessionId: 'mock-s2', classId: DEMO_CLASS_ID_2, className: "ח'2", testNameHe: 'קפיצה לגובה', conductedAt: new Date(Date.now() - 172800000).toISOString() },
  ],
};

export const MOCK_STATS_B: DashboardStats = {
  overallFitnessAvg:    81,
  overallAttendancePct: 89,
  totalBelowNormCount:  2,
  totalStudents:        74,
  pendingResultsCount:  3,
  classStats: [
    { classId: DEMO_CLASS_ID_1, fitnessAvg: 80, attendancePct: 88, belowNormCount: 1 },
    { classId: DEMO_CLASS_ID_2, fitnessAvg: 83, attendancePct: 91, belowNormCount: 0 },
    { classId: DEMO_CLASS_ID_3, fitnessAvg: 79, attendancePct: 87, belowNormCount: 1 },
  ],
  recentSessions: [],
};

// ─── Mock class averages (chart) ──────────────────────────────────────────────

const MONTHS_A = ["ספט'", "אוק'", "נוב'", "דצמ'", "ינו'", "פבר'"];
const MONTHS_B = ["ינו'", "פבר'", "מרץ'", "אפר'", "מאי'", "יוני"];

function buildAverages(months: string[], baseAvg: number): MonthlyClassAverage[] {
  return months.flatMap((month, i) => [
    { month: `2024-${String(i + 9).padStart(2, '0')}`, classId: DEMO_CLASS_ID_1, className: "ח'5", avg: baseAvg + i },
    { month: `2024-${String(i + 9).padStart(2, '0')}`, classId: DEMO_CLASS_ID_2, className: "ח'2", avg: baseAvg + i + 3 },
    { month: `2024-${String(i + 9).padStart(2, '0')}`, classId: DEMO_CLASS_ID_3, className: "ט'1", avg: baseAvg + i + 1 },
  ]);
}

// ─── Mock top students ────────────────────────────────────────────────────────

export const MOCK_TOP_STUDENTS_A: TopStudentItem[] = [
  { rank: 1, studentId: 'ts1', studentName: 'אורי כהן',   classId: DEMO_CLASS_ID_1, className: "ח'5", avgGrade: 94, resultCount: 4, gender: 'MALE' },
  { rank: 2, studentId: 'ts3', studentName: 'נועם מזרחי', classId: DEMO_CLASS_ID_1, className: "ח'5", avgGrade: 89, resultCount: 3, gender: 'MALE' },
  { rank: 3, studentId: 'ts5', studentName: 'דוד אברהם',  classId: DEMO_CLASS_ID_1, className: "ח'5", avgGrade: 85, resultCount: 4, gender: 'MALE' },
];

export const MOCK_TOP_PER_CLASS_A: TopStudentPerClassItem[] = [
  { rank: 1, studentId: 'ts1', studentName: 'אורי כהן',   classId: DEMO_CLASS_ID_1, className: "ח'5", avgScore: 94 },
  { rank: 1, studentId: 'ts3', studentName: 'נועם מזרחי', classId: DEMO_CLASS_ID_2, className: "ח'2", avgScore: 91 },
  { rank: 1, studentId: 'ts5', studentName: 'דוד אברהם',  classId: DEMO_CLASS_ID_3, className: "ט'1", avgScore: 88 },
];

// ─── Mock event ───────────────────────────────────────────────────────────────

const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
export const MOCK_EVENT: EventData = {
  id:          'tour-event-1',
  title:       'יום ספורט בית-ספרי',
  description: 'תחרות ריצה ומשחקי קבוצות לכלל שכבות הביניים',
  eventDate:   nextWeek,
  location:    'מגרש בית הספר',
  teacherId:   'tour-teacher',
  createdAt:   new Date().toISOString(),
  updatedAt:   new Date().toISOString(),
};

// ─── Precomputed class averages (semester-scoped) ─────────────────────────────

export const MOCK_CLASS_AVERAGES_A: MonthlyClassAverage[] = buildAverages(MONTHS_A, 68);
export const MOCK_CLASS_AVERAGES_B: MonthlyClassAverage[] = buildAverages(MONTHS_B, 74);

// ─── Mock test types catalog ──────────────────────────────────────────────────
//
// Five representative tests covering all four input types (TIME / REPS /
// GENERAL / PASS_FAIL) and the four categories (ENDURANCE / STRENGTH /
// SPEED_AGILITY / FLEXIBILITY). Sufficient for the test-type dropdown and
// the "Open Test" modal in the class detail page.

export const MOCK_TEST_TYPES: TestType[] = [
  {
    id:            'mock-test-sprint-60',
    nameHe:        'ריצת 60 מטר',
    descriptionHe: 'מבחן מהירות',
    inputType:     'TIME',
    unit:          'שניות',
    isGlobal:      true,
    category:      'SPEED_AGILITY',
    minGrade:      6,
    maxGrade:      12,
  },
  {
    id:            'mock-test-2000m',
    nameHe:        'ריצת 2000 מטר',
    descriptionHe: 'מבחן סיבולת לב-ריאה',
    inputType:     'TIME',
    unit:          'שניות',
    isGlobal:      true,
    category:      'ENDURANCE',
    minGrade:      7,
    maxGrade:      12,
  },
  {
    id:            'mock-test-pushups',
    nameHe:        'שכיבות סמיכה',
    descriptionHe: 'מבחן כוח פלג גוף עליון',
    inputType:     'REPS',
    unit:          null,
    isGlobal:      true,
    category:      'STRENGTH',
    minGrade:      6,
    maxGrade:      12,
  },
  {
    id:            'mock-test-long-jump',
    nameHe:        'קפיצה למרחק',
    descriptionHe: 'מבחן כוח פלג גוף תחתון',
    inputType:     'GENERAL',
    unit:          'ס"מ',
    isGlobal:      true,
    category:      'STRENGTH',
    minGrade:      6,
    maxGrade:      12,
  },
  {
    id:            'mock-test-flex',
    nameHe:        'גמישות גב-תחת',
    descriptionHe: 'מבחן גמישות',
    inputType:     'GENERAL',
    unit:          'ס"מ',
    isGlobal:      true,
    category:      'FLEXIBILITY',
    minGrade:      6,
    maxGrade:      12,
  },
];

// ─── Mock top achievements (one best result per student) ──────────────────────

export const MOCK_TOP_ACHIEVEMENTS: TopAchievementItem[] = [
  { rank: 1, studentId: 'ts1', studentName: 'אורי כהן',     classId: DEMO_CLASS_ID_1, className: "ח'5", classGenderType: 'BOYS',  examName: 'ריצת 60 מטר',  score: 95, rawValue: 8.4,  unit: 'שניות' },
  { rank: 2, studentId: 'ts3', studentName: 'נועם מזרחי',   classId: DEMO_CLASS_ID_1, className: "ח'5", classGenderType: 'BOYS',  examName: 'שכיבות סמיכה', score: 92, rawValue: 38,   unit: null     },
  { rank: 3, studentId: 'ts5', studentName: 'דוד אברהם',    classId: DEMO_CLASS_ID_2, className: "ח'2", classGenderType: 'GIRLS', examName: 'קפיצה למרחק', score: 90, rawValue: 182,  unit: 'ס"מ'   },
  { rank: 4, studentId: 'ts2', studentName: 'יונתן לוי',    classId: DEMO_CLASS_ID_1, className: "ח'5", classGenderType: 'BOYS',  examName: 'ריצת 2000 מטר', score: 88, rawValue: 480,  unit: 'שניות' },
  { rank: 5, studentId: 'ts4', studentName: 'עמית פרץ',     classId: DEMO_CLASS_ID_3, className: "ט'1", classGenderType: 'MIXED', examName: 'גמישות גב-תחת', score: 86, rawValue: 28,   unit: 'ס"מ'   },
];

// ─── Schedule localStorage helpers ────────────────────────────────────────────

const SCHEDULE_KEY      = 'fitgrade-schedule-v2-A';
const TOUR_MOCK_SENTINEL = '__tourMock';

interface ScheduleEvent {
  id:        string;
  type:      'lesson' | 'break' | 'meeting';
  classId?:  string;
  startTime: string;
  endTime:   string;
  day:       number;
  [TOUR_MOCK_SENTINEL]?: boolean;
}

function buildMockSchedule(): ScheduleEvent[] {
  // Spread across 3 days × 2 periods each, sentinel on first entry only.
  const entries: ScheduleEvent[] = [
    { id: 'tm-0', type: 'lesson', classId: DEMO_CLASS_ID_1, startTime: '08:00', endTime: '08:45', day: 0, [TOUR_MOCK_SENTINEL]: true },
    { id: 'tm-1', type: 'lesson', classId: DEMO_CLASS_ID_2, startTime: '09:00', endTime: '09:45', day: 0 },
    { id: 'tm-2', type: 'lesson', classId: DEMO_CLASS_ID_3, startTime: '08:00', endTime: '08:45', day: 1 },
    { id: 'tm-3', type: 'lesson', classId: DEMO_CLASS_ID_1, startTime: '10:00', endTime: '10:45', day: 1 },
    { id: 'tm-4', type: 'lesson', classId: DEMO_CLASS_ID_2, startTime: '08:00', endTime: '08:45', day: 2 },
    { id: 'tm-5', type: 'lesson', classId: DEMO_CLASS_ID_3, startTime: '11:00', endTime: '11:45', day: 3 },
  ];
  return entries;
}

export function seedTourSchedule(): void {
  if (typeof window === 'undefined') return;
  const existing = localStorage.getItem(SCHEDULE_KEY);
  if (existing) return; // never overwrite real data
  try {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(buildMockSchedule()));
  } catch {
    // localStorage quota exceeded — not critical
  }
}

export function clearTourSchedule(): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(SCHEDULE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as ScheduleEvent[];
    // Only remove if the first entry carries our sentinel flag
    if (Array.isArray(parsed) && parsed[0]?.[TOUR_MOCK_SENTINEL] === true) {
      localStorage.removeItem(SCHEDULE_KEY);
    }
  } catch {
    // malformed JSON — leave it alone
  }
}
