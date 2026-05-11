'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTestSession } from '@/hooks/use-test-session';
import { apiRequest } from '@/lib/api-client';
import { ApiError, getHebrewGradeLabel } from '@fitgrade/types';
import type { SessionStudent } from '@fitgrade/types';
import { PreTestRosterSelection } from '@/components/pre-test-roster-selection';
import { useSemester } from '@/contexts/semester-context';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/back-button';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StudentSlot {
  inputValue: string;
  /** Value currently persisted in DB — used to skip identical re-saves. */
  savedInputValue: string;
  /** Whether the DB already has a result row for this student. */
  hasResult: boolean;
  calculatedGrade: number | null;
  status: SlotStatus;
  errorMsg: string | null;
}

type SlotsMap = Record<string, StudentSlot>;

function emptySlot(
  inputValue = '',
  calculatedGrade: number | null = null,
  hasResult = false,
): StudentSlot {
  return {
    inputValue,
    savedInputValue: inputValue,
    hasResult,
    calculatedGrade,
    status: hasResult ? 'saved' : 'idle',
    errorMsg: null,
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

interface SavedResult {
  id: string;
  calculatedGrade: number;
}

async function postResult(
  sessionId: string,
  studentId: string,
  rawValue: number,
): Promise<SavedResult> {
  return apiRequest<SavedResult>(`/sessions/${sessionId}/results`, {
    method: 'POST',
    body: JSON.stringify({ studentId, rawValue }),
  });
}

async function deleteStudentResult(sessionId: string, studentId: string): Promise<void> {
  await apiRequest<void>(`/sessions/${sessionId}/results/${studentId}`, {
    method: 'DELETE',
  });
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function gradeColor(grade: number): string {
  if (grade >= 90) return 'text-emerald-600';
  if (grade >= 75) return 'text-blue-600';
  if (grade >= 60) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ManualEntrySkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-5 w-48 animate-pulse rounded-lg bg-white/70" />
      <div className="h-28 animate-pulse rounded-3xl bg-white/70" />
      <div className="overflow-hidden rounded-2xl bg-white/60">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex items-center gap-4 border-b border-slate-50 px-5 py-3.5">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-12 w-28 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pass/Fail toggle ─────────────────────────────────────────────────────────

interface PassFailToggleProps {
  value: string;        // '1' = pass, '0' = fail, '' = unset
  status: SlotStatus;
  onChange: (val: '1' | '0') => void;
  onSave: () => void;
  disabled: boolean;
}

function PassFailToggle({
  value, status, onChange, onSave, disabled,
}: PassFailToggleProps): React.JSX.Element {
  function pick(v: '1' | '0'): void {
    if (disabled) return;
    onChange(v);
    setTimeout(onSave, 0); // let state update settle before saving
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => pick('1')}
        disabled={disabled}
        aria-pressed={value === '1'}
        className={cn(
          'flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-all',
          value === '1'
            ? 'bg-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.40)]'
            : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600',
          status === 'saving' && 'opacity-50 cursor-not-allowed',
        )}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        עובר
      </button>
      <button
        type="button"
        onClick={() => pick('0')}
        disabled={disabled}
        aria-pressed={value === '0'}
        className={cn(
          'flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-all',
          value === '0'
            ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.35)]'
            : 'border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600',
          status === 'saving' && 'opacity-50 cursor-not-allowed',
        )}
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        נכשל
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManualSessionPage(): React.JSX.Element {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();
  const { activeSemester } = useSemester();

  const { data: session, isLoading, error: sessionError } = useTestSession(sessionId, false);

  /**
   * Slots live in a ref for stale-closure-safe async reads.
   * A `useReducer` tick forces re-renders whenever slots change.
   */
  const slotsRef            = useRef<SlotsMap>({});
  const pendingSaveRef      = useRef<Set<string>>(new Set());
  const isEndingRef         = useRef(false);
  const inputRefs           = useRef<(HTMLInputElement | null)[]>([]);
  const [, forceRender]     = useReducer((n: number) => n + 1, 0);

  // ── Roster confirmed by PreTestRosterSelection ────────────────────────────
  const [activeStudents, setActiveStudents] = useState<SessionStudent[] | null>(null);

  // ── Hydrate slots from API response ───────────────────────────────────────

  useEffect(() => {
    if (!session || activeStudents === null) return;
    const next: SlotsMap = {};
    for (const student of activeStudents) {
      // Preserve any in-progress edits across SWR revalidations
      if (slotsRef.current[student.id] !== undefined) {
        next[student.id] = slotsRef.current[student.id]!;
        continue;
      }
      const existing = session.results.find((r) => r.studentId === student.id);
      next[student.id] = existing
        ? emptySlot(String(existing.rawValue), existing.calculatedGrade, true)
        : emptySlot();
    }
    slotsRef.current = next;
    forceRender();
  }, [session, activeStudents]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  function patchSlot(studentId: string, patch: Partial<StudentSlot>): void {
    slotsRef.current = {
      ...slotsRef.current,
      [studentId]: { ...slotsRef.current[studentId]!, ...patch },
    };
    forceRender();
  }

  function focusNext(index: number): void {
    const next = inputRefs.current[index + 1];
    if (next) {
      next.focus();
      next.select();
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(studentId: string, index: number): Promise<void> {
    // Guard: already mid-save for this student
    if (pendingSaveRef.current.has(studentId)) return;

    const slot = slotsRef.current[studentId];
    if (!slot) return;

    const trimmed = slot.inputValue.trim();

    if (trimmed === '') { focusNext(index); return; }

    // Skip identical re-save
    if (slot.status === 'saved' && trimmed === slot.savedInputValue) {
      focusNext(index);
      return;
    }

    const rawValue = parseFloat(trimmed);
    if (isNaN(rawValue)) {
      patchSlot(studentId, { status: 'error', errorMsg: 'ערך לא תקין' });
      return;
    }

    pendingSaveRef.current.add(studentId);
    patchSlot(studentId, { status: 'saving', errorMsg: null });

    try {
      if (slot.hasResult) {
        await deleteStudentResult(sessionId, studentId);
      }
      const result = await postResult(sessionId, studentId, rawValue);

      // Move focus BEFORE removing lock so the resulting onBlur sees the guard
      focusNext(index);

      patchSlot(studentId, {
        status: 'saved',
        hasResult: true,
        savedInputValue: trimmed,
        calculatedGrade: result.calculatedGrade,
      });
    } catch (err) {
      patchSlot(studentId, {
        status: 'error',
        errorMsg: err instanceof ApiError ? err.message : 'שגיאה בשמירה — נסה שוב',
      });
    } finally {
      pendingSaveRef.current.delete(studentId);
    }
  }

  function handleInputChange(studentId: string, value: string): void {
    const prev   = slotsRef.current[studentId];
    const status = prev?.status === 'saving' ? 'saving' : 'idle';
    patchSlot(studentId, { inputValue: value, status, errorMsg: null });
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: string,
    index: number,
  ): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave(studentId, index);
    }
  }

  // ── End session ───────────────────────────────────────────────────────────

  async function handleEndSession(): Promise<void> {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    forceRender();
    try {
      await apiRequest(`/sessions/${sessionId}/complete`, { method: 'PATCH' });
      router.push(`/classes/${classId}`);
    } catch {
      isEndingRef.current = false;
      forceRender();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <ManualEntrySkeleton />;

  if (sessionError || !session) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 max-w-lg">
        לא ניתן לטעון את פרטי המבחן — נסה לרענן את הדף.
      </div>
    );
  }

  if (activeStudents === null) {
    return (
      <PreTestRosterSelection
        students={session.students}
        testName={session.testNameHe}
        onConfirm={setActiveStudents}
      />
    );
  }

  const slots       = slotsRef.current;
  const isPassFail  = session.testInputType === 'PASS_FAIL';
  const savedCount  = Object.values(slots).filter((s) => s.status === 'saved').length;
  const totalCount  = activeStudents.length;
  const progressPct = totalCount > 0 ? (savedCount / totalCount) * 100 : 0;
  const allDone     = savedCount === totalCount && totalCount > 0;

  const gridCols = isPassFail
    ? 'grid-cols-[1fr_auto_6rem]'
    : 'grid-cols-[1fr_9rem_8rem]';

  return (
    <>
      <BackButton />
      <div className="space-y-6">
      {/* ── Breadcrumb ────────────────────────────────────────── */}
      <nav aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm">
        <Link
          href={`/classes/${classId}`}
          className="flex items-center gap-1 font-medium text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          חזרה לכיתה
        </Link>
        <span className="text-slate-300 select-none">/</span>
        <span className="max-w-[18ch] truncate font-semibold text-slate-700">
          {session.testNameHe}
        </span>
        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
          הזנה ידנית
        </span>
      </nav>

      {/* ── Semester safety badge ─────────────────────────────── */}
      <div className={cn(
        'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold border',
        activeSemester === 'A'
          ? 'bg-violet-50/80 text-violet-700 border-violet-200/70'
          : 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70',
      )}>
        <span aria-hidden="true">📌</span>
        <span>שימו לב: ההזנה מתבצעת למחצית {activeSemester === 'A' ? 'א׳' : 'ב׳'}</span>
      </div>

      {/* ── Header card ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
        className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 shadow-[0_4px_28px_rgba(99,102,241,0.35)]"
      >
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
          {session.testUnit ? `יחידה: ${session.testUnit}` : 'הזנה ידנית'} ·{' '}
          {new Date(session.conductedAt).toLocaleDateString('he-IL')}
        </p>
        <h1 className="mb-5 text-2xl font-extrabold text-white">{session.testNameHe}</h1>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-indigo-200">{savedCount} / {totalCount} תלמידים נרשמו</span>
            <span className="font-bold text-white">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Keyboard hint (numeric only) ──────────────────────── */}
      {!isPassFail && (
        <p className="text-center text-xs text-slate-400">
          הקלד ערך ←{' '}
          <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            Enter
          </kbd>{' '}
          ← עבור לתלמיד הבא אוטומטית
        </p>
      )}

      {/* ── Student table ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55, delay: 0.08 }}
        className="overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
      >
        {/* Column headers */}
        <div className={cn('border-b border-slate-100 bg-slate-50/80 px-5 py-3 grid gap-4', gridCols)}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">שם תלמיד</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {isPassFail ? 'תוצאה' : session.testUnit ? `ערך (${session.testUnit})` : 'ערך'}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ציון</span>
        </div>

        <ul>
          {activeStudents.map((student, index) => {
            const slot     = slots[student.id] ?? emptySlot();
            const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

            return (
              <motion.li
                key={student.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35, delay: index * 0.025 }}
              >
                <div
                  className={cn(
                    'grid items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 transition-colors',
                    gridCols,
                    slot.status === 'saved' && 'bg-emerald-50/35',
                    slot.status === 'error'  && 'bg-red-50/35',
                  )}
                >
                  {/* Student name */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {student.firstName} {student.lastName}
                      </p>
                      {student.nationalId && (
                        <code className="font-mono text-xs text-slate-400">
                          ת.ז ****{student.nationalId.slice(-4)}
                        </code>
                      )}
                    </div>
                  </div>

                  {/* Input: numeric or pass/fail */}
                  {isPassFail ? (
                    <PassFailToggle
                      value={slot.inputValue}
                      status={slot.status}
                      disabled={slot.status === 'saving'}
                      onChange={(val) => handleInputChange(student.id, val)}
                      onSave={() => void handleSave(student.id, index)}
                    />
                  ) : (
                    <div className="relative">
                      <input
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={slot.inputValue}
                        onChange={(e) => handleInputChange(student.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, student.id, index)}
                        onBlur={() => { void handleSave(student.id, index); }}
                        disabled={slot.status === 'saving'}
                        placeholder="0"
                        aria-label={`ערך עבור ${student.firstName} ${student.lastName}`}
                        className={cn(
                          'h-12 w-full rounded-xl border bg-white/90 ps-4 pe-9 text-lg font-bold text-slate-800 transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent',
                          'placeholder:text-slate-300 disabled:opacity-50',
                          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                          slot.status === 'error'
                            ? 'border-red-300 focus:ring-red-300'
                            : slot.status === 'saved' && slot.inputValue
                              ? 'border-emerald-300 bg-emerald-50/50'
                              : 'border-slate-200',
                        )}
                      />
                      {/* Status icon */}
                      <div className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                        <AnimatePresence mode="wait">
                          {slot.status === 'saving' && (
                            <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" aria-hidden="true" />
                            </motion.div>
                          )}
                          {slot.status === 'saved' && (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            >
                              <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* Calculated grade */}
                  <div className="text-start">
                    <AnimatePresence mode="wait">
                      {slot.calculatedGrade !== null ? (
                        <motion.div
                          key={`g-${slot.calculatedGrade}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                        >
                          <span className={`text-xl font-extrabold ${gradeColor(slot.calculatedGrade)}`}>
                            {getHebrewGradeLabel(slot.calculatedGrade)}
                          </span>
                          <p className="text-[11px] leading-tight text-slate-500">
                            {getHebrewGradeLabel(slot.calculatedGrade)}
                          </p>
                        </motion.div>
                      ) : slot.status === 'error' ? (
                        <motion.p
                          key="err"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs leading-tight text-red-600"
                        >
                          {slot.errorMsg}
                        </motion.p>
                      ) : (
                        <span key="empty" className="text-sm text-slate-300">—</span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>

      {/* ── End session ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {allDone
            ? 'כל התלמידים נרשמו — ניתן לסיים'
            : `נותרו ${totalCount - savedCount} תלמידים להזנה`}
        </p>
        <motion.button
          type="button"
          onClick={() => { void handleEndSession(); }}
          disabled={isEndingRef.current}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition-colors',
            allDone
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_20px_rgba(16,185,129,0.35)]'
              : activeSemester === 'A'
                ? 'bg-violet-600 hover:bg-violet-700 shadow-[0_4px_20px_rgba(124,58,237,0.30)]'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_20px_rgba(16,185,129,0.30)]',
            isEndingRef.current && 'opacity-70 cursor-not-allowed',
          )}
        >
          {isEndingRef.current ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isEndingRef.current ? 'מסיים...' : 'סיים מבחן'}
        </motion.button>
      </div>
    </div>
    </>
  );
}
