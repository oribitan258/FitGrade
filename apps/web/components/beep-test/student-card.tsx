'use client';

/**
 * StudentCard — tappable player card for ACTIVE and WARNING students.
 *
 * State transitions:
 *   ACTIVE   → glass card, spring hover lift
 *   WARNING  → intense amber glassmorphic glow + pulsing border ring with boxShadow
 *              animation + inner radial bloom behind avatar + one-shot shake
 *
 * Architecture notes:
 *   - Shake triggers ONCE via useAnimation when status first changes to WARNING.
 *   - layoutId enables a shared-element glide to EliminatedCard on elimination.
 *   - Tap debounced at 350 ms to prevent accidental double-eliminations.
 *   - Min touch target: 96 px tall (outdoor gym use).
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import type { BeepStudentState } from '@/hooks/use-beep-students';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum ms between two taps on the same card (prevents accidental double-tap). */
const TAP_DEBOUNCE_MS = 350;

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface StudentCardProps {
  student: BeepStudentState;
  onTap:   (studentId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function StudentCard({ student, onTap }: StudentCardProps): React.JSX.Element {
  const lastTapRef    = useRef<number>(0);
  const prevStatusRef = useRef<BeepStudentState['status']>(student.status);
  const shakeControls = useAnimation();
  const isWarning     = student.status === 'WARNING';

  // ── One-shot shake on ACTIVE → WARNING transition ─────────────────────────
  useEffect(() => {
    if (prevStatusRef.current !== 'WARNING' && student.status === 'WARNING') {
      void shakeControls.start({
        x: [0, -11, 11, -8, 8, -5, 5, -2, 2, 0],
        transition: { duration: 0.50, ease: 'easeInOut' },
      });
    }
    prevStatusRef.current = student.status;
  }, [student.status, shakeControls]);

  // ── Tap handler ──────────────────────────────────────────────────────────
  const handleTap = useCallback((): void => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_DEBOUNCE_MS) return;
    lastTapRef.current = now;
    onTap(student.id);
  }, [student.id, onTap]);

  // ── Initials for the avatar circle ───────────────────────────────────────
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    /**
     * Outer motion.button — handles layout/layoutId, entrance, exit, whileTap, whileHover.
     * Inner motion.div  — handles the shake animation (separate animate prop).
     */
    <motion.button
      layoutId={student.id}
      layout
      initial={{ opacity: 0, scale: 0.80 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.62, y: 6, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -3, transition: { type: 'spring', stiffness: 400, damping: 26 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      type="button"
      onClick={handleTap}
      aria-label={`סלק תלמיד ${student.firstName} ${student.lastName}`}
      dir="rtl"
      className="relative flex min-h-[96px] w-full cursor-pointer select-none flex-col items-center justify-center overflow-hidden rounded-2xl px-3 py-3 transition-colors duration-150"
      style={
        isWarning
          ? {
              background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.12) 100%)',
              border: '1px solid rgba(251,191,36,0.36)',
              boxShadow: [
                '0 0 40px rgba(245,158,11,0.45)',
                '0 0 80px rgba(245,158,11,0.18)',
                '0 8px 24px rgba(0,0,0,0.35)',
                'inset 0 1px 0 rgba(255,255,255,0.08)',
              ].join(', '),
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }
          : {
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.11)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }
      }
    >
      {/* ── Inner radial bloom (WARNING only) ─────────────────────────── */}
      <AnimatePresence>
        {isWarning && (
          <motion.div
            key="warning-bloom"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.35, 1] }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute"
            style={{
              insetInlineStart: '20%',
              top: '18%',
              width: '60%',
              height: '60%',
              background: 'radial-gradient(ellipse, rgba(251,191,36,0.30) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Pulsing amber glow ring (WARNING only) ────────────────────── */}
      <AnimatePresence>
        {isWarning && (
          <motion.div
            key="warning-ring"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.45, 1, 0.45],
              boxShadow: [
                '0 0 0px rgba(251,191,36,0)',
                '0 0 18px rgba(251,191,36,0.75)',
                '0 0 0px rgba(251,191,36,0)',
              ],
            }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-amber-400"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Hover inner glow (ACTIVE only) ──────────────────────────── */}
      {!isWarning && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.16), transparent 70%)' }}
          aria-hidden="true"
        />
      )}

      {/* ── Warning badge (top-start) ────────────────────────────────── */}
      <AnimatePresence>
        {isWarning && (
          <motion.span
            key="warning-badge"
            initial={{ opacity: 0, scale: 0.65, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.65, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 480, damping: 28 }}
            className="absolute start-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950"
            aria-label="אזהרה ראשונה"
          >
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
            אזהרה
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Shake wrapper (inner) ────────────────────────────────────── */}
      <motion.div
        animate={shakeControls}
        className="flex flex-col items-center gap-1"
      >
        {/* Avatar circle with initials */}
        <div
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black"
          style={
            isWarning
              ? {
                  background: 'rgba(245,158,11,0.25)',
                  color: 'rgba(253,230,138,0.9)',
                  boxShadow: '0 0 12px rgba(245,158,11,0.50)',
                }
              : {
                  background: 'rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.55)',
                }
          }
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* First name */}
        <span
          className="text-center text-base font-extrabold leading-tight tracking-tight"
          style={{ color: isWarning ? 'rgba(254,243,199,1)' : 'rgba(255,255,255,1)' }}
        >
          {student.firstName}
        </span>

        {/* Last name */}
        <span
          className="text-center text-sm font-semibold leading-tight"
          style={{ color: isWarning ? 'rgba(253,230,138,0.70)' : 'rgba(255,255,255,0.50)' }}
        >
          {student.lastName}
        </span>
      </motion.div>
    </motion.button>
  );
}
