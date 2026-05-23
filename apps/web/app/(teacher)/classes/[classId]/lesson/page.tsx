'use client';

/**
 * ניהול שיעור — Live Lesson Data Entry
 *
 * Two-phase state machine:
 *   select  → teacher picks test type + can mark injury exemptions
 *   active  → session running, inline result entry per student
 *
 * Injury/Exemption:
 *   POST /classes/:classId/attendance { date, records: [{studentId, status}] }
 *   Uses EXCUSED status. Exempt students slide to a separated section.
 *
 * Session flow:
 *   1. Teacher selects test type → "התחל מבחן" → POST /classes/:classId/sessions
 *   2. Session created → inline numeric/PASS_FAIL entry grid
 *   3. Teacher saves results per student (blur / Enter)
 *   4. "סיים שיעור" → PATCH /sessions/:id/complete → back to class page
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flag,
  Loader2,
  ShieldAlert,
  UserMinus,
  X,
} from 'lucide-react';
import { useStudents } from '@/hooks/use-classes';
import { useTestTypes } from '@/hooks/use-test-types';
import type { TestType } from '@/hooks/use-test-types';
import { apiRequest } from '@/lib/api-client';
import { ApiError, getHebrewGradeLabel } from '@fitgrade/types';
import { useSemester } from '@/contexts/semester-context';
import { useDashboardInvalidate } from '@/hooks/use-dashboard-invalidate';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/ui/back-button';

// ─── Types ────────────────────────────────────────────────────────────────────

type LessonStep = 'select' | 'creating' | 'active' | 'done';

type SlotStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StudentSlot {
  inputValue:      string;
  savedInputValue: string;
  hasResult:       boolean;
  calculatedGrade: number | null;
  status:          SlotStatus;
  errorMsg:        string | null;
}

type SlotsMap = Record<string, StudentSlot>;

interface SessionInfo {
  id:            string;
  testInputType: 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptySlot(inputValue = '', calculatedGrade: number | null = null, hasResult = false): StudentSlot {
  return {
    inputValue,
    savedInputValue: inputValue,
    hasResult,
    calculatedGrade,
    status:   hasResult ? 'saved' : 'idle',
    errorMsg: null,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function gradeColor(grade: number): string {
  if (grade >= 90) return 'text-emerald-600';
  if (grade >= 75) return 'text-blue-600';
  if (grade >= 60) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; onDismiss: () => void }
function Toast({ message, onDismiss }: ToastProps): React.JSX.Element {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      className="fixed bottom-6 start-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl"
      style={{
        transform:            'translateX(-50%)',
        background:           'rgba(220,38,38,0.92)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               '1px solid rgba(239,68,68,0.4)',
      }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
      <button type="button" onClick={onDismiss} className="ms-1 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ─── Pass/Fail toggle ─────────────────────────────────────────────────────────

interface PassFailToggleProps {
  value:    string;
  status:   SlotStatus;
  onChange: (val: '1' | '0') => void;
  onSave:   () => void;
  disabled: boolean;
}
function PassFailToggle({ value, status, onChange, onSave, disabled }: PassFailToggleProps): React.JSX.Element {
  function pick(v: '1' | '0') {
    if (disabled) return;
    onChange(v);
    setTimeout(onSave, 0);
  }
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => pick('1')}
        disabled={disabled}
        aria-pressed={value === '1'}
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-all',
          value === '1'
            ? 'bg-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.40)]'
            : 'border border-slate-200 bg-white/80 text-slate-500 hover:border-emerald-300 hover:text-emerald-600',
          status === 'saving' && 'opacity-50 cursor-not-allowed',
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        עובר
      </button>
      <button
        type="button"
        onClick={() => pick('0')}
        disabled={disabled}
        aria-pressed={value === '0'}
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-all',
          value === '0'
            ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.35)]'
            : 'border border-slate-200 bg-white/80 text-slate-500 hover:border-red-300 hover:text-red-600',
          status === 'saving' && 'opacity-50 cursor-not-allowed',
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        נכשל
      </button>
    </div>
  );
}

// ─── Injury toggle button ─────────────────────────────────────────────────────

interface InjuryToggleProps {
  studentId: string;
  isExempt:  boolean;
  loading:   boolean;
  onToggle:  (studentId: string) => void;
}
function InjuryToggle({ studentId, isExempt, loading, onToggle }: InjuryToggleProps): React.JSX.Element {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(studentId)}
      disabled={loading}
      whileHover={loading ? {} : { scale: 1.05 }}
      whileTap={loading ? {} : { scale: 0.95 }}
      title={isExempt ? 'הסר פטור' : 'סמן כפצוע/פטור'}
      aria-label={isExempt ? 'הסר פטור' : 'סמן כפצוע/פטור'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
        isExempt
          ? 'bg-orange-500 text-white shadow-[0_2px_10px_rgba(249,115,22,0.40)]'
          : 'border border-orange-200/70 bg-orange-50/60 text-orange-400 hover:bg-orange-100 hover:text-orange-600 hover:border-orange-300',
        loading && 'opacity-60 cursor-not-allowed',
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
      )}
    </motion.button>
  );
}

// ─── Absent toggle button ──────────────────────────────────────────────────────

interface AbsentToggleProps {
  studentId: string;
  isAbsent:  boolean;
  loading:   boolean;
  onToggle:  (studentId: string) => void;
}
function AbsentToggle({ studentId, isAbsent, loading, onToggle }: AbsentToggleProps): React.JSX.Element {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(studentId)}
      disabled={loading}
      whileHover={loading ? {} : { scale: 1.05 }}
      whileTap={loading ? {} : { scale: 0.95 }}
      title={isAbsent ? 'הסר חיסור' : 'סמן כחסר'}
      aria-label={isAbsent ? 'הסר חיסור' : 'סמן כחסר'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
        isAbsent
          ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.40)]'
          : 'border border-red-200/70 bg-red-50/60 text-red-400 hover:bg-red-100 hover:text-red-600 hover:border-red-300',
        loading && 'opacity-60 cursor-not-allowed',
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <UserMinus className="h-4 w-4" aria-hidden="true" />
      )}
    </motion.button>
  );
}

// ─── Test type picker ─────────────────────────────────────────────────────────

const INPUT_TYPE_LABELS: Record<string, string> = {
  TIME:      'זמן',
  REPS:      'חזרות',
  PASS_FAIL: 'עובר/נכשל',
  GENERAL:   'כללי',
};

interface TestPickerProps {
  testTypes:        TestType[];
  selectedId:       string;
  onSelect:         (id: string) => void;
}
function TestTypePicker({ testTypes, selectedId, onSelect }: TestPickerProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {testTypes.map((tt) => {
        const selected = tt.id === selectedId;
        return (
          <motion.button
            key={tt.id}
            type="button"
            onClick={() => onSelect(tt.id)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
              selected
                ? 'bg-indigo-600 text-white shadow-[0_4px_20px_rgba(99,102,241,0.35)]'
                : 'bg-white/70 border border-slate-200/80 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700',
            )}
            aria-pressed={selected}
          >
            <span>{tt.nameHe}</span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              selected ? 'bg-white/20 text-indigo-100' : 'bg-slate-100 text-slate-400',
            )}>
              {INPUT_TYPE_LABELS[tt.inputType] ?? tt.inputType}
            </span>
            {tt.unit && (
              <span className={cn(
                'text-[11px]',
                selected ? 'text-indigo-200' : 'text-slate-400',
              )}>
                ({tt.unit})
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();

  const { activeSemester } = useSemester();
  const { data: students, isLoading: studentsLoading } = useStudents(classId);
  const { data: testTypes, isLoading: testTypesLoading } = useTestTypes();
  const invalidateDashboard = useDashboardInvalidate();

  // ── Phase state ────────────────────────────────────────────────────────────
  const [step, setStep]             = useState<LessonStep>('select');
  const [selectedTestTypeId, setSelectedTestTypeId] = useState('');
  const [session, setSession]       = useState<SessionInfo | null>(null);

  // ── Absence state ──────────────────────────────────────────────────────────
  // No `loading` set — toggles are fire-and-forget. Optimistic update IS the
  // feedback; rollback on error happens silently in .catch().
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  // ── Injury / exemption state ────────────────────────────────────────────────
  const [exemptIds, setExemptIds] = useState<Set<string>>(new Set());

  // ── Result entry state (mirrors manual/page.tsx pattern) ──────────────────
  const slotsRef        = useRef<SlotsMap>({});
  const pendingSaveRef  = useRef<Set<string>>(new Set());
  const inputRefs       = useRef<(HTMLInputElement | null)[]>([]);
  const isEndingRef     = useRef(false);
  const hasSavedAnyRef  = useRef(false);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);

  // ── Derived (memoized — re-filtered only when deps change, not on every forceRender) ──
  const activeStudents = useMemo(
    () => (students ?? []).filter((s) => !exemptIds.has(s.id) && !absentIds.has(s.id)),
    [students, exemptIds, absentIds],
  );
  const absentStudents = useMemo(
    () => (students ?? []).filter((s) => absentIds.has(s.id)),
    [students, absentIds],
  );
  const exemptStudents = useMemo(
    () => (students ?? []).filter((s) => exemptIds.has(s.id)),
    [students, exemptIds],
  );
  const selectedTestType = useMemo(
    () => (testTypes ?? []).find((tt) => tt.id === selectedTestTypeId),
    [testTypes, selectedTestTypeId],
  );
  const isPassFail       = session?.testInputType === 'PASS_FAIL';
  const today            = todayIso();

  // ── Hydrate slots when session is ready ────────────────────────────────────
  useEffect(() => {
    if (!session || !students) return;
    const next: SlotsMap = {};
    for (const student of students) {
      if (slotsRef.current[student.id] !== undefined) {
        next[student.id] = slotsRef.current[student.id]!;
        continue;
      }
      next[student.id] = emptySlot();
    }
    slotsRef.current = next;
    forceRender();
  }, [session, students]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dashboard cache invalidation on unmount ────────────────────────────────
  // Covers exits that bypass handleEndSession (breadcrumb nav, back button,
  // browser tab close via visibilitychange) so the leaderboard and carousels
  // are always fresh after the teacher leaves the lesson page with saved data.
  useEffect(() => {
    return () => {
      if (hasSavedAnyRef.current) {
        invalidateDashboard();
      }
    };
  }, [invalidateDashboard]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function patchSlot(studentId: string, patch: Partial<StudentSlot>): void {
    slotsRef.current = {
      ...slotsRef.current,
      [studentId]: { ...slotsRef.current[studentId]!, ...patch },
    };
    forceRender();
  }

  function focusNext(activeIndex: number): void {
    const next = inputRefs.current[activeIndex + 1];
    if (next) { next.focus(); next.select(); }
  }

  // ── Toggle injury/exemption ────────────────────────────────────────────────
  // Fire-and-forget: flip optimistic state synchronously, dispatch the request,
  // roll back on failure. Rapid re-taps are allowed — server stores last write.

  function handleToggleExempt(studentId: string): void {
    const willBeExempt = !exemptIds.has(studentId);
    const newStatus    = willBeExempt ? 'EXCUSED' : 'PRESENT';

    setExemptIds((prev) => {
      const next = new Set(prev);
      willBeExempt ? next.add(studentId) : next.delete(studentId);
      return next;
    });

    // If student had a result and is now exempt, reset their slot immediately.
    // The DELETE request runs in the background; we don't wait for it.
    if (willBeExempt && slotsRef.current[studentId]?.hasResult) {
      patchSlot(studentId, emptySlot());
      void apiRequest(`/sessions/${session?.id}/results/${studentId}`, { method: 'DELETE' })
        .catch(() => { /* Non-critical — result still in DB but student is marked exempt */ });
    }

    void apiRequest(`/classes/${classId}/attendance`, {
      method: 'POST',
      body:   JSON.stringify({ date: today, semester: activeSemester, records: [{ studentId, status: newStatus }] }),
    }).catch((err: unknown) => {
      setExemptIds((prev) => {
        const next = new Set(prev);
        willBeExempt ? next.delete(studentId) : next.add(studentId);
        return next;
      });
      showToast(err instanceof ApiError ? err.message : 'שגיאה בשמירת הפטור');
    });
  }

  // ── Toggle absence ─────────────────────────────────────────────────────────

  function handleToggleAbsent(studentId: string): void {
    const willBeAbsent = !absentIds.has(studentId);
    const newStatus    = willBeAbsent ? 'ABSENT' : 'PRESENT';

    setAbsentIds((prev) => {
      const next = new Set(prev);
      willBeAbsent ? next.add(studentId) : next.delete(studentId);
      return next;
    });

    void apiRequest(`/classes/${classId}/attendance`, {
      method: 'POST',
      body:   JSON.stringify({ date: today, semester: activeSemester, records: [{ studentId, status: newStatus }] }),
    }).catch((err: unknown) => {
      setAbsentIds((prev) => {
        const next = new Set(prev);
        willBeAbsent ? next.delete(studentId) : next.add(studentId);
        return next;
      });
      showToast(err instanceof ApiError ? err.message : 'שגיאה בשמירת החיסור');
    });
  }

  // ── Create session ─────────────────────────────────────────────────────────

  async function handleStartLesson(): Promise<void> {
    if (!selectedTestTypeId || step !== 'select') return;
    const tt = (testTypes ?? []).find((t) => t.id === selectedTestTypeId);
    if (!tt) return;
    setStep('creating');
    try {
      const res = await apiRequest<{ id: string }>(`/classes/${classId}/sessions`, {
        method: 'POST',
        body:   JSON.stringify({ testTypeId: selectedTestTypeId, notes: '', semester: activeSemester }),
      });
      setSession({ id: res.id, testInputType: tt.inputType });
      setStep('active');
    } catch (err) {
      setStep('select');
      showToast(err instanceof ApiError ? err.message : 'שגיאה ביצירת הסשן');
    }
  }

  // ── Save result ────────────────────────────────────────────────────────────

  async function handleSave(studentId: string, activeIndex: number): Promise<void> {
    if (!session) return;
    if (pendingSaveRef.current.has(studentId)) return;

    const slot    = slotsRef.current[studentId];
    if (!slot) return;

    const trimmed = slot.inputValue.trim();
    if (trimmed === '') { focusNext(activeIndex); return; }
    if (slot.status === 'saved' && trimmed === slot.savedInputValue) { focusNext(activeIndex); return; }

    const rawValue = parseFloat(trimmed);
    if (isNaN(rawValue)) {
      patchSlot(studentId, { status: 'error', errorMsg: 'ערך לא תקין' });
      return;
    }

    pendingSaveRef.current.add(studentId);
    patchSlot(studentId, { status: 'saving', errorMsg: null });

    try {
      if (slot.hasResult) {
        await apiRequest(`/sessions/${session.id}/results/${studentId}`, { method: 'DELETE' });
      }
      const result = await apiRequest<{ id: string; calculatedGrade: number }>(
        `/sessions/${session.id}/results`,
        { method: 'POST', body: JSON.stringify({ studentId, rawValue }) },
      );
      hasSavedAnyRef.current = true;
      focusNext(activeIndex);
      patchSlot(studentId, {
        status: 'saved', hasResult: true,
        savedInputValue: trimmed, calculatedGrade: result.calculatedGrade,
      });
    } catch (err) {
      patchSlot(studentId, {
        status:   'error',
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, studentId: string, idx: number): void {
    if (e.key === 'Enter') { e.preventDefault(); void handleSave(studentId, idx); }
  }

  // ── End session ────────────────────────────────────────────────────────────

  async function handleEndSession(): Promise<void> {
    if (isEndingRef.current || !session) return;
    isEndingRef.current = true;
    forceRender();
    try {
      await apiRequest(`/sessions/${session.id}/complete`, { method: 'PATCH' });
      // Eagerly invalidate all /dashboard/* SWR keys so the leaderboard and
      // top-results carousels show the new data as soon as the teacher lands
      // on the dashboard or outstanding-students page.
      invalidateDashboard();
      hasSavedAnyRef.current = false; // cleanup effect can skip double-invalidate
      router.push(`/classes/${classId}`);
    } catch {
      isEndingRef.current = false;
      forceRender();
    }
  }

  // ── Computed stats ────────────────────────────────────────────────────────

  const slots        = slotsRef.current;
  const savedCount   = activeStudents.filter((s) => slots[s.id]?.status === 'saved').length;
  const totalActive  = activeStudents.length;
  const progressPct  = totalActive > 0 ? (savedCount / totalActive) * 100 : 0;

  // ── Loading ────────────────────────────────────────────────────────────────

  const isLoading = studentsLoading || testTypesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-white/70" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/50" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/40" />
      </div>
    );
  }

  // ── Layout helpers ─────────────────────────────────────────────────────────

  const gridCols = isPassFail
    ? 'grid-cols-[2rem_1fr_auto_auto_auto]'
    : 'grid-cols-[2rem_1fr_8rem_6rem_auto]';

  return (
    <>
      <BackButton />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
        className="space-y-5 pt-16 px-4 md:pt-0 md:px-0"
        dir="rtl"
      >
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-sm flex-wrap" aria-label="ניווט עמודים">
          <Link href="/schedule" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            מערכת שעות
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rotate-180" aria-hidden="true" />
          <Link href={`/classes/${classId}`} className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            כיתה
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rotate-180" aria-hidden="true" />
          <span className="font-semibold text-slate-700">ניהול שיעור</span>
        </nav>

        {/* ── Phase 1: Test selection ─────────────────────────────────── */}
        {(step === 'select' || step === 'creating') && (
          <motion.div
            layout
            className="rounded-3xl p-6 space-y-5"
            style={{
              background:           'rgba(255,255,255,0.62)',
              backdropFilter:       'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border:               '1px solid rgba(255,255,255,0.75)',
              boxShadow:            '0 8px 40px rgba(15,23,42,0.10)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100">
                <Dumbbell className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">ניהול שיעור</h1>
                <p className="text-xs text-slate-500">
                  {today} · {students?.length ?? 0} תלמידים
                </p>
              </div>
            </div>

            {/* Semester safety badge */}
            <div className={cn(
              'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold border',
              activeSemester === 'A'
                ? 'bg-violet-50/80 text-violet-700 border-violet-200/70'
                : 'bg-emerald-50/80 text-emerald-700 border-emerald-200/70',
            )}>
              <span aria-hidden="true">📌</span>
              <span>שימו לב: ההזנה מתבצעת למחצית {activeSemester === 'A' ? 'א׳' : 'ב׳'}</span>
            </div>

            {/* Test type picker */}
            <div>
              <p className="mb-3 text-sm font-bold text-slate-700">בחר סוג מבחן</p>
              {testTypes && testTypes.length > 0 ? (
                <TestTypePicker
                  testTypes={testTypes}
                  selectedId={selectedTestTypeId}
                  onSelect={setSelectedTestTypeId}
                />
              ) : (
                <p className="text-sm text-slate-400">טוען מבחנים...</p>
              )}
            </div>

            {/* Start button */}
            <motion.button
              type="button"
              onClick={() => { void handleStartLesson(); }}
              disabled={!selectedTestTypeId || step === 'creating'}
              whileHover={selectedTestTypeId ? { scale: 1.02 } : {}}
              whileTap={selectedTestTypeId ? { scale: 0.98 } : {}}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold text-white transition-all',
                selectedTestTypeId && step === 'select'
                  ? activeSemester === 'A'
                    ? 'bg-violet-600 hover:bg-violet-700 shadow-[0_4px_24px_rgba(124,58,237,0.35)]'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_24px_rgba(5,150,105,0.35)]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              )}
            >
              {step === 'creating' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  יוצר סשן...
                </>
              ) : (
                <>
                  <Flag className="h-5 w-5" aria-hidden="true" />
                  התחל מבחן{selectedTestType ? ` — ${selectedTestType.nameHe}` : ''}
                </>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* ── Student roster (shown in BOTH phases) ───────────────────── */}
        {students && students.length > 0 && (
          <div className="space-y-4">

            {/* Active students section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">
                  תלמידים פעילים ({activeStudents.length})
                </span>
                {step === 'active' && (
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {savedCount}/{totalActive} נרשמו
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <UserMinus className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                חיסור
                <span className="text-slate-300">|</span>
                <ShieldAlert className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                פטור
              </span>
            </div>

            {/* Progress bar (active phase only) */}
            {step === 'active' && totalActive > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                <motion.div
                  className="h-full rounded-full bg-indigo-500"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
                />
              </div>
            )}

            {/* Student table */}
            <motion.div
              layout
              className="overflow-hidden rounded-2xl"
              style={{
                background:           'rgba(255,255,255,0.68)',
                backdropFilter:       'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border:               '1px solid rgba(255,255,255,0.80)',
                boxShadow:            '0 4px 24px rgba(15,23,42,0.08)',
              }}
            >
              {/* Column headers (active phase only) */}
              {step === 'active' && (
                <div className={cn('grid gap-3 border-b border-slate-100/80 bg-slate-50/60 px-4 py-2.5', gridCols)}>
                  <span />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">שם תלמיד</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {isPassFail ? 'תוצאה' : selectedTestType?.unit ? `ערך (${selectedTestType.unit})` : 'ערך'}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ציון</span>
                  <span />
                </div>
              )}

              {/* Active student rows */}
              <ul>
                <AnimatePresence initial={false}>
                  {activeStudents.map((student, idx) => {
                    const slot     = slots[student.id] ?? emptySlot();
                    const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                    return (
                      <motion.li
                        key={student.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20, scale: 0.97 }}
                        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                      >
                        <div
                          className={cn(
                            'grid items-center gap-3 border-b border-slate-50/80 px-4 py-3.5 last:border-b-0 transition-colors',
                            step === 'active' ? gridCols : 'grid-cols-[2rem_1fr_auto]',
                            slot.status === 'saved' && step === 'active' && 'bg-emerald-50/30',
                            slot.status === 'error'  && step === 'active' && 'bg-red-50/30',
                          )}
                        >
                          {/* Avatar */}
                          <div className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
                            step === 'active' && slot.status === 'saved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-indigo-100 text-indigo-700',
                          )}>
                            {initials}
                          </div>

                          {/* Name */}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {student.firstName} {student.lastName}
                            </p>
                            {student.nationalId && (
                              <code className="font-mono text-[11px] text-slate-400">
                                ת.ז ****{student.nationalId.slice(-4)}
                              </code>
                            )}
                          </div>

                          {/* Result input (active phase only) */}
                          {step === 'active' && (
                            isPassFail ? (
                              <PassFailToggle
                                value={slot.inputValue}
                                status={slot.status}
                                disabled={slot.status === 'saving'}
                                onChange={(val) => handleInputChange(student.id, val)}
                                onSave={() => void handleSave(student.id, idx)}
                              />
                            ) : (
                              <div className="relative">
                                <input
                                  ref={(el) => { inputRefs.current[idx] = el; }}
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  value={slot.inputValue}
                                  onChange={(e) => handleInputChange(student.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, student.id, idx)}
                                  onBlur={() => { void handleSave(student.id, idx); }}
                                  disabled={slot.status === 'saving'}
                                  placeholder="0"
                                  aria-label={`ערך עבור ${student.firstName} ${student.lastName}`}
                                  className={cn(
                                    'h-11 w-full rounded-xl border bg-white/90 ps-3 pe-8 text-base font-bold text-slate-800 transition-all',
                                    'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent',
                                    'placeholder:text-slate-300 disabled:opacity-50',
                                    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                    slot.status === 'error'
                                      ? 'border-red-300 focus:ring-red-300'
                                      : slot.status === 'saved' && slot.inputValue
                                        ? 'border-emerald-300 bg-emerald-50/60'
                                        : 'border-slate-200',
                                  )}
                                />
                                <div className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2">
                                  <AnimatePresence mode="wait">
                                    {slot.status === 'saving' && (
                                      <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" aria-hidden="true" />
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
                                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            )
                          )}

                          {/* Grade (active phase only) */}
                          {step === 'active' && (
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
                                    <span className={`text-lg font-extrabold ${gradeColor(slot.calculatedGrade)}`}>
                                      {getHebrewGradeLabel(slot.calculatedGrade)}
                                    </span>
                                    <p className="text-[10px] leading-tight text-slate-400">
                                      {getHebrewGradeLabel(slot.calculatedGrade)}
                                    </p>
                                  </motion.div>
                                ) : slot.status === 'error' ? (
                                  <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="text-xs text-red-600 leading-tight"
                                  >
                                    {slot.errorMsg}
                                  </motion.p>
                                ) : (
                                  <span key="empty" className="text-sm text-slate-300">—</span>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Action buttons: absent + exempt */}
                          <div className="flex items-center gap-1.5">
                            <AbsentToggle
                              studentId={student.id}
                              isAbsent={false}
                              loading={false}
                              onToggle={(id) => { handleToggleAbsent(id); }}
                            />
                            <InjuryToggle
                              studentId={student.id}
                              isExempt={false}
                              loading={false}
                              onToggle={(id) => { handleToggleExempt(id); }}
                            />
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </motion.div>

            {/* ── Absent students section ─────────────────────────────── */}
            <AnimatePresence>
              {absentStudents.length > 0 && (
                <motion.div
                  key="absent-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <UserMinus className="h-4 w-4 text-red-500" aria-hidden="true" />
                    <span className="text-sm font-bold text-red-700">
                      חסרים ({absentStudents.length})
                    </span>
                  </div>

                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                      background:           'rgba(254,226,226,0.55)',
                      backdropFilter:       'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border:               '1px solid rgba(239,68,68,0.20)',
                    }}
                  >
                    <ul>
                      <AnimatePresence initial={false}>
                        {absentStudents.map((student) => {
                          const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                          return (
                            <motion.li
                              key={student.id}
                              layout
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12, scale: 0.97 }}
                              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                            >
                              <div className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-3 border-b border-red-100/60 px-4 py-3 last:border-b-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xs font-bold text-red-600">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-500 line-through">
                                    {student.firstName} {student.lastName}
                                  </p>
                                  <span className="rounded-full bg-red-200/70 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    חסר/ה
                                  </span>
                                </div>
                                <AbsentToggle
                                  studentId={student.id}
                                  isAbsent={true}
                                  loading={false}
                                  onToggle={(id) => { handleToggleAbsent(id); }}
                                />
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Exempt students section ─────────────────────────────── */}
            <AnimatePresence>
              {exemptStudents.length > 0 && (
                <motion.div
                  key="exempt-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-500" aria-hidden="true" />
                    <span className="text-sm font-bold text-orange-700">
                      פטורים / פצועים ({exemptStudents.length})
                    </span>
                  </div>

                  <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                      background:           'rgba(255,237,213,0.55)',
                      backdropFilter:       'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border:               '1px solid rgba(251,146,60,0.25)',
                    }}
                  >
                    <ul>
                      <AnimatePresence initial={false}>
                        {exemptStudents.map((student) => {
                          const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                          return (
                            <motion.li
                              key={student.id}
                              layout
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12, scale: 0.97 }}
                              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                            >
                              <div className="grid grid-cols-[2rem_1fr_2.5rem] items-center gap-3 border-b border-orange-100/60 px-4 py-3 last:border-b-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xs font-bold text-orange-600">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-600">
                                    {student.firstName} {student.lastName}
                                  </p>
                                  <span className="rounded-full bg-orange-200/70 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                    פטור/ה
                                  </span>
                                </div>
                                {/* Toggle off = restore to active */}
                                <InjuryToggle
                                  studentId={student.id}
                                  isExempt={true}
                                  loading={false}
                                  onToggle={(id) => { handleToggleExempt(id); }}
                                />
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

        {/* ── Empty student state ────────────────────────────────────── */}
        {students?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl border border-dashed border-slate-200 bg-white/50 py-16 text-center"
          >
            <p className="font-semibold text-slate-600">אין תלמידים בכיתה זו</p>
            <p className="mt-1 text-sm text-slate-400">הוסף תלמידים מדף הכיתה</p>
          </motion.div>
        )}

        {/* ── End session button (active phase) ────────────────────────── */}
        {step === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-between"
          >
            <p className="text-sm text-slate-500">
              {savedCount === totalActive && totalActive > 0
                ? 'כל התלמידים הפעילים נרשמו — ניתן לסיים'
                : `נותרו ${totalActive - savedCount} תלמידים להזנה`}
            </p>
            <motion.button
              type="button"
              onClick={() => { void handleEndSession(); }}
              disabled={isEndingRef.current}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition-colors',
                savedCount === totalActive && totalActive > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_4px_20px_rgba(16,185,129,0.35)]'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_20px_rgba(99,102,241,0.30)]',
                isEndingRef.current && 'opacity-70 cursor-not-allowed',
              )}
            >
              {isEndingRef.current ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Flag className="h-4 w-4" aria-hidden="true" />
              )}
              {isEndingRef.current ? 'מסיים...' : 'סיים שיעור'}
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast} onDismiss={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}
