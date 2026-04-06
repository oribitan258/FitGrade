'use client';

/**
 * BeepPreTestSelection — combined participant selection + test settings screen.
 *
 * Replaces the two-step (PreTestRosterSelection → BeepTestSetup) flow with a
 * single full-screen portal that includes:
 *   1. The purple student grid (same design as PreTestRosterSelection)
 *   2. Settings section: Second-chance toggle + Start level picker
 *   3. "התחל מבחן" CTA — synchronously inits AudioContext (browser autoplay
 *      policy), then requests Fullscreen + Wake Lock before calling onStart().
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, ChevronUp, Play, Users, X, Zap } from 'lucide-react';

import { initAudio, preloadAudio } from '@/lib/beep-audio';
import { BEEP_TEST_LEVELS } from '@/lib/beep-test-levels';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BeepPreTestStudent {
  id: string;
  firstName: string;
  lastName: string;
}

export interface BeepPreTestSelectionProps {
  students: ReadonlyArray<BeepPreTestStudent>;
  testName: string;
  onStart: (
    selectedStudents: ReadonlyArray<BeepPreTestStudent>,
    secondChanceEnabled: boolean,
    startLevel: number,
    wakeLock: WakeLockSentinel | null,
  ) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating sports icons (same as PreTestRosterSelection)
// ─────────────────────────────────────────────────────────────────────────────

interface FloatDef {
  src: string;
  w: number;
  left: string;
  top: string;
  delay: number;
  dur: number;
  blur: number;
  opacity: number;
}

const FLOAT_ICONS: FloatDef[] = [
  { src: '/sports-icons/stopwatch.png',       w: 88,  left: '4%',  top: '8%',  delay: 0,   dur: 8.0,  blur: 0,   opacity: 0.80 },
  { src: '/sports-icons/football-player.png', w: 100, left: '66%', top: '5%',  delay: 1.2, dur: 10.0, blur: 1,   opacity: 0.60 },
  { src: '/sports-icons/football.png',        w: 68,  left: '84%', top: '46%', delay: 0.6, dur: 7.5,  blur: 2,   opacity: 0.45 },
  { src: '/sports-icons/baseball.png',        w: 56,  left: '8%',  top: '70%', delay: 2.0, dur: 9.0,  blur: 0.5, opacity: 0.68 },
  { src: '/sports-icons/stopwatch.png',       w: 44,  left: '46%', top: '82%', delay: 1.5, dur: 11.5, blur: 3,   opacity: 0.35 },
  { src: '/sports-icons/football.png',        w: 76,  left: '1%',  top: '36%', delay: 0.9, dur: 8.5,  blur: 1.5, opacity: 0.50 },
  { src: '/sports-icons/baseball.png',        w: 40,  left: '75%', top: '20%', delay: 3.0, dur: 12.0, blur: 4,   opacity: 0.30 },
  { src: '/sports-icons/football-player.png', w: 54,  left: '31%', top: '87%', delay: 0.4, dur: 9.5,  blur: 2,   opacity: 0.28 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function qualitativeLabel(level: number): string {
  if (level <= 4) return 'הליכה מהירה / חימום';
  if (level <= 8) return 'ריצה קלה';
  if (level <= 12) return 'ריצה בינונית';
  return 'ריצה מהירה / ספרינט';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BeepPreTestSelection({
  students,
  testName,
  onStart,
}: BeepPreTestSelectionProps): React.JSX.Element {
  const [mounted, setMounted] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [secondChanceEnabled, setSecondChanceEnabled] = useState(false);
  const [startLevel, setStartLevel] = useState(1);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const toggleStudent = (id: string): void => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    setExcluded(
      excluded.size === 0
        ? new Set(students.map((s) => s.id))
        : new Set(),
    );
  };

  const activeStudents = students.filter((s) => !excluded.has(s.id));
  const activeCount = activeStudents.length;
  const levelData = BEEP_TEST_LEVELS[startLevel - 1];

  // Must be synchronous inside click handler to satisfy browser autoplay policy.
  const handleStart = useCallback(async (): Promise<void> => {
    if (activeCount === 0 || isStarting) return;
    setIsStarting(true);

    initAudio(); // sync — satisfies AudioContext autoplay policy

    void preloadAudio().catch(() => {});
    void document.documentElement.requestFullscreen().catch(() => {});

    const wakeLock = await (
      'wakeLock' in navigator
        ? navigator.wakeLock.request('screen').catch(() => null)
        : Promise.resolve(null)
    );

    onStart(activeStudents, secondChanceEnabled, startLevel, wakeLock);
  }, [activeStudents, activeCount, secondChanceEnabled, startLevel, isStarting, onStart]);

  if (!mounted) return <></>;

  return createPortal(
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#0B0A1F' }}
    >
      {/* ── Ambient gradient orbs ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, rgba(109,40,217,0.22) 0%, transparent 55%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 15% 75%, rgba(59,130,246,0.14) 0%, transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)' }} />
      </div>

      {/* ── Floating sports icons ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {FLOAT_ICONS.map((ic, i) => (
          <motion.img
            key={i}
            src={ic.src}
            alt=""
            width={ic.w}
            style={{
              position: 'absolute',
              left: ic.left,
              top: ic.top,
              opacity: ic.opacity,
              filter: `blur(${ic.blur}px)`,
              userSelect: 'none',
            }}
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: ic.dur, delay: ic.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 px-6 pt-8 pb-5"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(11,10,31,0.60)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1"
          style={{
            background: 'rgba(139,92,246,0.20)',
            border: '1px solid rgba(196,157,255,0.30)',
          }}
        >
          <Zap className="h-3.5 w-3.5 text-violet-300 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-violet-200 tracking-wide">{testName}</span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">הגדרות מבחן</h1>
            <p className="mt-0.5 text-sm text-white/50">בחר משתתפים והגדר את תנאי המבחן</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
              style={{
                background: 'rgba(139,92,246,0.18)',
                border: '1px solid rgba(139,92,246,0.30)',
              }}
            >
              <Users className="h-3.5 w-3.5 text-violet-300 shrink-0" aria-hidden="true" />
              <span className="text-sm font-bold text-violet-200">{activeCount}</span>
              <span className="text-xs text-violet-300/70">/ {students.length}</span>
            </div>

            <button
              type="button"
              onClick={toggleAll}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:text-white/90"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              {excluded.size === 0 ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-6">

          {/* Student grid */}
          <section aria-label="בחירת משתתפים">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              משתתפים
            </p>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-white/40">
                <Users className="h-12 w-12 opacity-40" aria-hidden="true" />
                <p className="text-base font-medium">אין תלמידים רשומים לשיעור זה</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <AnimatePresence initial={false}>
                  {students.map((student) => {
                    const isExcluded = excluded.has(student.id);
                    return (
                      <motion.button
                        key={student.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleStudent(student.id)}
                        className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer"
                        style={{
                          minHeight: 96,
                          background: isExcluded ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.18)',
                          border: isExcluded ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(196,157,255,0.45)',
                          boxShadow: isExcluded ? 'none' : '0 0 20px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
                          filter: isExcluded ? 'grayscale(1) brightness(0.45)' : 'none',
                          opacity: isExcluded ? 0.55 : 1,
                        }}
                        aria-pressed={!isExcluded}
                        aria-label={`${student.firstName} ${student.lastName} — ${isExcluded ? 'לא משתתף' : 'משתתף'}`}
                      >
                        <div
                          className="absolute top-2.5 start-2.5 flex h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            background: isExcluded ? 'rgba(239,68,68,0.30)' : 'rgba(139,92,246,0.50)',
                            border: isExcluded ? '1px solid rgba(239,68,68,0.50)' : '1px solid rgba(196,157,255,0.60)',
                          }}
                          aria-hidden="true"
                        >
                          {isExcluded
                            ? <X className="h-3 w-3 text-red-300" />
                            : <CheckCircle2 className="h-3 w-3 text-violet-200" />
                          }
                        </div>

                        <span className="text-sm font-bold leading-tight text-white">
                          {student.firstName}
                        </span>
                        <span className="text-xs leading-tight text-white/60">
                          {student.lastName}
                        </span>

                        {isExcluded && (
                          <span className="mt-0.5 text-[10px] font-semibold text-red-400/80">
                            לא משתתף
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Settings section */}
          <section
            className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm flex flex-col gap-5"
            aria-label="הגדרות מבחן"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              הגדרות מבחן
            </p>

            {/* Second-chance toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">סיכוי שני</p>
                <p className="mt-0.5 text-xs text-white/40">אזהרה ראשונה לפני סילוק</p>
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

              {levelData !== undefined && (
                <p className="text-xs text-violet-300/70" aria-live="polite">
                  {`קצב: ${levelData.speedKmh} קמ"ש — ${qualitativeLabel(startLevel)}`}
                </p>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 px-6 py-5"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(11,10,31,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <motion.button
          type="button"
          onClick={() => { void handleStart(); }}
          disabled={activeCount === 0 || isStarting}
          whileHover={
            activeCount > 0 && !isStarting
              ? { y: -2, boxShadow: '0 12px 32px rgba(139,92,246,0.55)', transition: { type: 'spring', stiffness: 400, damping: 25 } }
              : {}
          }
          whileTap={activeCount > 0 && !isStarting ? { scale: 0.98 } : {}}
          className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-extrabold tracking-wide text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(109,40,217,0.90) 100%)',
            border: '1px solid rgba(196,157,255,0.40)',
            boxShadow: activeCount > 0
              ? '0 4px 24px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'none',
          }}
        >
          {activeCount > 0 && !isStarting && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              animate={{ opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: '0 0 0 3px rgba(196,157,255,0.35)' }}
              aria-hidden="true"
            />
          )}
          <span className="relative flex items-center justify-center gap-2">
            {isStarting ? (
              'מכין מבחן...'
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                התחל מבחן
                {activeCount > 0 && (
                  <span className="text-sm font-semibold opacity-70">
                    ({activeCount} תלמידים)
                  </span>
                )}
              </>
            )}
          </span>
        </motion.button>
      </div>
    </div>,
    document.body,
  );
}
