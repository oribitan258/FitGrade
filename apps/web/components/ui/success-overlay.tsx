'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface SuccessOverlayProps {
  /**
   * Triggers the overlay.  Each false → true transition starts a fresh display
   * cycle: the overlay animates in, holds for `displayMs`, then fades out on
   * its own — the consumer does not need to set `show` back to false.
   *
   * If `show` becomes true again while the overlay is mid-exit, a new cycle
   * begins immediately (keyed to restart the animation).
   */
  show: boolean;

  /** Custom Hebrew success message. Defaults to "הנתונים נשמרו בהצלחה". */
  message?: string;

  /** How long (ms) the overlay stays fully visible before fading out. Default 2500. */
  displayMs?: number;

  /** Called after the exit animation fully completes. */
  onHide?: () => void;
}

const DEFAULT_MESSAGE = 'הנתונים נשמרו בהצלחה';
const DEFAULT_DISPLAY = 2500;

/**
 * Premium action-confirmation overlay.
 *
 * Lifecycle per trigger:
 *   show=true  → mount → spring in (80 ms) → hold → fade out (400 ms) → unmount
 *
 * Compositing:
 *   The spinning logo video uses `mix-blend-mode: screen` over the dark
 *   glass backdrop, identically to SplashScreen.  The blurred backdrop
 *   preserves depth perception while the video's black pixels disappear.
 *
 * The internal `cycleKey` increments on every new trigger so AnimatePresence
 * correctly restarts the enter animation even if the previous exit is in flight.
 */
export function SuccessOverlay({
  show,
  message = DEFAULT_MESSAGE,
  displayMs = DEFAULT_DISPLAY,
  onHide,
}: SuccessOverlayProps): React.JSX.Element {
  const [visible, setVisible]   = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!show) return;

    // New trigger: increment key (restarts AnimatePresence child), make visible
    setCycleKey((k) => k + 1);
    setVisible(true);

    // Clear any in-flight dismiss timer
    if (timerRef.current !== null) clearTimeout(timerRef.current);

    // Schedule auto-dismiss
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, displayMs);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [show, displayMs]);

  return (
    <AnimatePresence onExitComplete={onHide}>
      {visible && (
        <>
          {/*
           * Backdrop layer — blurred, semi-transparent.
           * Separate from the card so backdrop-filter applies to the full
           * viewport without affecting the card's internal rendering.
           */}
          <motion.div
            key={`backdrop-${cycleKey}`}
            className="fixed inset-0 z-[9998]"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            aria-hidden="true"
          >
            {/* Dark tint over the blur */}
            <div className="absolute inset-0 bg-black/45" />
          </motion.div>

          {/*
           * Card layer — centred, spring-animated scale-in.
           * Uses role="status" + aria-live so screen readers announce the
           * success message without needing a separate toast region.
           */}
          <motion.div
            key={`card-${cycleKey}`}
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div
              className="relative flex flex-col items-center gap-5 rounded-3xl px-14 py-10"
              style={{
                background:           'rgba(13,17,53,0.72)',
                backdropFilter:       'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border:               '1px solid rgba(255,255,255,0.10)',
                boxShadow: [
                  '0 32px 80px rgba(0,0,0,0.55)',
                  '0 0 0 1px rgba(99,102,241,0.12)',
                  'inset 0 1px 0 rgba(255,255,255,0.07)',
                ].join(', '),
              }}
            >
              {/* Inner radial glow behind the video */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.22) 0%, transparent 65%)',
                }}
              />

              {/* Animated ring — pulses once on enter to draw attention */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: 192,
                  height: 192,
                  border: '1px solid rgba(99,102,241,0.35)',
                }}
                initial={{ opacity: 0.8, scale: 0.6 }}
                animate={{ opacity: 0, scale: 1.6 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.05 }}
              />

              {/*
               * Video — mix-blend-mode: screen.
               * The isolation wrapper confines the blend so it does not
               * affect the text element below or the card border.
               */}
              <div
                style={{ isolation: 'isolate', width: 148, height: 148 }}
                className="relative"
              >
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  src="/logo_black_background.mp4"
                  className="h-full w-full object-contain"
                  style={{ mixBlendMode: 'screen' }}
                  aria-hidden="true"
                />
              </div>

              {/* Success message */}
              <motion.div
                className="flex flex-col items-center gap-1.5 text-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.3, ease: 'easeOut' }}
              >
                <p
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                >
                  {message}
                </p>

                {/* Subtle accent line */}
                <motion.div
                  className="rounded-full"
                  style={{
                    height: 2,
                    background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: 88 }}
                  transition={{ delay: 0.22, duration: 0.45, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
