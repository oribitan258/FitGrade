'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Dumbbell,
  FileDown,
  Loader2,
  Printer,
  TrendingUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { getHebrewGradeLabel, getGradeColorKey } from '@fitgrade/types';
import type { ReportTestResult } from '@fitgrade/types';
import { useStudentReport } from '@/hooks/use-student-report';
import { useSemester } from '@/contexts/semester-context';
import { cn, formatRawValue } from '@/lib/utils';

// ─── Animation ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.5, staggerChildren: 0.06 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.45 } },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  MALE: 'זכר',
  FEMALE: 'נקבה',
  OTHER: 'אחר',
};

/** Maps grade 0–100 to a Tailwind-compatible color token for badge rendering. */
function gradeStyle(score: number): {
  bg: string; text: string; border: string; dot: string; label: string;
} {
  if (score >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'מצטיין' };
  if (score >= 75) return { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    label: 'טוב מאוד' };
  if (score >= 60) return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   label: 'טוב' };
  if (score >= 55) return { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500',  label: 'עובר' };
  return              { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'נכשל' };
}

/** Color for the BarChart fill based on grade. */
function barColor(score: number): string {
  if (score >= 90) return '#10b981'; // emerald-500
  if (score >= 75) return '#3b82f6'; // blue-500
  if (score >= 60) return '#f59e0b'; // amber-500
  if (score >= 55) return '#f97316'; // orange-500
  return '#ef4444';                  // red-500
}

/** Format a JS Date string (ISO) to dd/mm/yyyy. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div variants={ITEM} className="prismatic-glass rounded-2xl p-5 flex items-start gap-4">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accent ?? 'bg-indigo-100 text-indigo-600')}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-800">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
    </motion.div>
  );
}

/** Skeleton placeholder — matches StatCard dimensions */
function SkeletonCard() {
  return (
    <div className="prismatic-glass rounded-2xl p-5 flex items-start gap-4 animate-pulse">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-7 w-14 rounded bg-slate-200" />
      </div>
    </div>
  );
}

// ─── Custom Recharts tooltip ───────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg text-sm" dir="rtl">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.fill ?? '#6366f1' }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentReportPage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  // Sidebar controls A/B globally. Report page has its own Full Year override.
  const { semesterFilter } = useSemester();
  const [showFullYear, setShowFullYear] = useState(false);
  // When Full Year is active, pass undefined to the API (returns data for all semesters).
  const effectiveSemester = showFullYear ? undefined : semesterFilter;

  const { data: report, isLoading, error } = useStudentReport(classId, studentId, effectiveSemester);

  /** Export test results as a UTF-8 CSV file with BOM for Excel RTL support. */
  function handleExportExcel(): void {
    if (!report) return;

    const BOM = '\uFEFF';
    const headers = ['שם המבחן', 'יחידות', 'תאריך ביצוע', 'תוצאה גולמית', 'ציון סופי', 'ממוצע כיתתי', 'מספר סשנים'];

    const rows: string[][] = report.testResults.map((t) => [
      t.nameHe,
      t.unit ?? '',
      formatDate(t.conductedAt),
      t.rawValue !== null ? (formatRawValue(t.rawValue, t.inputType) ?? '') : '',
      String(t.grade),
      t.classAvg > 0 ? String(t.classAvg) : '',
      String(t.sessionCount),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `${report.firstName}_${report.lastName}_דוח_${formatDate(report.generatedAt).replace(/\//g, '-')}.csv`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Chart data: one bar-group per test type
  const chartData = useMemo(() => {
    if (!report) return [];
    return report.testResults.map((t) => ({
      name:     t.nameHe.length > 8 ? t.nameHe.slice(0, 8) + '…' : t.nameHe,
      fullName: t.nameHe,
      student:  t.grade,
      class:    t.classAvg,
    }));
  }, [report]);

  // ── Error / Loading states ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center" dir="rtl">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-bold text-slate-700">שגיאה בטעינת הדוח</p>
        <p className="text-sm text-slate-500">אנא נסה שוב מאוחר יותר</p>
        <Link
          href={`/classes/${classId}`}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לכיתה
        </Link>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !report) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-6" dir="rtl">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-xl bg-slate-200" />
          <div className="h-6 w-48 rounded bg-slate-200" />
        </div>
        <div className="prismatic-glass rounded-3xl p-6 animate-pulse">
          <div className="flex items-start gap-5">
            <div className="h-16 w-16 rounded-2xl bg-slate-200" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-52 rounded bg-slate-200" />
              <div className="h-4 w-36 rounded bg-slate-200" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  const { firstName, lastName, gender, dateOfBirth, studentCode, className, gradeLevel, generatedAt, testResults, attendance, finalGrade } = report;

  const overallStyle = gradeStyle(finalGrade.recommendedGrade);

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-8 p-6"
      dir="rtl"
      variants={PAGE_ENTER}
      initial="hidden"
      animate="show"
    >

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/classes/${classId}`}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-indigo-700 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לכיתה
          </Link>
          {/* Full Year toggle — prominent, local to this page only */}
          <button
            type="button"
            onClick={() => { setShowFullYear((v) => !v); }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors print:hidden',
              showFullYear
                ? 'border-indigo-400 bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
            )}
          >
            <CalendarRange className="h-4 w-4 shrink-0" />
            דוח שנתי / שנה שלמה
          </button>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-700 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            אקסל
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:border-indigo-300 hover:text-indigo-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            הדפסה / PDF
          </button>
        </div>
      </motion.div>

      {/* ── Profile Header ────────────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="prismatic-glass rounded-3xl p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-extrabold text-white shadow-lg">
            {firstName[0]}{lastName[0]}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {firstName} {lastName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                {className}{gradeLevel !== null && gradeLevel !== undefined ? ` · כיתה ${gradeLevel}` : ''}
              </span>
              <span className="flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                {GENDER_LABELS[gender] ?? gender}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {formatDate(dateOfBirth)}
              </span>
              <code className="font-mono text-xs text-slate-400">{studentCode}</code>
            </div>
          </div>

          {/* Recommended grade badge */}
          <div className={cn(
            'shrink-0 rounded-2xl border px-5 py-3 text-center [print-color-adjust:exact]',
            overallStyle.bg, overallStyle.border,
          )}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ציון מומלץ</p>
            <p className={cn('text-4xl font-black tabular-nums leading-none mt-1', overallStyle.text)}>
              {finalGrade.recommendedGrade}
            </p>
            <p className={cn('mt-0.5 text-xs font-bold', overallStyle.text)}>
              {getHebrewGradeLabel(finalGrade.recommendedGrade)}
            </p>
          </div>
        </div>

        {/* Report meta row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/20 pt-4 text-xs text-slate-500">
          <span>הופק: {formatDate(generatedAt)}</span>
          {effectiveSemester === 'A' && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
              מחצית א׳
            </span>
          )}
          {effectiveSemester === 'B' && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              מחצית ב׳
            </span>
          )}
          {effectiveSemester === undefined && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
              שנה שלמה
            </span>
          )}
        </div>
      </motion.div>

      {/* ── Stats Grid ────────────────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="grid grid-cols-2 gap-4 sm:grid-cols-4 [print-color-adjust:exact]">
        <StatCard
          icon={<Dumbbell className="h-5 w-5" />}
          label="ממוצע כושר"
          value={finalGrade.fitnessAvg}
          sub={`${finalGrade.testWeight}% מהציון`}
          accent="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="תלמידות"
          value={finalGrade.talmidautAvg}
          sub={`${finalGrade.talmidautWeight}% מהציון`}
          accent="bg-violet-100 text-violet-600"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="נוכחות"
          value={`${attendance.pct}%`}
          sub={`${attendance.present} מתוך ${attendance.total}`}
          accent="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="מבחנים שהושלמו"
          value={testResults.length}
          sub={testResults.length > 0 ? `${testResults.reduce((s, t) => s + t.sessionCount, 0)} סשנים סה"כ` : 'אין נתונים'}
          accent="bg-amber-100 text-amber-600"
        />
      </motion.div>

      {/* ── Two-column layout: table + chart ──────────────────────────────── */}
      <motion.div variants={ITEM} className="grid gap-6 lg:grid-cols-[1fr_360px]">

        {/* Achievements Table */}
        <div className="prismatic-glass overflow-hidden rounded-3xl">
          <div className="flex items-center gap-2 border-b border-white/20 px-5 py-4">
            <Dumbbell className="h-4 w-4 text-indigo-400" />
            <h2 className="font-bold text-slate-800">תוצאות מבחנים</h2>
            <span className="me-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
              {testResults.length} מבחנים
            </span>
          </div>

          {testResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Dumbbell className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">אין תוצאות מבחנים לתצוגה</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="bg-slate-50/60 text-start">
                    {['מבחן', 'תאריך', 'תוצאה גולמית', 'ציון', 'ממוצע כיתה', 'סשנים'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result, i) => {
                    const gs = gradeStyle(result.grade);
                    const raw =
                      result.rawValue !== null
                        ? formatRawValue(result.rawValue, result.inputType)
                        : null;
                    return (
                      <tr
                        key={result.testTypeId}
                        className={cn(
                          'border-t border-slate-50 transition-colors hover:bg-indigo-50/30',
                          i % 2 === 0 ? 'bg-white/40' : 'bg-slate-50/30',
                        )}
                      >
                        {/* Test name */}
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {result.nameHe}
                          {result.unit && (
                            <span className="me-1.5 text-xs font-normal text-slate-400">
                              ({result.unit})
                            </span>
                          )}
                        </td>
                        {/* Date */}
                        <td className="px-4 py-3 tabular-nums text-slate-500">
                          {formatDate(result.conductedAt)}
                        </td>
                        {/* Raw value */}
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                          {raw ?? '—'}
                        </td>
                        {/* Grade badge */}
                        <td className="px-4 py-3 [print-color-adjust:exact]">
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold',
                            gs.bg, gs.text, gs.border,
                          )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', gs.dot)} />
                            {result.grade}
                          </span>
                        </td>
                        {/* Class avg */}
                        <td className="px-4 py-3 tabular-nums text-slate-500">
                          {result.classAvg > 0 ? result.classAvg : '—'}
                        </td>
                        {/* Session count */}
                        <td className="px-4 py-3 text-center text-slate-500">
                          {result.sessionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Chart + Attendance */}
        <div className="flex flex-col gap-6">

          {/* Bar Chart: student vs class */}
          <div className="prismatic-glass rounded-3xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              <h2 className="font-bold text-slate-800">תלמיד מול ממוצע כיתה</h2>
            </div>

            {chartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                אין נתונים לתרשים
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={62} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                  <Bar dataKey="class" name="ממוצע כיתה" fill="#e0e7ff" radius={[0, 4, 4, 0]} barSize={7}>
                    <LabelList dataKey="class" position="right" style={{ fontSize: 9, fill: '#94a3b8' }} />
                  </Bar>
                  <Bar dataKey="student" name="ציון תלמיד" radius={[0, 4, 4, 0]} barSize={10}>
                    {chartData.map((entry) => (
                      <Cell key={entry.fullName} fill={barColor(entry.student)} />
                    ))}
                    <LabelList dataKey="student" position="right" style={{ fontSize: 10, fontWeight: 700, fill: '#1e293b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-5 rounded-sm bg-indigo-200" />
                ממוצע כיתה
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-5 rounded-sm bg-emerald-400" />
                ציון תלמיד
              </span>
            </div>
          </div>

          {/* Attendance Card */}
          <div className="prismatic-glass rounded-3xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="font-bold text-slate-800">נוכחות</h2>
              <span className={cn(
                'me-auto rounded-full px-2 py-0.5 text-[11px] font-bold',
                attendance.pct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                attendance.pct >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700',
              )}>
                {attendance.pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  attendance.pct >= 80 ? 'bg-emerald-500' :
                  attendance.pct >= 60 ? 'bg-amber-500' : 'bg-red-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${attendance.pct}%` }}
                transition={{ ease: EASE, duration: 0.8, delay: 0.3 }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-emerald-50 py-2">
                <p className="text-lg font-extrabold text-emerald-700">{attendance.present}</p>
                <p className="font-medium text-emerald-600">נוכח/ת</p>
              </div>
              <div className="rounded-xl bg-red-50 py-2">
                <p className="text-lg font-extrabold text-red-600">{attendance.absent}</p>
                <p className="font-medium text-red-500">נעדר/ת</p>
              </div>
              <div className="rounded-xl bg-orange-50 py-2">
                <p className="text-lg font-extrabold text-orange-600">{attendance.excused}</p>
                <p className="font-medium text-orange-500">פטור/ת</p>
              </div>
            </div>
          </div>

          {/* Final Grade Breakdown */}
          <div className="prismatic-glass rounded-3xl p-5 [print-color-adjust:exact]">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-500" />
              <h2 className="font-bold text-slate-800">פירוט ציון סופי</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2">
                <span className="text-sm text-indigo-700">כושר גופני</span>
                <span className="text-sm font-bold text-indigo-800">
                  {finalGrade.fitnessAvg}
                  <span className="ms-1 text-xs font-normal text-indigo-500">× {finalGrade.testWeight}%</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2">
                <span className="text-sm text-violet-700">תלמידות</span>
                <span className="text-sm font-bold text-violet-800">
                  {finalGrade.talmidautAvg}
                  <span className="ms-1 text-xs font-normal text-violet-500">× {finalGrade.talmidautWeight}%</span>
                </span>
              </div>
              <div className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-2.5',
                overallStyle.bg, overallStyle.border,
              )}>
                <span className={cn('text-sm font-bold', overallStyle.text)}>ציון מומלץ סופי</span>
                <span className={cn('text-xl font-black tabular-nums', overallStyle.text)}>
                  {finalGrade.recommendedGrade}
                </span>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ── Signature Footer (print only) ────────────────────────────────── */}
      <div className="hidden print:block mt-24 border-t-2 border-gray-300 pt-8">
        <div className="flex justify-between gap-12" dir="rtl">
          <div className="flex-1 text-center">
            <p className="text-sm text-gray-400 mb-10">___________________________</p>
            <p className="text-sm font-semibold text-gray-700">חתימת המורה לחינוך גופני</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm text-gray-400 mb-10">___________________________</p>
            <p className="text-sm font-semibold text-gray-700">חתימת מנהל/ת בית הספר</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-sm text-gray-400 mb-10">___________________________</p>
            <p className="text-sm font-semibold text-gray-700">תאריך</p>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-gray-400">
          דוח זה הופק ממערכת FitGrade · {formatDate(generatedAt)}
        </p>
      </div>

    </motion.div>
  );
}
