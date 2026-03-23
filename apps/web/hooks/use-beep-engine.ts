'use client';

/**
 * useBeepEngine — RAF-based timing loop for the 20m PACER Beep Test.
 *
 * Architecture contract (MUST be preserved):
 *   - ZERO React re-renders during the test.  All runtime state lives in refs.
 *   - Timer accuracy: beeps fire within one animation frame (~16 ms) of schedule.
 *   - Pause/resume: shifts all remaining timestamps by the exact pause duration.
 *   - Tab hide: auto-pauses via visibilitychange and calls onAutopaused().
 *   - Cleanup: cancels RAF and removes event listeners on unmount.
 *
 * Beep schedule:
 *   Each entry records the absolute performance.now() timestamp when a beep
 *   should fire, along with its level and shuttle index.  The schedule is
 *   computed once in start() and mutated in-place only during pause/resume.
 *
 * rawValue encoding (for database):
 *   rawValue = level + shuttle * 0.1
 *   e.g. Level 8, shuttle 3 → 8.3
 */

import { useCallback, useEffect, useRef } from 'react';
import { BEEP_TEST_LEVELS } from '../lib/beep-test-levels';
import { playStartSequence, scheduleBeep } from '../lib/beep-audio';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduledBeep {
  /** Absolute performance.now() timestamp when this beep should fire. */
  time: number;
  /** PACER level (1–21). */
  level: number;
  /** 0-indexed shuttle within the level.  rawValue = level + shuttle * 0.1. */
  shuttle: number;
  /** True when shuttle === 0 (first shuttle of a new level). */
  isLevelChange: boolean;
  /** Sentinel entry — signals the test is fully complete. */
  isTestEnd: boolean;
}

export interface BeepEngineOptions {
  /** Level at which the test begins (1–21, default 1). */
  startLevel: number;
  /**
   * Called on every beep that fires (including level-change beeps).
   * Update HUD DOM refs here — DO NOT call setState from this callback.
   */
  onBeep: (level: number, shuttle: number) => void;
  /**
   * Called on the first beep of each new level (shuttle === 0).
   * Fires just before onBeep for the same event.
   */
  onLevelChange: (level: number) => void;
  /** Called once when the sentinel end-of-test entry fires. */
  onTestComplete: () => void;
  /**
   * Called when the engine auto-pauses because the browser tab was hidden.
   * Use this to surface a "resume" prompt to the teacher.
   */
  onAutopaused?: () => void;
}

export interface BeepEngineControls {
  /** Starts from scratch (or from startLevel) after a COUNTDOWN_MS delay. */
  start: () => void;
  /** Pauses the engine; records pausedAt for accurate resume. */
  pause: () => void;
  /** Resumes after pause by shifting remaining timestamps. */
  resume: () => void;
  /** Hard-stops and clears all state (called on unmount or early exit). */
  stop: () => void;
  /** Current level being run — read directly for DOM updates, never via useState. */
  currentLevelRef: React.MutableRefObject<number>;
  /** Current 0-indexed shuttle within currentLevelRef — same read pattern. */
  currentShuttleRef: React.MutableRefObject<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-computes the absolute timestamp for every beep in the test.
 *
 * @param startLevel  First level to include (1–21).
 * @param firstBeepAt performance.now() timestamp when Level 1 / Shuttle 1 should fire.
 *                    Callers must offset this by the start-sequence countdown duration
 *                    so the schedule aligns with the end of the countdown audio.
 * @returns           Flat array of ScheduledBeep entries, chronologically ordered,
 *                    with a final isTestEnd sentinel appended.
 */
function buildSchedule(startLevel: number, firstBeepAt: number): ScheduledBeep[] {
  const schedule: ScheduledBeep[] = [];
  let t = firstBeepAt; // origin IS the first-beep timestamp — no internal offset

  for (const lvl of BEEP_TEST_LEVELS.slice(startLevel - 1)) {
    for (let s = 0; s < lvl.shuttles; s++) {
      schedule.push({
        time: t,
        level: lvl.level,
        shuttle: s,
        isLevelChange: s === 0,
        isTestEnd: false,
      });
      t += lvl.intervalMs;
    }
  }

  // Sentinel — fires one interval after the final real beep.
  const lastLvl = BEEP_TEST_LEVELS[BEEP_TEST_LEVELS.length - 1];
  schedule.push({
    time: t,
    level: lastLvl.level,
    shuttle: lastLvl.shuttles,
    isLevelChange: false,
    isTestEnd: true,
  });

  return schedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useBeepEngine(options: BeepEngineOptions): BeepEngineControls {
  // Always-fresh options ref — callbacks passed to the hook stay current without
  // forcing a re-render or re-creating the engine functions.
  const optionsRef = useRef<BeepEngineOptions>(options);
  optionsRef.current = options;

  // ── Public position refs (read by the HUD via DOM manipulation) ──────────
  const currentLevelRef = useRef<number>(options.startLevel);
  const currentShuttleRef = useRef<number>(0);

  // ── Internal engine state (all refs — never React state) ─────────────────
  const scheduleRef = useRef<ScheduledBeep[]>([]);
  const nextBeepIdxRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const pausedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── Tick (RAF callback) ───────────────────────────────────────────────────
  //
  // Re-assigned on every render so it always closes over the latest refs.
  // Because ALL state is in refs (never React state), re-renders during a test
  // are essentially impossible — this pattern is safe and allocation-cheap.
  const tickRef = useRef<() => void>(() => {});

  tickRef.current = function tick(): void {
    if (!isRunningRef.current) return;

    const now = performance.now();

    // Process every overdue beep in one frame.
    // Under normal conditions this loop executes exactly once per frame.
    // After an unexpected delay (e.g. GC pause) it catches up without skipping.
    while (
      nextBeepIdxRef.current < scheduleRef.current.length &&
      now >= scheduleRef.current[nextBeepIdxRef.current].time
    ) {
      const beep = scheduleRef.current[nextBeepIdxRef.current];
      nextBeepIdxRef.current++;

      // ── Test complete ──────────────────────────────────────────────────
      if (beep.isTestEnd) {
        isRunningRef.current = false;
        scheduleBeep();
        optionsRef.current.onTestComplete();
        return; // Do not reschedule RAF.
      }

      // ── Update position refs ───────────────────────────────────────────
      currentLevelRef.current = beep.level;
      currentShuttleRef.current = beep.shuttle;

      // ── Play sound ────────────────────────────────────────────────────
      // All shuttle and level-change beeps use the same regular-beep.mp3.
      // Level-change distinction is still communicated via onLevelChange().
      scheduleBeep();
      if (beep.isLevelChange) {
        optionsRef.current.onLevelChange(beep.level);
      }

      // ── Notify HUD ────────────────────────────────────────────────────
      optionsRef.current.onBeep(beep.level, beep.shuttle);
    }

    rafRef.current = requestAnimationFrame(tickRef.current);
  };

  // ── cancelRaf helper ─────────────────────────────────────────────────────
  const cancelRaf = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Public controls ───────────────────────────────────────────────────────

  const start = useCallback((): void => {
    cancelRaf();
    const now = performance.now();

    // Play the "3, 2, 1" countdown audio and get back its exact duration.
    // The schedule is offset by that duration so the engine's first internal
    // beep fires precisely when the countdown audio ends.
    const countdownMs = playStartSequence();

    scheduleRef.current = buildSchedule(optionsRef.current.startLevel, now + countdownMs);
    nextBeepIdxRef.current = 0;
    currentLevelRef.current = optionsRef.current.startLevel;
    currentShuttleRef.current = 0;
    pausedAtRef.current = null;
    isRunningRef.current = true;

    rafRef.current = requestAnimationFrame(tickRef.current);
  }, [cancelRaf]);

  const pause = useCallback((): void => {
    if (!isRunningRef.current) return;

    isRunningRef.current = false;
    pausedAtRef.current = performance.now();
    cancelRaf();
  }, [cancelRaf]);

  const resume = useCallback((): void => {
    if (isRunningRef.current || pausedAtRef.current === null) return;

    const resumedAt = performance.now();
    const pauseDuration = resumedAt - pausedAtRef.current;

    // Shift all future beep timestamps forward by the exact pause duration
    // so no shuttles are skipped and the inter-beep intervals stay accurate.
    for (let i = nextBeepIdxRef.current; i < scheduleRef.current.length; i++) {
      scheduleRef.current[i] = {
        ...scheduleRef.current[i],
        time: scheduleRef.current[i].time + pauseDuration,
      };
    }

    pausedAtRef.current = null;
    isRunningRef.current = true;
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const stop = useCallback((): void => {
    isRunningRef.current = false;
    pausedAtRef.current = null;
    cancelRaf();
  }, [cancelRaf]);

  // ── Auto-pause on tab hide ────────────────────────────────────────────────
  //
  // RAF is throttled (and often frozen) by the browser when the tab is hidden.
  // Auto-pausing guarantees the schedule stays accurate when the teacher
  // switches back to the tab.
  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'hidden' && isRunningRef.current) {
        pause();
        optionsRef.current.onAutopaused?.();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pause]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return stop;
  }, [stop]);

  return { start, pause, resume, stop, currentLevelRef, currentShuttleRef };
}
