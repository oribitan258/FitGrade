'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  FlaskConical,
  Play,
  Shirt,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { StudentProfile, StudentTestHistory } from '@fitgrade/types';
import { useClasses, useStudents } from '@/hooks/use-classes';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { cn, formatRawValue } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Workout plan types (mirrors class-page shape, persisted in localStorage) ──

interface WorkoutExercise { name: string; detail: string; }
interface WorkoutWeek { week: number; focus: string; emoji: string; exercises: WorkoutExercise[]; }
interface WorkoutPlanPayload { plan: WorkoutWeek[]; savedAt: number; }

/** Returns the localStorage key scoped to a specific student. */
function workoutPlanKey(studentId: string): string {
  return `fitgrade-workout-plan-${studentId}`;
}

/** Brief how-to tip per exercise name (Hebrew). Falls back to DEFAULT_EXERCISE_TIP. */
const EXERCISE_TIPS: Record<string, string> = {
  'ריצה קלה':        'שמור על קצב נוח שמאפשר שיחה. נשום עמוק דרך האף ונשוף דרך הפה.',
  'שכיבות סמיכה':    'גוף ישר כקרש. מרפקים קרובים לגוף. רד לאט 2 שניות — עלה מהר.',
  'פלאנק':            'בטן מכווצת, גב ישר. אל תרים ואל תשפיל את האגן.',
  'קפיצות כוח':      'נחת רך על קדמת כף הרגל. ברכיים מעל בהונות בזמן הכריעה.',
  'מתח מוסגר':       'אחיזה רחבה, כתפיים אחורה ומטה. עלה עד שהסנטר מעל המוט.',
  'ריצת שאטל':       'פנה מהר בתחנות. מרכז כובד נמוך לאורך כל הריצה.',
  'כפיפות בטן':      'ידיים מאחורי הראש, מרפקים פתוחים. אל תמשוך את הצוואר.',
  'סקוואט':          'רגליים ברוחב כתפיים. ישב לאחור ולמטה כאילו יש כיסא מאחוריך.',
  "לאנג'ס":          'ברך קדמית מעל הקרסול. גוף זקוף לאורך כל התרגיל.',
  'קפיצות לגובה':    'מנף ידיים למעלה בזמן הקפיצה. נחת רך ומכופף ברכיים.',
  'ריצה מהירה':      'ספרינט מלא — נשום, הרם ברכיים, דחוף מהעקב.',
  'אינטרוול ריצה':   'מנוחה שווה ל-50% מזמן הריצה בין חזרות. שמור עקביות.',
  'תרגיל משולב':     'בצע כל תרגיל לפי הסדר ללא הפסקה. מנוחה רק בין סבבים.',
  'בורפי':           'מהיר ורציף: עמד → כרע → שכב → דחוף → קפוץ. קצב יציב.',
  '5 ק"מ טמפו':     'קצב קשה אבל יציב — לא ספרינט ולא ג\'וג. שמור על דופק גבוה.',
  'ריצת אינטרוול':   'דופק 85% בכל חזרה. מנוחה מלאה בין חזרות.',
  'קפיצות קרוספיט':  'פנה מהר ונחת רך. אל תנעל ברכיים בנחיתה.',
  'סקוואט קפיצה':    'כרע עמוק, קפוץ נפיץ. נחת רך ועבור מיד לחזרה הבאה.',
  'שכיבות פיצוץ':    'ידיים רחוקות מהרצפה בראש התנועה. מהיר ומבוקר.',
  'ריצת מדרגות':     'הרם ברכיים גבוה, עלה קדמת כף הרגל. מהר למטה.',
  'מסלול מכשולים':   'מד זמן לפני כל סבב. נוח 90 שניות בין סבבים.',
};
const DEFAULT_EXERCISE_TIP = 'בצע בצורה מבוקרת עם נשימה סדירה. אם מרגיש כאב — עצור ודווח למורה.';

// ─── Plan Notification Toast ───────────────────────────────────────────────────

function PlanNotificationToast({ onDismiss }: { onDismiss: () => void }): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ ease: EASE, duration: 0.35 }}
      role="status"
      aria-live="polite"
      className="prismatic-glass fixed start-4 top-20 z-[9998] max-w-xs rounded-2xl p-4 shadow-[0_8px_32px_rgba(109,40,217,0.22)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100/80">
          <Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">תוכנית חדשה ממתינה לך!</p>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">המורה עדכן את האימונים שלך.</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-violet-100/60 hover:text-slate-600 transition-colors"
          aria-label="סגור התראה"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Workout Celebration Modal ────────────────────────────────────────────────

function CelebrationModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.55 }}
        onClick={(e) => e.stopPropagation()}
        className="prismatic-glass w-full max-w-xs rounded-3xl p-8 text-center"
      >
        {/* Trophy icon — glowing + infinite pulse */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300"
          style={{ boxShadow: '0 0 40px rgba(251,191,36,0.55), 0 0 80px rgba(251,191,36,0.25)' }}
        >
          <Trophy className="h-10 w-10 text-white drop-shadow-md" aria-hidden="true" />
        </motion.div>

        {/* Headline */}
        <h2 className="mb-2 text-3xl font-black text-white">כל הכבוד!</h2>

        {/* Subtitle */}
        <p className="mb-8 text-sm leading-relaxed text-violet-200/80">
          סיימת את האימון היומי שלך בהצלחה.<br />
          המשך כך — אתה מתחזק!
        </p>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(139,92,246,0.45)] transition-opacity hover:opacity-90 active:scale-95"
        >
          סגור
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Daily Workout Card ────────────────────────────────────────────────────────

function DailyWorkoutCard({ payload, studentId }: { payload: WorkoutPlanPayload; studentId: string }): React.JSX.Element {
  const [expandedEx, setExpandedEx]           = useState<number | null>(null);
  const [startedSet, setStartedSet]           = useState<Set<number>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);

  // Determine which week of the plan we're in based on days since it was saved
  const weekIdx = Math.min(
    (payload.plan.length || 1) - 1,
    Math.floor((Date.now() - payload.savedAt) / (7 * 24 * 60 * 60 * 1000)),
  );
  const weekPlan = payload.plan[weekIdx] ?? payload.plan[0];
  if (!weekPlan) return <></>;

  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
  const completedCount = startedSet.size;
  const totalCount     = weekPlan.exercises.length;

  function handleStart(idx: number): void {
    setStartedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      // Emit real-time workout progress to teacher dashboard
      const pct = totalCount > 0 ? Math.round((next.size / totalCount) * 100) : 0;
      try { localStorage.setItem(`fitgrade-progress-${studentId}`, String(pct)); } catch { /* quota */ }
      // Trigger celebration when every exercise is marked done
      if (next.size === totalCount && totalCount > 0) {
        setTimeout(() => setShowCelebration(true), 500);
      }
      return next;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.45 }}
      className="prismatic-glass rounded-3xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-violet-200/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100/80">
            <Dumbbell className="h-5 w-5 text-violet-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-400">האימון היומי שלך</p>
            <p className="text-sm font-bold text-slate-800">{today}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-lg" aria-hidden="true">{weekPlan.emoji}</span>
          <span className="text-[10px] font-bold text-violet-500">
            שבוע {weekPlan.week} מתוך {payload.plan.length}
          </span>
        </div>
      </div>

      {/* Focus badge */}
      <div className="px-5 pb-0 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-bold text-violet-700">
          <Target className="h-3 w-3" aria-hidden="true" />
          {weekPlan.focus}
        </span>
      </div>

      {/* Exercise list */}
      <div className="space-y-2 p-4">
        {weekPlan.exercises.map((ex, idx) => {
          const isExpanded = expandedEx === idx;
          const isStarted  = startedSet.has(idx);
          const tip        = EXERCISE_TIPS[ex.name] ?? DEFAULT_EXERCISE_TIP;

          return (
            <div
              key={idx}
              className={cn(
                'rounded-2xl border transition-all duration-200',
                isStarted
                  ? 'border-emerald-200/80 bg-emerald-50/60'
                  : 'border-violet-100/60 bg-white/40',
              )}
            >
              {/* Row — vertical on mobile, horizontal on md+ */}
              <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-3">
                {/* Number badge + exercise info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors',
                    isStarted ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-600',
                  )} aria-hidden="true">
                    {isStarted ? '✓' : idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-bold leading-tight transition-all',
                      isStarted ? 'text-emerald-700 line-through opacity-60' : 'text-slate-800',
                    )}>{ex.name}</p>
                    <p className="text-xs text-slate-400 leading-tight">{ex.detail}</p>
                  </div>

                  {/* How-to toggle — inline with text on all sizes */}
                  <button
                    type="button"
                    onClick={() => setExpandedEx(isExpanded ? null : idx)}
                    className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-violet-500 hover:bg-violet-50/80 transition-colors"
                    aria-expanded={isExpanded}
                    aria-label={`איך לבצע ${ex.name}`}
                  >
                    איך?
                  </button>
                </div>

                {/* Start / Done button — full-width on mobile, auto on md+ */}
                <button
                  type="button"
                  onClick={() => handleStart(idx)}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all md:w-auto md:py-1.5 md:text-xs',
                    isStarted
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-violet-600 text-white shadow-[0_2px_10px_rgba(139,92,246,0.35)] hover:bg-violet-700',
                  )}
                  aria-pressed={isStarted}
                >
                  {isStarted
                    ? <CheckCircle2 className="h-4 w-4 md:h-3 md:w-3" aria-hidden="true" />
                    : <Play        className="h-4 w-4 md:h-3 md:w-3" aria-hidden="true" />
                  }
                  {isStarted ? 'בוצע' : 'התחל'}
                </button>
              </div>

              {/* How-to expansion */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ ease: EASE, duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-violet-100/60 bg-violet-50/40 px-4 py-3">
                      <p className="mb-1 text-[11px] font-bold text-violet-500">💡 טיפ ביצוע</p>
                      <p className="text-sm leading-relaxed text-slate-600">{tip}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer — completion progress */}
      <div className="flex items-center justify-between border-t border-violet-200/40 px-5 py-3">
        <span className="text-xs text-slate-500">
          {completedCount} מתוך {totalCount} תרגילים בוצעו
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-violet-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-violet-500 to-indigo-500"
              animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              transition={{ ease: EASE, duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-bold text-violet-600">
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Workout complete celebration */}
      <AnimatePresence>
        {showCelebration && (
          <CelebrationModal onClose={() => setShowCelebration(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Neon colour palette for multi-line test progress chart */
const LINE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171'] as const;

/** Ministry of Education national fitness norm — used as chart reference line */
const NATIONAL_NORM = 74;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function gradeBgBorder(score: number): string {
  if (score >= 90) return 'bg-emerald-50 border-emerald-100';
  if (score >= 75) return 'bg-blue-50 border-blue-100';
  if (score >= 60) return 'bg-amber-50 border-amber-100';
  return 'bg-red-50 border-red-100';
}

function gradePill(score: number): string {
  if (score >= 90) return 'bg-emerald-100 text-emerald-800';
  if (score >= 75) return 'bg-blue-100 text-blue-800';
  if (score >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

/** Merge all test type history months in encountered order and build chart rows */
function buildChartData(
  testHistories: StudentTestHistory[],
): Array<Record<string, string | number>> {
  const monthOrder: string[] = [];
  const seen = new Set<string>();
  for (const test of testHistories) {
    for (const point of test.history) {
      if (!seen.has(point.month)) {
        seen.add(point.month);
        monthOrder.push(point.month);
      }
    }
  }
  const rows = monthOrder.map((month) => {
    const row: Record<string, string | number> = { month };
    for (const test of testHistories) {
      const point = test.history.find((h) => h.month === month);
      if (point !== undefined) row[test.testTypeId] = point.grade;
    }
    return row;
  });

  // Recharts needs ≥2 points to draw a line. When there is only one real data
  // point, prepend a ghost entry with the same values so the chart renders a
  // flat horizontal line leading into the actual data point.
  if (rows.length === 1) {
    const ghost: Record<string, string | number> = { month: 'תחילת שנה' };
    for (const test of testHistories) {
      if (rows[0]![test.testTypeId] !== undefined) {
        ghost[test.testTypeId] = rows[0]![test.testTypeId]!;
      }
    }
    return [ghost, ...rows];
  }

  return rows;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-3xl bg-white/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
      <div className="h-52 animate-pulse rounded-2xl bg-white/60" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  index: number;
}

function KpiCard({
  label, value, sub, icon: Icon, colorClass, bgClass, index,
}: KpiCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.4, delay: index * 0.07 }}
      whileHover={{ y: -4, scale: 1.02, boxShadow: '0 16px 40px rgba(15,23,42,0.14)', transition: { type: 'spring', stiffness: 400, damping: 30 } }}
      whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      className="overflow-hidden rounded-2xl bg-white/80 backdrop-blur-2xl border border-white/20 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.09)]"
    >
      <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-xl', bgClass)}>
        <Icon className={cn('h-4 w-4', colorClass)} aria-hidden="true" />
      </div>
      <div className={cn('text-2xl font-extrabold tabular-nums', colorClass)}>{value}</div>
      {sub && (
        <div className="text-[11px] font-semibold text-slate-500">{sub}</div>
      )}
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </motion.div>
  );
}

// ─── Attendance Trend dots ─────────────────────────────────────────────────────

function AttendanceTrend({ trend }: { trend: number[] }): React.JSX.Element {
  if (trend.length === 0) {
    return <span className="text-xs text-slate-400">אין נתונים</span>;
  }
  return (
    <div className="flex items-center gap-1.5" aria-label="מגמת נוכחות — שיעורים אחרונים">
      {trend.map((val, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.06, ease: EASE, duration: 0.3 }}
          className={cn(
            'h-3 w-3 rounded-full',
            val === 100 ? 'bg-emerald-500' : 'bg-red-400',
          )}
          title={val === 100 ? 'נכח/ה' : 'נעדר/ה'}
        />
      ))}
    </div>
  );
}

// ─── Dynamic glow dot — colour changes by score ────────────────────────────────

function GlowDot({ cx, cy, value }: { cx?: number; cy?: number; value?: number | null }): React.JSX.Element {
  if (cx == null || cy == null || value == null) return <g />;
  const fill =
    value >= 90 ? '#34d399' :
    value >= 75 ? '#60a5fa' :
    value >= 60 ? '#fbbf24' : '#f87171';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="rgba(255,255,255,0.30)"
      strokeWidth={1.5}
      style={{ filter: `drop-shadow(0 0 5px ${fill})` }}
    />
  );
}

// ─── Progress Chart ────────────────────────────────────────────────────────────

function ProgressChart({ testHistories }: { testHistories: StudentTestHistory[] }): React.JSX.Element {
  const chartData = useMemo(() => buildChartData(testHistories), [testHistories]);
  const hasData = chartData.length > 0 && testHistories.some((t) => t.history.length > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center">
        <TrendingUp className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-500">אין נתוני התקדמות עדיין</p>
        <p className="text-sm text-slate-400">הגרף יופיע לאחר תיעוד המבחן הראשון</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(45,27,105,0.55)] backdrop-blur-xl p-4"
      style={{ background: 'rgba(30,24,80,0.65)' }}
    >
      <div style={{ filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.45))' }}>
        <ResponsiveContainer width="100%" height={268}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#a5b4fc' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#a5b4fc' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,10,40,0.95)',
                border: '1px solid rgba(129,140,248,0.30)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.50)',
                fontSize: 12,
                color: '#e2e8f0',
              }}
              formatter={(value: number, name: string) => {
                const test = testHistories.find((t) => t.testTypeId === name);
                return [`${value} — ${getHebrewGradeLabel(value)}`, test?.nameHe ?? name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#a5b4fc' }}
              formatter={(value: string) => {
                const test = testHistories.find((t) => t.testTypeId === value);
                return test?.nameHe ?? value;
              }}
            />
            {/* National norm reference line — neon cyan */}
            <ReferenceLine
              y={NATIONAL_NORM}
              stroke="#22d3ee"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              label={{
                value: `נורמה ארצית ${NATIONAL_NORM}`,
                fill: '#22d3ee',
                fontSize: 10,
                fontWeight: 700,
              }}
              style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.90))' }}
            />
            {testHistories.map((test, i) => (
              <Line
                key={test.testTypeId}
                type="monotone"
                dataKey={test.testTypeId}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={4}
                animationDuration={1500}
                animationEasing="ease-out"
                dot={<GlowDot />}
                activeDot={{ r: 8, strokeWidth: 2, stroke: 'rgba(255,255,255,0.45)', fill: LINE_COLORS[i % LINE_COLORS.length] }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Grades Table ─────────────────────────────────────────────────────────────

function GradesTable({ testHistories }: { testHistories: StudentTestHistory[] }): React.JSX.Element {
  if (testHistories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center">
        <Target className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-500">אין תוצאות מבחנים עדיין</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl">
      <div className="overflow-x-auto">
      {/* Header */}
      <div
        className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 min-w-[340px]"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
      >
        {['שם המבחן', 'תוצאה', 'ציון', 'רמה'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-slate-50 min-w-[340px]">
        {testHistories.map((test) => (
          <div
            key={test.testTypeId}
            className="grid items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 transition-colors"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
          >
            <div>
              <p className="text-sm font-semibold text-slate-800">{test.nameHe}</p>
              {test.unit && <p className="text-xs text-slate-400">{test.unit}</p>}
            </div>
            <span className="font-mono text-sm font-semibold text-slate-700">
              {test.latestRawValue !== null
                ? (formatRawValue(test.latestRawValue, test.inputType) ?? '—')
                : '—'}
            </span>
            <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(test.latestGrade))}>
              {test.latestGrade > 0 ? test.latestGrade : '—'}
            </span>
            <span className={cn(
              'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-bold',
              test.latestGrade > 0 ? gradePill(test.latestGrade) : 'bg-slate-100 text-slate-500',
            )}>
              {test.latestGrade > 0 ? getHebrewGradeLabel(test.latestGrade) : '—'}
            </span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ─── Talmidaut Section ────────────────────────────────────────────────────────

function TalmidautSection({ profile }: { profile: StudentProfile }): React.JSX.Element {
  const latest = profile.talmidautRecords[0];

  if (!latest) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center">
        <Star className="h-7 w-7 text-slate-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-500">אין רשומות תלמידות עדיין</p>
      </div>
    );
  }

  const items: Array<{ label: string; value: number; icon: React.ElementType }> = [
    { label: 'השתתפות', value: latest.participation, icon: Zap },
    { label: 'מדי ספורט', value: latest.uniform, icon: Shirt },
    { label: 'התנהגות', value: latest.behavior, icon: Star },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-bold text-slate-700">
          הערכה אחרונה
          <span className="ms-2 text-xs font-normal text-slate-400">
            {new Date(latest.recordedAt).toLocaleDateString('he-IL')}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 p-4 gap-2">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl',
              gradeBgBorder(value),
            )}>
              <Icon className={cn('h-4 w-4', gradeColor(value))} aria-hidden="true" />
            </div>
            <span className={cn('text-xl font-extrabold tabular-nums', gradeColor(value))}>{value}</span>
            <span className="text-center text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 bg-gradient-to-l from-indigo-50/60 to-violet-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">ציון תלמידות ממוצע</span>
          <span className={cn('text-2xl font-extrabold tabular-nums', gradeColor(latest.compositeScore))}>
            {latest.compositeScore}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{getHebrewGradeLabel(latest.compositeScore)}</p>
      </div>
    </div>
  );
}

// ─── Final Grade Breakdown ────────────────────────────────────────────────────

function FinalGradeBreakdown({ profile }: { profile: StudentProfile }): React.JSX.Element {
  const { finalGrade } = profile;
  const fitnessContrib = Math.round(finalGrade.fitnessAvg * finalGrade.testWeight / 100);
  const talmidautContrib = Math.round(finalGrade.talmidautAvg * finalGrade.talmidautWeight / 100);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl">
      {/* Recommended grade header */}
      <div className="bg-gradient-to-l from-indigo-50 to-violet-50 border-b border-indigo-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">ציון גמר מומלץ</p>
            <p className={cn('mt-1 text-sm font-bold', gradeColor(finalGrade.recommendedGrade))}>
              {getHebrewGradeLabel(finalGrade.recommendedGrade)}
            </p>
          </div>
          <span className={cn('text-4xl font-black tabular-nums', gradeColor(finalGrade.recommendedGrade))}>
            {finalGrade.recommendedGrade}
          </span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              כושר גופני ({finalGrade.testWeight}%) · ממוצע {finalGrade.fitnessAvg}
            </span>
            <span className="font-bold text-blue-700">+{fitnessContrib} נק&apos;</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-indigo-500 to-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${finalGrade.testWeight}%` }}
              transition={{ ease: EASE, duration: 0.8 }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              תלמידות ({finalGrade.talmidautWeight}%) · ממוצע {finalGrade.talmidautAvg}
            </span>
            <span className="font-bold text-violet-700">+{talmidautContrib} נק&apos;</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-violet-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${finalGrade.talmidautWeight}%` }}
              transition={{ ease: EASE, duration: 0.8, delay: 0.15 }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            {fitnessContrib} + {talmidautContrib} = סה&quot;כ
          </span>
          <span className={cn('text-base font-extrabold tabular-nums', gradeColor(finalGrade.recommendedGrade))}>
            {finalGrade.recommendedGrade}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView({
  profile,
  className,
  workoutPlan,
  studentId,
}: {
  profile: StudentProfile;
  className: string;
  workoutPlan: WorkoutPlanPayload | null;
  studentId: string;
}): React.JSX.Element {
  const attendancePct = Math.round(profile.attendancePct);
  const totalRecords = profile.attendanceTrend.length;
  const presentCount = Math.round((profile.attendancePct / 100) * totalRecords);
  const absentCount = totalRecords - presentCount;

  const kpiCards: KpiCardProps[] = [
    {
      label: 'ממוצע כושר',
      value: profile.overallAvg > 0 ? profile.overallAvg : '—',
      sub: profile.overallAvg > 0 ? getHebrewGradeLabel(profile.overallAvg) : undefined,
      icon: Target,
      colorClass: profile.overallAvg > 0 ? gradeColor(profile.overallAvg) : 'text-slate-400',
      bgClass: profile.overallAvg > 0 ? gradeBgBorder(profile.overallAvg).split(' ')[0] : 'bg-slate-50',
      index: 0,
    },
    {
      label: 'ציון גמר מומלץ',
      value: profile.finalGrade.recommendedGrade > 0 ? profile.finalGrade.recommendedGrade : '—',
      sub: profile.finalGrade.recommendedGrade > 0 ? getHebrewGradeLabel(profile.finalGrade.recommendedGrade) : undefined,
      icon: TrendingUp,
      colorClass: profile.finalGrade.recommendedGrade > 0 ? gradeColor(profile.finalGrade.recommendedGrade) : 'text-slate-400',
      bgClass: profile.finalGrade.recommendedGrade > 0 ? gradeBgBorder(profile.finalGrade.recommendedGrade).split(' ')[0] : 'bg-slate-50',
      index: 1,
    },
    {
      label: 'נוכחות',
      value: `${attendancePct}%`,
      sub: attendancePct >= 80 ? 'תקין' : attendancePct >= 60 ? 'לתשומת לב' : 'חריג',
      icon: Users,
      colorClass: attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-red-600',
      bgClass: attendancePct >= 80 ? 'bg-emerald-50' : attendancePct >= 60 ? 'bg-amber-50' : 'bg-red-50',
      index: 2,
    },
    {
      label: 'תלמידות ספורטיבית',
      value: profile.finalGrade.talmidautAvg > 0 ? profile.finalGrade.talmidautAvg : '—',
      sub: profile.finalGrade.talmidautAvg > 0 ? getHebrewGradeLabel(profile.finalGrade.talmidautAvg) : undefined,
      icon: Star,
      colorClass: profile.finalGrade.talmidautAvg > 0 ? gradeColor(profile.finalGrade.talmidautAvg) : 'text-slate-400',
      bgClass: profile.finalGrade.talmidautAvg > 0 ? gradeBgBorder(profile.finalGrade.talmidautAvg).split(' ')[0] : 'bg-slate-50',
      index: 3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Welcome banner ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-indigo-600 to-violet-600 p-6 text-white shadow-[0_8px_32px_rgba(99,102,241,0.35)]"
      >
        {/* Radial shimmer */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-200">ברוך הבא</p>
          <h1 className="mt-0.5 text-xl font-black md:text-2xl">
            שלום, {profile.firstName} {profile.lastName}!
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-indigo-200">
            <span>{className}</span>
            <span aria-hidden="true">·</span>
            <span>
              קוד תלמיד:{' '}
              <span className="font-mono font-bold text-white">{profile.studentCode}</span>
            </span>
          </div>
        </div>

        {/* Floating grade badge — end side */}
        {profile.finalGrade.recommendedGrade > 0 && (
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ease: EASE, duration: 0.5, delay: 0.2 }}
            className="absolute end-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 rounded-2xl bg-white/20 px-4 py-3 backdrop-blur-sm"
          >
            <span className="text-3xl font-black tabular-nums text-white">
              {profile.finalGrade.recommendedGrade}
            </span>
            <span className="text-[11px] font-bold text-indigo-200">ציון גמר</span>
          </motion.div>
        )}
      </motion.div>

      {/* ── Daily Workout Card ──────────────────────────────────────────── */}
      {workoutPlan && (
        <section aria-labelledby="workout-heading">
          <div className="mb-3 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <h2 id="workout-heading" className="text-base font-bold text-slate-800">
              תוכנית האימון שלך
            </h2>
          </div>
          <DailyWorkoutCard payload={workoutPlan} studentId={studentId} />
        </section>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Progress Chart ──────────────────────────────────────────────── */}
      <section aria-labelledby="progress-heading">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          <h2 id="progress-heading" className="text-base font-bold text-slate-800">
            גרף התקדמות
          </h2>
        </div>
        <ProgressChart testHistories={profile.testHistories} />
      </section>

      {/* ── Grades table + Attendance ────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Grades table — 2 columns wide */}
        <section className="lg:col-span-2" aria-labelledby="grades-heading">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h2 id="grades-heading" className="text-base font-bold text-slate-800">
              פירוט ציונים לפי מבחן
            </h2>
          </div>
          <GradesTable testHistories={profile.testHistories} />
        </section>

        {/* Attendance widget */}
        <section aria-labelledby="attendance-heading">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h2 id="attendance-heading" className="text-base font-bold text-slate-800">
              נוכחות
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl p-4 space-y-4">
            {/* Big percentage */}
            <div className="flex flex-col items-center py-4">
              <span className={cn(
                'text-5xl font-black tabular-nums',
                attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-red-600',
              )}>
                {attendancePct}%
              </span>
              <span className="mt-1 text-xs text-slate-500">אחוז נוכחות</span>
            </div>

            {/* Present / Absent pills */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <span className="text-xl font-extrabold text-emerald-600 tabular-nums">{presentCount}</span>
                <p className="text-[11px] font-semibold text-emerald-700">נוכח/ת</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                <span className="text-xl font-extrabold text-red-600 tabular-nums">{absentCount}</span>
                <p className="text-[11px] font-semibold text-red-700">נעדר/ת</p>
              </div>
            </div>

            {/* Trend dots */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">שיעורים אחרונים</p>
              <AttendanceTrend trend={profile.attendanceTrend} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Talmidaut + Final Grade ───────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="talmidaut-heading">
          <div className="mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h2 id="talmidaut-heading" className="text-base font-bold text-slate-800">
              תלמידות ספורטיבית
            </h2>
          </div>
          <TalmidautSection profile={profile} />
        </section>

        <section aria-labelledby="final-grade-heading">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            <h2 id="final-grade-heading" className="text-base font-bold text-slate-800">
              פירוט ציון גמר
            </h2>
          </div>
          <FinalGradeBreakdown profile={profile} />
        </section>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage(): React.JSX.Element {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [devPanelOpen, setDevPanelOpen] = useState(true);
  const [workoutPlan, setWorkoutPlan]       = useState<WorkoutPlanPayload | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: students, isLoading: studentsLoading } = useStudents(selectedClassId);
  const { data: profile, isLoading: profileLoading } = useStudentProfile(
    selectedClassId,
    selectedStudentId,
  );

  const selectedClass = classes?.find((c) => c.id === selectedClassId);

  // Auto-select first class
  useEffect(() => {
    if (!selectedClassId && classes?.[0]) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Reset student selection when class changes
  useEffect(() => {
    setSelectedStudentId('');
  }, [selectedClassId]);

  // Auto-select first student once the list loads
  useEffect(() => {
    if (!selectedStudentId && students?.[0]) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  // Load stored workout plan whenever the active student changes, and listen for
  // cross-tab updates from the teacher — only reacting to keys that match this student.
  useEffect(() => {
    if (!selectedStudentId) return;

    const key = workoutPlanKey(selectedStudentId);

    function loadPlan(): WorkoutPlanPayload | null {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as WorkoutPlanPayload;
      } catch { return null; }
    }

    setWorkoutPlan(loadPlan());

    function handleStorage(e: StorageEvent): void {
      if (e.key !== key) return;
      const updated = loadPlan();
      setWorkoutPlan(updated);
      if (updated) {
        setShowNotification(true);
        // Auto-dismiss after 8 seconds
        setTimeout(() => setShowNotification(false), 8000);
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [selectedStudentId]);

  const isLoading = profileLoading && Boolean(selectedStudentId);

  return (
    <div className="w-full overflow-x-hidden space-y-6">
      {/* ── Workout plan notification toast (fixed, top-start) ───────────── */}
      <AnimatePresence>
        {showNotification && (
          <PlanNotificationToast onDismiss={() => setShowNotification(false)} />
        )}
      </AnimatePresence>
      {/* ── Dev Impersonation Panel ──────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setDevPanelOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-amber-100/50 transition-colors"
          aria-expanded={devPanelOpen}
          aria-controls="dev-panel-content"
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold text-amber-800">מצב פיתוח — בחר תלמיד לצפייה</span>
            <span className="rounded-full bg-amber-200 px-2 py-px text-[10px] font-bold text-amber-800">DEV</span>
          </div>
          <motion.div
            animate={{ rotate: devPanelOpen ? 180 : 0 }}
            transition={{ ease: EASE, duration: 0.2 }}
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4 text-amber-600" />
          </motion.div>
        </button>

        {devPanelOpen && (
          <div id="dev-panel-content" className="border-t border-amber-200/60 px-4 py-3">
            <p className="mb-3 text-xs text-amber-700">
              בחר כיתה ותלמיד כדי לצפות בפורטל שלהם כאילו היית אותם.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              {/* Class picker */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-amber-700" htmlFor="dev-class-select">
                  כיתה
                </label>
                {classesLoading ? (
                  <div className="h-9 w-40 animate-pulse rounded-lg bg-amber-200/60" />
                ) : (
                  <select
                    id="dev-class-select"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="h-9 min-w-40 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  >
                    <option value="">— בחר כיתה —</option>
                    {(classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Student picker */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-amber-700" htmlFor="dev-student-select">
                  תלמיד
                </label>
                {studentsLoading && selectedClassId ? (
                  <div className="h-9 w-52 animate-pulse rounded-lg bg-amber-200/60" />
                ) : (
                  <select
                    id="dev-student-select"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    disabled={!selectedClassId || (students ?? []).length === 0}
                    className="h-9 min-w-52 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— בחר תלמיד —</option>
                    {(students ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {!selectedStudentId ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/60 backdrop-blur-sm py-20 text-center">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100"
          >
            <Users className="h-7 w-7 text-indigo-600" aria-hidden="true" />
          </motion.div>
          <div>
            <p className="text-lg font-extrabold text-slate-700">בחר תלמיד להצגת הפורטל</p>
            <p className="mt-1 text-sm text-slate-400">
              השתמש בלוח הפיתוח למעלה לבחירת כיתה ותלמיד
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : !profile ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          לא ניתן לטעון את פרופיל התלמיד. נסה שוב.
        </div>
      ) : (
        <ProfileView profile={profile} className={selectedClass?.name ?? ''} workoutPlan={workoutPlan} studentId={selectedStudentId} />
      )}
    </div>
  );
}
