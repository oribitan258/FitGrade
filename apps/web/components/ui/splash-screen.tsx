'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const MIN_DISPLAY_MS = 3_500;

interface SplashScreenProps {
  /**
   * True while the app is fetching auth/data.  Even when this becomes false,
   * the splash stays visible until MIN_DISPLAY_MS has elapsed since mount.
   * Only after BOTH conditions are satisfied does the exit animation begin.
   */
  isLoading: boolean;
}

/**
 * Full-screen initial-load mask.
 *
 * Why NO isolation: isolate on the video wrapper
 * ───────────────────────────────────────────────
 * CSS spec (Compositing L1 §9.1): `isolation: isolate` forces a new
 * compositing group whose backdrop is the group's own *empty* alpha channel,
 * not the dark gradient behind it.  With no background inside that group,
 * `mix-blend-mode: screen` on the video blends against *transparent* —
 * killing the effect.  The wrapper is removed entirely so the video's blend
 * reaches the dark gradient of the motion.div directly.
 *
 * mix-blend-mode: screen formula: result = 1 − (1 − A)(1 − B)
 *   Video black (0) + dark bg (≈0.04) → 0.04  — background shows through
 *   Video white (1) + any bg           → 1     — logo always fully white
 */
export function SplashScreen({ isLoading }: SplashScreenProps): React.JSX.Element {
  const mountedAt = useRef(Date.now());
  const [canHide, setCanHide] = useState(false);

  useEffect(() => {
    const remaining = Math.max(0, MIN_DISPLAY_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => { setCanHide(true); }, remaining);
    return () => { clearTimeout(t); };
  }, []);

  const visible = isLoading || !canHide;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          role="status"
          aria-label="טוען את FitGrade…"
          aria-live="polite"
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{
            background:  '#0f0a1f',
            colorScheme: 'dark',
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* ── Aurora orbs ─────────────────────────────────────────────── */}

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full blur-3xl"
            style={{
              width: 640, height: 640,
              top: '-18%', insetInlineStart: '-12%',
              background: 'rgba(99,102,241,0.35)',
            }}
            animate={{ scale: [1, 1.08, 0.96, 1], opacity: [0.35, 0.45, 0.30, 0.35] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full blur-3xl"
            style={{
              width: 560, height: 560,
              bottom: '-16%', insetInlineEnd: '-12%',
              background: 'rgba(139,92,246,0.30)',
            }}
            animate={{ scale: [1, 1.12, 0.94, 1], opacity: [0.30, 0.40, 0.25, 0.30] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          />

          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full blur-3xl"
            style={{
              width: 320, height: 320,
              top: '42%', insetInlineEnd: '20%',
              background: 'rgba(56,189,248,0.12)',
            }}
            animate={{ scale: [1, 0.88, 1.16, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
          />

          {/* ── Centred logo column ──────────────────────────────────────── */}
          <div className="relative flex flex-col items-center gap-2">

            {/* Soft radial glow sits behind the video in DOM order so
                it is behind in the stacking context — it does not
                interfere with the blend because it is a sibling, not
                a parent, of the video element. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                inset: '-40px',
                background:
                  'radial-gradient(ellipse at center, rgba(99,102,241,0.22) 0%, transparent 70%)',
                filter: 'blur(32px)',
              }}
            />

            {/*
             * The <video> element sits directly inside the flex column with
             * no intervening stacking-context wrapper.  mix-blend-screen
             * composites against the dark gradient of the motion.div above,
             * keying out all pure-black pixels from the MP4.
             *
             * Explicit Tailwind sizing (w-64 h-64 = 256 × 256 px) prevents
             * the intrinsicless video from collapsing to 0 × 0 before the
             * browser parses the first frame.  object-contain preserves the
             * original aspect ratio inside that box.
             */}
            <video
              autoPlay
              loop
              muted
              playsInline
              src="/logo_black_background.mp4"
              className="w-64 h-64 object-contain mix-blend-screen"
              aria-hidden="true"
              onError={() => {
                console.error(
                  '[SplashScreen] Video failed to load — verify the file exists at public/logo_black_background.mp4',
                );
              }}
            />

            <p
              className="text-xs font-semibold uppercase tracking-[0.22em] text-center"
              style={{ color: 'rgba(148,163,184,0.38)' }}
            >
              FitGrade
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
