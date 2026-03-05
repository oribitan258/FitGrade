'use client';

import { motion } from 'framer-motion';
import { getHebrewGradeLabel, getGradeColorKey } from '@fitgrade/types';
import { useMyAttendance, useMyResults } from '@/hooks/use-student-data';
import type { AttendanceStatus, StudentResult } from '@/hooks/use-student-data';
import { AlertCircle, CheckCircle, Clock, Target, Trophy, XCircle } from 'lucide-react';

// ─── Animation presets ───────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.55 } },
};

const staggerGrid = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formats ISO date string → DD/MM/YY */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0]!.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; Icon: typeof CheckCircle; bg: string; text: string; border: string }
> = {
  PRESENT: {
    label: 'נוכח',
    Icon: CheckCircle,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  ABSENT: {
    label: 'נעדר',
    Icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  LATE: {
    label: 'איחור',
    Icon: Clock,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  EXCUSED: {
    label: 'פטור',
    Icon: AlertCircle,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
};

const GRADE_PILL: Record<string, string> = {
  excellent: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  good: 'bg-blue-100 text-blue-800 border-blue-200',
  pass: 'bg-amber-100 text-amber-800 border-amber-200',
  fail: 'bg-red-100 text-red-800 border-red-200',
};

/** Top-3 personal bests by grade (one per test type). */
function getPersonalBests(results: StudentResult[]): StudentResult[] {
  const best = new Map<string, StudentResult>();
  for (const r of results) {
    const existing = best.get(r.testNameHe);
    if (!existing || r.effectiveGrade > existing.effectiveGrade) {
      best.set(r.testNameHe, r);
    }
  }
  return [...best.values()]
    .sort((a, b) => b.effectiveGrade - a.effectiveGrade)
    .slice(0, 3);
}

interface NextGoal {
  testName: string;
  currentScore: number;
  targetScore: number;
  targetLabel: string;
}

/** Finds the lowest result and computes the next grade tier target. */
function getNextGoal(results: StudentResult[]): NextGoal | null {
  if (!results.length) return null;
  const [worst] = [...results].sort((a, b) => a.effectiveGrade - b.effectiveGrade);
  if (!worst) return null;

  let targetScore: number;
  let targetLabel: string;

  if (worst.effectiveGrade < 55) {
    targetScore = 55;
    targetLabel = getHebrewGradeLabel(55);
  } else if (worst.effectiveGrade < 60) {
    targetScore = 60;
    targetLabel = getHebrewGradeLabel(60);
  } else if (worst.effectiveGrade < 75) {
    targetScore = 75;
    targetLabel = getHebrewGradeLabel(75);
  } else if (worst.effectiveGrade < 90) {
    targetScore = 90;
    targetLabel = getHebrewGradeLabel(90);
  } else {
    return null; // already excellent across the board
  }

  return {
    testName: worst.testNameHe,
    currentScore: worst.effectiveGrade,
    targetScore,
    targetLabel,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonalBestsWidget({
  results,
}: {
  results: StudentResult[];
}): React.JSX.Element {
  const bests = getPersonalBests(results);
  return (
    <div className="rounded-2xl bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 shadow-sm p-5 h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-amber-100">
          <Trophy className="w-4 h-4 text-amber-600" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-foreground text-sm">הישגים אישיים</h2>
      </div>
      {bests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">עדיין אין תוצאות להצגה</p>
      ) : (
        <ul className="space-y-2.5">
          {bests.map((r) => {
            const colorKey = getGradeColorKey(r.effectiveGrade);
            const pillClass = GRADE_PILL[colorKey] ?? 'bg-muted text-muted-foreground border-border';
            return (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{r.testNameHe}</span>
                <span
                  className={`shrink-0 text-xs font-semibold rounded-full border px-2.5 py-0.5 ${pillClass}`}
                >
                  {getHebrewGradeLabel(r.effectiveGrade)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NextGoalWidget({ results }: { results: StudentResult[] }): React.JSX.Element {
  const goal = getNextGoal(results);
  return (
    <div className="rounded-2xl bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 shadow-sm p-5 h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-blue-100">
          <Target className="w-4 h-4 text-blue-600" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-foreground text-sm">היעד הבא</h2>
      </div>
      {!goal ? (
        <p className="text-sm text-center py-4">
          {results.length === 0 ? (
            <span className="text-muted-foreground">אין נתונים עדיין</span>
          ) : (
            <span className="text-emerald-700 font-medium">מצוין! הגעת לציון הגבוה ביותר!</span>
          )}
        </p>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            ב<span className="font-semibold text-foreground">{goal.testName}</span>
          </p>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{goal.currentScore}</div>
              <div className="text-xs text-muted-foreground">כעת</div>
            </div>
            <div className="flex-1 h-2 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400"
                style={{
                  width: `${Math.min(Math.round((goal.currentScore / goal.targetScore) * 100), 95)}%`,
                }}
              />
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{goal.targetScore}</div>
              <div className="text-xs text-muted-foreground">יעד</div>
            </div>
          </div>
          <p className="text-xs text-blue-700 font-medium">המטרה: {goal.targetLabel}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage(): React.JSX.Element {
  const { data: attendance, isLoading: loadingAttendance, error: errorAttendance } =
    useMyAttendance();
  const { data: results, isLoading: loadingResults, error: errorResults } = useMyResults();

  const summary = attendance ?? {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
    records: [],
  };
  const resultsList: StudentResult[] = results ?? [];
  const attendancePct =
    summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">הביצועים שלי</h1>
        <p className="text-muted-foreground text-sm mt-0.5">סיכום נוכחות ותוצאות מבחני כושר</p>
      </div>

      {/* ─── Personal Bests + Next Goal ──────────────────────────── */}
      {!loadingResults && !errorResults && (
        <motion.div
          variants={staggerGrid}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <motion.div variants={fadeUp} className="h-full">
            <PersonalBestsWidget results={resultsList} />
          </motion.div>
          <motion.div variants={fadeUp} className="h-full">
            <NextGoalWidget results={resultsList} />
          </motion.div>
        </motion.div>
      )}

      {/* ─── Attendance ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/60 shadow-sm p-6"
      >
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-emerald-100">
            <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-foreground">נוכחות</h2>
        </div>

        {loadingAttendance && <p className="text-muted-foreground text-sm">טוען...</p>}
        {errorAttendance && (
          <p className="text-sm text-destructive">שגיאה בטעינת נתוני הנוכחות</p>
        )}

        {!loadingAttendance && !errorAttendance && (
          <>
            {/* Stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {(
                [
                  ['PRESENT', summary.present],
                  ['ABSENT', summary.absent],
                  ['LATE', summary.late],
                  ['EXCUSED', summary.excused],
                ] as [AttendanceStatus, number][]
              ).map(([status, count]) => {
                const cfg = STATUS_CONFIG[status];
                const Icon = cfg.Icon;
                return (
                  <div
                    key={status}
                    className={`rounded-xl border p-3 text-center ${cfg.bg} ${cfg.border}`}
                  >
                    <Icon className={`w-5 h-5 ${cfg.text} mx-auto mb-1`} aria-hidden="true" />
                    <div className={`text-2xl font-bold ${cfg.text}`}>{count}</div>
                    <div className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>

            {summary.total > 0 && (
              <>
                {/* Progress bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold text-emerald-700">{attendancePct}% נוכחות</span>
                    <span className="text-muted-foreground">
                      {summary.present} מתוך {summary.total}
                    </span>
                  </div>
                  <div
                    className="h-2.5 rounded-full bg-emerald-100 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={attendancePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`אחוז נוכחות: ${attendancePct}%`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${attendancePct}%` }}
                      transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-emerald-500"
                    />
                  </div>
                </div>

                {/* Recent records */}
                <div className="space-y-2">
                  {summary.records.slice(0, 8).map((record) => {
                    const cfg = STATUS_CONFIG[record.status];
                    const Icon = cfg.Icon;
                    return (
                      <div
                        key={record.date}
                        className="flex items-center justify-between rounded-xl border bg-white/60 px-3 py-2"
                      >
                        <div className={`flex items-center gap-2 text-sm font-medium ${cfg.text}`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                          {cfg.label}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatDate(record.date)}
                        </span>
                      </div>
                    );
                  })}
                  {summary.records.length > 8 && (
                    <p className="text-center text-xs text-muted-foreground pt-1">
                      מציג 8 מתוך {summary.records.length} רשומות
                    </p>
                  )}
                </div>
              </>
            )}

            {summary.total === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                אין רשומות נוכחות עדיין
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* ─── Test Results ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-md p-6"
      >
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-indigo-100">
            <Trophy className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-foreground">תוצאות מבחני כושר</h2>
        </div>

        {loadingResults && <p className="text-muted-foreground text-sm">טוען...</p>}
        {errorResults && (
          <p className="text-sm text-destructive">שגיאה בטעינת תוצאות המבחנים</p>
        )}

        {!loadingResults && !errorResults && resultsList.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            אין תוצאות מבחנים עדיין
          </p>
        )}

        {!loadingResults && !errorResults && resultsList.length > 0 && (
          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {resultsList.map((result) => {
              const colorKey = getGradeColorKey(result.effectiveGrade);
              const pillClass =
                GRADE_PILL[colorKey] ?? 'bg-muted text-muted-foreground border-border';
              return (
                <motion.div
                  key={result.id}
                  variants={fadeUp}
                  className="flex items-center justify-between rounded-xl border bg-white/60 px-4 py-3 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground">{result.testNameHe}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ביצוע:{' '}
                      <span className="font-mono">{result.rawValue}</span>
                      <span className="mx-1.5">·</span>
                      {formatDate(result.sessionDate)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold rounded-full border px-3 py-1 ${pillClass}`}
                    aria-label={`ציון: ${getHebrewGradeLabel(result.effectiveGrade)}`}
                  >
                    {getHebrewGradeLabel(result.effectiveGrade)}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
