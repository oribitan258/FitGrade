'use client';

/**
 * PreTestRosterSelection — universal pre-test roster gate.
 *
 * Renders as a full-screen portal BEFORE any test begins.
 * All students start active; tapping a card toggles exclusion.
 * When the teacher presses "Continue", only the active students
 * are forwarded to the actual test component via `onConfirm`.
 *
 * Visual design: #0B0A1F base, floating sports icons, frosted-glass
 * student cards (active = violet glow, excluded = grayscale/dim),
 * pulsing violet CTA button.
 *
 * RTL: `dir="rtl"` on portal root, logical Tailwind properties only.
 */

import { createPortal }        from 'react-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Users, X, Zap } from 'lucide-react';
import type { SessionStudent } from '@fitgrade/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PreTestRosterSelectionProps {
  /** Full class roster from the session. */
  students:   SessionStudent[];
  /** Hebrew test name — shown in the badge and CTA. */
  testName:   string;
  /** Called with the filtered active-only array when the teacher confirms. */
  onConfirm:  (activeStudents: SessionStudent[]) => void;
  /** Skeletons are shown instead of real cards while session is loading. */
  isLoading?: boolean;
}

// ─── Floating sports icons ──────────────────────────────────────────────────────

interface FloatDef {
  src:     string;
  w:       number;
  left:    string;
  top:     string;
  delay:   number;
  dur:     number;
  blur:    number;
  opacity: number;
}

const FLOAT_ICONS: FloatDef[] = [
  { src: '/sports-icons/stopwatch.png',       w: 88,  left: '4%',  top: '8%',  delay: 0,   dur: 8.0,  blur: 0,   opacity: 0.80 },
  { src: '/sports-icons/football-player.png', w: 100, left: '66%', top: '5%',  delay: 1.2, dur: 10.0, blur: 1,   opacity: 0.60 },
  { src: '/sports-icons/football.png',        w: 68,  left: '84%', top: '46%', delay: 0.6, dur: 7.5,  blur: 2,   opacity: 0.45 },
  { src: '/sports-icons/baseball.png',        w: 56,  left: '8%',  top: '70%', delay: 2.0, dur: 9.0,  blur: 0.5, opacity: 0.68 },
  { src: '/sports-icons/stopwatch.png',       w: 44,  left: '46%', top: '82%', delay: 1.5, dur: 11.5, blur: 3,   opacity: 0.35 },
  { src: '/sports-icons/football.png',        w: 76,  left: '1%',  top: '36%', delay: 0.9, dur: 8.5,  blur: 1.5, opacity: 0.50 },
  { src: '/sports-icons/baseball.png',        w: 40,  left: '75%', top: '20%', delay: 3.0, dur: 12.0, blur: 4,   opacity: 0.30 },
  { src: '/sports-icons/football-player.png', w: 54,  left: '31%', top: '87%', delay: 0.4, dur: 9.5,  blur: 2,   opacity: 0.28 },
];

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard(): React.JSX.Element {
  return (
    <div
      className="animate-pulse rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border:     '1px solid rgba(255,255,255,0.07)',
        height:     96,
      }}
    />
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PreTestRosterSelection({
  students,
  testName,
  onConfirm,
  isLoading = false,
}: PreTestRosterSelectionProps): React.JSX.Element {
  const [mounted,  setMounted]  = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  const toggleStudent = (id: string): void => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    if (excluded.size === 0) {
      // All active → exclude everyone
      setExcluded(new Set(students.map((s) => s.id)));
    } else {
      // Some/all excluded → restore everyone
      setExcluded(new Set());
    }
  };

  const activeCount = students.length - excluded.size;

  const handleConfirm = (): void => {
    onConfirm(students.filter((s) => !excluded.has(s.id)));
  };

  if (!mounted) return <></>;

  return createPortal(
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#0B0A1F' }}
    >
      {/* ── Ambient gradient orbs ──────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 20%, rgba(109,40,217,0.22) 0%, transparent 55%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 15% 75%, rgba(59,130,246,0.14) 0%, transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)' }} />
      </div>

      {/* ── Floating sports icons ──────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {FLOAT_ICONS.map((ic, i) => (
          <motion.img
            key={i}
            src={ic.src}
            alt=""
            width={ic.w}
            style={{
              position:   'absolute',
              left:       ic.left,
              top:        ic.top,
              opacity:    ic.opacity,
              filter:     `blur(${ic.blur}px)`,
              userSelect: 'none',
            }}
            animate={{ y: [0, -14, 0] }}
            transition={{
              duration: ic.dur,
              delay:    ic.delay,
              repeat:   Infinity,
              ease:     'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 px-6 pt-8 pb-5"
        style={{
          borderBottom:        '1px solid rgba(255,255,255,0.07)',
          background:          'rgba(11,10,31,0.60)',
          backdropFilter:      'blur(16px)',
          WebkitBackdropFilter:'blur(16px)',
        }}
      >
        {/* Test badge */}
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1"
          style={{
            background: 'rgba(139,92,246,0.20)',
            border:     '1px solid rgba(196,157,255,0.30)',
          }}
        >
          <Zap className="h-3.5 w-3.5 text-violet-300 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-violet-200 tracking-wide">{testName}</span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              בחירת משתתפים
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              כל התלמידים נבחרו כברירת מחדל — לחץ על תלמיד להוצאתו
            </p>
          </div>

          {/* Summary chip + select-all toggle */}
          <div className="flex shrink-0 items-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
              style={{
                background: 'rgba(139,92,246,0.18)',
                border:     '1px solid rgba(139,92,246,0.30)',
              }}
            >
              <Users className="h-3.5 w-3.5 text-violet-300 shrink-0" aria-hidden="true" />
              <span className="text-sm font-bold text-violet-200">{activeCount}</span>
              <span className="text-xs text-violet-300/70">/ {students.length}</span>
            </div>

            <button
              type="button"
              onClick={toggleAll}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:text-white/90"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border:     '1px solid rgba(255,255,255,0.10)',
              }}
            >
              {excluded.size === 0 ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Student grid ──────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/40">
            <Users className="h-12 w-12 opacity-40" aria-hidden="true" />
            <p className="text-base font-medium">אין תלמידים רשומים לשיעור זה</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence initial={false}>
              {students.map((student) => {
                const isExcluded = excluded.has(student.id);
                return (
                  <motion.button
                    key={student.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleStudent(student.id)}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer"
                    style={{
                      minHeight:  96,
                      background: isExcluded
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(139,92,246,0.18)',
                      border: isExcluded
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(196,157,255,0.45)',
                      boxShadow: isExcluded
                        ? 'none'
                        : '0 0 20px rgba(139,92,246,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
                      filter:  isExcluded ? 'grayscale(1) brightness(0.45)' : 'none',
                      opacity: isExcluded ? 0.55 : 1,
                    }}
                    aria-pressed={!isExcluded}
                    aria-label={`${student.firstName} ${student.lastName} — ${isExcluded ? 'לא משתתף' : 'משתתף'}`}
                  >
                    {/* Status indicator badge */}
                    <div
                      className="absolute top-2.5 start-2.5 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        background: isExcluded
                          ? 'rgba(239,68,68,0.30)'
                          : 'rgba(139,92,246,0.50)',
                        border: isExcluded
                          ? '1px solid rgba(239,68,68,0.50)'
                          : '1px solid rgba(196,157,255,0.60)',
                      }}
                      aria-hidden="true"
                    >
                      {isExcluded
                        ? <X className="h-3 w-3 text-red-300" />
                        : <CheckCircle2 className="h-3 w-3 text-violet-200" />
                      }
                    </div>

                    {/* Name */}
                    <span className="text-sm font-bold leading-tight text-white">
                      {student.firstName}
                    </span>
                    <span className="text-xs leading-tight text-white/60">
                      {student.lastName}
                    </span>

                    {/* Excluded label */}
                    {isExcluded && (
                      <span className="mt-0.5 text-[10px] font-semibold text-red-400/80">
                        לא משתתף
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <div
        className="relative shrink-0 px-6 py-5"
        style={{
          borderTop:           '1px solid rgba(255,255,255,0.07)',
          background:          'rgba(11,10,31,0.75)',
          backdropFilter:      'blur(16px)',
          WebkitBackdropFilter:'blur(16px)',
        }}
      >
        <motion.button
          type="button"
          onClick={handleConfirm}
          disabled={activeCount === 0}
          whileHover={
            activeCount > 0
              ? {
                  y:         -2,
                  boxShadow: '0 12px 32px rgba(139,92,246,0.55)',
                  transition: { type: 'spring', stiffness: 400, damping: 25 },
                }
              : {}
          }
          whileTap={activeCount > 0 ? { scale: 0.98 } : {}}
          className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-extrabold tracking-wide text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background:  'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(109,40,217,0.90) 100%)',
            border:      '1px solid rgba(196,157,255,0.40)',
            boxShadow:   activeCount > 0
              ? '0 4px 24px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'none',
          }}
        >
          {/* Pulsing ring */}
          {activeCount > 0 && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              animate={{ opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: '0 0 0 3px rgba(196,157,255,0.35)' }}
              aria-hidden="true"
            />
          )}
          <span className="relative">
            המשך לבדיקה ({activeCount} תלמידים)
          </span>
        </motion.button>
      </div>
    </div>,
    document.body,
  );
}
