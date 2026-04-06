'use client';

/**
 * Live test session page — stopwatch mode.
 *
 * Architecture notes:
 *  - The timer display is updated via a direct DOM ref inside a
 *    requestAnimationFrame loop. This means the timer NEVER triggers a React
 *    re-render, keeping the student-list completely stable during ticking.
 *  - Student state (pending / completed) is managed with useState and only
 *    changes when a student is tapped or an undo is requested.
 *  - All API calls are optimistic: the UI updates immediately and reverts on
 *    failure so the teacher never waits for a network round-trip.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit2,
  Flag,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import type { LiveStudentResult, SessionDetail, SessionStudent } from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { useTestSession } from '@/hooks/use-test-session';
import { apiRequest } from '@/lib/api-client';
import { PreTestRosterSelection } from '@/components/pre-test-roster-selection';

// ─── Timer helpers ────────────────────────────────────────────────────────────

/** Formats elapsed milliseconds as MM:SS.cc (centiseconds). */
function formatElapsed(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs      = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec     = totalSec % 60;
  const min     = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Formats elapsed milliseconds as a short "M:SS" string for result badges. */
function formatShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const sec      = totalSec % 60;
  const min      = Math.floor(totalSec / 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Parses a "MM:SS" string to total seconds, or returns null on invalid input. */
function parseTimeInput(value: string): number | null {
  const parts = value.split(':');
  if (parts.length !== 2) return null;
  const mm = parseInt(parts[0]!, 10);
  const ss = parseInt(parts[1]!, 10);
  if (isNaN(mm) || isNaN(ss) || ss >= 60) return null;
  return mm * 60 + ss;
}

// ─── Timer state type ─────────────────────────────────────────────────────────

type TimerState = 'idle' | 'running' | 'paused';

// ─── Completed result local state ────────────────────────────────────────────

interface CompletedEntry {
  resultId:        string | null; // null while the POST is in-flight
  elapsedMs:       number;
  calculatedGrade: number;
  submitting:      boolean;
  error:           string | null;
}

// ─── Error toast ──────────────────────────────────────────────────────────────

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

// ─── Edit time modal ──────────────────────────────────────────────────────────

interface EditTimeModalProps {
  student:       SessionStudent;
  currentElapsedMs: number;
  onSave:        (newRawSeconds: number) => void;
  onCancel:      () => void;
}

function EditTimeModal({ student, currentElapsedMs, onSave, onCancel }: EditTimeModalProps): React.JSX.Element {
  const currentSec = Math.floor(currentElapsedMs / 1000);
  const initVal    = `${String(Math.floor(currentSec / 60)).padStart(2, '0')}:${String(currentSec % 60).padStart(2, '0')}`;
  const [value, setValue] = useState(initVal);
  const [error, setError] = useState('');

  function handleSave() {
    const secs = parseTimeInput(value);
    if (secs === null || secs <= 0) {
      setError('הכנס זמן תקין — לדוגמה: 08:45');
      return;
    }
    onSave(secs);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background:           'rgba(15,23,42,0.95)',
          border:               '1px solid rgba(255,255,255,0.12)',
          boxShadow:            '0 24px 64px rgba(0,0,0,0.5)',
        }}
        dir="rtl"
      >
        <h3 className="text-base font-bold text-white mb-1">ערוך זמן</h3>
        <p className="text-xs text-slate-400 mb-4">
          {student.firstName} {student.lastName}
        </p>

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
          זמן (דק:שנ)
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="08:45"
          className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-center text-2xl font-black text-white tabular-nums tracking-widest outline-none focus:ring-2 focus:ring-teal-500"
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors"
            style={{ background: 'rgba(45,212,191,0.85)' }}
          >
            שמור
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LiveSessionPage(): React.JSX.Element {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();

  const { data: session, isLoading, error: loadError } = useTestSession(sessionId);

  // ── Timer state (never in React state — DOM-only for performance) ────────────
  const timerDisplayRef = useRef<HTMLSpanElement>(null);
  const startedAtRef    = useRef<number | null>(null);    // wall-clock of last Start click
  const pausedMsRef     = useRef<number>(0);              // accumulated ms before this run
  const rafIdRef        = useRef<number | null>(null);

  const [timerState, setTimerState]   = useState<TimerState>('idle');
  const [sessionEnded, setSessionEnded] = useState(false);

  // ── Student / result lists ─────────────────────────────────────────────────
  const [pendingIds, setPendingIds]         = useState<string[]>([]);
  const [completed, setCompleted]           = useState<Map<string, CompletedEntry>>(new Map());
  // Derived from session load — set once
  const [students, setStudents]             = useState<Map<string, SessionStudent>>(new Map());

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToast(msg), []);

  // ── Roster confirmed by PreTestRosterSelection ────────────────────────────
  const [activeStudents, setActiveStudents] = useState<SessionStudent[] | null>(null);

  // ── Hydrate student list from API on load ──────────────────────────────────
  useEffect(() => {
    if (!session || activeStudents === null) return;

    const studentMap = new Map<string, SessionStudent>(
      activeStudents.map((s) => [s.id, s]),
    );
    setStudents(studentMap);

    const recordedIds = new Set(session.results.map((r) => r.studentId));

    // Pending = enrolled students without a result yet
    setPendingIds(
      activeStudents
        .filter((s) => !recordedIds.has(s.id))
        .map((s) => s.id),
    );

    // Completed = existing results (e.g. after browser refresh)
    const completedMap = new Map<string, CompletedEntry>();
    for (const r of session.results) {
      completedMap.set(r.studentId, {
        resultId:        r.resultId,
        elapsedMs:       Math.round(r.rawValue * 1000),
        calculatedGrade: r.calculatedGrade,
        submitting:      false,
        error:           null,
      });
    }
    setCompleted(completedMap);

    if (session.completedAt) setSessionEnded(true);
  }, [session, activeStudents]);

  // ── RAF timer loop (writes directly to DOM span — zero React renders) ───────
  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    const elapsed = pausedMsRef.current + (Date.now() - startedAtRef.current);
    if (timerDisplayRef.current) {
      timerDisplayRef.current.textContent = formatElapsed(elapsed);
    }
    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopRaf, [stopRaf]);

  // ── Timer controls ─────────────────────────────────────────────────────────
  function getElapsedMs(): number {
    if (startedAtRef.current === null) return pausedMsRef.current;
    return pausedMsRef.current + (Date.now() - startedAtRef.current);
  }

  function handleStart() {
    startedAtRef.current = Date.now();
    setTimerState('running');
    rafIdRef.current = requestAnimationFrame(tick);

    // Notify server (best-effort, non-blocking)
    void apiRequest(`/sessions/${sessionId}/start`, { method: 'POST' }).catch(() => {
      // Server-side startedAt is for audit only — ignore failures
    });
  }

  function handlePause() {
    pausedMsRef.current = getElapsedMs();
    startedAtRef.current = null;
    stopRaf();
    setTimerState('paused');
  }

  function handleReset() {
    stopRaf();
    pausedMsRef.current  = 0;
    startedAtRef.current = null;
    if (timerDisplayRef.current) timerDisplayRef.current.textContent = '00:00.00';
    setTimerState('idle');
  }

  async function handleEndSession() {
    stopRaf();
    setTimerState('idle');
    setSessionEnded(true);
    try {
      await apiRequest(`/sessions/${sessionId}/complete`, { method: 'PATCH' });
    } catch {
      // Session complete is best-effort; data is already saved in results
    }
    router.push(`/classes/${classId}`);
  }

  // ── Tap a student (TIME mode) ──────────────────────────────────────────────
  const handleTap = useCallback(
    async (studentId: string) => {
      if (timerState !== 'running') return;

      const elapsedMs    = getElapsedMs();
      const rawValue     = elapsedMs / 1000; // seconds

      // Optimistic: move to completed immediately
      setPendingIds((prev) => prev.filter((id) => id !== studentId));
      setCompleted((prev) => {
        const next = new Map(prev);
        next.set(studentId, {
          resultId:        null,
          elapsedMs,
          calculatedGrade: 0,  // will be updated on API response
          submitting:      true,
          error:           null,
        });
        return next;
      });

      try {
        const result = await apiRequest<LiveStudentResult>(
          `/sessions/${sessionId}/results`,
          {
            method: 'POST',
            body:   JSON.stringify({ studentId, rawValue }),
          },
        );

        setCompleted((prev) => {
          const next = new Map(prev);
          next.set(studentId, {
            resultId:        result.resultId,
            elapsedMs,
            calculatedGrade: result.calculatedGrade,
            submitting:      false,
            error:           null,
          });
          return next;
        });
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'שגיאה בשמירת התוצאה';

        // Revert — return student to pending
        setCompleted((prev) => {
          const next = new Map(prev);
          next.delete(studentId);
          return next;
        });
        setPendingIds((prev) => [studentId, ...prev]);
        showToast(msg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timerState, sessionId, showToast],
  );

  // ── Undo a recorded result ─────────────────────────────────────────────────
  const handleUndo = useCallback(
    async (studentId: string) => {
      const entry = completed.get(studentId);
      if (!entry) return;

      // Optimistic: return student to pending immediately
      setCompleted((prev) => {
        const next = new Map(prev);
        next.delete(studentId);
        return next;
      });
      setPendingIds((prev) => {
        // Re-insert in alphabetical position (by maintaining original order)
        const student = students.get(studentId);
        if (!student) return [studentId, ...prev];
        const allIds = activeStudents?.map((s) => s.id) ?? [];
        const merged = [studentId, ...prev];
        merged.sort((a, b) => {
          const ai = allIds.indexOf(a);
          const bi = allIds.indexOf(b);
          return ai - bi;
        });
        return merged;
      });

      try {
        await apiRequest(`/sessions/${sessionId}/results/${studentId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : 'שגיאה בביטול התוצאה';

        // Revert — put student back in completed
        setCompleted((prev) => {
          const next = new Map(prev);
          next.set(studentId, { ...entry, error: null });
          return next;
        });
        setPendingIds((prev) => prev.filter((id) => id !== studentId));
        showToast(msg);
      }
    },
    [activeStudents, completed, session, sessionId, showToast, students],
  );

  // ── Edit a result (delete + re-submit with corrected rawValue) ─────────────
  const handleEditSave = useCallback(
    async (studentId: string, newRawSeconds: number) => {
      const entry = completed.get(studentId);
      if (!entry) return;
      setEditingStudentId(null);

      // Optimistic update — show new time immediately
      const newElapsedMs = newRawSeconds * 1000;
      setCompleted((prev) => {
        const next = new Map(prev);
        next.set(studentId, { ...entry, elapsedMs: newElapsedMs, submitting: true });
        return next;
      });

      try {
        // Delete old result
        if (entry.resultId) {
          await apiRequest(`/sessions/${sessionId}/results/${studentId}`, {
            method: 'DELETE',
          });
        }
        // Re-submit with corrected value
        const result = await apiRequest<LiveStudentResult>(
          `/sessions/${sessionId}/results`,
          {
            method: 'POST',
            body:   JSON.stringify({ studentId, rawValue: newRawSeconds }),
          },
        );

        setCompleted((prev) => {
          const next = new Map(prev);
          next.set(studentId, {
            resultId:        result.resultId,
            elapsedMs:       newElapsedMs,
            calculatedGrade: result.calculatedGrade,
            submitting:      false,
            error:           null,
          });
          return next;
        });
      } catch (err) {
        // Restore original on failure
        setCompleted((prev) => {
          const next = new Map(prev);
          next.set(studentId, { ...entry, submitting: false });
          return next;
        });
        showToast(err instanceof ApiError ? err.message : 'שגיאה בעריכת התוצאה');
      }
    },
    [completed, sessionId, showToast],
  );

  // ── Derived counts ─────────────────────────────────────────────────────────
  const totalStudents     = (session?.students.length ?? 0);
  const completedCount    = completed.size;
  const pendingCount      = pendingIds.length;

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-white/70" />
        <div className="h-48 animate-pulse rounded-3xl bg-white/30" />
        <div className="h-96 animate-pulse rounded-3xl bg-white/20" />
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
        לא ניתן לטעון את הסשן — נסה לרענן את הדף.
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

  const editingStudent = editingStudentId ? students.get(editingStudentId) : null;
  const editingEntry   = editingStudentId ? completed.get(editingStudentId) : null;

  return (
    <>
      {/* ── Global keyframes ──────────────────────────────────────── */}
      <style>{`
        @keyframes timerGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(45,212,191,0.4), 0 0 40px rgba(45,212,191,0.2); }
          50%       { text-shadow: 0 0 30px rgba(45,212,191,0.6), 0 0 60px rgba(45,212,191,0.3); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .timer-glow    { animation: timerGlow 2.4s ease-in-out infinite; }
        .pulse-ring    { animation: pulseRing 1.2s ease-out infinite; }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
        className="space-y-5"
        dir="rtl"
      >
        {/* ── Breadcrumb ──────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-sm flex-wrap" aria-label="ניווט עמודים">
          <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            הכיתות שלי
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rotate-180" aria-hidden="true" />
          <Link href={`/classes/${classId}`} className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            כיתה
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rotate-180" aria-hidden="true" />
          <span className="font-semibold text-slate-700 truncate max-w-[180px]">
            {session.testNameHe}
          </span>
        </nav>

        {/* ── Stopwatch card ──────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-center"
          style={{
            background:           'rgba(7,17,35,0.85)',
            backdropFilter:       'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border:               '1px solid rgba(45,212,191,0.20)',
            boxShadow:            '0 8px 48px rgba(45,212,191,0.10), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {/* Ambient background glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(45,212,191,0.3), transparent)',
            }}
          />

          {/* Test meta */}
          <div className="relative mb-3 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-teal-400">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                {session.testNameHe}
              </span>
            </div>
            <div className="text-[10px] font-medium text-slate-500">
              {completedCount} / {totalStudents} תלמידים נרשמו
            </div>
          </div>

          {/* Timer display */}
          <div className="relative my-4 flex justify-center">
            {/* Outer pulse ring — only visible while running */}
            {timerState === 'running' && (
              <div
                className="pulse-ring absolute inset-0 m-auto h-4 w-4 rounded-full"
                style={{ background: 'rgba(45,212,191,0.6)' }}
              />
            )}
            <span
              ref={timerDisplayRef}
              className={`font-black tabular-nums tracking-tight text-white select-none ${timerState === 'running' ? 'timer-glow' : ''}`}
              style={{ fontSize: 'clamp(3.5rem, 12vw, 5.5rem)', lineHeight: 1 }}
              aria-label="שעון עצר"
            >
              00:00.00
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative mb-5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              className="absolute inset-y-0 start-0 rounded-full"
              style={{ background: 'linear-gradient(90deg, #2dd4bf, #10b981)' }}
              animate={{ width: `${totalStudents > 0 ? (completedCount / totalStudents) * 100 : 0}%` }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            />
          </div>

          {/* Controls */}
          <div className="relative flex items-center justify-center gap-3 flex-wrap">
            {timerState === 'idle' && !sessionEnded && (
              <motion.button
                type="button"
                onClick={handleStart}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2dd4bf, #10b981)',
                  boxShadow:  '0 4px 24px rgba(45,212,191,0.35)',
                }}
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                התחל
              </motion.button>
            )}

            {timerState === 'paused' && (
              <motion.button
                type="button"
                onClick={handleStart}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-base font-bold text-white shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #2dd4bf, #10b981)',
                  boxShadow:  '0 4px 24px rgba(45,212,191,0.35)',
                }}
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                המשך
              </motion.button>
            )}

            {timerState === 'running' && (
              <motion.button
                type="button"
                onClick={handlePause}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border:     '1px solid rgba(255,255,255,0.14)',
                  color:      'rgba(255,255,255,0.8)',
                }}
              >
                <Pause className="h-4 w-4" aria-hidden="true" />
                השהה
              </motion.button>
            )}

            {(timerState === 'paused') && (
              <motion.button
                type="button"
                onClick={handleReset}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border:     '1px solid rgba(255,255,255,0.10)',
                  color:      'rgba(148,163,184,0.8)',
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                אפס
              </motion.button>
            )}

            {timerState !== 'idle' && !sessionEnded && (
              <motion.button
                type="button"
                onClick={() => void handleEndSession()}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border:     '1px solid rgba(239,68,68,0.30)',
                  color:      '#f87171',
                }}
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                סיים סשן
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Student lists ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Completed students */}
          <AnimatePresence initial={false}>
            {completedCount > 0 && (
              <motion.section
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                aria-label={`תלמידים שנרשמו: ${completedCount}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-700">
                    נרשמו ({completedCount})
                  </h2>
                </div>

                <div className="space-y-2">
                  <AnimatePresence>
                    {[...completed.entries()].map(([studentId, entry]) => {
                      const student = students.get(studentId);
                      if (!student) return null;
                      return (
                        <motion.div
                          key={studentId}
                          layout
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -20, scale: 0.97 }}
                          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
                          className="flex items-center gap-3 rounded-2xl px-4 py-3"
                          style={{
                            background:           'rgba(236,253,245,0.85)',
                            backdropFilter:       'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border:               '1px solid rgba(52,211,153,0.25)',
                            boxShadow:            '0 2px 12px rgba(16,185,129,0.06)',
                          }}
                        >
                          {/* Status dot */}
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ background: entry.submitting ? '#f59e0b' : '#10b981' }}
                          />

                          {/* Name */}
                          <span className="flex-1 text-sm font-semibold text-slate-800 truncate">
                            {student.firstName} {student.lastName}
                          </span>

                          {/* Elapsed time badge */}
                          <span
                            className="rounded-lg px-2.5 py-0.5 text-xs font-black tabular-nums"
                            style={{
                              background: 'rgba(16,185,129,0.15)',
                              color:      '#059669',
                            }}
                          >
                            {formatShort(entry.elapsedMs)}
                          </span>

                          {/* Grade badge */}
                          {!entry.submitting && entry.calculatedGrade > 0 && (
                            <span
                              className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                              style={{
                                background: 'rgba(99,102,241,0.12)',
                                color:      '#6366f1',
                              }}
                            >
                              {entry.calculatedGrade}
                            </span>
                          )}

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => setEditingStudentId(studentId)}
                            disabled={entry.submitting}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 disabled:opacity-40 transition-colors"
                            aria-label={`ערוך זמן ${student.firstName}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>

                          {/* Undo button */}
                          <button
                            type="button"
                            onClick={() => void handleUndo(studentId)}
                            disabled={entry.submitting}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-40"
                            style={{
                              background: 'rgba(239,68,68,0.10)',
                              color:      '#ef4444',
                            }}
                            aria-label={`בטל תוצאה של ${student.firstName}`}
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
                            בטל
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Pending students */}
          {pendingCount > 0 && (
            <section aria-label={`ממתינים לרישום: ${pendingCount}`}>
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: timerState === 'running' ? '#f59e0b' : '#94a3b8' }}
                />
                <h2 className="text-sm font-bold text-slate-700">
                  ממתינים ({pendingCount})
                </h2>
                {timerState !== 'running' && (
                  <span className="text-xs text-slate-400">— הפעל את השעון כדי לרשום</span>
                )}
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {pendingIds.map((studentId) => {
                    const student = students.get(studentId);
                    if (!student) return null;
                    const isActive = timerState === 'running';

                    return (
                      <motion.button
                        key={studentId}
                        layout
                        type="button"
                        disabled={!isActive}
                        onClick={() => void handleTap(studentId)}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                        whileTap={isActive ? { scale: 0.98 } : {}}
                        className="w-full text-start rounded-2xl px-5 py-4 transition-all"
                        style={{
                          background:           isActive
                            ? 'rgba(255,255,255,0.88)'
                            : 'rgba(255,255,255,0.55)',
                          backdropFilter:       'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border:               isActive
                            ? '1px solid rgba(45,212,191,0.25)'
                            : '1px solid rgba(255,255,255,0.60)',
                          boxShadow: isActive
                            ? '0 2px 16px rgba(45,212,191,0.08)'
                            : '0 1px 8px rgba(15,23,42,0.05)',
                          cursor: isActive ? 'pointer' : 'not-allowed',
                        }}
                        aria-label={`רשום זמן עבור ${student.firstName} ${student.lastName}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Tap indicator */}
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                            style={{
                              background: isActive ? 'rgba(45,212,191,0.15)' : 'rgba(148,163,184,0.12)',
                              color:      isActive ? '#2dd4bf' : '#94a3b8',
                            }}
                          >
                            {isActive ? '▶' : student.studentCode.slice(0, 2)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-[11px] text-slate-400">{student.studentCode}</p>
                          </div>

                          {isActive && (
                            <span className="text-xs font-semibold text-teal-500 opacity-70">
                              הקש לרשום ▶
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* All done state */}
          {pendingCount === 0 && completedCount > 0 && !sessionEnded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl px-5 py-6 text-center"
              style={{
                background:     'rgba(236,253,245,0.82)',
                border:         '1px solid rgba(52,211,153,0.25)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" aria-hidden="true" />
              <p className="font-bold text-slate-800 mb-1">כל התלמידים נרשמו!</p>
              <p className="text-sm text-slate-500 mb-4">לחץ "סיים סשן" לסגירת הסשן ושמירת כל הציונים.</p>
              <button
                type="button"
                onClick={() => void handleEndSession()}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                סיים סשן
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ── Edit time modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {editingStudent && editingEntry && (
          <EditTimeModal
            key="edit-modal"
            student={editingStudent}
            currentElapsedMs={editingEntry.elapsedMs}
            onSave={(secs) => void handleEditSave(editingStudentId!, secs)}
            onCancel={() => setEditingStudentId(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Error toast ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast key="toast" message={toast} onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
