'use client';

import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Semester } from '@fitgrade/types';

interface SemesterTransitionWrapperProps {
  /** The currently active semester — drives animation direction and color flash. */
  activeSemester: Semester;
  children: React.ReactNode;
}

// Subtle color-pulse overlay during transition to signal data pool change
const FLASH_COLOR: Record<Semester, string> = {
  A: 'rgba(139,92,246,0.06)',
  B: 'rgba(34,197,94,0.06)',
};

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Wraps semester-sensitive data sections with a brief color flash + directional
 * slide when the active semester changes.
 *
 * Performance note: Children are NEVER unmounted. The previous AnimatePresence
 * mode="wait" approach forced a full DOM teardown/rebuild of the subtree on every
 * toggle, causing a render cascade freeze. This version uses motion.animate() with
 * changing values — React keeps the tree mounted and only the CSS transform changes.
 *
 * RTL-aware direction:
 *   Switching to B (forward): slides from start (x: -20 → 0).
 *   Switching to A (backward): slides from end  (x:  20 → 0).
 */
export function SemesterTransitionWrapper({
  activeSemester,
  children,
}: SemesterTransitionWrapperProps): React.JSX.Element {
  const prevSemesterRef = useRef<Semester>(activeSemester);
  const isForward = activeSemester === 'B';

  // Track direction based on what we're transitioning TO
  const xIn = isForward ? -20 : 20;

  // Only animate when semester actually changes (not on first mount)
  const didChange = prevSemesterRef.current !== activeSemester;
  prevSemesterRef.current = activeSemester;

  return (
    <div className="relative">
      {/* ── Color flash overlay — fades out immediately after semester switch ── */}
      <AnimatePresence>
        <motion.div
          key={`flash-${activeSemester}`}
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
          initial={{ opacity: 0.08 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: FLASH_COLOR[activeSemester] }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          aria-hidden="true"
        />
      </AnimatePresence>

      {/* ── Directional slide — children stay MOUNTED; only transform animates ── */}
      <motion.div
        key={activeSemester}
        initial={didChange ? { opacity: 0, x: xIn } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        {children}
      </motion.div>
    </div>
  );
}
