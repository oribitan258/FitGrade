'use client';

/**
 * SprintHeatMode — Heat-based 60-metre sprint recorder.
 *
 * State machine:  SETUP → RACING → SUMMARY → SETUP (next heat)
 *
 * Timing contract:
 *   Race start:      performance.now() stored in raceStartTimeRef (a ref, never state).
 *   Live display:    requestAnimationFrame loop writes textContent to DOM span refs
 *                    directly — zero React re-renders while a race is in progress.
 *   Individual stop: performance.now() captured on the exact tap event, ensuring
 *                    the displayed and persisted times are byte-for-byte identical.
 *   Result:          stopNow − raceStart  (no accumulated setInterval drift).
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Flag,
  Play,
  RotateCcw,
  Save,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface SprintStudent {
  id:        string;
  firstName: string;
  lastName:  string;
}

export interface SprintRunnerResult {
  student: SprintStudent;
  timeMs:  number;
}

export interface SprintHeatModeProps {
  /** Students still available — caller filters out already-finished ones. */
  students:        SprintStudent[];
  heatNumber:      number;
  onSaveAndFinish: (results: SprintRunnerResult[]) => void;
  onSaveAndNext:   (results: SprintRunnerResult[]) => void;
}

// ─── Internal types ────────────────────────────────────────────────────────────

type Phase       = 'SETUP' | 'RACING' | 'SUMMARY';
type RunnerCount = 1 | 2 | 3 | 4;

// ─── Constants ─────────────────────────────────────────────────────────────────

const RUNNER_COUNT_OPTIONS: RunnerCount[] = [1, 2, 3, 4];

/** Delay (ms) between last runner finishing and SUMMARY transition. */
const SUMMARY_DELAY_MS = 700;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format elapsed milliseconds → "SS.cc" (seconds · centiseconds). */
function formatTime(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs      = totalCs % 100;
  const s       = Math.floor(totalCs / 100);
  return `${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function gridClass(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-2'; // 4 → 2 × 2
}

// ─── Runner Card ───────────────────────────────────────────────────────────────

interface RunnerCardProps {
  student:      SprintStudent;
  isFinished:   boolean;
  finishTimeMs: number | null;
  raceStarted:  boolean;
  onTap:        (id: string) => void;
  timerRef:     (el: HTMLSpanElement | null) => void;
}

function RunnerCard({
  student, isFinished, finishTimeMs, raceStarted, onTap, timerRef,
}: RunnerCardProps): React.JSX.Element {
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();
  const tappable = raceStarted && !isFinished;

  return (
    <motion.button
      type="button"
      layout
      onClick={() => { if (tappable) onTap(student.id); }}
      disabled={!tappable}
      whileTap={tappable ? { scale: 0.96 } : {}}
      className="relative flex w-full flex-col items-center justify-center overflow-hidden p-6 transition-colors duration-500"
      style={{
        cursor:          tappable ? 'pointer' : 'default',
        background:      isFinished
          ? 'linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(16,185,129,0.12) 100%)'
          : raceStarted
            ? 'linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(109,40,217,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border:          isFinished
          ? '1px solid rgba(34,197,94,0.40)'
          : raceStarted
            ? '1px solid rgba(139,92,246,0.28)'
            : '1px solid rgba(255,255,255,0.08)',
        backdropFilter:        'blur(24px)',
        WebkitBackdropFilter:  'blur(24px)',
        boxShadow:       isFinished
          ? '0 0 56px rgba(34,197,94,0.22), inset 0 1px 0 rgba(255,255,255,0.10)'
          : raceStarted
            ? '0 0 40px rgba(139,92,246,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'
            : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      aria-label={
        isFinished
          ? `${student.firstName} סיים — ${finishTimeMs !== null ? formatTime(finishTimeMs) : ''}`
          : `לחץ כשיגיע לקו הסיום — ${student.firstName}`
      }
    >
      {/* Pulsing inner glow while running */}
      {raceStarted && !isFinished && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{
            boxShadow: [
              'inset 0 0 0px rgba(139,92,246,0)',
              'inset 0 0 48px rgba(139,92,246,0.14)',
              'inset 0 0 0px rgba(139,92,246,0)',
            ],
          }}
          transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* Green finish radial bloom */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.22) 0%, transparent 65%)',
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Avatar */}
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black"
        style={
          isFinished
            ? { background: 'rgba(34,197,94,0.25)',   color: 'rgba(134,239,172,1)',   boxShadow: '0 0 24px rgba(34,197,94,0.40)' }
            : raceStarted
              ? { background: 'rgba(139,92,246,0.22)', color: 'rgba(196,157,255,0.9)' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)' }
        }
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Name */}
      <span className="text-center text-2xl font-extrabold leading-tight tracking-tight text-white">
        {student.firstName}
      </span>
      <span className="mt-1 text-center text-base font-semibold text-white/50">
        {student.lastName}
      </span>

      {/* Timer / result */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {isFinished && finishTimeMs !== null ? (
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />
            <span className="text-4xl font-black tabular-nums text-emerald-300">
              {formatTime(finishTimeMs)}
            </span>
          </motion.div>
        ) : (
          <span
            ref={timerRef}
            className="text-5xl font-black tabular-nums"
            style={{
              color: raceStarted ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.25)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            00.00
          </span>
        )}
      </div>

      {/* Tap hint pulse */}
      {raceStarted && !isFinished && (
        <motion.p
          className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/25"
          animate={{ opacity: [0.30, 0.85, 0.30] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          לחץ בקו הסיום
        </motion.p>
      )}

      {isFinished && (
        <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-emerald-400/55">
          סיים ✓
        </p>
      )}
    </motion.button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SprintHeatMode({
  students,
  heatNumber,
  onSaveAndFinish,
  onSaveAndNext,
}: SprintHeatModeProps): React.JSX.Element {

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('SETUP');

  // ── SETUP ──────────────────────────────────────────────────────────────────
  const initialCount = (Math.min(2, students.length) || 1) as RunnerCount;
  const [runnerCount,  setRunnerCount]  = useState<RunnerCount>(initialCount);
  const [selectedIds,  setSelectedIds]  = useState<(string | null)[]>([null, null]);

  // ── RACING ─────────────────────────────────────────────────────────────────
  const [raceStarted,   setRaceStarted]   = useState(false);
  const [finishedTimes, setFinishedTimes] = useState<Map<string, number>>(new Map());

  // ── Precision-timing refs (never trigger re-renders) ───────────────────────
  const raceStartTimeRef  = useRef<number>(0);
  const rafRef            = useRef<number>(0);
  const finishedTimesRef  = useRef<Map<string, number>>(new Map());
  const timerDisplayRefs  = useRef<Map<string, HTMLSpanElement | null>>(new Map());

  // Sync slot count when runnerCount changes
  useEffect(() => {
    setSelectedIds((prev) =>
      Array.from({ length: runnerCount }, (_, i) => prev[i] ?? null),
    );
  }, [runnerCount]);

  // Cancel RAF on unmount
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const allSlotsFilled = selectedIds.every((id) => id !== null);

  const selectedStudents: SprintStudent[] = selectedIds
    .filter((id): id is string => id !== null)
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is SprintStudent => s !== undefined);

  const summaryResults: SprintRunnerResult[] = selectedStudents
    .map((s) => ({ student: s, timeMs: finishedTimesRef.current.get(s.id) ?? 0 }))
    .sort((a, b) => a.timeMs - b.timeMs);

  function availableForSlot(slotIndex: number): SprintStudent[] {
    const others = new Set(
      selectedIds.filter((id, i) => id !== null && i !== slotIndex) as string[],
    );
    return students.filter((s) => !others.has(s.id));
  }

  // ── SETUP handlers ─────────────────────────────────────────────────────────

  function handleCountChange(count: RunnerCount): void {
    if (count <= students.length) setRunnerCount(count);
  }

  function handleSelectStudent(slotIndex: number, value: string): void {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[slotIndex] = value || null;
      return next;
    });
  }

  function handleGoToRace(): void {
    if (!allSlotsFilled) return;
    finishedTimesRef.current = new Map();
    setFinishedTimes(new Map());
    setRaceStarted(false);
    timerDisplayRefs.current.clear();
    setPhase('RACING');
  }

  // ── RACING handlers ────────────────────────────────────────────────────────

  function handleStartRace(): void {
    raceStartTimeRef.current = performance.now();
    setRaceStarted(true);

    // RAF loop — writes directly to DOM, no setState
    function tick(now: DOMHighResTimeStamp): void {
      const elapsed = now - raceStartTimeRef.current;
      timerDisplayRefs.current.forEach((el, id) => {
        if (el !== null && !finishedTimesRef.current.has(id)) {
          el.textContent = formatTime(elapsed);
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handleRunnerStop(studentId: string): void {
    const elapsed = performance.now() - raceStartTimeRef.current;

    // Freeze display at exact stop time
    const el = timerDisplayRefs.current.get(studentId);
    if (el != null) el.textContent = formatTime(elapsed);

    // Persist result via ref first (synchronous), then trigger re-render
    finishedTimesRef.current = new Map(finishedTimesRef.current).set(studentId, elapsed);
    const snapshot = new Map(finishedTimesRef.current);
    setFinishedTimes(snapshot);

    // All runners done?
    if (snapshot.size >= selectedStudents.length) {
      cancelAnimationFrame(rafRef.current);
      setTimeout(() => { setPhase('SUMMARY'); }, SUMMARY_DELAY_MS);
    }
  }

  // ── SUMMARY handlers ───────────────────────────────────────────────────────

  function handleSaveAndFinish(): void {
    onSaveAndFinish(summaryResults);
  }

  function handleSaveAndNext(): void {
    onSaveAndNext(summaryResults);
    finishedTimesRef.current = new Map();
    setFinishedTimes(new Map());
    setSelectedIds(Array.from({ length: runnerCount }, () => null));
    setRaceStarted(false);
    setPhase('SETUP');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      dir="rtl"
      style={{
        background: 'linear-gradient(160deg, rgba(18,12,46,0.99) 0%, rgba(10,7,28,1) 100%)',
      }}
    >
      {/* ── Ambient decoration ────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute"
          style={{
            insetInlineEnd: '-8%', top: '-12%',
            width: '55%', height: '55%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.14) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute"
          style={{
            insetInlineStart: '-8%', bottom: '-10%',
            width: '45%', height: '45%',
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════ PHASE 1 — SETUP */}
        {phase === 'SETUP' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 py-8"
          >
            {/* Header */}
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: 'rgba(139,92,246,0.25)',
                    border: '1px solid rgba(139,92,246,0.40)',
                  }}
                >
                  <Zap className="h-4 w-4 text-violet-300" aria-hidden="true" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-violet-400/70">
                  מקצה {heatNumber}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">הגדרת מקצה</h1>
              <p className="mt-1 text-sm text-white/40">בחר כמה רצים ומי ריץ במקצה הזה</p>
            </div>

            {/* ── Runner count selector */}
            <div className="mb-8">
              <p className="mb-3 text-end text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                מספר רצים במקצה
              </p>
              <div className="grid grid-cols-4 gap-3">
                {RUNNER_COUNT_OPTIONS.map((count) => {
                  const disabled = count > students.length;
                  const active   = runnerCount === count;
                  return (
                    <motion.button
                      key={count}
                      type="button"
                      onClick={() => { handleCountChange(count); }}
                      disabled={disabled}
                      whileTap={disabled ? {} : { scale: 0.93 }}
                      className="flex flex-col items-center justify-center rounded-2xl py-5 font-black"
                      style={
                        active
                          ? {
                              background: 'rgba(109,40,217,0.38)',
                              border: '1px solid rgba(168,85,247,0.65)',
                              boxShadow: '0 0 28px rgba(168,85,247,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
                              color: 'white',
                            }
                          : disabled
                            ? {
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.18)',
                                cursor: 'not-allowed',
                              }
                            : {
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                color: 'rgba(255,255,255,0.72)',
                              }
                      }
                      aria-label={`${count} רצים`}
                      aria-pressed={active}
                    >
                      <span className="text-3xl">{count}</span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
                        {count === 1 ? 'רץ' : 'רצים'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Student slot selectors */}
            <div className="mb-8">
              <p className="mb-3 text-end text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                בחירת תלמידים
              </p>
              <div className="space-y-3">
                {selectedIds.map((selectedId, index) => (
                  <div key={index} className="flex items-center gap-3">
                    {/* Slot number badge */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black"
                      style={{
                        background: selectedId
                          ? 'rgba(109,40,217,0.30)'
                          : 'rgba(255,255,255,0.06)',
                        border: selectedId
                          ? '1px solid rgba(168,85,247,0.50)'
                          : '1px solid rgba(255,255,255,0.10)',
                        color: selectedId
                          ? 'rgba(196,157,255,1)'
                          : 'rgba(255,255,255,0.35)',
                      }}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </div>

                    {/* Styled select */}
                    <select
                      value={selectedId ?? ''}
                      onChange={(e) => { handleSelectStudent(index, e.target.value); }}
                      className="flex-1 appearance-none rounded-xl py-3 pe-4 ps-4 text-sm font-semibold text-white outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: selectedId
                          ? '1px solid rgba(168,85,247,0.50)'
                          : '1px solid rgba(255,255,255,0.11)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: selectedId
                          ? '0 0 14px rgba(168,85,247,0.18)'
                          : 'none',
                      }}
                      dir="rtl"
                      aria-label={`בחר תלמיד לרץ ${index + 1}`}
                    >
                      <option value="" style={{ background: '#12082e' }}>— בחר תלמיד —</option>
                      {availableForSlot(index).map((s) => (
                        <option key={s.id} value={s.id} style={{ background: '#12082e' }}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CTA */}
            <motion.button
              type="button"
              onClick={handleGoToRace}
              disabled={!allSlotsFilled}
              whileTap={allSlotsFilled ? { scale: 0.97 } : {}}
              className="mt-auto flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-black tracking-wide"
              style={
                allSlotsFilled
                  ? {
                      background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                      boxShadow: '0 0 36px rgba(109,40,217,0.58), inset 0 1px 0 rgba(255,255,255,0.16)',
                      color: 'white',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.22)',
                      cursor: 'not-allowed',
                    }
              }
              aria-disabled={!allSlotsFilled}
            >
              <Flag className="h-5 w-5" aria-hidden="true" />
              מעבר למסך הריצה
            </motion.button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ PHASE 2 — RACING */}
        {phase === 'RACING' && (
          <motion.div
            key="racing"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 flex flex-1 flex-col"
          >
            {/* Status bar */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                {raceStarted ? (
                  <motion.div
                    className="h-2 w-2 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/20" aria-hidden="true" />
                )}
                <span className="text-xs font-black uppercase tracking-widest text-white/40">
                  {raceStarted ? 'ריצה פעילה' : 'ממתין להזנקה'}
                </span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-white/30">
                מקצה {heatNumber}
              </span>
            </div>

            {/* Runner cards — equal split */}
            <div className={cn('grid flex-1', gridClass(selectedStudents.length))}>
              {selectedStudents.map((student) => (
                <RunnerCard
                  key={student.id}
                  student={student}
                  isFinished={finishedTimes.has(student.id)}
                  finishTimeMs={finishedTimes.get(student.id) ?? null}
                  raceStarted={raceStarted}
                  onTap={handleRunnerStop}
                  timerRef={(el) => { timerDisplayRefs.current.set(student.id, el); }}
                />
              ))}
            </div>

            {/* Start button — floats above cards until race begins */}
            <AnimatePresence>
              {!raceStarted && (
                <motion.div
                  key="start-btn"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40, transition: { duration: 0.22 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="absolute inset-x-0 bottom-0 flex justify-center p-8"
                  style={{
                    background: 'linear-gradient(to top, rgba(10,7,28,0.97) 0%, transparent 100%)',
                  }}
                >
                  <motion.button
                    type="button"
                    onClick={handleStartRace}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{
                      scale: 1.03,
                      boxShadow: '0 0 56px rgba(34,197,94,0.65)',
                      transition: { type: 'spring', stiffness: 400, damping: 24 },
                    }}
                    className="flex items-center gap-3 rounded-2xl px-14 py-5 text-lg font-black tracking-wide text-white"
                    style={{
                      background: 'linear-gradient(135deg, rgba(22,163,74,0.92) 0%, rgba(16,185,129,0.82) 100%)',
                      boxShadow: '0 0 40px rgba(34,197,94,0.50), inset 0 1px 0 rgba(255,255,255,0.22)',
                      backdropFilter: 'blur(12px)',
                    }}
                    aria-label="הזנק מקצה"
                  >
                    <Play className="h-6 w-6 fill-white" aria-hidden="true" />
                    הזנק מקצה
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════ PHASE 3 — SUMMARY */}
        {phase === 'SUMMARY' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -36 }}
            transition={{ duration: 0.40, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6 py-8"
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.08 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(34,197,94,0.20)',
                  border: '1px solid rgba(34,197,94,0.40)',
                  boxShadow: '0 0 36px rgba(34,197,94,0.28)',
                }}
              >
                <Flag className="h-8 w-8 text-emerald-400" aria-hidden="true" />
              </motion.div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                סיכום מקצה {heatNumber}
              </h2>
              <p className="mt-1 text-sm text-white/40">תוצאות הריצה לפי סדר</p>
            </div>

            {/* Results */}
            <div className="mb-8 space-y-3">
              {summaryResults.map((result, rank) => (
                <motion.div
                  key={result.student.id}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rank * 0.09 + 0.12, duration: 0.30 }}
                  className="flex items-center gap-4 rounded-2xl px-5 py-4"
                  style={{
                    background: rank === 0
                      ? 'linear-gradient(135deg, rgba(234,179,8,0.18) 0%, rgba(202,138,4,0.10) 100%)'
                      : 'rgba(255,255,255,0.06)',
                    border: rank === 0
                      ? '1px solid rgba(234,179,8,0.32)'
                      : '1px solid rgba(255,255,255,0.09)',
                    backdropFilter: 'blur(14px)',
                  }}
                >
                  {/* Rank badge */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black"
                    style={
                      rank === 0
                        ? { background: 'rgba(234,179,8,0.28)', color: 'rgba(253,224,71,1)' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)' }
                    }
                    aria-label={`מקום ${rank + 1}`}
                  >
                    {rank + 1}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold text-white">
                      {result.student.firstName} {result.student.lastName}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-2xl font-black tabular-nums"
                      style={{ color: rank === 0 ? 'rgba(253,224,71,1)' : 'rgba(255,255,255,0.80)' }}
                    >
                      {formatTime(result.timeMs)}
                    </span>
                    <span className="text-xs font-semibold text-white/30">שנ׳</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-auto space-y-3">
              {/* Primary — next heat */}
              <motion.button
                type="button"
                onClick={handleSaveAndNext}
                whileTap={{ scale: 0.97 }}
                whileHover={{
                  boxShadow: '0 0 40px rgba(109,40,217,0.65)',
                  transition: { type: 'spring', stiffness: 400, damping: 24 },
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                  boxShadow: '0 0 30px rgba(109,40,217,0.52), inset 0 1px 0 rgba(255,255,255,0.16)',
                }}
              >
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
                שמור והמשך למקצה הבא
              </motion.button>

              {/* Secondary — finish */}
              <motion.button
                type="button"
                onClick={handleSaveAndFinish}
                whileTap={{ scale: 0.97 }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(10px)',
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                <Save className="h-5 w-5" aria-hidden="true" />
                שמור וסיים
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
