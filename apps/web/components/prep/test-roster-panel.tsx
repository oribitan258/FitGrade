'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, UserMinus, RotateCcw, Users } from 'lucide-react';

interface RosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
}

interface TestRosterPanelProps {
  students: RosterStudent[];
  exclusions: Record<string, 'injured' | 'absent'>;
  onToggleStatus: (studentId: string, status: 'injured' | 'absent') => void;
  onClearExclusions: () => void;
}

export function TestRosterPanel({
  students,
  exclusions,
  onToggleStatus,
  onClearExclusions,
}: TestRosterPanelProps): React.JSX.Element {
  const excludedCount = Object.keys(exclusions).length;
  const activeCount = students.length - excludedCount;

  return (
    <div
      dir="rtl"
      className="flex h-full flex-col rounded-2xl border border-white/10"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
        {/* Active count badge */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.30)' }}
          >
            <Users className="h-4 w-4 text-violet-300" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0">
            <div className="flex items-baseline gap-1.5">
              <motion.span
                key={activeCount}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="text-lg font-bold leading-none text-white"
              >
                {activeCount}
              </motion.span>
              <span className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.55)' }}>
                / {students.length}
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(148,163,184,0.50)' }}>
              תלמידים פעילים
            </span>
          </div>
        </div>

        {/* Restore all — only shown when exclusions exist */}
        <AnimatePresence>
          {excludedCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.88, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.88, x: -8 }}
              transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
              type="button"
              onClick={onClearExclusions}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:scale-[1.04] active:scale-[0.96]"
              style={{
                color: 'rgba(165,180,252,0.85)',
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
              שחזר הכל
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scrollable student list ───────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.25) transparent' }}
      >
        {students.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.45)' }}>
              אין תלמידים רשומים לכיתה זו
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-white/5">
            {students.map((student, i) => (
              <StudentRow
                key={student.id}
                student={student}
                status={exclusions[student.id] ?? null}
                onToggleStatus={onToggleStatus}
                animDelay={i * 0.025}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Individual student row ─────────────────────────────────────────────────

interface StudentRowProps {
  student: RosterStudent;
  status: 'injured' | 'absent' | null;
  onToggleStatus: (studentId: string, type: 'injured' | 'absent') => void;
  animDelay: number;
}

function StudentRow({ student, status, onToggleStatus, animDelay }: StudentRowProps): React.JSX.Element {
  const isInjured = status === 'injured';
  const isAbsent = status === 'absent';
  const isExcluded = isInjured || isAbsent;

  return (
    <motion.li
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.30, delay: animDelay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 px-5 py-3.5 transition-all duration-200"
      style={{
        background: isInjured
          ? 'rgba(251,146,60,0.07)'
          : isAbsent
          ? 'rgba(100,116,139,0.08)'
          : 'transparent',
      }}
    >
      {/* Student name */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold transition-all duration-200"
          style={{
            color: isAbsent
              ? 'rgba(148,163,184,0.40)'
              : isInjured
              ? 'rgba(253,186,116,0.80)'
              : 'rgba(255,255,255,0.90)',
            textDecoration: isAbsent ? 'line-through' : 'none',
          }}
        >
          {student.firstName} {student.lastName}
        </p>
        {student.studentCode && (
          <p
            className="mt-0.5 text-[11px] transition-all duration-200"
            style={{
              color: isAbsent ? 'rgba(100,116,139,0.40)' : 'rgba(100,116,139,0.65)',
            }}
          >
            {student.studentCode}
          </p>
        )}
      </div>

      {/* Status label pill */}
      <AnimatePresence mode="wait">
        {isExcluded && (
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.80 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.80 }}
            transition={{ duration: 0.18 }}
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide"
            style={
              isInjured
                ? { background: 'rgba(251,146,60,0.18)', color: 'rgba(253,186,116,0.90)', border: '1px solid rgba(251,146,60,0.30)' }
                : { background: 'rgba(100,116,139,0.18)', color: 'rgba(148,163,184,0.70)', border: '1px solid rgba(100,116,139,0.28)' }
            }
          >
            {isInjured ? 'פצוע' : 'נעדר'}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Injured / EXCUSED toggle */}
        <motion.button
          type="button"
          onClick={() => { onToggleStatus(student.id, 'injured'); }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.90 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          aria-label={isInjured ? `הסר סטטוס פצוע עבור ${student.firstName}` : `סמן ${student.firstName} כפצוע`}
          aria-pressed={isInjured}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200"
          style={
            isInjured
              ? {
                  background: 'rgba(251,146,60,0.22)',
                  border: '1px solid rgba(251,146,60,0.50)',
                  boxShadow: '0 0 12px rgba(251,146,60,0.30)',
                }
              : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }
          }
        >
          <ShieldAlert
            className="h-4 w-4 transition-all duration-200"
            style={{ color: isInjured ? 'rgba(251,146,60,0.95)' : 'rgba(148,163,184,0.40)' }}
            aria-hidden="true"
          />
        </motion.button>

        {/* Absent / ABSENT toggle */}
        <motion.button
          type="button"
          onClick={() => { onToggleStatus(student.id, 'absent'); }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.90 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          aria-label={isAbsent ? `הסר סטטוס נעדר עבור ${student.firstName}` : `סמן ${student.firstName} כנעדר`}
          aria-pressed={isAbsent}
          className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200"
          style={
            isAbsent
              ? {
                  background: 'rgba(100,116,139,0.22)',
                  border: '1px solid rgba(100,116,139,0.45)',
                  boxShadow: '0 0 10px rgba(100,116,139,0.20)',
                }
              : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }
          }
        >
          <UserMinus
            className="h-4 w-4 transition-all duration-200"
            style={{ color: isAbsent ? 'rgba(148,163,184,0.90)' : 'rgba(148,163,184,0.40)' }}
            aria-hidden="true"
          />
        </motion.button>
      </div>
    </motion.li>
  );
}
