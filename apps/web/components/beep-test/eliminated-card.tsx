'use client';

/**
 * EliminatedCard — compact row for students who have finished the beep test.
 *
 * Visual design:
 *   - Full grayscale + 55 % opacity to clearly de-emphasize finished students.
 *   - Compact 48 px row with student name on start side and elimination point on end.
 *   - Uses the same layoutId as StudentCard to produce a shared-element glide
 *     animation when a student transitions from the active grid to this list.
 *   - Exit: sinks (y +8, scale 0.88) and fades out in 160 ms.
 */

import { motion } from 'framer-motion';
import type { BeepStudentState } from '@/hooks/use-beep-students';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface EliminatedCardProps {
  student: BeepStudentState & {
    eliminatedAt: NonNullable<BeepStudentState['eliminatedAt']>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EliminatedCard({ student }: EliminatedCardProps): React.JSX.Element {
  const { level, shuttle } = student.eliminatedAt;

  return (
    <motion.div
      layoutId={student.id}
      layout
      initial={{ opacity: 0, y: -6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: 8,
        scale: 0.88,
        transition: { duration: 0.16, ease: 'easeIn' },
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      dir="rtl"
      className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        // Grayscale + reduce opacity to visually de-emphasize completed students.
        filter: 'grayscale(1)',
        opacity: 0.55,
      }}
    >
      {/* Student name */}
      <span className="min-w-0 truncate text-sm font-semibold leading-tight text-white">
        {student.firstName} {student.lastName}
      </span>

      {/* Elimination point badge */}
      <div
        className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
        aria-label={`נסגר ברמה ${level}, מעבר ${shuttle}`}
      >
        <span className="text-[10px] font-bold tabular-nums text-white/45">רמה</span>
        <span className="text-xs font-black tabular-nums text-white/65">{level}</span>
        <span className="text-[10px] text-white/25" aria-hidden="true">·</span>
        <span className="text-[10px] font-bold tabular-nums text-white/45">מעבר</span>
        <span className="text-xs font-black tabular-nums text-white/65">{shuttle}</span>
      </div>
    </motion.div>
  );
}
