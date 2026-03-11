'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BookOpen,
  ChevronDown,
  FlaskConical,
  Shirt,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

/** Colour palette for multi-line test progress chart */
const LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'] as const;

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
  return monthOrder.map((month) => {
    const row: Record<string, string | number> = { month };
    for (const test of testHistories) {
      const point = test.history.find((h) => h.month === month);
      if (point !== undefined) row[test.testTypeId] = point.grade;
    }
    return row;
  });
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
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl p-4">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(226,232,240,0.8)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              const test = testHistories.find((t) => t.testTypeId === name);
              return [`${value} — ${getHebrewGradeLabel(value)}`, test?.nameHe ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => {
              const test = testHistories.find((t) => t.testTypeId === value);
              return test?.nameHe ?? value;
            }}
          />
          {testHistories.map((test, i) => (
            <Line
              key={test.testTypeId}
              type="monotone"
              dataKey={test.testTypeId}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: LINE_COLORS[i % LINE_COLORS.length] }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
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
      {/* Header */}
      <div
        className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
      >
        {['שם המבחן', 'תוצאה', 'ציון', 'רמה'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-slate-50">
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
}: {
  profile: StudentProfile;
  className: string;
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
          <h1 className="mt-0.5 text-2xl font-black">
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

  const isLoading = profileLoading && Boolean(selectedStudentId);

  return (
    <div className="space-y-6">
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
        <ProfileView profile={profile} className={selectedClass?.name ?? ''} />
      )}
    </div>
  );
}
