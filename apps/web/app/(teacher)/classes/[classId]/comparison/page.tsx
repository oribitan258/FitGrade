'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useClass, useStudents } from '@/hooks/use-classes';
import { useClassComparison } from '@/hooks/use-comparison';
import type {
  ClassComparisonResponseDto,
  ComparisonGradeDistributionDto,
  SemesterTestDataDto,
  TestComparisonDto,
} from '@/hooks/use-comparison';
import type { StudentData } from '@fitgrade/types';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/back-button';

// ─── Animation presets ────────────────────────────────────────────────────

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

// ─── Grade thresholds (must match backend) ────────────────────────────────

const GRADE_EXCELLENT = 90;
const GRADE_GOOD      = 75;
const GRADE_PASS      = 60;

type FitnessLevel = 'excellent' | 'good' | 'pass' | 'fail';

function gradeLevel(score: number): FitnessLevel {
  if (score >= GRADE_EXCELLENT) return 'excellent';
  if (score >= GRADE_GOOD)      return 'good';
  if (score >= GRADE_PASS)      return 'pass';
  return 'fail';
}

const LEVEL_COLOR: Record<FitnessLevel, string> = {
  excellent: '#10b981',
  good:      '#6366f1',
  pass:      '#f59e0b',
  fail:      '#ef4444',
};

const LEVEL_LABEL: Record<FitnessLevel, string> = {
  excellent: 'מצטיין',
  good:      'טוב',
  pass:      'עובר',
  fail:      'מתחת לנורמה',
};

// ─── Semester colors ──────────────────────────────────────────────────────

/** Indigo for Semester A, teal/emerald for Semester B. */
const SEM_A_COLOR = '#6366f1';
const SEM_B_COLOR = '#10b981';

// ─── DeltaBadge ──────────────────────────────────────────────────────────

interface DeltaBadgeProps {
  delta: number | null;
  size?: 'sm' | 'lg';
}

function DeltaBadge({ delta, size = 'sm' }: DeltaBadgeProps): React.JSX.Element {
  if (delta === null) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-500',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
      )}>
        —
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 font-bold text-emerald-700',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
      )}>
        <TrendingUp className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" />
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 font-bold text-red-700',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
      )}>
        <TrendingDown className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} aria-hidden="true" />
        {delta}
      </span>
    );
  }
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-500',
      size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
    )}>
      0
    </span>
  );
}

// ─── GradeDistributionRow ─────────────────────────────────────────────────

interface GradeDistributionRowProps {
  a: ComparisonGradeDistributionDto;
  b: ComparisonGradeDistributionDto;
}

function DistributionBar({
  dist,
  label,
  color,
}: {
  dist: ComparisonGradeDistributionDto;
  label: string;
  color: string;
}): React.JSX.Element {
  const total = dist.excellent + dist.good + dist.pass + dist.fail;
  if (total === 0) return <div className="text-xs text-slate-400">אין נתונים</div>;

  const segments: Array<{ key: keyof ComparisonGradeDistributionDto; level: FitnessLevel }> = [
    { key: 'excellent', level: 'excellent' },
    { key: 'good',      level: 'good'      },
    { key: 'pass',      level: 'pass'      },
    { key: 'fail',      level: 'fail'      },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="text-slate-400">{total} תלמידים</span>
      </div>
      <div
        className="flex h-5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`התפלגות ציונים ${label}: מצטיין ${dist.excellent}, טוב ${dist.good}, עובר ${dist.pass}, מתחת לנורמה ${dist.fail}`}
      >
        {segments.map(({ key, level }) => {
          const count  = dist[key];
          const pct    = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: LEVEL_COLOR[level] }}
              title={`${LEVEL_LABEL[level]}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {segments.map(({ key, level }) => {
          const count = dist[key];
          if (count === 0) return null;
          return (
            <span key={key} className="flex items-center gap-1 text-[10px] text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLOR[level] }} aria-hidden="true" />
              {LEVEL_LABEL[level]}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function GradeDistributionRow({ a, b }: GradeDistributionRowProps): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <DistributionBar dist={a} label="מחצית א׳" color={SEM_A_COLOR} />
      <DistributionBar dist={b} label="מחצית ב׳" color={SEM_B_COLOR} />
    </div>
  );
}

// ─── Custom Recharts tooltip ──────────────────────────────────────────────

function ComparisonTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div
      className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm shadow-lg backdrop-blur-md"
      dir="rtl"
    >
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-slate-600">
        ממוצע: <span className="font-bold" style={{ color: entry?.color as string }}>{entry?.value as number}</span>
      </p>
    </div>
  );
}

// ─── StudentDrillDown ─────────────────────────────────────────────────────

interface StudentDrillDownProps {
  semesterA: SemesterTestDataDto | null;
  semesterB: SemesterTestDataDto | null;
  studentNameMap: Map<string, string>;
}

function StudentDrillDown({
  semesterA,
  semesterB,
  studentNameMap,
}: StudentDrillDownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const rows = useMemo(() => {
    const mapA = new Map(
      (semesterA?.studentGrades ?? []).map((sg) => [sg.studentId, sg.effectiveGrade]),
    );
    const mapB = new Map(
      (semesterB?.studentGrades ?? []).map((sg) => [sg.studentId, sg.effectiveGrade]),
    );
    const allIds = new Set(Array.from(mapA.keys()).concat(Array.from(mapB.keys())));

    return Array.from(allIds).map((id) => {
      const gradeA = mapA.get(id) ?? null;
      const gradeB = mapB.get(id) ?? null;
      const delta  =
        gradeA !== null && gradeB !== null ? gradeB - gradeA : null;
      return { id, name: studentNameMap.get(id) ?? id, gradeA, gradeB, delta };
    }).sort((a, b) => {
      // Sort by name for consistent ordering
      return a.name.localeCompare(b.name, 'he');
    });
  }, [semesterA, semesterB, studentNameMap]);

  return (
    <div>
      <button
        type="button"
        onClick={() => { setIsOpen((v) => !v); }}
        className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        aria-expanded={isOpen}
      >
        <span>צפה בתוצאות תלמידים ({rows.length})</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
            <div className="min-w-[280px] space-y-1 pt-1">
              {/* Table header */}
              <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span className="col-span-2">שם</span>
                <span className="text-center">מחצית א׳</span>
                <span className="text-center">מחצית ב׳</span>
              </div>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-4 gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <span className="col-span-2 font-medium text-slate-700 truncate">{row.name}</span>
                  <span className="text-center">
                    {row.gradeA !== null ? (
                      <span
                        className="font-semibold"
                        style={{ color: LEVEL_COLOR[gradeLevel(row.gradeA)] }}
                      >
                        {row.gradeA}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </span>
                  <span className="flex items-center justify-center gap-1.5">
                    {row.gradeB !== null ? (
                      <>
                        <span
                          className="font-semibold"
                          style={{ color: LEVEL_COLOR[gradeLevel(row.gradeB)] }}
                        >
                          {row.gradeB}
                        </span>
                        {row.delta !== null && (
                          <DeltaBadge delta={row.delta} size="sm" />
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TestComparisonCard ───────────────────────────────────────────────────

interface TestComparisonCardProps {
  test: TestComparisonDto;
  studentNameMap: Map<string, string>;
}

function TestComparisonCard({
  test,
  studentNameMap,
}: TestComparisonCardProps): React.JSX.Element {
  const { nameHe, unit, semesterA, semesterB, deltaClassAvg } = test;

  const label = unit ? `${nameHe} (${unit})` : nameHe;

  // Both semesters missing — should not appear per the service but guard defensively
  if (semesterA === null && semesterB === null) return <></>;

  // One or both semesters are missing — show a placeholder card
  if (semesterA === null || semesterB === null) {
    const missingLabel = semesterA === null ? 'לא בוצע במחצית א׳' : 'אין נתונים להשוואה במחצית ב׳ עבור מבחן זה';
    return (
      <motion.div
        variants={ITEM}
        className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-6"
        role="region"
        aria-label={label}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">{label}</h3>
          <DeltaBadge delta={null} />
        </div>
        <p className="text-sm text-slate-400">{missingLabel}</p>
      </motion.div>
    );
  }

  // Full comparison data available
  const chartData = [
    { name: "מחצית א׳", avg: semesterA.classAvg },
    { name: "מחצית ב׳", avg: semesterB.classAvg },
  ];

  return (
    <motion.div
      variants={ITEM}
      className="overflow-hidden rounded-3xl border border-white/70 bg-white/65 shadow-[0_4px_24px_rgba(15,23,42,0.07)]"
      style={{ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}
      role="region"
      aria-label={label}
    >
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-base font-bold text-slate-800">{label}</h3>
        <DeltaBadge delta={deltaClassAvg} size="sm" />
      </div>

      <div className="space-y-5 p-6">
        {/* Avg score row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-indigo-50 p-4 text-center">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-500">מחצית א׳</p>
            <p className="text-3xl font-extrabold" style={{ color: LEVEL_COLOR[gradeLevel(semesterA.classAvg)] }}>
              {semesterA.classAvg}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">ממוצע כיתה</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 text-center">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-500">מחצית ב׳</p>
            <p className="text-3xl font-extrabold" style={{ color: LEVEL_COLOR[gradeLevel(semesterB.classAvg)] }}>
              {semesterB.classAvg}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">ממוצע כיתה</p>
          </div>
        </div>

        {/* Bar chart */}
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={52} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
              />
              <Tooltip content={<ComparisonTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 8 }} />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={index === 0 ? SEM_A_COLOR : SEM_B_COLOR}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grade distribution */}
        <GradeDistributionRow a={semesterA.distribution} b={semesterB.distribution} />

        {/* Student drill-down */}
        <StudentDrillDown
          semesterA={semesterA}
          semesterB={semesterB}
          studentNameMap={studentNameMap}
        />
      </div>
    </motion.div>
  );
}

// ─── ClassSummaryBanner ───────────────────────────────────────────────────

interface ClassSummaryBannerProps {
  data: ClassComparisonResponseDto;
}

function ClassSummaryBanner({ data }: ClassSummaryBannerProps): React.JSX.Element {
  const { classAverageA, classAverageB, deltaClassAverage } = data;

  return (
    <motion.div
      variants={ITEM}
      className="overflow-hidden rounded-3xl border border-white/70 bg-white/65 shadow-[0_4px_24px_rgba(15,23,42,0.07)]"
      style={{ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}
    >
      <div className="border-b border-slate-100 px-6 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">סיכום כיתה</p>
        <p className="mt-0.5 text-base font-bold text-slate-800">ממוצע כיתה כולל — השוואה בין מחציות</p>
      </div>
      <div className="flex items-center gap-6 p-6">
        {/* Semester A */}
        <div className="flex-1 rounded-2xl bg-indigo-50 p-5 text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-500">מחצית א׳</p>
          {classAverageA !== null ? (
            <p className="text-4xl font-extrabold text-indigo-700">{classAverageA}</p>
          ) : (
            <p className="text-2xl font-bold text-slate-400">—</p>
          )}
          <p className="mt-1 text-xs text-slate-400">ממוצע כל המבחנים</p>
        </div>

        {/* Delta */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <ArrowRight className="h-5 w-5 text-slate-300" aria-hidden="true" />
          <DeltaBadge delta={deltaClassAverage} size="lg" />
        </div>

        {/* Semester B */}
        <div className="flex-1 rounded-2xl bg-emerald-50 p-5 text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-500">מחצית ב׳</p>
          {classAverageB !== null ? (
            <p className="text-4xl font-extrabold text-emerald-700">{classAverageB}</p>
          ) : (
            <p className="text-2xl font-bold text-slate-400">—</p>
          )}
          <p className="mt-1 text-xs text-slate-400">ממוצע כל המבחנים</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4 animate-pulse" dir="rtl">
      <div className="h-24 rounded-3xl bg-slate-200/60" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-64 rounded-3xl bg-slate-200/60" />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ComparisonPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();

  const { data: cls }                           = useClass(classId);
  const { data: students }                      = useStudents(classId);
  const { data, isLoading, error }              = useClassComparison(classId);

  /** Map of studentId → full name for drill-down labels. */
  const studentNameMap = useMemo<Map<string, string>>(
    () => new Map(
      (students ?? []).map((s: StudentData) => [s.id, `${s.firstName} ${s.lastName}`]),
    ),
    [students],
  );

  return (
    <>
    <BackButton />
    <div dir="rtl" className="min-h-screen">
      <motion.div
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl space-y-6 px-4 pt-16 pb-6 md:px-0 md:pt-6"
      >
        {/* ── Page Header ──────────────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-400">{cls?.name ?? '...'}</p>
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                <h1 className="text-xl font-extrabold text-slate-800">השוואת מחציות</h1>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Loading ───────────────────────────────────────────────── */}
        {isLoading && (
          <LoadingSkeleton />
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {error !== undefined && !isLoading && (
          <motion.div
            variants={ITEM}
            className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <p className="font-semibold text-red-700">שגיאה בטעינת נתוני ההשוואה</p>
            <p className="mt-1 text-sm text-red-500">אנא נסה לרענן את הדף</p>
          </motion.div>
        )}

        {/* ── Content ──────────────────────────────────────────────── */}
        {data !== undefined && !isLoading && (
          <>
            {/* Class summary banner */}
            <ClassSummaryBanner data={data} />

            {/* Test comparison cards */}
            <motion.div variants={ITEM} className="space-y-4">
              {data.testComparisons.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white/50 p-8 text-center">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden="true" />
                  <p className="font-semibold text-slate-500">אין נתוני השוואה זמינים</p>
                  <p className="mt-1 text-sm text-slate-400">הזן ציונים למחצית ב׳ כדי לראות את ההשוואה</p>
                </div>
              ) : (
                data.testComparisons.map((test) => (
                  <TestComparisonCard
                    key={test.testTypeId}
                    test={test}
                    studentNameMap={studentNameMap}
                  />
                ))
              )}
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
    </>
  );
}
