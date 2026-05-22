'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'framer-motion';
import {
  Activity,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Dumbbell,
  Leaf,
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
import { useStudentProfile } from '@/hooks/use-student-profile';
import { DEV_BYPASS_TOKEN, getToken } from '@/lib/api-client';
import { cn, formatRawValue } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Workout plan types ───────────────────────────────────────────────────────

interface WorkoutExercise { name: string; detail: string; }
interface WorkoutWeek { week: number; focus: string; emoji: string; exercises: WorkoutExercise[]; }
interface WorkoutPlanPayload { plan: WorkoutWeek[]; savedAt: number; }

function workoutPlanKey(studentId: string): string {
  return `fitgrade-workout-plan-${studentId}`;
}

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

// ─── Light-theme colour helpers ───────────────────────────────────────────────

function gradeColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function gradeBgIcon(score: number): string {
  if (score >= 90) return 'bg-emerald-50 border border-emerald-100';
  if (score >= 75) return 'bg-blue-50 border border-blue-100';
  if (score >= 60) return 'bg-amber-50 border border-amber-100';
  return 'bg-red-50 border border-red-100';
}

function gradePill(score: number): string {
  if (score >= 90) return 'bg-emerald-100 text-emerald-800';
  if (score >= 75) return 'bg-blue-100 text-blue-800';
  if (score >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

const STUDENT_SEMESTER_KEY = 'fitgrade-student-semester-v1';

// Shared light frosted-glass panel (violet — used by inner sub-components)
const GLASS_PANEL = 'bg-white/50 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(139,92,246,0.08)]';

// Per-semester theme tokens for outer/top-level elements
const SEMESTER_THEME = {
  A: {
    bg: 'bg-[linear-gradient(to_bottom_right,#f5f3ff,#ede9fe,#ffffff)]',
    glass: GLASS_PANEL,
    orb1: 'bg-violet-200/40',
    orb2: 'bg-emerald-200/30',
    icon1: 'text-violet-400',
    icon2: 'text-emerald-500',
    icon3: 'text-indigo-400',
    icon4: 'text-amber-400',
    accent: 'bg-gradient-to-l from-violet-700 to-emerald-600',
    shimmerGradient: 'linear-gradient(90deg,#7c3aed,#06b6d4,#10b981,#7c3aed)',
    refLine: '#7c3aed',
    badgeActive: 'bg-violet-600 text-white',
    label: "סמסטר א'",
  },
  B: {
    bg: 'bg-[linear-gradient(to_bottom_right,#ecfdf5,#d1fae5,#f0fdf4)]',
    glass: 'bg-white/50 backdrop-blur-2xl border border-emerald-100/80 shadow-[0_4px_24px_rgba(16,185,129,0.08)]',
    orb1: 'bg-emerald-200/40',
    orb2: 'bg-teal-200/30',
    icon1: 'text-emerald-400',
    icon2: 'text-teal-500',
    icon3: 'text-emerald-600',
    icon4: 'text-amber-400',
    accent: 'bg-gradient-to-l from-emerald-700 to-teal-600',
    shimmerGradient: 'linear-gradient(90deg,#059669,#0891b2,#7c3aed,#059669)',
    refLine: '#059669',
    badgeActive: 'bg-emerald-600 text-white',
    label: "סמסטר ב'",
  },
} as const;

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
      className="fixed start-4 top-20 z-[9998] max-w-xs rounded-2xl backdrop-blur-2xl bg-white/80 border border-white/80 p-4 shadow-[0_8px_32px_rgba(109,40,217,0.14)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">תוכנית חדשה ממתינה לך!</p>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">המורה עדכן את האימונים שלך.</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-violet-50 hover:text-slate-600 transition-colors"
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
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.55 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl backdrop-blur-2xl bg-white/90 border border-white/80 p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.15)]"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-300"
          style={{ boxShadow: '0 0 40px rgba(251,191,36,0.45), 0 0 80px rgba(251,191,36,0.20)' }}
        >
          <Trophy className="h-10 w-10 text-white drop-shadow-md" aria-hidden="true" />
        </motion.div>
        <h2 className="mb-2 text-3xl font-black text-slate-800">כל הכבוד!</h2>
        <p className="mb-8 text-sm leading-relaxed text-slate-500">
          סיימת את האימון היומי שלך בהצלחה.<br />
          המשך כך — אתה מתחזק!
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-600 py-3 text-base font-bold text-white shadow-[0_4px_20px_rgba(139,92,246,0.35)] transition-opacity hover:opacity-90 active:scale-95"
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
      const pct = totalCount > 0 ? Math.round((next.size / totalCount) * 100) : 0;
      try { localStorage.setItem(`fitgrade-progress-${studentId}`, String(pct)); } catch { /* quota */ }
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
      className={cn('rounded-3xl overflow-hidden', GLASS_PANEL)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-violet-100/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
            <Dumbbell className="h-5 w-5 text-violet-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">האימון היומי שלך</p>
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
              <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-3">
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-violet-100/60 px-5 py-3">
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

      <AnimatePresence>
        {showCelebration && (
          <CelebrationModal onClose={() => setShowCelebration(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Vibrant palette for light-bg multi-line progress chart */
const LINE_COLORS = ['#7c3aed', '#059669', '#d97706', '#2563eb', '#db2777', '#dc2626'] as const;
const NATIONAL_NORM = 74;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
          <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/60" />
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

function kpiGlow(colorClass: string): string {
  if (colorClass.includes('emerald')) return 'rgba(16,185,129,0.22)';
  if (colorClass.includes('blue'))    return 'rgba(37,99,235,0.18)';
  if (colorClass.includes('amber'))   return 'rgba(217,119,6,0.18)';
  if (colorClass.includes('red'))     return 'rgba(220,38,38,0.18)';
  return 'rgba(148,163,184,0.10)';
}

function KpiCard({
  label, value, sub, icon: Icon, colorClass, bgClass, index,
}: KpiCardProps): React.JSX.Element {
  const glow = kpiGlow(colorClass);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ease: EASE, duration: 0.45, delay: index * 0.09 }}
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={{ scale: 0.95, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      className="relative overflow-hidden rounded-2xl p-4"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.20) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.70)',
      }}
    >
      {/* Top-edge prismatic shimmer line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" aria-hidden="true" />

      {/* Colored ambient radial glow — matches metric colour */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 20% 80%, ${glow}, transparent 65%)` }}
        aria-hidden="true"
      />

      {/* Large watermark icon for depth */}
      <div
        className="pointer-events-none absolute inset-0 flex items-end justify-start ps-1 pb-1 opacity-[0.07] mix-blend-multiply"
        aria-hidden="true"
      >
        <Icon className="h-24 w-24 text-slate-900" />
      </div>

      <div className="relative">
        <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm', bgClass)}>
          <Icon className={cn('h-4 w-4', colorClass)} aria-hidden="true" />
        </div>
        <div className={cn('text-4xl font-black tabular-nums drop-shadow-sm', colorClass)}>{value}</div>
        {sub && (
          <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{sub}</div>
        )}
        <div className="mt-1 text-xs text-slate-500">{label}</div>
      </div>
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

// ─── Dynamic glow dot ─────────────────────────────────────────────────────────

function GlowDot({ cx, cy, value }: { cx?: number; cy?: number; value?: number | null }): React.JSX.Element {
  if (cx == null || cy == null || value == null) return <g />;
  const fill =
    value >= 90 ? '#059669' :
    value >= 75 ? '#2563eb' :
    value >= 60 ? '#d97706' : '#dc2626';
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

// ─── Progress Chart ────────────────────────────────────────────────────────────

function ProgressChart({ testHistories, refLineColor }: { testHistories: StudentTestHistory[]; refLineColor: string }): React.JSX.Element {
  const chartData = useMemo(() => buildChartData(testHistories), [testHistories]);
  const hasData = chartData.length > 0 && testHistories.some((t) => t.history.length > 0);

  // Remount Recharts when the chart first enters the viewport so the built-in
  // line-draw animation (animationDuration) always plays as a scroll-triggered effect.
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.25 });
  const [chartKey, setChartKey] = useState(0);
  useEffect(() => {
    if (isInView) setChartKey((k) => k + 1);
  }, [isInView]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <TrendingUp className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-500">אין נתוני התקדמות עדיין</p>
        <p className="text-sm text-slate-400">הגרף יופיע לאחר תיעוד המבחן הראשון</p>
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ease: EASE, duration: 0.55 }}
      className="overflow-hidden rounded-2xl bg-white/50 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(139,92,246,0.08)] p-4"
    >
      <ResponsiveContainer width="100%" height={268}>
        <LineChart key={chartKey} data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(139,92,246,0.20)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(139,92,246,0.12)',
              fontSize: 12,
              color: '#1e293b',
            }}
            formatter={(value: number, name: string) => {
              const test = testHistories.find((t) => t.testTypeId === name);
              return [`${value} — ${getHebrewGradeLabel(value)}`, test?.nameHe ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#64748b' }}
            formatter={(value: string) => {
              const test = testHistories.find((t) => t.testTypeId === value);
              return test?.nameHe ?? value;
            }}
          />
          <ReferenceLine
            y={NATIONAL_NORM}
            stroke={refLineColor}
            strokeWidth={2}
            strokeDasharray="6 3"
            label={{
              value: `נורמה ארצית ${NATIONAL_NORM}`,
              fill: refLineColor,
              fontSize: 10,
              fontWeight: 700,
            }}
          />
          {testHistories.map((test, i) => (
            <Line
              key={test.testTypeId}
              type="monotone"
              dataKey={test.testTypeId}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={3}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="ease-out"
              dot={<GlowDot />}
              activeDot={{ r: 7, strokeWidth: 2, stroke: '#ffffff', fill: LINE_COLORS[i % LINE_COLORS.length] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─── Grades Table ─────────────────────────────────────────────────────────────

function GradesTable({ testHistories }: { testHistories: StudentTestHistory[] }): React.JSX.Element {
  if (testHistories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <Target className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-500">אין תוצאות מבחנים עדיין</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl', GLASS_PANEL)}>
      <div className="overflow-x-auto">
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
              <span className={cn('text-2xl font-black tabular-nums', gradeColor(test.latestGrade))}>
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
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
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
    <div className={cn('overflow-hidden rounded-2xl', GLASS_PANEL)}>
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
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', gradeBgIcon(value))}>
              <Icon className={cn('h-4 w-4', gradeColor(value))} aria-hidden="true" />
            </div>
            <span className={cn('text-2xl font-extrabold tabular-nums', gradeColor(value))}>{value}</span>
            <span className="text-center text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 bg-gradient-to-l from-indigo-50/60 to-violet-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">ציון תלמידות ממוצע</span>
          <span className={cn('text-3xl font-extrabold tabular-nums', gradeColor(latest.compositeScore))}>
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
    <div className={cn('overflow-hidden rounded-2xl', GLASS_PANEL)}>
      <div className="bg-gradient-to-l from-indigo-50 to-violet-50 border-b border-indigo-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">ציון גמר מומלץ</p>
            <p className={cn('mt-1 text-sm font-bold', gradeColor(finalGrade.recommendedGrade))}>
              {getHebrewGradeLabel(finalGrade.recommendedGrade)}
            </p>
          </div>
          <span className={cn('text-5xl font-black tabular-nums', gradeColor(finalGrade.recommendedGrade))}>
            {getHebrewGradeLabel(finalGrade.recommendedGrade)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              כושר גופני ({finalGrade.testWeight}%) · ממוצע {getHebrewGradeLabel(finalGrade.fitnessAvg)}
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
              תלמידות ({finalGrade.talmidautWeight}%) · ממוצע {getHebrewGradeLabel(finalGrade.talmidautAvg)}
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
          <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(finalGrade.recommendedGrade))}>
            {getHebrewGradeLabel(finalGrade.recommendedGrade)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Semester Empty State ─────────────────────────────────────────────────────

function SemesterEmptyState({
  activeSemester,
  glassClass,
}: {
  activeSemester: 'A' | 'B';
  glassClass: string;
}): React.JSX.Element {
  const semLabel = activeSemester === 'A' ? "א'" : "ב'";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.5 }}
      className={cn('rounded-3xl p-10 text-center', glassClass)}
      role="status"
      aria-live="polite"
    >
      <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-bold text-slate-700">
        {`נתוני מחצית ${semLabel} טרם הוזנו במערכת`}
      </h2>
      <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
        מורה הכיתה טרם הזין תוצאות מבחנים למחצית זו. הנתונים יופיעו כאן לאחר רישום השיעור הראשון.
      </p>
    </motion.div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView({
  profile,
  className,
  workoutPlan,
  studentId,
  activeSemester,
  onSemesterChange,
}: {
  profile: StudentProfile;
  className: string;
  workoutPlan: WorkoutPlanPayload | null;
  studentId: string;
  activeSemester: 'A' | 'B';
  onSemesterChange: (sem: 'A' | 'B') => void;
}): React.JSX.Element {
  const theme = SEMESTER_THEME[activeSemester];
  const hasAnyData = profile.testHistories.some((t) => t.history.length > 0) || profile.overallAvg > 0;
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
      bgClass: profile.overallAvg > 0 ? gradeBgIcon(profile.overallAvg) : 'bg-slate-50',
      index: 0,
    },
    {
      label: 'ציון גמר מומלץ',
      value: profile.finalGrade.recommendedGrade > 0 ? profile.finalGrade.recommendedGrade : '—',
      sub: profile.finalGrade.recommendedGrade > 0 ? getHebrewGradeLabel(profile.finalGrade.recommendedGrade) : undefined,
      icon: TrendingUp,
      colorClass: profile.finalGrade.recommendedGrade > 0 ? gradeColor(profile.finalGrade.recommendedGrade) : 'text-slate-400',
      bgClass: profile.finalGrade.recommendedGrade > 0 ? gradeBgIcon(profile.finalGrade.recommendedGrade) : 'bg-slate-50',
      index: 1,
    },
    {
      label: 'נוכחות',
      value: `${attendancePct}%`,
      sub: attendancePct >= 80 ? 'תקין' : attendancePct >= 60 ? 'לתשומת לב' : 'חריג',
      icon: Users,
      colorClass: attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-red-600',
      bgClass: attendancePct >= 80 ? 'bg-emerald-50 border border-emerald-100' : attendancePct >= 60 ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100',
      index: 2,
    },
    {
      label: 'תלמידות ספורטיבית',
      value: profile.finalGrade.talmidautAvg > 0 ? profile.finalGrade.talmidautAvg : '—',
      sub: profile.finalGrade.talmidautAvg > 0 ? getHebrewGradeLabel(profile.finalGrade.talmidautAvg) : undefined,
      icon: Star,
      colorClass: profile.finalGrade.talmidautAvg > 0 ? gradeColor(profile.finalGrade.talmidautAvg) : 'text-slate-400',
      bgClass: profile.finalGrade.talmidautAvg > 0 ? gradeBgIcon(profile.finalGrade.talmidautAvg) : 'bg-slate-50',
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
        className="relative overflow-hidden rounded-3xl bg-white/50 backdrop-blur-2xl border border-white/80 p-6 shadow-[0_4px_24px_rgba(139,92,246,0.08)]"
      >
        {/* Prismatic shimmer overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(139,92,246,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(16,185,129,0.07),transparent_55%)]" />

        {/* Athlete watermark — fades left-to-right on the physical left side */}
        <div
          className="pointer-events-none absolute top-0 h-full w-40 opacity-[0.08] mix-blend-multiply"
          style={{ left: 0, maskImage: 'linear-gradient(to right, black, transparent)' }}
          aria-hidden="true"
        >
          <Dumbbell className="h-full w-full text-violet-700" style={{ objectFit: 'contain' }} />
        </div>

        <div className="relative">
          {/* FitGrade logo with shimmer */}
          <p
            className="text-xs font-black uppercase tracking-[0.2em] bg-clip-text text-transparent"
            style={{
              backgroundImage: theme.shimmerGradient,
              backgroundSize: '200%',
              animation: 'shimmer 3s linear infinite',
            }}
          >
            FitGrade
          </p>
          <h1 className={cn('mt-1 text-xl font-black md:text-2xl bg-clip-text text-transparent', theme.accent)}>
            שלום, {profile.firstName} {profile.lastName} 👋
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{className}</span>
            <span aria-hidden="true">·</span>
            <span>
              קוד תלמיד:{' '}
              <span className="font-mono font-bold text-slate-700">{profile.studentCode}</span>
            </span>
          </div>

          {/* Semester selector */}
          <div className="mt-3 flex items-center gap-1 w-fit rounded-xl bg-white/40 p-1">
            {(['A', 'B'] as const).map((sem) => (
              <button
                key={sem}
                type="button"
                onClick={() => onSemesterChange(sem)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-300',
                  activeSemester === sem ? SEMESTER_THEME[sem].badgeActive : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {SEMESTER_THEME[sem].label}
              </button>
            ))}
          </div>
        </div>
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

      {/* ── Data sections — gated by hasAnyData ─────────────────────────── */}
      {hasAnyData ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpiCards.map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>

          {/* Progress Chart */}
          <section aria-labelledby="progress-heading">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" aria-hidden="true" />
              <h2 id="progress-heading" className="text-base font-bold text-slate-800">
                גרף התקדמות
              </h2>
            </div>
            <ProgressChart testHistories={profile.testHistories} refLineColor={theme.refLine} />
          </section>

          {/* Grades table + Attendance */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2" aria-labelledby="grades-heading">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h2 id="grades-heading" className="text-base font-bold text-slate-800">
                  פירוט ציונים לפי מבחן
                </h2>
              </div>
              <GradesTable testHistories={profile.testHistories} />
            </section>

            <section aria-labelledby="attendance-heading">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h2 id="attendance-heading" className="text-base font-bold text-slate-800">
                  נוכחות
                </h2>
              </div>
              <div className={cn('overflow-hidden rounded-2xl p-4 space-y-4', GLASS_PANEL)}>
                <div className="flex flex-col items-center py-4">
                  <span className={cn(
                    'text-5xl font-black tabular-nums',
                    attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {attendancePct}%
                  </span>
                  <span className="mt-1 text-xs text-slate-500">אחוז נוכחות</span>
                </div>

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

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">שיעורים אחרונים</p>
                  <AttendanceTrend trend={profile.attendanceTrend} />
                </div>
              </div>
            </section>
          </div>

          {/* Talmidaut + Final Grade */}
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
        </>
      ) : (
        <SemesterEmptyState activeSemester={activeSemester} glassClass={theme.glass} />
      )}

      {/* ── Move to Semester B card ─────────────────────────────────────── */}
      {activeSemester === 'A' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: EASE, delay: 0.5, duration: 0.4 }}
          className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-6 text-center shadow-[0_4px_24px_rgba(16,185,129,0.08)]"
        >
          <Leaf className="mx-auto h-8 w-8 text-emerald-500 mb-2" aria-hidden="true" />
          <h3 className="font-bold text-slate-700">מוכן לסמסטר ב&apos;?</h3>
          <p className="mt-1 text-sm text-slate-500">עבור לתצוגת סמסטר ב&apos; כדי לראות את הנתונים החדשים.</p>
          <motion.button
            type="button"
            onClick={() => onSemesterChange('B')}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            whileHover={{ scale: 1.09, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
            whileTap={{ scale: 0.95 }}
            className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.40)] hover:bg-emerald-700"
          >
            מעבר לסמסטר ב&apos; ←
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Dev bypass mock data ─────────────────────────────────────────────────────

const DEV_MOCK_CLASS_NAME = "ז'2 בנים (Dev)";

// Semester A — rich mock data so all UI sections are exercised in dev mode.
const DEV_MOCK_PROFILE_A: StudentProfile = {
  id: 'dev-student-1',
  firstName: 'דניאל',
  lastName: 'לוי (פרופיל מבחן)',
  dateOfBirth: '2011-03-15',
  gender: 'MALE',
  studentCode: 'DEV001',
  attendancePct: 87,
  attendanceTrend: [100, 100, 0, 100, 100, 100],
  overallAvg: 83,
  testHistories: [
    {
      testTypeId: 'tt-run-2000',
      nameHe: 'ריצת 2000 מטר',
      unit: 'דקות:שניות',
      inputType: 'TIME',
      latestGrade: 88,
      latestRawValue: 522,
      history: [
        { month: "ינו'", grade: 72 },
        { month: 'מרץ',  grade: 80 },
        { month: 'מאי',  grade: 88 },
      ],
    },
    {
      testTypeId: 'tt-pushups',
      nameHe: 'שכיבות סמיכה',
      unit: 'חזרות',
      inputType: 'REPS',
      latestGrade: 79,
      latestRawValue: 32,
      history: [
        { month: "ינו'", grade: 65 },
        { month: 'מרץ',  grade: 72 },
        { month: 'מאי',  grade: 79 },
      ],
    },
    {
      testTypeId: 'tt-sprint-60',
      nameHe: 'ריצת 60 מטר',
      unit: 'שניות',
      inputType: 'TIME',
      latestGrade: 82,
      latestRawValue: 8.7,
      history: [
        { month: "ינו'", grade: 74 },
        { month: 'מאי',  grade: 82 },
      ],
    },
    {
      testTypeId: 'tt-situps',
      nameHe: 'כפיפות בטן',
      unit: 'חזרות/דקה',
      inputType: 'REPS',
      latestGrade: 0,
      latestRawValue: null,
      history: [],
    },
  ],
  talmidautRecords: [
    {
      id: 'tal-dev-1',
      participation: 90,
      uniform: 85,
      behavior: 92,
      compositeScore: 89,
      notes: 'תלמיד מצטיין — הערה שנוצרה ע"י ניסוח חכם [Dev Mock]',
      recordedAt: '2026-04-15T10:00:00.000Z',
    },
  ],
  finalGrade: {
    fitnessAvg: 83,
    talmidautAvg: 89,
    recommendedGrade: 86,
    testWeight: 60,
    talmidautWeight: 40,
  },
};

// Semester B — intentionally empty so the SemesterEmptyState renders in dev mode.
const DEV_MOCK_PROFILE_B: StudentProfile = {
  id: 'dev-student-1',
  firstName: 'דניאל',
  lastName: 'לוי (פרופיל מבחן)',
  dateOfBirth: '2011-03-15',
  gender: 'MALE',
  studentCode: 'DEV001',
  attendancePct: 0,
  attendanceTrend: [],
  overallAvg: 0,
  testHistories: [],
  talmidautRecords: [],
  finalGrade: { fitnessAvg: 0, talmidautAvg: 0, recommendedGrade: 0, testWeight: 60, talmidautWeight: 40 },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function parseJwtPayload(token: string): { sub: string; classId?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]!)) as { sub: string; classId?: string };
    return payload;
  } catch {
    return null;
  }
}

export default function StudentDashboardPage(): React.JSX.Element {
  const [workoutPlan, setWorkoutPlan]           = useState<WorkoutPlanPayload | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [jwtIds, setJwtIds]   = useState<{ studentId: string; classId: string } | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [activeSemester, setActiveSemester] = useState<'A' | 'B'>(() => {
    if (typeof window === 'undefined') return 'A';
    return (localStorage.getItem(STUDENT_SEMESTER_KEY) as 'A' | 'B') ?? 'A';
  });

  const handleSemesterChange = (sem: 'A' | 'B'): void => {
    setActiveSemester(sem);
    localStorage.setItem(STUDENT_SEMESTER_KEY, sem);
  };

  // Parallax MotionValues — each icon drifts at a different rate as the user scrolls
  const { scrollY } = useScroll();
  const py1 = useTransform(scrollY, [0, 900], [0, -70]);  // Dumbbell — fastest
  const py2 = useTransform(scrollY, [0, 900], [0, -40]);  // Activity — mid
  const py3 = useTransform(scrollY, [0, 900], [0, -55]);  // Zap — mid-fast
  const py4 = useTransform(scrollY, [0, 900], [0, -28]);  // Trophy — slowest

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = getToken();
    if (!token) return;
    if (token === DEV_BYPASS_TOKEN) {
      setDevMode(true);
      setJwtIds({ studentId: 'dev-student-1', classId: 'dev-class-1' });
      return;
    }
    const payload = parseJwtPayload(token);
    if (payload?.sub && payload?.classId) {
      setJwtIds({ studentId: payload.sub, classId: payload.classId });
    }
  }, []);

  const { data: profileData, isLoading: profileLoading } = useStudentProfile(
    devMode ? '' : (jwtIds?.classId ?? ''),
    devMode ? '' : (jwtIds?.studentId ?? ''),
    devMode ? undefined : activeSemester,
  );

  // In dev mode, serve semester-specific mocks so the empty-state path is testable
  // without hitting the API. Semester A → rich data. Semester B → empty (no records).
  const profile: StudentProfile | undefined = devMode
    ? (activeSemester === 'A' ? DEV_MOCK_PROFILE_A : DEV_MOCK_PROFILE_B)
    : profileData;

  useEffect(() => {
    if (!jwtIds?.studentId) return;
    const key = workoutPlanKey(jwtIds.studentId);

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
        setTimeout(() => setShowNotification(false), 8000);
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [jwtIds?.studentId]);

  const isLoading = !jwtIds || (!devMode && profileLoading);

  return (
    <div
      className={cn('relative min-h-screen w-full overflow-x-hidden text-slate-800 transition-all duration-700', SEMESTER_THEME[activeSemester].bg)}
      data-semester={activeSemester}
    >

      {/* ── Floating background sport icons ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Dumbbell — outer: parallax scroll / inner: float loop */}
        <motion.div style={{ y: py1 }} className="absolute -top-8 start-[8%] opacity-[0.12]">
          <motion.div
            animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Dumbbell className={cn('h-56 w-56', SEMESTER_THEME[activeSemester].icon1)} style={{ filter: 'blur(0.5px)' }} />
          </motion.div>
        </motion.div>

        {/* Activity — outer: parallax scroll / inner: float loop */}
        <motion.div style={{ y: py2 }} className="absolute top-[35%] end-[5%] opacity-[0.10]">
          <motion.div
            animate={{ y: [0, 14, 0], rotate: [0, -6, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          >
            <Activity className={cn('h-72 w-72', SEMESTER_THEME[activeSemester].icon2)} style={{ filter: 'blur(1px)' }} />
          </motion.div>
        </motion.div>

        {/* Zap — outer: parallax scroll / inner: float loop */}
        <motion.div style={{ y: py3 }} className="absolute bottom-[15%] start-[3%] opacity-[0.11]">
          <motion.div
            animate={{ y: [0, 22, 0], rotate: [0, 12, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          >
            <Zap className={cn('h-48 w-48', SEMESTER_THEME[activeSemester].icon3)} style={{ filter: 'blur(0.5px)' }} />
          </motion.div>
        </motion.div>

        {/* Trophy — outer: parallax scroll / inner: float loop */}
        <motion.div style={{ y: py4 }} className="absolute bottom-[8%] end-[10%] opacity-[0.09]">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <Trophy className={cn('h-40 w-40', SEMESTER_THEME[activeSemester].icon4)} style={{ filter: 'blur(1px)' }} />
          </motion.div>
        </motion.div>

        {/* Soft ambient glow orbs */}
        <div className={cn('absolute top-[-5%] start-[25%] h-[500px] w-[500px] rounded-full blur-[100px]', SEMESTER_THEME[activeSemester].orb1)} />
        <div className={cn('absolute bottom-[10%] end-[20%] h-[400px] w-[400px] rounded-full blur-[90px]', SEMESTER_THEME[activeSemester].orb2)} />
      </div>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full space-y-5 px-3 py-4 md:px-5 md:py-5">

        {/* ── Dev mode banner ───────────────────────────────────────────── */}
        {devMode && (
          <div className="rounded-xl border border-dashed border-amber-400/60 bg-amber-50/80 backdrop-blur-sm px-4 py-2 text-center text-xs font-mono font-semibold text-amber-700">
            ⚡ מצב פיתוח — נתוני מבחן בלבד · לא מחובר לשרת
          </div>
        )}

        {/* ── Workout plan notification toast ─────────────────────────── */}
        <AnimatePresence>
          {showNotification && (
            <PlanNotificationToast onDismiss={() => setShowNotification(false)} />
          )}
        </AnimatePresence>

        {/* ── Main content ─────────────────────────────────────────────── */}
        {isLoading ? (
          <DashboardSkeleton />
        ) : !profile ? (
          <div className="rounded-2xl border border-red-100 bg-red-50/80 px-5 py-4 text-sm text-red-700">
            לא ניתן לטעון את פרופיל התלמיד. נסה שוב.
          </div>
        ) : (
          <ProfileView
            profile={profile}
            className={devMode ? DEV_MOCK_CLASS_NAME : ''}
            workoutPlan={workoutPlan}
            studentId={jwtIds!.studentId}
            activeSemester={activeSemester}
            onSemesterChange={handleSemesterChange}
          />
        )}
      </div>
    </div>
  );
}
