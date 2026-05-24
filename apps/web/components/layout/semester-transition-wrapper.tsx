'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { Semester } from '@fitgrade/types';

interface SemesterTransitionWrapperProps {
  /** The currently active semester — drives the color-flash overlay. */
  activeSemester: Semester;
  children: React.ReactNode;
}

// Subtle color-pulse overlay during transition to signal data pool change
const FLASH_COLOR: Record<Semester, string> = {
  A: 'rgba(139,92,246,0.06)',
  B: 'rgba(34,197,94,0.06)',
};

/**
 * Wraps semester-sensitive data sections with a brief color flash when the
 * active semester changes.
 *
 * Children are NEVER unmounted — they sit in a static container so rapid
 * A↔B toggles cannot cause a render cascade, a remount race, or cards
 * stuck at opacity:0. Only the overlay flash animates per change; the
 * underlying stat values update in place via SWR's keepPreviousData.
 */
export function SemesterTransitionWrapper({
  activeSemester,
  children,
}: SemesterTransitionWrapperProps): React.JSX.Element {
  return (
    <div className="relative">
      {/* ── Color flash overlay — re-fires per semester change via key ── */}
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

      {/* Children stay mounted — no key, no enter animation, no race. */}
      {children}
    </div>
  );
}
