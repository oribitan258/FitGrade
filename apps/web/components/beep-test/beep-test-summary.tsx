'use client';

/**
 * BeepTestSummary — post-test results table with grade override and save.
 *
 * Flow:
 *   1. On mount, POST /sessions/:sessionId/results for every student.
 *      rawValue = eliminatedAt.level + eliminatedAt.shuttle * 0.1
 *                 (or finalLevel + finalShuttle * 0.1 for students still
 *                 running at test end).
 *   2. Backend GradingService calculates a grade (0–100) per student.
 *   3. Teacher can override any grade with a reason.
 *   4. "שמור הכל" PATCHes overrides, then PATCHes session complete,
 *      then navigates back to the class page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Save, TriangleAlert } from 'lucide-react';

import { getHebrewGradeLabel } from '@fitgrade/types';
import type { LiveStudentResult } from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { apiRequest } from '@/lib/api-client';
import type { BeepStudentState } from '@/hooks/use-beep-students';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ResultRow {
  studentId: string;
  firstName: string;
  lastName: string;
  /** level + shuttle * 0.1 */
  rawValue: number;
  /** Returned by the backend after POST. */
  resultId: string | null;
  calculatedGrade: number | null;
  /** Teacher-entered override values (empty string = no override). */
  overrideGrade: string;
  overrideReason: string;
  /** Per-row submission state. */
  submitting: boolean;
  error: string | null;
}

export interface BeepTestSummaryProps {
  sessionId: string;
  classId: string;
  /** Final roster from BeepTestConsole — includes ACTIVE, WARNING, ELIMINATED. */
  students: BeepStudentState[];
  /** Engine level at the moment the test ended (for still-active students). */
  finalLevel: number;
  /** Engine shuttle at the moment the test ended. */
  finalShuttle: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Computes the rawValue for a student. */
function computeRawValue(
  student: BeepStudentState,
  finalLevel: number,
  finalShuttle: number,
): number {
  if (student.eliminatedAt !== null) {
    return parseFloat(
      (student.eliminatedAt.level + student.eliminatedAt.shuttle * 0.1).toFixed(1),
    );
  }
  // Still active or warning at test end — use the engine's final position.
  return parseFloat((finalLevel + finalShuttle * 0.1).toFixed(1));
}

/** Formats a rawValue for display: "8.3" → "רמה 8, מעבר 3". */
function formatRawValue(rawValue: number): string {
  const level = Math.floor(rawValue);
  const shuttle = Math.round((rawValue - level) * 10);
  return `${level}.${shuttle}`;
}

function buildInitialRows(
  students: BeepStudentState[],
  finalLevel: number,
  finalShuttle: number,
): ResultRow[] {
  return students.map((s) => ({
    studentId: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    rawValue: computeRawValue(s, finalLevel, finalShuttle),
    resultId: null,
    calculatedGrade: null,
    overrideGrade: '',
    overrideReason: '',
    submitting: true,
    error: null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BeepTestSummary({
  sessionId,
  classId,
  students,
  finalLevel,
  finalShuttle,
}: BeepTestSummaryProps): React.JSX.Element {
  const router = useRouter();

  const [rows, setRows] = useState<ResultRow[]>(() =>
    buildInitialRows(students, finalLevel, finalShuttle),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ── Auto-submit results on mount ──────────────────────────────────────────
  const submitStartedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation.
    if (submitStartedRef.current) return;
    submitStartedRef.current = true;

    const initialRows = buildInitialRows(students, finalLevel, finalShuttle);

    void Promise.all(
      initialRows.map(async (row) => {
        try {
          const result = await apiRequest<LiveStudentResult>(
            `/sessions/${sessionId}/results`,
            {
              method: 'POST',
              body: JSON.stringify({ studentId: row.studentId, rawValue: row.rawValue }),
            },
          );
          setRows((prev) =>
            prev.map((r) =>
              r.studentId === row.studentId
                ? {
                    ...r,
                    resultId: result.resultId,
                    calculatedGrade: result.calculatedGrade,
                    submitting: false,
                    error: null,
                  }
                : r,
            ),
          );
        } catch (err) {
          const msg =
            err instanceof ApiError ? err.message : 'שגיאה בשמירת התוצאה';
          setRows((prev) =>
            prev.map((r) =>
              r.studentId === row.studentId
                ? { ...r, submitting: false, error: msg }
                : r,
            ),
          );
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers to update override fields ─────────────────────────────────────
  const setOverrideGrade = useCallback(
    (studentId: string, value: string): void => {
      setRows((prev) =>
        prev.map((r) => (r.studentId === studentId ? { ...r, overrideGrade: value } : r)),
      );
    },
    [],
  );

  const setOverrideReason = useCallback(
    (studentId: string, value: string): void => {
      setRows((prev) =>
        prev.map((r) =>
          r.studentId === studentId ? { ...r, overrideReason: value } : r,
        ),
      );
    },
    [],
  );

  // ── Save all ──────────────────────────────────────────────────────────────
  const handleSaveAll = useCallback(async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);

    try {
      // 1. PATCH any rows with a numeric override grade.
      await Promise.all(
        rows
          .filter((r) => r.resultId !== null && r.overrideGrade.trim() !== '')
          .map(async (r) => {
            const gradeOverride = parseInt(r.overrideGrade, 10);
            if (isNaN(gradeOverride) || gradeOverride < 0 || gradeOverride > 100) return;
            await apiRequest(
              `/sessions/${sessionId}/results/${r.resultId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  gradeOverride,
                  overrideReason: r.overrideReason.trim(),
                }),
              },
            );
          }),
      );

      // 2. Mark session as complete.
      await apiRequest(`/sessions/${sessionId}/complete`, { method: 'PATCH' });

      setSaved(true);

      // 3. Navigate back to class page after a short pause.
      setTimeout(() => {
        router.push(`/classes/${classId}`);
      }, 1200);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'שגיאה בשמירת הנתונים');
      setSaving(false);
    }
  }, [rows, sessionId, classId, router]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const submittingCount = rows.filter((r) => r.submitting).length;
  const errorCount = rows.filter((r) => r.error !== null).length;
  const allSubmitted = submittingCount === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex min-h-screen flex-col"
      dir="rtl"
    >
      {/* Dark background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(160deg, #1e1b4b 0%, #0f0a2e 60%, #120828 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 pb-32 flex flex-col gap-6">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <CheckCircle2
            className="mx-auto mb-3 h-12 w-12 text-emerald-400"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-black text-white">המבחן הסתיים</h1>
          <p className="mt-1 text-sm text-white/50">
            {rows.length} תלמידים — בדוק ציונים ושמור
          </p>
        </motion.div>

        {/* ── Submission progress indicator ─────────────────────────────── */}
        <AnimatePresence>
          {!allSubmitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-300"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              שומר תוצאות... ({rows.length - submittingCount} / {rows.length})
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error summary ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {errorCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorCount} תוצאות לא נשמרו — בדוק שגיאות בטבלה
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results table ─────────────────────────────────────────────── */}
        <section
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
          aria-label="תוצאות מבחן ביפ"
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr_auto_auto_1fr] gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/35"
            aria-hidden="true"
          >
            <span>שם</span>
            <span className="text-center">ניקוד</span>
            <span className="text-center">ציון</span>
            <span>עקיפה</span>
          </div>

          {/* Student rows */}
          <div className="divide-y divide-white/5">
            {rows.map((row) => (
              <div
                key={row.studentId}
                className="grid grid-cols-[1fr_auto_auto_1fr] items-start gap-3 px-4 py-3"
              >
                {/* Name + error */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {row.firstName} {row.lastName}
                  </p>
                  {row.error !== null && (
                    <p className="mt-0.5 text-xs text-red-400" role="alert">
                      {row.error}
                    </p>
                  )}
                </div>

                {/* Raw value badge */}
                <div className="flex items-center justify-center">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-white/70">
                    {formatRawValue(row.rawValue)}
                  </span>
                </div>

                {/* Calculated grade */}
                <div className="flex min-w-[64px] flex-col items-center justify-center gap-0.5">
                  {row.submitting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin text-white/30"
                      aria-label="מחשב ציון..."
                    />
                  ) : row.calculatedGrade !== null ? (
                    <>
                      <span className="text-base font-black tabular-nums text-white">
                        {row.calculatedGrade}
                      </span>
                      <span className="text-[10px] font-semibold text-white/40">
                        {getHebrewGradeLabel(row.calculatedGrade)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-white/25">—</span>
                  )}
                </div>

                {/* Override inputs */}
                <div className="flex flex-col gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.overrideGrade}
                    onChange={(e) => setOverrideGrade(row.studentId, e.target.value)}
                    placeholder="ציון חלופי"
                    className="w-full rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30"
                    aria-label={`ציון חלופי עבור ${row.firstName}`}
                    disabled={row.resultId === null}
                  />
                  {row.overrideGrade.trim() !== '' && (
                    <input
                      type="text"
                      value={row.overrideReason}
                      onChange={(e) => setOverrideReason(row.studentId, e.target.value)}
                      placeholder="סיבה (חובה)"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/20"
                      aria-label={`סיבת עקיפה עבור ${row.firstName}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Fixed bottom bar ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#0f0a2e]/90 px-4 py-3 backdrop-blur-xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-emerald-300"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              נשמר! מעביר לדף הכיתה...
            </motion.div>
          ) : (
            <motion.div key="save-btn" className="flex flex-col gap-2">
              {saveError !== null && (
                <p className="text-center text-xs font-semibold text-red-400" role="alert">
                  {saveError}
                </p>
              )}
              <motion.button
                type="button"
                whileTap={!saving && allSubmitted ? { scale: 0.97 } : {}}
                onClick={() => { void handleSaveAll(); }}
                disabled={saving || !allSubmitted}
                className={[
                  'flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold transition-all',
                  saving || !allSubmitted
                    ? 'cursor-not-allowed bg-white/10 text-white/30'
                    : 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/35',
                ].join(' ')}
                aria-disabled={saving || !allSubmitted}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    שומר...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" aria-hidden="true" />
                    שמור הכל וסיים
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
