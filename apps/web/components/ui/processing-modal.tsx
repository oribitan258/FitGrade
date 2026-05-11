'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ProcessingModalProps {
  /** Controls visibility. AnimatePresence handles the exit animation. */
  isOpen: boolean;
  /** Hebrew message shown below the logo, e.g. "מעבד נתונים..." */
  message: string;
}

/**
 * Reusable heavy-operation modal.
 *
 * Covers the viewport with a dark glassmorphic backdrop while a background
 * task runs (CSV export, bulk grade compute, report generation, etc.).
 * The spinning logo video composites via mix-blend-mode: screen — the dark
 * backdrop doubles as the blend canvas, so no extra dark wrapper is needed.
 *
 * Usage:
 *   const [exporting, setExporting] = useState(false);
 *
 *   const handleExport = async () => {
 *     setExporting(true);
 *     await generateCsv();
 *     setExporting(false);
 *   };
 *
 *   <ProcessingModal isOpen={exporting} message="מכין את הדוח..." />
 */
export function ProcessingModal({ isOpen, message }: ProcessingModalProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────────────
              Two separate layers so backdrop-filter: blur applies to the full
              viewport without affecting the card's internal rendering (a known
              browser bug where blur on a transform parent blurs its children). */}
          <motion.div
            key="processing-backdrop"
            className="fixed inset-0 z-[9990]"
            style={{
              backdropFilter:       'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-black/70" />
          </motion.div>

          {/* ── Card ─────────────────────────────────────────────────────────
              role="status" + aria-live="polite" — screen readers announce the
              message when it appears without interrupting ongoing narration. */}
          <motion.div
            key="processing-card"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="fixed inset-0 z-[9991] flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.90, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.94,  y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              className="relative flex flex-col items-center gap-5 rounded-3xl px-12 py-10"
              style={{
                background:           'rgba(10,7,32,0.75)',
                backdropFilter:       'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border:               '1px solid rgba(255,255,255,0.09)',
                boxShadow: [
                  '0 32px 80px rgba(0,0,0,0.60)',
                  '0 0 0 1px rgba(99,102,241,0.10)',
                  'inset 0 1px 0 rgba(255,255,255,0.06)',
                ].join(', '),
              }}
            >
              {/* Ambient radial glow behind the video */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 38%, rgba(99,102,241,0.20) 0%, transparent 65%)',
                }}
              />

              {/* Entry pulse ring — fires once to draw attention */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{ width: 160, height: 160, border: '1px solid rgba(99,102,241,0.40)' }}
                initial={{ opacity: 0.9, scale: 0.55 }}
                animate={{ opacity: 0,   scale: 1.70 }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: 0.05 }}
              />

              {/*
               * Spinning logo video — w-40 h-40 (160×160 px).
               *
               * mix-blend-mode: screen composites against the card's own dark
               * background (rgba(10,7,32,0.75)) — near-black, so the formula
               * correctly keys out the MP4's black pixels.  No isolation wrapper
               * is used; the card's stacking context provides the blend boundary.
               */}
              <video
                autoPlay
                loop
                muted
                playsInline
                src="/logo_black_background.mp4"
                className="w-40 h-40 object-contain mix-blend-screen"
                aria-hidden="true"
                onError={() => {
                  console.error('[ProcessingModal] Video failed to load — verify public/logo_black_background.mp4 exists');
                }}
              />

              {/* Message */}
              <motion.div
                className="flex flex-col items-center gap-2 text-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.28, ease: 'easeOut' }}
              >
                <p
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'rgba(255,255,255,0.90)' }}
                >
                  {message}
                </p>

                {/* Animated accent line grows in on entry */}
                <motion.div
                  className="rounded-full"
                  style={{
                    height:     2,
                    background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.75), transparent)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: 72 }}
                  transition={{ delay: 0.24, duration: 0.40, ease: 'easeOut' }}
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
