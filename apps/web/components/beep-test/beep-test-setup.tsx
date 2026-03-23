'use client';

/**
 * BeepTestSetup — pre-test configuration screen.
 *
 * The teacher:
 *   1. Reviews the class roster and unchecks absent / non-participating students.
 *   2. Toggles the "Second Chance" warning rule on or off.
 *   3. Optionally changes the starting level (default: 1).
 *   4. Presses "התחל מבחן" — which synchronously inits the AudioContext (must
 *      happen inside the click handler to satisfy browser autoplay policy), then
 *      requests Fullscreen and Screen Wake Lock before calling onStart().
 */

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Play, Users } from 'lucide-react';

import { initAudio, preloadAudio } from '@/lib/beep-audio';
import { BEEP_TEST_LEVELS } from '@/lib/beep-test-levels';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BeepTestSetupStudent {
  id: string;
  firstName: string;
  lastName: string;
}

export interface BeepTestSetupProps {
  /** Full class roster — teacher unchecks absent students. */
  classStudents: ReadonlyArray<BeepTestSetupStudent>;
  /**
   * Called when the teacher presses Start.
   * The wakeLock handle is passed so the page can release it on completion.
   */
  onStart: (
    selectedStudents: ReadonlyArray<BeepTestSetupStudent>,
    secondChanceEnabled: boolean,
    startLevel: number,
    wakeLock: WakeLockSentinel | null,
  ) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// StartLevelHint — dynamic speed + qualitative descriptor
// ─────────────────────────────────────────────────────────────────────────────

function qualitativeLabel(level: number): string {
  if (level <= 4) return 'הליכה מהירה / חימום';
  if (level <= 8) return 'ריצה קלה';
  if (level <= 12) return 'ריצה בינונית';
  return 'ריצה מהירה / ספרינט';
}

function StartLevelHint({ level }: { level: number }): React.JSX.Element {
  const levelData = BEEP_TEST_LEVELS[level - 1];
  if (levelData === undefined) return <></>;
  return (
    <p className="text-xs text-violet-300/70" aria-live="polite">
      {`קצב: ${levelData.speedKmh} קמ"ש — ${qualitativeLabel(level)}`}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BeepTestSetup({
  classStudents,
  onStart,
}: BeepTestSetupProps): React.JSX.Element {
  // ── Selection state — all checked by default ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(classStudents.map((s) => s.id)),
  );
  const [secondChanceEnabled, setSecondChanceEnabled] = useState(false);
  const [startLevel, setStartLevel] = useState(1);
  const [isStarting, setIsStarting] = useState(false);

  const selectedStudents = classStudents.filter((s) => selectedIds.has(s.id));
  const allSelected = selectedIds.size === classStudents.length;
  const noneSelected = selectedIds.size === 0;

  // ── Toggle helpers ────────────────────────────────────────────────────────
  function toggleStudent(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(): void {
    setSelectedIds(
      allSelected ? new Set() : new Set(classStudents.map((s) => s.id)),
    );
  }

  // ── Start handler — must be sync to satisfy AudioContext autoplay policy ──
  const handleStart = useCallback(async (): Promise<void> => {
    if (selectedStudents.length === 0 || isStarting) return;
    setIsStarting(true);

    // 1. Init AudioContext — MUST be synchronous inside the click handler.
    initAudio();

    // 2. Fetch and decode both MP3 files into AudioBuffers while the fullscreen
    //    and wake-lock requests are in flight. Errors here are non-fatal — the
    //    engine will fall back to a 4 s countdown if buffers are unavailable.
    void preloadAudio().catch(() => {
      // Non-fatal: scheduleBeep() and playStartSequence() no-op gracefully.
    });

    // 3. Request fullscreen — best-effort, non-blocking (void = fire-and-forget).
    void document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen denied is non-critical — continue without it.
    });

    // 3. Screen wake lock — keeps display on during long run.
    const wakeLock = await (
      'wakeLock' in navigator
        ? navigator.wakeLock.request('screen').catch(() => null)
        : Promise.resolve(null)
    );

    onStart(selectedStudents, secondChanceEnabled, startLevel, wakeLock);
  }, [selectedStudents, secondChanceEnabled, startLevel, isStarting, onStart]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col" dir="rtl">
      {/* Dark background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(160deg, #1e1b4b 0%, #0f0a2e 60%, #120828 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-lg px-4 py-8 flex flex-col gap-6">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1 className="text-3xl font-black text-white">מבחן ביפ</h1>
          <p className="mt-1 text-sm text-white/50">הגדר השתתפות והתחל</p>
        </motion.div>

        {/* ── Student checklist ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
          aria-label="בחירת תלמידים"
        >
          {/* Section header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">תלמידים</span>
              <span className="tabular-nums text-xs text-white/40">
                {selectedIds.size} / {classStudents.length}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-violet-400 transition-colors hover:text-violet-300"
              aria-label={allSelected ? 'בטל בחירת כולם' : 'בחר את כולם'}
            >
              {allSelected ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>

          {/* Student rows */}
          <div className="divide-y divide-white/5">
            {classStudents.map((student) => {
              const isSelected = selectedIds.has(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => toggleStudent(student.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/5"
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'הסר' : 'הוסף'} ${student.firstName} ${student.lastName}`}
                >
                  {/* Checkbox */}
                  <div
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      isSelected
                        ? 'border-violet-400 bg-violet-500'
                        : 'border-white/30 bg-transparent',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 text-white" aria-hidden="true" />
                    )}
                  </div>
                  {/* Name */}
                  <span
                    className={[
                      'text-sm font-semibold transition-colors',
                      isSelected ? 'text-white' : 'text-white/35',
                    ].join(' ')}
                  >
                    {student.firstName} {student.lastName}
                  </span>
                </button>
              );
            })}

            {classStudents.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-white/30">
                אין תלמידים בכיתה זו
              </p>
            )}
          </div>
        </motion.section>

        {/* ── Settings card ─────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
          aria-label="הגדרות מבחן"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
            הגדרות
          </h2>

          {/* Second-chance toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">סיכוי שני</p>
              <p className="mt-0.5 text-xs text-white/40">
                אזהרה ראשונה לפני סילוק
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={secondChanceEnabled}
              onClick={() => setSecondChanceEnabled((v) => !v)}
              className={[
                'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                secondChanceEnabled ? 'bg-violet-500' : 'bg-white/20',
              ].join(' ')}
              aria-label={`סיכוי שני ${secondChanceEnabled ? 'מופעל' : 'כבוי'}`}
            >
              <span
                className={[
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200',
                  secondChanceEnabled ? 'start-5' : 'start-0.5',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" aria-hidden="true" />

          {/* Start level picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">רמת התחלה</p>
                <p className="mt-0.5 text-xs text-white/40">ברירת מחדל: רמה 1</p>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="בחר רמת התחלה">
                <button
                  type="button"
                  onClick={() => setStartLevel((v) => Math.max(1, v - 1))}
                  disabled={startLevel === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 disabled:opacity-30"
                  aria-label="הקטן רמה"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <span
                  className="w-8 text-center text-lg font-black tabular-nums text-white"
                  aria-live="polite"
                  aria-label={`רמה ${startLevel}`}
                >
                  {startLevel}
                </span>
                <button
                  type="button"
                  onClick={() => setStartLevel((v) => Math.min(21, v + 1))}
                  disabled={startLevel === 21}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 disabled:opacity-30"
                  aria-label="הגדל רמה"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {/* Speed helper text */}
            <StartLevelHint level={startLevel} />
          </div>
        </motion.section>

        {/* ── Start button ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            type="button"
            whileTap={!noneSelected && !isStarting ? { scale: 0.97 } : {}}
            onClick={() => { void handleStart(); }}
            disabled={noneSelected || isStarting}
            className={[
              'flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-black transition-all',
              noneSelected
                ? 'cursor-not-allowed bg-white/10 text-white/30'
                : 'text-white shadow-lg shadow-violet-900/40',
            ].join(' ')}
            style={
              noneSelected
                ? undefined
                : { background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }
            }
            aria-disabled={noneSelected}
          >
            {isStarting ? (
              <span className="text-base font-semibold">מכין מבחן...</span>
            ) : (
              <>
                <Play className="h-6 w-6 fill-current" aria-hidden="true" />
                התחל מבחן
                {!noneSelected && (
                  <span className="text-sm font-semibold opacity-70">
                    ({selectedStudents.length})
                  </span>
                )}
              </>
            )}
          </motion.button>

          {noneSelected && (
            <p className="mt-2 text-center text-xs text-white/35">
              בחר לפחות תלמיד אחד כדי להתחיל
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
