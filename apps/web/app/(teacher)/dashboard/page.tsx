'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type {
  BelowNormItem,
  ClassData,
  DashboardClassStat,
  DashboardStats,
  EventData,
  MissingResultItem,
  RecentSession,
  TopStudentItem,
} from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { useTopStudents } from '@/hooks/use-top-students';
import { useUpcomingEvent } from '@/hooks/use-events';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardX,
  Crown,
  Dumbbell,
  History,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getHebrewGradeLabel } from '@fitgrade/types';

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE, duration: 0.65, staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.55 } },
};

const STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// ─── Inner shimmer component (subtle violet sheen on white glass cards) ───────

function CardShimmer(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-y-0 w-1/2"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.09), transparent)' }}
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
      />
    </div>
  );
}

// ─── Animated number counter ─────────────────────────────────────────────────

interface AnimatedNumberProps { to: number; suffix?: string; className?: string; duration?: number }

function AnimatedNumber({ to, suffix = '', className, duration = 1.4 }: AnimatedNumberProps): React.JSX.Element {
  const count   = useMotionValue(0);
  const display = useTransform(count, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    const controls = animate(count, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [to, duration, count]);

  return <motion.span className={className}>{display}</motion.span>;
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-72 animate-pulse rounded-2xl bg-violet-200/60" />
        <div className="h-4 w-48 animate-pulse rounded-xl bg-violet-100/80" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-36 animate-pulse rounded-3xl bg-white/50 shadow-lg shadow-violet-200/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-3xl bg-white/50 shadow-lg shadow-violet-200/50 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/50 shadow-lg shadow-violet-200/50" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-52 animate-pulse rounded-3xl bg-white/50 shadow-lg shadow-violet-200/50" />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ministry of Education national fitness norm average. */
const MINISTRY_NORM = 74;

type FitnessLevel = 'above' | 'average' | 'below';

function fitnessLevel(avg: number): FitnessLevel {
  if (avg >= 80) return 'above';
  if (avg >= 65) return 'average';
  return 'below';
}

const LEVEL_CONFIG: Record<FitnessLevel, { label: string; bg: string; text: string; dot: string }> = {
  above:   { label: 'מעל לנורמה',  bg: 'bg-emerald-100',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  average: { label: 'ממוצע',        bg: 'bg-amber-100',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  below:   { label: 'מתחת לנורמה', bg: 'bg-red-100',      text: 'text-red-700',     dot: 'bg-red-500'     },
};

/** Alternating vivid badge colors for the session date pill. */
const BADGE_STYLES = [
  { bg: 'bg-indigo-600',  text: 'text-white', pill: 'bg-indigo-100 text-indigo-700'   },
  { bg: 'bg-teal-600',    text: 'text-white', pill: 'bg-teal-100   text-teal-700'     },
  { bg: 'bg-violet-600',  text: 'text-white', pill: 'bg-violet-100 text-violet-700'   },
  { bg: 'bg-emerald-600', text: 'text-white', pill: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-500',   text: 'text-white', pill: 'bg-amber-100  text-amber-700'    },
] as const;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function formatSession(isoString: string): { day: string; month: string; dayLabel: string } {
  const date = new Date(isoString);
  return {
    day:      date.getDate().toString().padStart(2, '0'),
    month:    (date.getMonth() + 1).toString().padStart(2, '0'),
    dayLabel: DAY_NAMES[date.getDay()] ?? '',
  };
}

// ─── Mock / demo data ─────────────────────────────────────────────────────────
// Used as fallback when the API returns no data (empty DB or backend unreachable).

const MOCK_STATS: DashboardStats = {
  overallFitnessAvg:    76,
  overallAttendancePct: 88,
  totalBelowNormCount:  4,
  totalStudents:        67,
  pendingResultsCount:  3,
  classStats: [
    { classId: 'cls-1', fitnessAvg: 79, attendancePct: 91, belowNormCount: 1 },
    { classId: 'cls-2', fitnessAvg: 71, attendancePct: 84, belowNormCount: 2 },
    { classId: 'cls-3', fitnessAvg: 82, attendancePct: 93, belowNormCount: 0 },
  ],
  recentSessions: [
    { sessionId: 'sess-1', classId: 'cls-1', className: "י'1", testNameHe: 'ריצת 2000 מטר',   conductedAt: '2026-03-13T10:00:00.000Z' },
    { sessionId: 'sess-2', classId: 'cls-2', className: "י'2", testNameHe: 'כפיפות בטן',      conductedAt: '2026-03-11T09:00:00.000Z' },
    { sessionId: 'sess-3', classId: 'cls-3', className: "ט'1", testNameHe: 'שכיבות סמיכה',    conductedAt: '2026-03-10T11:00:00.000Z' },
    { sessionId: 'sess-4', classId: 'cls-1', className: "י'1", testNameHe: 'קפיצה למרחק',     conductedAt: '2026-03-06T10:00:00.000Z' },
    { sessionId: 'sess-5', classId: 'cls-2', className: "ח'2", testNameHe: 'ריצת מקום',       conductedAt: '2026-03-04T08:30:00.000Z' },
  ],
};

const MOCK_TOP_STUDENTS: TopStudentItem[] = [
  { rank: 1, studentId: 'stu-1', studentName: 'דניאל כהן', classId: 'cls-1', className: "י'1", avgGrade: 94, resultCount: 5, gender: 'MALE'   },
  { rank: 2, studentId: 'stu-2', studentName: 'נועה לוי',  classId: 'cls-2', className: "ט'2", avgGrade: 91, resultCount: 4, gender: 'FEMALE' },
  { rank: 3, studentId: 'stu-3', studentName: 'עמית ברק',  classId: 'cls-3', className: "י'2", avgGrade: 88, resultCount: 6, gender: 'MALE'   },
];

const MOCK_UPCOMING_EVENT: EventData = {
  id:          'evt-1',
  title:       'יום ספורט בית-ספרי',
  description: null,
  eventDate:   '2026-03-25T09:00:00.000Z',
  location:    'מגרש החוץ',
  teacherId:   'teacher-mock',
  createdAt:   '2026-03-01T00:00:00.000Z',
  updatedAt:   '2026-03-01T00:00:00.000Z',
};

const MOCK_CLASSES: ClassData[] = [
  { id: 'cls-1', name: "י'1 — חינוך גופני", academicYear: '2025-2026', semester: 'B', joinCode: 'ABC123', joinCodeExpiresAt: null, studentCount: 28, createdAt: '2025-09-01T00:00:00.000Z' },
  { id: 'cls-2', name: "י'2 — חינוך גופני", academicYear: '2025-2026', semester: 'B', joinCode: 'DEF456', joinCodeExpiresAt: null, studentCount: 22, createdAt: '2025-09-01T00:00:00.000Z' },
  { id: 'cls-3', name: "ט'1 — חינוך גופני", academicYear: '2025-2026', semester: 'B', joinCode: 'GHI789', joinCodeExpiresAt: null, studentCount: 17, createdAt: '2025-09-01T00:00:00.000Z' },
];

// ─── SWR fetcher for drill-down data ─────────────────────────────────────────

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Missing Results Modal ────────────────────────────────────────────────────

function MissingResultsModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const { data, isLoading } = useSWR<MissingResultItem[]>(
    open ? '/dashboard/missing-results' : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-lg rounded-3xl border border-amber-200/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
              <ClipboardX className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-amber-900">תוצאות חסרות</DialogTitle>
              <p className="text-xs text-amber-700/70">תלמידים שלא ניגשו למבחן</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2 mt-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-2xl bg-amber-50" />
              ))}
            </div>
          )}

          {!isLoading && data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardX className="h-8 w-8 text-amber-400/60" aria-hidden="true" />
              <p className="text-sm font-semibold text-amber-700">אין תוצאות חסרות</p>
              <p className="text-xs text-amber-600/70">כל התלמידים ניגשו לכל המבחנים</p>
            </div>
          )}

          {!isLoading && data && data.length > 0 && data.map((item, i) => {
            const { day, month } = formatSession(item.sessionDate);
            return (
              <motion.div
                key={`${item.studentId}-${item.sessionId}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: EASE, duration: 0.35, delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200/60 px-4 py-3"
              >
                <div className="shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-amber-500 text-white">
                  <span className="text-xs font-extrabold leading-none">{day}</span>
                  <span className="text-[9px] leading-none opacity-80 mt-0.5">{month}/</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-purple-950 truncate">{item.studentName}</p>
                  <p className="text-xs text-purple-600/70 truncate">{item.className} · {item.testNameHe}</p>
                </div>
                <Link
                  href={`/classes/${item.classId}/session/${item.sessionId}/manual`}
                  className="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline underline-offset-2 transition-colors"
                >
                  הזן עכשיו
                </Link>
              </motion.div>
            );
          })}
        </div>

        {!isLoading && data && data.length > 0 && (
          <p className="text-center text-xs text-amber-600/70 pt-1">
            {data.length} תוצאות חסרות
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Below Norm Modal ─────────────────────────────────────────────────────────

function BelowNormModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const { data, isLoading } = useSWR<BelowNormItem[]>(
    open ? '/dashboard/below-norm-details' : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-lg rounded-3xl border border-red-200/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-red-900">תלמידים לטיפול</DialogTitle>
              <p className="text-xs text-red-600/70">ציון מתחת לנורמה ({data?.[0]?.normThreshold ?? 57})</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2 mt-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-2xl bg-red-50" />
              ))}
            </div>
          )}

          {!isLoading && data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-red-400/60" aria-hidden="true" />
              <p className="text-sm font-semibold text-red-700">אין תלמידים מתחת לנורמה</p>
              <p className="text-xs text-red-600/60">כל התלמידים עומדים בנורמה</p>
            </div>
          )}

          {!isLoading && data && data.length > 0 && data.map((item, i) => (
            <motion.div
              key={`${item.studentId}-${item.testNameHe}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE, duration: 0.35, delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200/60 px-4 py-3"
            >
              <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-red-500 text-white">
                <span className="text-sm font-extrabold leading-none">{item.score}</span>
                <span className="text-[9px] leading-none opacity-80 mt-0.5">{getHebrewGradeLabel(item.score)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-950 truncate">{item.studentName}</p>
                <p className="text-xs text-purple-600/70 truncate">{item.className} · {item.testNameHe}</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-xs font-bold text-red-600">
                  {item.score - item.normThreshold}
                </p>
                <p className="text-[10px] text-red-500/70">מנורמה</p>
              </div>
            </motion.div>
          ))}
        </div>

        {!isLoading && data && data.length > 0 && (
          <p className="text-center text-xs text-red-600/60 pt-1">
            {data.length} תוצאות מתחת לנורמה
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  valueSuffix?: string;
  sub: string;
  icon: typeof Dumbbell;
  iconCapsule: string;
  iconColor: string;
  valueColor: string;
  accentBar?: string;
  trend?: 'up' | 'down' | 'alert' | 'neutral';
  onClick?: () => void;
}

function KpiCard({
  label, value, valueSuffix, sub, icon: Icon,
  iconCapsule, iconColor, valueColor, accentBar, trend, onClick,
}: KpiCardProps): React.JSX.Element {
  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
      whileTap={{ scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      onClick={onClick}
      className={`prismatic-glass flex flex-col gap-3 rounded-3xl p-4 md:p-5 ${onClick ? 'cursor-pointer select-none' : 'cursor-default'}`}
    >
      <CardShimmer />

      {/* Colored top accent strip */}
      {accentBar && <div className={`absolute top-0 inset-x-0 h-1 rounded-t-3xl ${accentBar}`} />}

      <div className="flex items-center justify-between mt-1">
        <p className="text-xs font-bold uppercase tracking-wide text-purple-600/70">{label}</p>
        <motion.div
          className={`pointer-events-none flex h-9 w-9 items-center justify-center rounded-xl ${iconCapsule}`}
          whileHover={{ rotate: 8, scale: 1.1 }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
        >
          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
        </motion.div>
      </div>

      <div>
        <AnimatedNumber
          to={value}
          suffix={valueSuffix ?? ''}
          className={`text-3xl md:text-4xl font-extrabold tabular-nums ${valueColor}`}
          duration={1.6}
        />
        <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${
          trend === 'up'    ? 'text-emerald-600' :
          trend === 'down'  ? 'text-red-600' :
          trend === 'alert' ? 'text-red-600' :
                              'text-purple-500/70'
        }`}>
          {trend === 'up'    && <TrendingUp    className="h-3 w-3" />}
          {trend === 'down'  && <TrendingDown  className="h-3 w-3" />}
          {trend === 'alert' && <AlertTriangle className="h-3 w-3" />}
          <span>{sub}</span>
        </div>
      </div>

      {onClick && (
        <p className="flex items-center gap-1 text-[10px] font-semibold text-violet-500/60 tracking-wide -mt-1">
          לחץ לפרטים
          <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        </p>
      )}
    </motion.div>
  );
}

// ─── Class summary card ───────────────────────────────────────────────────────

const CLASS_STRIPES = [
  'from-indigo-500  to-indigo-700',
  'from-teal-500    to-teal-700',
  'from-violet-500  to-violet-700',
  'from-emerald-500 to-emerald-700',
  'from-orange-500  to-orange-700',
  'from-blue-500    to-blue-700',
] as const;

const SEMESTER_LABELS: Record<'A' | 'B', string> = { A: "סמסטר א'", B: "סמסטר ב'" };

interface ClassSummaryCardProps {
  cls: ClassData;
  stats: DashboardClassStat;
  index: number;
}

function ClassSummaryCard({ cls, stats, index }: ClassSummaryCardProps): React.JSX.Element {
  const stripe    = CLASS_STRIPES[index % CLASS_STRIPES.length]!;
  const level     = fitnessLevel(stats.fitnessAvg);
  const levelCfg  = LEVEL_CONFIG[level];
  const normDelta = stats.fitnessAvg - MINISTRY_NORM;

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
      whileTap={{ scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
    >
      <Link
        href={`/classes/${cls.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-3xl"
      >
        <article className="group prismatic-glass rounded-3xl transition-shadow duration-300">
          <CardShimmer />
          <div className={`h-1.5 w-full bg-gradient-to-r ${stripe}`} />
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-purple-950 leading-tight">{cls.name}</h3>
                <p className="text-xs text-purple-600/70 mt-0.5">
                  {cls.academicYear} · {SEMESTER_LABELS[cls.semester]}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${levelCfg.bg} ${levelCfg.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${levelCfg.dot}`} />
                {levelCfg.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl bg-purple-50 border border-purple-100 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500/70 mb-1">ממוצע כושר</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xl font-extrabold tabular-nums ${level === 'above' ? 'text-emerald-600' : level === 'below' ? 'text-red-600' : 'text-amber-600'}`}>
                    {stats.fitnessAvg}
                  </span>
                  <span className={`text-xs font-bold ${normDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {normDelta >= 0 ? '+' : ''}{normDelta}
                  </span>
                </div>
                <p className="text-[10px] text-purple-400/70 mt-0.5">נורמה: {MINISTRY_NORM}</p>
              </div>
              <div className="rounded-2xl bg-purple-50 border border-purple-100 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500/70 mb-1">נוכחות</p>
                <div className="text-2xl font-extrabold text-purple-950 tabular-nums">{stats.attendancePct}%</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-purple-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.attendancePct >= 90 ? 'bg-emerald-500' : stats.attendancePct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${stats.attendancePct}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-violet-400/70" aria-hidden="true" />
                <span className="text-xs text-purple-600/70">{cls.studentCount} תלמידים</span>
              </div>
              <div className="flex items-center gap-2">
                {stats.belowNormCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {stats.belowNormCount} מתחת לנורמה
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-violet-400/50 group-hover:text-violet-600 transition-colors" aria-hidden="true" />
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const { data: classes, isLoading: classesLoading, error: classesError } = useClasses();
  const { data: stats,   isLoading: statsLoading,   error: statsError   } = useDashboardStats();
  const { data: topStudents } = useTopStudents();
  const { data: upcomingEvent, isLoading: eventLoading } = useUpcomingEvent();

  const [missingOpen,   setMissingOpen]   = useState(false);
  const [belowNormOpen, setBelowNormOpen] = useState(false);

  const isLoading = classesLoading || statsLoading;
  const hasError  = classesError   || statsError;

  // Use real API data when the DB has students; fall back to mock demo data otherwise.
  const hasRealData = Boolean(stats && stats.totalStudents > 0);
  const effectiveStats        = hasRealData ? stats! : MOCK_STATS;
  const effectiveTopStudents  = (topStudents && topStudents.length > 0) ? topStudents : MOCK_TOP_STUDENTS;
  const effectiveEvent        = upcomingEvent ?? MOCK_UPCOMING_EVENT;
  const effectiveClasses      = (classes && classes.length > 0) ? classes : MOCK_CLASSES;

  const statsByClassId = useMemo(
    () => new Map<string, DashboardClassStat>(effectiveStats.classStats.map((s) => [s.classId, s])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveStats.classStats],
  );

  const fitnessAvg     = effectiveStats.overallFitnessAvg;
  const attendancePct  = effectiveStats.overallAttendancePct;
  const belowNormCount = effectiveStats.totalBelowNormCount;
  const totalStudents  = effectiveStats.totalStudents;
  const pendingResults = effectiveStats.pendingResultsCount;
  const recentSessions: RecentSession[] = effectiveStats.recentSessions;

  const normDeltaLabel = fitnessAvg > 0
    ? `${fitnessAvg >= MINISTRY_NORM ? '+' : ''}${fitnessAvg - MINISTRY_NORM} מנורמת משרד החינוך (${MINISTRY_NORM})`
    : 'אין נתונים עדיין';

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="dashboard"
          variants={PAGE_ENTER}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <motion.div variants={ITEM}>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-purple-950">לוח בקרה 👋</h1>
            <p className="text-purple-600/70 mt-1 text-sm">תצוגת-על של כלל הכיתות לחינוך גופני</p>
          </motion.div>

          {/* ── KPI Row ──────────────────────────────────────────────────── */}
          <motion.div variants={STAGGER} className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <KpiCard
              label="ממוצע כושר כללי"
              value={fitnessAvg}
              sub={normDeltaLabel}
              icon={Dumbbell}
              iconCapsule="bg-emerald-100"
              iconColor="text-emerald-600"
              valueColor="text-emerald-600"
              accentBar="bg-gradient-to-r from-emerald-400 to-teal-500"
              trend={fitnessAvg >= MINISTRY_NORM ? 'up' : 'down'}
            />
            <KpiCard
              label="נוכחות ממוצעת"
              value={attendancePct}
              valueSuffix="%"
              sub="יציב לאורך הסמסטר"
              icon={Users}
              iconCapsule="bg-violet-100"
              iconColor="text-violet-600"
              valueColor="text-violet-700"
              accentBar="bg-gradient-to-r from-violet-500 to-purple-600"
              trend="neutral"
            />
            <KpiCard
              label="תלמידים לטיפול"
              value={belowNormCount}
              sub="לחץ לרשימה המלאה"
              icon={AlertTriangle}
              iconCapsule="bg-red-100"
              iconColor="text-red-600"
              valueColor="text-red-600"
              accentBar="bg-gradient-to-r from-red-400 to-orange-500"
              trend="alert"
              onClick={() => setBelowNormOpen(true)}
            />
            <KpiCard
              label="תוצאות חסרות"
              value={pendingResults}
              sub="לחץ לרשימה המלאה"
              icon={ClipboardX}
              iconCapsule="bg-amber-100"
              iconColor="text-amber-600"
              valueColor="text-amber-600"
              accentBar="bg-gradient-to-r from-amber-400 to-orange-400"
              trend="neutral"
              onClick={() => setMissingOpen(true)}
            />
          </motion.div>

          {/* ── Upcoming Event + Top Students mini-widgets ───────────────── */}
          <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Upcoming Event */}
            <motion.div
              variants={ITEM}
              whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
              className="prismatic-glass rounded-3xl p-5"
            >
              <CardShimmer />
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100"
                  whileHover={{ rotate: 12 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                >
                  <Calendar className="h-4 w-4 text-violet-600" aria-hidden="true" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-purple-950">אירוע קרוב</h2>
                  <p className="text-xs text-purple-600/70">לוח אירועים בית-ספרי</p>
                </div>
              </div>

              {eventLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-16 rounded-2xl bg-violet-50" />
                  <div className="h-4 w-24 rounded-xl bg-violet-50" />
                </div>
              ) : (() => {
                const days = Math.ceil(
                  (new Date(effectiveEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                const dayLabel = days === 0 ? 'היום' : days === 1 ? 'מחר' : `עוד ${days} ימים`;
                const monthYear = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(effectiveEvent.eventDate));
                return (
                  <>
                    <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white text-xs font-extrabold">
                          {new Date(effectiveEvent.eventDate).getDate()}
                        </span>
                        <div className="text-start">
                          <p className="text-sm font-bold text-purple-950 truncate">{effectiveEvent.title}</p>
                          <p className="text-xs text-purple-600/70 truncate">
                            {monthYear}{effectiveEvent.location ? ` · ${effectiveEvent.location}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        {dayLabel}
                      </span>
                    </div>
                  </>
                );
              })()}

              <Link
                href="/events"
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                לכל האירועים
              </Link>
            </motion.div>

            {/* Top Students mini-widget */}
            <motion.div
              variants={ITEM}
              whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
              className="prismatic-glass rounded-3xl p-5"
            >
              <CardShimmer />
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Crown className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  </motion.div>
                  <div>
                    <h2 className="text-sm font-bold text-purple-950">תלמידים בולטים</h2>
                    <p className="text-xs text-purple-600/70">טופ 3 בממוצע ציוני כושר</p>
                  </div>
                </div>
                <Link
                  href="/outstanding-students"
                  className="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
                >
                  כולם
                </Link>
              </div>

              {effectiveTopStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Crown className="h-7 w-7 text-amber-300" aria-hidden="true" />
                  <p className="text-sm text-purple-500/70">אין נתונים עדיין</p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {effectiveTopStudents.slice(0, 3).map((student, i) => {
                    const medals = ['🥇', '🥈', '🥉'] as const;
                    const medalColors = [
                      'bg-amber-50 border-amber-200',
                      'bg-slate-50 border-slate-200',
                      'bg-orange-50 border-orange-200',
                    ] as const;
                    return (
                      <motion.li
                        key={student.studentId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ease: EASE, duration: 0.4, delay: i * 0.08 }}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${medalColors[i]}`}
                      >
                        <span className="text-xl leading-none shrink-0" aria-hidden="true">{medals[i]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-purple-950 truncate">{student.studentName}</p>
                          <p className="text-xs text-purple-600/70 truncate">{student.className}</p>
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="text-base font-extrabold text-amber-600 tabular-nums leading-none">{student.avgGrade}</p>
                          <p className="text-[10px] text-purple-500/70">{getHebrewGradeLabel(student.avgGrade)}</p>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </motion.div>
          </motion.div>

          {/* ── Recent sessions + quick stats ────────────────────────────── */}
          <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Recent sessions — 2 cols */}
            <motion.div
              variants={ITEM}
              whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
              className="prismatic-glass rounded-3xl p-6 lg:col-span-2"
            >
              <CardShimmer />
              <div className="flex items-center gap-3 mb-5">
                <motion.div
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100"
                  whileHover={{ rotate: 10 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                >
                  <History className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-purple-950">מפגשי מבחן אחרונים</h2>
                  <p className="text-xs text-purple-600/70">5 המפגשים האחרונים שנערכו</p>
                </div>
              </div>

              {recentSessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <History className="h-8 w-8 text-violet-300" aria-hidden="true" />
                  <p className="text-sm text-purple-500/70">אין מפגשי מבחן עדיין</p>
                </div>
              ) : (
                <ol className="space-y-2.5">
                  {recentSessions.map((session, i) => {
                    const badge = BADGE_STYLES[i % BADGE_STYLES.length]!;
                    const { day, month, dayLabel } = formatSession(session.conductedAt);
                    return (
                      <motion.li
                        key={session.sessionId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ease: EASE, duration: 0.45, delay: i * 0.07 }}
                        whileHover={{ x: -2, transition: { duration: 0.2 } }}
                        className="flex items-center gap-2 md:gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 px-3 md:px-4 py-2.5 md:py-3 cursor-default"
                      >
                        <div className={`shrink-0 flex flex-col items-center justify-center rounded-xl ${badge.bg} w-12 h-12`}>
                          <span className={`text-sm font-extrabold leading-none ${badge.text}`}>{day}</span>
                          <span className={`text-[10px] font-medium leading-none opacity-80 mt-0.5 ${badge.text}`}>{month}/</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-purple-950 truncate">{session.testNameHe}</div>
                          <div className="text-xs text-purple-600/70">{session.className} · {dayLabel}</div>
                        </div>
                        <div className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.pill}`}>
                          הושלם
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </motion.div>

            {/* Right column — quick stats */}
            <motion.div
              variants={ITEM}
              whileHover={{ y: -5, boxShadow: '0 24px 48px rgba(109,40,217,0.18)', transition: { type: 'spring', stiffness: 350, damping: 22 } }}
              className="prismatic-glass rounded-3xl p-6 flex flex-col"
            >
              <CardShimmer />
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                  <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-purple-950">דורש טיפול</h2>
                  <p className="text-xs text-purple-600/70">תלמידים מתחת לנורמה</p>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <button
                  type="button"
                  onClick={() => setBelowNormOpen(true)}
                  className="w-full rounded-2xl bg-red-50 border border-red-200/60 p-4 text-center hover:bg-red-100/70 transition-colors"
                >
                  <AnimatedNumber
                    to={belowNormCount}
                    className="text-3xl md:text-4xl font-extrabold text-red-600 tabular-nums"
                    duration={1.6}
                  />
                  <p className="mt-1 text-xs font-semibold text-red-600/80">תלמידים מתחת לנורמה</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMissingOpen(true)}
                  className="w-full rounded-2xl bg-amber-50 border border-amber-200/60 p-4 text-center hover:bg-amber-100/70 transition-colors"
                >
                  <AnimatedNumber
                    to={pendingResults}
                    className="text-3xl md:text-4xl font-extrabold text-amber-600 tabular-nums"
                    duration={1.2}
                  />
                  <p className="mt-1 text-xs font-semibold text-amber-600/80">תוצאות שלא הוזנו</p>
                </button>
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200/60 p-4 text-center">
                  <AnimatedNumber
                    to={totalStudents}
                    className="text-3xl md:text-4xl font-extrabold text-emerald-600 tabular-nums"
                    duration={1.8}
                  />
                  <p className="mt-1 text-xs font-semibold text-emerald-600/80">תלמידים פעילים סה&quot;כ</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* ── My Classes ──────────────────────────────────────────────── */}
          <motion.div variants={ITEM}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-purple-950">הכיתות שלי</h2>
                <p className="text-xs text-purple-600/70 mt-0.5">לחץ על כיתה לפרטים ולניהול מלא</p>
              </div>
              <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/classes"
                  className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-semibold transition-colors"
                >
                  כל הכיתות
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.div>
            </div>

            {hasError && (
              <div className="rounded-3xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                לא ניתן לטעון את הנתונים — נסה לרענן את הדף.
              </div>
            )}

            {!hasError && effectiveClasses.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
                className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-violet-200/60 bg-white/50 backdrop-blur-xl py-14 text-center shadow-lg shadow-purple-900/6"
              >
                <motion.div
                  className="p-3 rounded-2xl bg-violet-100"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <BookOpen className="h-7 w-7 text-violet-600" aria-hidden="true" />
                </motion.div>
                <div>
                  <p className="font-semibold text-purple-950">אין כיתות עדיין</p>
                  <Link href="/classes" className="text-sm text-violet-600 hover:text-violet-800 hover:underline mt-1 block underline-offset-4 transition-colors">
                    לחץ כאן ליצירת כיתה ראשונה
                  </Link>
                </div>
              </motion.div>
            )}

            {!hasError && effectiveClasses.length > 0 && (
              <motion.div variants={STAGGER} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveClasses.slice(0, 6).map((cls, i) => {
                  const classStat = statsByClassId.get(cls.id) ?? {
                    classId: cls.id,
                    fitnessAvg: 0,
                    attendancePct: 0,
                    belowNormCount: 0,
                  };
                  return (
                    <ClassSummaryCard key={cls.id} cls={cls} stats={classStat} index={i} />
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* ── Drill-down modals (outside AnimatePresence to avoid layout jitter) ── */}
      <MissingResultsModal open={missingOpen}   onClose={() => setMissingOpen(false)} />
      <BelowNormModal      open={belowNormOpen} onClose={() => setBelowNormOpen(false)} />
    </>
  );
}
