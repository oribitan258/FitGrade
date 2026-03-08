'use client';

import { useEffect } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { ClassData, DashboardClassStat, RecentSession } from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ClipboardX,
  Dumbbell,
  History,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';

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

// ─── Glassmorphic skeleton loader ─────────────────────────────────────────────

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-xl bg-white/60" />
        <div className="h-4 w-48 animate-pulse rounded-lg bg-white/40" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-2xl bg-white/60 shadow-[0_8px_28px_rgba(15,23,42,0.06)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-white/60 lg:col-span-2 shadow-[0_8px_28px_rgba(15,23,42,0.06)]" />
        <div className="h-72 animate-pulse rounded-2xl bg-white/60 shadow-[0_8px_28px_rgba(15,23,42,0.06)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-52 animate-pulse rounded-2xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />
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
  above:   { label: 'מעל לנורמה',  bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  average: { label: 'ממוצע',        bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  below:   { label: 'מתחת לנורמה', bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
};

/** Alternating vivid badge colors for the session date pill. */
const BADGE_STYLES = [
  { bg: 'bg-indigo-600',  text: 'text-white', pill: 'bg-indigo-50 text-indigo-700'   },
  { bg: 'bg-teal-600',    text: 'text-white', pill: 'bg-teal-50   text-teal-700'     },
  { bg: 'bg-violet-600',  text: 'text-white', pill: 'bg-violet-50 text-violet-700'   },
  { bg: 'bg-emerald-600', text: 'text-white', pill: 'bg-emerald-50 text-emerald-700' },
  { bg: 'bg-amber-500',   text: 'text-white', pill: 'bg-amber-50  text-amber-700'    },
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

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  valueSuffix?: string;
  sub: string;
  icon: typeof Dumbbell;
  /** Full Tailwind classes for the icon capsule background + ring */
  iconCapsule: string;
  /** Tailwind text color for the icon */
  iconColor: string;
  /** Tailwind text color for the big number */
  valueColor: string;
  /** Optional thin accent bar color (Tailwind bg-*) */
  accentBar?: string;
  trend?: 'up' | 'down' | 'alert' | 'neutral';
  /** Semantic glass tint classes — bg-* + border-* */
  cardGlass?: string;
}

function KpiCard({
  label, value, valueSuffix, sub, icon: Icon,
  iconCapsule, iconColor, valueColor, accentBar, trend, cardGlass,
}: KpiCardProps): React.JSX.Element {
  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -5, scale: 1.01, boxShadow: '0 20px 52px rgba(15,23,42,0.18)', transition: { ease: [0.22, 1, 0.36, 1], duration: 0.35 } }}
      whileTap={{ scale: 0.98 }}
      className={`flex flex-col gap-3 rounded-2xl p-4 md:p-5 shadow-[0_8px_28px_rgba(15,23,42,0.11)] cursor-default backdrop-blur-xl border ${cardGlass ?? 'bg-white/75 border-white/75'}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <motion.div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconCapsule}`}
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
          className={`text-2xl md:text-3xl font-extrabold tabular-nums ${valueColor}`}
          duration={1.6}
        />
        <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${
          trend === 'up'    ? 'text-emerald-600' :
          trend === 'down'  ? 'text-red-500' :
          trend === 'alert' ? 'text-red-600' :
                              'text-slate-400'
        }`}>
          {trend === 'up'    && <TrendingUp    className="h-3 w-3" />}
          {trend === 'down'  && <TrendingDown  className="h-3 w-3" />}
          {trend === 'alert' && <AlertTriangle className="h-3 w-3" />}
          <span>{sub}</span>
        </div>
      </div>

      {accentBar && <div className={`h-1.5 rounded-full ${accentBar}`} />}
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
      whileHover={{ y: -4, scale: 1.01, boxShadow: '0 20px 52px rgba(15,23,42,0.18)', transition: { ease: [0.22, 1, 0.36, 1], duration: 0.35 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={`/classes/${cls.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-2xl"
      >
        <article className="group overflow-hidden rounded-2xl bg-indigo-50/72 backdrop-blur-xl border border-white/80 shadow-[0_8px_28px_rgba(15,23,42,0.10)] transition-shadow duration-300">
          {/* Vivid accent stripe */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${stripe}`} />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">{cls.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cls.academicYear} · {SEMESTER_LABELS[cls.semester]}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelCfg.bg} ${levelCfg.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${levelCfg.dot}`} />
                {levelCfg.label}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-white/50 backdrop-blur-sm px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">ממוצע כושר</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-2xl font-extrabold tabular-nums ${level === 'above' ? 'text-emerald-700' : level === 'below' ? 'text-red-600' : 'text-amber-600'}`}>
                    {stats.fitnessAvg}
                  </span>
                  <span className={`text-xs font-bold ${normDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {normDelta >= 0 ? '+' : ''}{normDelta}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">נורמה: {MINISTRY_NORM}</p>
              </div>
              <div className="rounded-xl bg-white/50 backdrop-blur-sm px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">נוכחות</p>
                <div className="text-2xl font-extrabold text-slate-800 tabular-nums">{stats.attendancePct}%</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.attendancePct >= 90 ? 'bg-emerald-500' : stats.attendancePct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${stats.attendancePct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/60">
                  <Users className="h-3 w-3 text-slate-400" aria-hidden="true" />
                </div>
                <span className="text-xs text-slate-600">{cls.studentCount} תלמידים</span>
              </div>
              <div className="flex items-center gap-2">
                {stats.belowNormCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {stats.belowNormCount} מתחת לנורמה
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" aria-hidden="true" />
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

  const isLoading = classesLoading || statsLoading;
  const hasError  = classesError   || statsError;

  // Build a lookup map for per-class stats keyed by classId
  const statsByClassId = new Map<string, DashboardClassStat>(
    (stats?.classStats ?? []).map((s) => [s.classId, s]),
  );

  const fitnessAvg     = stats?.overallFitnessAvg    ?? 0;
  const attendancePct  = stats?.overallAttendancePct ?? 0;
  const belowNormCount = stats?.totalBelowNormCount  ?? 0;
  const totalStudents  = stats?.totalStudents        ?? 0;
  const pendingResults = stats?.pendingResultsCount  ?? 0;
  const recentSessions: RecentSession[] = stats?.recentSessions ?? [];

  const normDeltaLabel = fitnessAvg > 0
    ? `${fitnessAvg >= MINISTRY_NORM ? '+' : ''}${fitnessAvg - MINISTRY_NORM} מנורמת משרד החינוך (${MINISTRY_NORM})`
    : 'אין נתונים עדיין';

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
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
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">שלום! הנה המצב הכללי 👋</h1>
          <p className="text-slate-600 mt-0.5 text-sm">תצוגת-על של כלל הכיתות לחינוך גופני</p>
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
            valueColor="text-emerald-700"
            accentBar="bg-gradient-to-r from-emerald-400 to-teal-500"
            trend={fitnessAvg >= MINISTRY_NORM ? 'up' : 'down'}
            cardGlass="bg-emerald-50/82 border-white/80"
          />
          <KpiCard
            label="נוכחות ממוצעת"
            value={attendancePct}
            valueSuffix="%"
            sub="יציב לאורך הסמסטר"
            icon={Users}
            iconCapsule="bg-indigo-100"
            iconColor="text-indigo-600"
            valueColor="text-indigo-700"
            accentBar="bg-gradient-to-r from-indigo-400 to-violet-500"
            trend="neutral"
            cardGlass="bg-indigo-50/82 border-white/80"
          />
          <KpiCard
            label="תלמידים לטיפול"
            value={belowNormCount}
            sub="מתחת לנורמה — נדרשת התייחסות"
            icon={AlertTriangle}
            iconCapsule="bg-red-100"
            iconColor="text-red-500"
            valueColor="text-red-600"
            accentBar="bg-gradient-to-r from-red-400 to-orange-500"
            trend="alert"
            cardGlass="bg-red-50/82 border-white/80"
          />
          <KpiCard
            label="תוצאות חסרות"
            value={pendingResults}
            sub="תלמידים שלא ניגשו למבחן"
            icon={ClipboardX}
            iconCapsule="bg-amber-100"
            iconColor="text-amber-600"
            valueColor="text-amber-700"
            accentBar="bg-gradient-to-r from-amber-400 to-orange-400"
            trend="neutral"
            cardGlass="bg-amber-50/82 border-white/80"
          />
        </motion.div>

        {/* ── Recent sessions + quick stats ────────────────────────────── */}
        <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Recent sessions — 2 cols */}
          <motion.div
            variants={ITEM}
            whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(15,23,42,0.10)', transition: { ease: [0.22, 1, 0.36, 1], duration: 0.35 } }}
            className="rounded-2xl bg-indigo-50/78 backdrop-blur-xl border border-white/80 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)] lg:col-span-2"
          >
            <div className="flex items-center gap-3 mb-5">
              <motion.div
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100"
                whileHover={{ rotate: 10 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
              >
                <History className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              </motion.div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">מפגשי מבחן אחרונים</h2>
                <p className="text-xs text-slate-500">5 המפגשים האחרונים שנערכו</p>
              </div>
            </div>

            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <History className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm text-slate-400">אין מפגשי מבחן עדיין</p>
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
                      whileHover={{ x: -2, backgroundColor: 'rgba(248,250,252,1)', transition: { duration: 0.2 } }}
                      className="flex items-center gap-2 md:gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 md:px-4 py-2.5 md:py-3 cursor-default"
                    >
                      {/* Vivid date badge */}
                      <div className={`shrink-0 flex flex-col items-center justify-center rounded-xl ${badge.bg} w-12 h-12`}>
                        <span className={`text-sm font-extrabold leading-none ${badge.text}`}>{day}</span>
                        <span className={`text-[10px] font-medium leading-none opacity-80 mt-0.5 ${badge.text}`}>{month}/</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{session.testNameHe}</div>
                        <div className="text-xs text-slate-500">{session.className} · {dayLabel}</div>
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
            whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(15,23,42,0.10)', transition: { ease: [0.22, 1, 0.36, 1], duration: 0.35 } }}
            className="rounded-2xl bg-indigo-50/72 backdrop-blur-xl border border-white/80 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)] flex flex-col"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">דורש טיפול</h2>
                <p className="text-xs text-slate-500">תלמידים מתחת לנורמה</p>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div className="rounded-xl bg-red-50/70 backdrop-blur-sm border border-red-100/50 p-4 text-center">
                <AnimatedNumber
                  to={belowNormCount}
                  className="text-3xl md:text-4xl font-extrabold text-red-600 tabular-nums"
                  duration={1.6}
                />
                <p className="mt-1 text-xs font-semibold text-red-500">תלמידים מתחת לנורמה</p>
              </div>
              <div className="rounded-xl bg-amber-50/70 backdrop-blur-sm border border-amber-100/50 p-4 text-center">
                <AnimatedNumber
                  to={pendingResults}
                  className="text-3xl md:text-4xl font-extrabold text-amber-600 tabular-nums"
                  duration={1.2}
                />
                <p className="mt-1 text-xs font-semibold text-amber-600">תוצאות שלא הוזנו</p>
              </div>
              <div className="rounded-xl bg-emerald-50/70 backdrop-blur-sm border border-emerald-100/50 p-4 text-center">
                <AnimatedNumber
                  to={totalStudents}
                  className="text-3xl md:text-4xl font-extrabold text-emerald-600 tabular-nums"
                  duration={1.8}
                />
                <p className="mt-1 text-xs font-semibold text-emerald-600">תלמידים פעילים סה&quot;כ</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── My Classes ──────────────────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">הכיתות שלי</h2>
              <p className="text-xs text-slate-500 mt-0.5">לחץ על כיתה לפרטים ולניהול מלא</p>
            </div>
            <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/classes"
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                כל הכיתות
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </motion.div>
          </div>

          {hasError && (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              לא ניתן לטעון את הנתונים — נסה לרענן את הדף.
            </div>
          )}

          {!hasError && classes?.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-14 text-center"
            >
              <motion.div
                className="p-3 rounded-2xl bg-indigo-50"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BookOpen className="h-7 w-7 text-indigo-400" aria-hidden="true" />
              </motion.div>
              <div>
                <p className="font-semibold text-slate-700">אין כיתות עדיין</p>
                <Link href="/classes" className="text-sm text-indigo-600 hover:underline mt-1 block underline-offset-4">
                  לחץ כאן ליצירת כיתה ראשונה
                </Link>
              </div>
            </motion.div>
          )}

          {!hasError && classes && classes.length > 0 && (
            <motion.div variants={STAGGER} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.slice(0, 6).map((cls, i) => {
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
  );
}
