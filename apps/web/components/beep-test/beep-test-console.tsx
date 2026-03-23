'use client';

/**
 * BeepTestConsole — orchestrator for the active (RUNNING | PAUSED) phase.
 *
 * Owns:
 *   - The beep engine (useBeepEngine) — RAF loop, audio, timing
 *   - Student state (useBeepStudents) — tap tracking, undo, crash recovery
 *   - HUD DOM refs — updated imperatively from RAF callbacks, zero re-renders
 *   - Screen flash overlay — Framer Motion imperative animation on every beep
 *
 * UI additions vs. initial scaffold:
 *   - HoldToStopButton  — teacher must hold for 1.5 s to end early; prevents
 *                         accidental mid-test termination.
 *   - Paused overlay    — full-screen dim + centred "המשך" prompt when paused.
 *   - Pool section headers — count badge pill, section colour-coded by state.
 *   - Flash colour      — white on normal beep, soft violet on level change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimate,
  useAnimation,
} from 'framer-motion';
import { Pause, Play, RotateCcw, Square, Users, CheckCircle2, Zap } from 'lucide-react';

import { useBeepEngine } from '@/hooks/use-beep-engine';
import { useBeepStudents } from '@/hooks/use-beep-students';
import type { BeepStudentState, PersistedBeepState } from '@/hooks/use-beep-students';
import { resumeAudioContext } from '@/lib/beep-audio';
import { BEEP_TEST_LEVELS } from '@/lib/beep-test-levels';

import { BeepTestHUD } from './beep-test-hud';
import { StudentCard } from './student-card';
import { EliminatedCard } from './eliminated-card';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function qualitativeLabel(level: number): string {
  if (level <= 4)  return 'הליכה מהירה / חימום';
  if (level <= 8)  return 'ריצה קלה';
  if (level <= 12) return 'ריצה בינונית';
  return 'ריצה מהירה / ספרינט';
}

// ─────────────────────────────────────────────────────────────────────────────
// HoldToStopButton
//
// Teacher must hold the button for HOLD_DURATION_MS continuously.
// Releasing early resets the fill bar.  Uses useAnimation so the fill is driven
// by the Framer Motion scheduler, not a JS interval — zero drift.
// ─────────────────────────────────────────────────────────────────────────────

const HOLD_DURATION_MS = 1_500;

interface HoldToStopButtonProps {
  onConfirm: () => void;
}

function HoldToStopButton({ onConfirm }: HoldToStopButtonProps): React.JSX.Element {
  const [isHolding, setIsHolding]   = useState(false);
  const confirmedRef                = useRef(false);
  const fillControls                = useAnimation();

  const handleHoldStart = useCallback(async (): Promise<void> => {
    confirmedRef.current = false;
    setIsHolding(true);
    fillControls.set({ scaleX: 0 });

    await fillControls.start({
      scaleX: 1,
      transition: { duration: HOLD_DURATION_MS / 1_000, ease: 'linear' },
    });

    // Animation ran to completion without being interrupted — fire.
    confirmedRef.current = true;
    onConfirm();
  }, [fillControls, onConfirm]);

  const handleHoldEnd = useCallback((): void => {
    if (confirmedRef.current) return; // already fired — ignore the pointer-up
    setIsHolding(false);
    void fillControls.start({
      scaleX: 0,
      transition: { duration: 0.18, ease: 'easeOut' },
    });
  }, [fillControls]);

  return (
    <motion.button
      type="button"
      onPointerDown={() => { void handleHoldStart(); }}
      onPointerUp={handleHoldEnd}
      onPointerLeave={handleHoldEnd}
      onPointerCancel={handleHoldEnd}
      whileTap={{ scale: 0.96 }}
      className="relative flex h-12 items-center gap-2 overflow-hidden rounded-xl px-4 text-sm font-semibold"
      style={{
        background: isHolding ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.13)',
        border: '1px solid rgba(239,68,68,0.28)',
        color: 'rgba(252,165,165,1)',
        touchAction: 'none',
        transition: 'background 0.15s',
      }}
      aria-label="החזק לסיום המבחן"
    >
      {/* Fill bar — grows from start (RTL-aware via originX 'right') */}
      <motion.div
        animate={fillControls}
        className="pointer-events-none absolute inset-0 origin-start"
        style={{ background: 'rgba(239,68,68,0.28)', scaleX: 0 }}
        aria-hidden="true"
      />

      <Square className="relative z-10 h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
      <span className="relative z-10 whitespace-nowrap">
        {isHolding ? 'מחזיק...' : 'סיום'}
      </span>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface BeepTestConsoleProps {
  sessionId: string;
  classStudents: ReadonlyArray<{ id: string; firstName: string; lastName: string }>;
  startLevel: number;
  secondChanceEnabled: boolean;
  initialSnapshot?: PersistedBeepState;
  onTestComplete: (students: BeepStudentState[], finalLevel: number, finalShuttle: number) => void;
  onEndEarly:     (students: BeepStudentState[], finalLevel: number, finalShuttle: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BeepTestConsole({
  sessionId,
  classStudents,
  startLevel,
  secondChanceEnabled,
  initialSnapshot,
  onTestComplete,
  onEndEarly,
}: BeepTestConsoleProps): React.JSX.Element {

  // ── Running state (one boolean — only drives Pause/Resume button and overlay)
  const [engineRunning, setEngineRunning] = useState(true);

  // ── HUD DOM refs (written in RAF loop — zero React re-renders) ────────────
  const levelRef        = useRef<HTMLSpanElement | null>(null);
  const shuttleRef      = useRef<HTMLSpanElement | null>(null);
  const speedRef        = useRef<HTMLSpanElement | null>(null);
  const levelDescRef    = useRef<HTMLSpanElement | null>(null);
  const countdownBarRef = useRef<HTMLDivElement | null>(null);

  // ── Screen flash: white on normal beep, violet on level change ────────────
  const [flashScope, flashAnimate]       = useAnimate<HTMLDivElement>();
  const flashColorRef                    = useRef<string>('#ffffff');
  const levelChangeFlashControls         = useAnimation();

  // ── Student state ─────────────────────────────────────────────────────────
  const studentsState = useBeepStudents({ sessionId, secondChanceEnabled });

  // ── Engine ref (breaks circular init dependency) ──────────────────────────
  const engineRef = useRef<ReturnType<typeof useBeepEngine> | null>(null);

  // ── HUD updater (called from RAF loop — must be allocation-cheap) ─────────
  const updateHUD = useCallback((level: number, shuttle: number): void => {
    if (levelRef.current)   levelRef.current.textContent   = String(level);
    if (shuttleRef.current) shuttleRef.current.textContent = String(shuttle + 1);

    const lvlData = BEEP_TEST_LEVELS[level - 1];
    if (!lvlData) return;

    if (speedRef.current)     speedRef.current.textContent     = String(lvlData.speedKmh);
    if (levelDescRef.current) levelDescRef.current.textContent = qualitativeLabel(level);

    // Countdown bar: full → empty over the level's shuttle interval.
    if (countdownBarRef.current) {
      countdownBarRef.current.animate(
        [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
        { duration: lvlData.intervalMs, easing: 'linear', fill: 'forwards' },
      );
    }
  }, []);

  // ── Beep engine ───────────────────────────────────────────────────────────
  const engine = useBeepEngine({
    startLevel,

    onBeep: useCallback(
      (level: number, shuttle: number): void => {
        updateHUD(level, shuttle);
        void flashAnimate(
          flashScope.current,
          { opacity: [0, flashColorRef.current === '#ffffff' ? 0.14 : 0.10, 0] },
          { duration: 0.28, ease: 'easeOut' },
        );
      },
      [updateHUD, flashAnimate, flashScope],
    ),

    onLevelChange: useCallback((level: number): void => {
      // Update flash colour to violet for this level's beep.
      flashColorRef.current = '#8b5cf6';
      // Reset to white after the flash so subsequent shuttles are white.
      setTimeout(() => { flashColorRef.current = '#ffffff'; }, 350);
      void level;
    }, []),

    onTestComplete: useCallback((): void => {
      setEngineRunning(false);
      studentsState.clearSavedSession();
      onTestComplete(
        studentsState.students,
        engineRef.current?.currentLevelRef.current ?? 1,
        engineRef.current?.currentShuttleRef.current ?? 0,
      );
    }, [studentsState, onTestComplete]),

    onAutopaused: useCallback((): void => {
      setEngineRunning(false);
    }, []),
  });

  engineRef.current = engine;

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTapStudent = useCallback(
    (studentId: string): void => {
      studentsState.tapStudent(
        studentId,
        engineRef.current?.currentLevelRef.current ?? 1,
        engineRef.current?.currentShuttleRef.current ?? 0,
      );
    },
    [studentsState],
  );

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const handlePause = useCallback((): void => {
    engineRef.current?.pause();
    setEngineRunning(false);
  }, []);

  const handleResume = useCallback((): void => {
    void resumeAudioContext();
    engineRef.current?.resume();
    setEngineRunning(true);
  }, []);

  // ── End early (called by HoldToStopButton after confirmed hold) ───────────
  const handleEndEarly = useCallback((): void => {
    engineRef.current?.stop();
    setEngineRunning(false);
    studentsState.clearSavedSession();
    onEndEarly(
      studentsState.students,
      engineRef.current?.currentLevelRef.current ?? 1,
      engineRef.current?.currentShuttleRef.current ?? 0,
    );
  }, [studentsState, onEndEarly]);

  // ── Init roster + start engine on mount ──────────────────────────────────
  useEffect(() => {
    studentsState.initStudents([...classStudents]);
    if (initialSnapshot !== undefined) studentsState.restoreSession(initialSnapshot);
    engineRef.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-end: all students eliminated ────────────────────────────────────
  const { activeStudents, warningStudents, eliminatedStudents, canUndo } = studentsState;
  const visibleActiveStudents = [...activeStudents, ...warningStudents];

  useEffect(() => {
    if (studentsState.students.length === 0) return;
    if (visibleActiveStudents.length === 0) handleEndEarly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleActiveStudents.length, studentsState.students.length]);

  // ── Initial HUD values (shown before first beep fires) ───────────────────
  const startSpeedKmh  = BEEP_TEST_LEVELS[startLevel - 1]?.speedKmh  ?? 8.5;
  const startLevelDesc = qualitativeLabel(startLevel);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex h-full min-h-screen flex-col overflow-hidden"
      dir="rtl"
    >
      {/* ── Screen flash overlay ────────────────────────────────────────── */}
      <div
        ref={flashScope}
        className="pointer-events-none fixed inset-0 z-50"
        style={{ opacity: 0, background: flashColorRef.current }}
        aria-hidden="true"
      />

      {/* ── Paused overlay: dims the screen + shows Resume prompt ──────── */}
      <AnimatePresence>
        {!engineRunning && (
          <motion.div
            key="paused-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center gap-5"
            style={{ background: 'rgba(8,6,18,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          >
            {/* Paused label */}
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 340, damping: 26 }}
              className="text-sm font-black uppercase tracking-[0.25em] text-white/40"
            >
              מושהה
            </motion.p>

            {/* Resume button — centred, prominent */}
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08, type: 'spring', stiffness: 380, damping: 26 }}
              whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(34,197,94,0.35)', transition: { type: 'spring', stiffness: 400, damping: 24 } }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResume}
              className="flex h-16 w-48 items-center justify-center gap-3 rounded-2xl text-base font-black text-emerald-200"
              style={{
                background: 'rgba(34,197,94,0.18)',
                border: '1px solid rgba(34,197,94,0.35)',
                backdropFilter: 'blur(12px)',
              }}
              aria-label="המשך מבחן"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              המשך
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pro Max backdrop: base gradient ──────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'linear-gradient(160deg, #1a0a3d 0%, #0d0620 45%, #06030f 100%)' }}
        aria-hidden="true"
      />

      {/* ── Animated ambient orbs ────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Violet orb — top-end */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 700, height: 700,
            insetInlineEnd: '-180px', top: '-220px',
            background: 'radial-gradient(ellipse, rgba(109,40,217,0.28) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
          animate={{ scale: [1, 1.10, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Indigo-blue orb — bottom-start */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 600, height: 600,
            insetInlineStart: '-160px', bottom: '-160px',
            background: 'radial-gradient(ellipse, rgba(79,70,229,0.22) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        {/* Pink-violet orb — center */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 500, height: 500,
            insetInlineStart: '50%', top: '40%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        />
      </div>

      {/* ── Floating 3D sports icons ─────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Stopwatch — large, top-start, far depth (blurred) */}
        <motion.img
          src="/sports-icons/stopwatch.png"
          alt=""
          style={{
            position: 'absolute',
            width: 220, height: 220,
            insetInlineStart: '-40px', top: '8%',
            opacity: 0.07,
            filter: 'blur(2px)',
          }}
          animate={{
            y: [0, -18, 0],
            rotate: [-6, 2, -6],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Football player — mid, bottom-end, near depth */}
        <motion.img
          src="/sports-icons/football-player.png"
          alt=""
          style={{
            position: 'absolute',
            width: 180, height: 180,
            insetInlineEnd: '-20px', bottom: '12%',
            opacity: 0.08,
            filter: 'blur(0.5px)',
          }}
          animate={{
            y: [0, 14, 0],
            rotate: [4, -3, 4],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
        {/* Football — mid-screen end, mid depth */}
        <motion.img
          src="/sports-icons/football.png"
          alt=""
          style={{
            position: 'absolute',
            width: 120, height: 120,
            insetInlineEnd: '10%', top: '38%',
            opacity: 0.10,
            filter: 'blur(1px)',
          }}
          animate={{
            y: [0, -22, 0],
            rotate: [0, 360],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />
        {/* Baseball — small, top-end corner, far depth */}
        <motion.img
          src="/sports-icons/baseball.png"
          alt=""
          style={{
            position: 'absolute',
            width: 90, height: 90,
            insetInlineEnd: '20%', top: '5%',
            opacity: 0.07,
            filter: 'blur(1.5px)',
          }}
          animate={{
            y: [0, 12, 0],
            rotate: [0, -180, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col gap-4 px-4 pb-28 pt-5">

        {/* HUD */}
        <section aria-label="תצוגה עליונה">
          <BeepTestHUD
            levelRef={levelRef}
            shuttleRef={shuttleRef}
            speedRef={speedRef}
            levelDescRef={levelDescRef}
            countdownBarRef={countdownBarRef}
            startLevel={startLevel}
            startSpeedKmh={startSpeedKmh}
            startLevelDesc={startLevelDesc}
          />
        </section>

        {/* ── Student pools ──────────────────────────────────────────────── */}
        <LayoutGroup>

          {/* Active + Warning pool */}
          <section aria-label="תלמידים פעילים" className="flex flex-col gap-2.5">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-violet-400/60" aria-hidden="true" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40">
                פעילים
              </h2>
              {/* Count badge */}
              <div
                className="ms-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums"
                style={{
                  background: visibleActiveStudents.length > 0 ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.08)',
                  color: visibleActiveStudents.length > 0 ? 'rgba(196,181,253,1)' : 'rgba(255,255,255,0.30)',
                }}
                aria-label={`${visibleActiveStudents.length} תלמידים פעילים`}
              >
                {visibleActiveStudents.length}
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {visibleActiveStudents.map((s) => (
                  <StudentCard key={s.id} student={s} onTap={handleTapStudent} />
                ))}
              </AnimatePresence>

              {/* Empty state (all eliminated) */}
              {visibleActiveStudents.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-5 text-center text-sm text-white/25"
                >
                  כל התלמידים סיימו
                </motion.p>
              )}
            </div>
          </section>

          {/* Eliminated pool */}
          {eliminatedStudents.length > 0 && (
            <section aria-label="תלמידים שסיימו" className="flex flex-col gap-2">
              {/* Section header */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-white/25" aria-hidden="true" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/30">
                  סיימו
                </h2>
                <div
                  className="ms-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black tabular-nums text-white/30"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {eliminatedStudents.length}
                </div>
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-1.5">
                <AnimatePresence mode="popLayout">
                  {eliminatedStudents.map((s) => (
                    <EliminatedCard
                      key={s.id}
                      student={
                        s as BeepStudentState & {
                          eliminatedAt: NonNullable<BeepStudentState['eliminatedAt']>;
                        }
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </LayoutGroup>
      </div>

      {/* ── Fixed bottom controls ────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 px-4 py-3"
        style={{
          background: 'rgba(9,6,28,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        }}
      >
        {/* Hold-to-stop (end early) */}
        <HoldToStopButton onConfirm={handleEndEarly} />

        {/* Undo */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={studentsState.undo}
          disabled={!canUndo}
          className="flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors"
          style={{
            background: canUndo ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.13)',
            color: canUndo ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.25)',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
          aria-label="בטל פעולה אחרונה"
          aria-disabled={!canUndo}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          ביטול
        </motion.button>

        {/* Pause / Resume — largest, centre */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={engineRunning ? handlePause : handleResume}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-base font-black transition-colors"
          style={
            engineRunning
              ? {
                  background: 'rgba(139,92,246,0.22)',
                  border: '1px solid rgba(139,92,246,0.38)',
                  color: 'rgba(196,181,253,1)',
                }
              : {
                  background: 'rgba(34,197,94,0.22)',
                  border: '1px solid rgba(34,197,94,0.38)',
                  color: 'rgba(134,239,172,1)',
                }
          }
          aria-label={engineRunning ? 'השהה מבחן' : 'המשך מבחן'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {engineRunning ? (
              <motion.span
                key="pause-label"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.14 }}
                className="flex items-center gap-2"
              >
                <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
                השהה
              </motion.span>
            ) : (
              <motion.span
                key="resume-label"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.14 }}
                className="flex items-center gap-2"
              >
                <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                המשך
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
