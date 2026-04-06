'use client';

/**
 * BeepTestPage — the top-level coordinator for the Beep Test (20m PACER) flow.
 *
 * Phase machine:
 *   SETUP → RUNNING → COMPLETE
 *
 * Responsibilities:
 *   - Loads the class roster from the session (useTestSession).
 *   - Runs crash-recovery check on mount (reads localStorage).
 *   - Transitions between phases, passing data between components.
 *   - Manages Fullscreen / Screen Wake Lock lifecycle.
 *   - Activates Zen Mode (isTestActive) to suppress global toasts/copilot.
 *   - Warns the teacher before navigating away mid-test (beforeunload).
 *   - Cleans up on unmount (wake lock, fullscreen, zen mode).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

import { useTestSession } from '@/hooks/use-test-session';
import { useBeepTestContext } from '@/contexts/beep-test-context';
import type { BeepStudentState, PersistedBeepState } from '@/hooks/use-beep-students';

import type { BeepTestSetupStudent } from '@/components/beep-test/beep-test-setup';
import { BeepPreTestSelection } from '@/components/beep-test/beep-pre-test-selection';
import { BeepTestConsole } from '@/components/beep-test/beep-test-console';
import { BeepTestSummary } from '@/components/beep-test/beep-test-summary';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 'SETUP' | 'RUNNING' | 'COMPLETE';

/** Maximum age (ms) for a crash-recovery snapshot to be offered. */
const MAX_RECOVERY_AGE_MS = 2 * 60 * 60 * 1_000; // 2 hours

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BeepTestPage(): React.JSX.Element {
  const { classId, sessionId } =
    useParams<{ classId: string; sessionId: string }>();

  // ── Session data (for class roster) ──────────────────────────────────────
  const { data: session, isLoading, error: loadError } = useTestSession(sessionId);

  // ── Phase state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('SETUP');

  // ── Transition payload — set in RUNNING, consumed in COMPLETE ────────────
  const [selectedStudents, setSelectedStudents] = useState<BeepTestSetupStudent[]>([]);
  const [secondChanceEnabled, setSecondChanceEnabled] = useState(false);
  const [startLevel, setStartLevel] = useState(1);
  const [crashSnapshot, setCrashSnapshot] = useState<PersistedBeepState | undefined>(undefined);

  // ── Post-test state — set in COMPLETE ─────────────────────────────────────
  const [finalStudents, setFinalStudents] = useState<BeepStudentState[]>([]);
  const [finalLevel, setFinalLevel] = useState(1);
  const [finalShuttle, setFinalShuttle] = useState(0);

  // ── Crash recovery banner ─────────────────────────────────────────────────
  const [crashBannerSnapshot, setCrashBannerSnapshot] =
    useState<PersistedBeepState | null>(null);
  const [showCrashBanner, setShowCrashBanner] = useState(false);

  // ── Browser APIs ──────────────────────────────────────────────────────────
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Zen Mode ──────────────────────────────────────────────────────────────
  const { setTestActive } = useBeepTestContext();

  // ── Crash recovery: check localStorage on mount ───────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `fitgrade-beep-${sessionId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const saved = JSON.parse(raw) as PersistedBeepState;
      if (Date.now() - saved.savedAt > MAX_RECOVERY_AGE_MS) {
        localStorage.removeItem(key);
        return;
      }
      setCrashBannerSnapshot(saved);
      setShowCrashBanner(true);
    } catch {
      // Corrupt entry — silently ignore.
    }
  }, [sessionId]);

  // ── Beforeunload warning — only during active test ────────────────────────
  useEffect(() => {
    if (phase !== 'RUNNING') return;
    function handleBeforeUnload(e: BeforeUnloadEvent): string {
      e.preventDefault();
      return 'מבחן פעיל — האם אתה בטוח שברצונך לצאת?';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release().catch(() => {});
      void document.exitFullscreen().catch(() => {});
      setTestActive(false);
    };
  }, [setTestActive]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Called by BeepTestSetup when teacher presses "התחל מבחן". */
  const handleStart = useCallback(
    (
      students: ReadonlyArray<BeepTestSetupStudent>,
      secondChance: boolean,
      level: number,
      wakeLock: WakeLockSentinel | null,
    ): void => {
      wakeLockRef.current = wakeLock;
      setSelectedStudents([...students]);
      setSecondChanceEnabled(secondChance);
      setStartLevel(level);
      setCrashSnapshot(undefined);
      setTestActive(true);
      setPhase('RUNNING');
    },
    [setTestActive],
  );

  /** Called from the crash-recovery banner's "שחזר" button. */
  const handleRestore = useCallback((): void => {
    if (crashBannerSnapshot === null) return;
    setShowCrashBanner(false);

    // Restore the student list from the snapshot (names only, for setup roster).
    const restoredStudents = crashBannerSnapshot.students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
    }));
    setSelectedStudents(restoredStudents);
    setSecondChanceEnabled(crashBannerSnapshot.secondChanceEnabled);
    setCrashSnapshot(crashBannerSnapshot);
    setTestActive(true);
    setPhase('RUNNING');
  }, [crashBannerSnapshot, setTestActive]);

  /** Called when the beep engine signals test completion. */
  const handleTestComplete = useCallback(
    (
      students: BeepStudentState[],
      lvl: number,
      shuttle: number,
    ): void => {
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      void document.exitFullscreen().catch(() => {});
      setTestActive(false);
      setFinalStudents(students);
      setFinalLevel(lvl);
      setFinalShuttle(shuttle);
      setPhase('COMPLETE');
    },
    [setTestActive],
  );

  /** Called when teacher ends the test early. */
  const handleEndEarly = useCallback(
    (
      students: BeepStudentState[],
      lvl: number,
      shuttle: number,
    ): void => {
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      void document.exitFullscreen().catch(() => {});
      setTestActive(false);
      setFinalStudents(students);
      setFinalLevel(lvl);
      setFinalShuttle(shuttle);
      setPhase('COMPLETE');
    },
    [setTestActive],
  );

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #0f0a2e 60%, #120828 100%)' }}
      >
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-violet-500/30">
          <motion.div
            className="h-full rounded-full bg-violet-500"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    );
  }

  if (loadError !== undefined || session === undefined) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-6"
        style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #0f0a2e 60%, #120828 100%)' }}
        dir="rtl"
      >
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-300">
          לא ניתן לטעון את הסשן — נסה לרענן את הדף.
        </div>
      </div>
    );
  }

  // Map session students → BeepTestSetupStudent for the pre-test screen
  const beepRoster: BeepTestSetupStudent[] = session.students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Crash Recovery Banner ───────────────────────────────────────── */}
      <AnimatePresence>
        {showCrashBanner && crashBannerSnapshot !== null && (
          <motion.div
            key="crash-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-0 z-50 mx-auto max-w-lg px-4 pt-4"
            dir="rtl"
          >
            <div
              className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-900/80 px-4 py-3 shadow-xl backdrop-blur-lg"
              role="alert"
            >
              <RefreshCw
                className="h-5 w-5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-100">
                  נמצא מפגש שנותק
                </p>
                <p className="text-xs text-amber-300/80">
                  {crashBannerSnapshot.students.length} תלמידים — האם לשחזר?
                </p>
              </div>
              <button
                type="button"
                onClick={handleRestore}
                className="shrink-0 rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400/35"
              >
                שחזר
              </button>
              <button
                type="button"
                onClick={() => setShowCrashBanner(false)}
                className="shrink-0 rounded-lg p-1.5 text-amber-400/60 transition-colors hover:text-amber-300"
                aria-label="סגור הודעת שחזור"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === 'SETUP' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BeepPreTestSelection
              students={beepRoster}
              testName={session.testNameHe}
              onStart={handleStart}
            />
          </motion.div>
        )}

        {phase === 'RUNNING' && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BeepTestConsole
              sessionId={sessionId}
              classStudents={selectedStudents}
              startLevel={startLevel}
              secondChanceEnabled={secondChanceEnabled}
              initialSnapshot={crashSnapshot}
              onTestComplete={handleTestComplete}
              onEndEarly={handleEndEarly}
            />
          </motion.div>
        )}

        {phase === 'COMPLETE' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <BeepTestSummary
              sessionId={sessionId}
              classId={classId}
              students={finalStudents}
              finalLevel={finalLevel}
              finalShuttle={finalShuttle}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
