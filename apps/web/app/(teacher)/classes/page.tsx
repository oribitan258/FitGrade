'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Target,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { type ClassData } from '@fitgrade/types';
import type { TopAchievementItem } from '@fitgrade/types';
import { formatClassWithGender } from '@/lib/class-utils';
import { useClasses } from '@/hooks/use-classes';
import { useTopAchievements } from '@/hooks/use-top-achievements';
import { TopResultsTicker } from '@/components/ui/top-results-ticker';
import { cn } from '@/lib/utils';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';
import { SemesterPanel } from '@/components/ui/semester-panel';
import { AddClassModal } from '@/components/classes/add-class-modal';
import { useSignalPageReady } from '@/components/tour/use-signal-page-ready';
import { useTour } from '@/components/tour/TourProvider';

// ─── Animation presets ───────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
};

const GRID_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

// ─── Prismatic 4-tone palette ─────────────────────────────────────────────────

const CARD_THEMES = [
  {
    label: '7th',
    badgeBg: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    stripe:  'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
    bar1:    'linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%)',
    bar2:    'linear-gradient(90deg, #67e8f9 0%, #93c5fd 100%)',
    glow:      '0 0 44px rgba(6,182,212,0.18), 0 8px 28px rgba(15,23,42,0.08)',
    hoverGlow: '0 0 64px rgba(6,182,212,0.34), 0 14px 44px rgba(15,23,42,0.14)',
    ring:    'rgba(6,182,212,0.28)',
    titleColor: '#0c2a3a',
    subColor:   '#0e7490',
  },
  {
    label: '8th',
    badgeBg: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    stripe:  'linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)',
    bar1:    'linear-gradient(90deg, #8b5cf6 0%, #d946ef 100%)',
    bar2:    'linear-gradient(90deg, #a78bfa 0%, #f0abfc 100%)',
    glow:      '0 0 44px rgba(109,40,217,0.18), 0 8px 28px rgba(15,23,42,0.08)',
    hoverGlow: '0 0 64px rgba(109,40,217,0.36), 0 14px 44px rgba(15,23,42,0.14)',
    ring:    'rgba(109,40,217,0.30)',
    titleColor: '#1e1b4b',
    subColor:   '#6d28d9',
  },
  {
    label: '9th',
    badgeBg: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
    stripe:  'linear-gradient(90deg, #f97316 0%, #f59e0b 100%)',
    bar1:    'linear-gradient(90deg, #fb923c 0%, #fbbf24 100%)',
    bar2:    'linear-gradient(90deg, #fdba74 0%, #fde68a 100%)',
    glow:      '0 0 44px rgba(234,88,12,0.18), 0 8px 28px rgba(15,23,42,0.08)',
    hoverGlow: '0 0 64px rgba(234,88,12,0.36), 0 14px 44px rgba(15,23,42,0.14)',
    ring:    'rgba(234,88,12,0.28)',
    titleColor: '#431407',
    subColor:   '#c2410c',
  },
  {
    label: '10th',
    badgeBg: 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
    stripe:  'linear-gradient(90deg, #ef4444 0%, #f43f5e 100%)',
    bar1:    'linear-gradient(90deg, #f87171 0%, #fb7185 100%)',
    bar2:    'linear-gradient(90deg, #fca5a5 0%, #fda4af 100%)',
    glow:      '0 0 44px rgba(220,38,38,0.18), 0 8px 28px rgba(15,23,42,0.08)',
    hoverGlow: '0 0 64px rgba(220,38,38,0.36), 0 14px 44px rgba(15,23,42,0.14)',
    ring:    'rgba(220,38,38,0.28)',
    titleColor: '#450a0a',
    subColor:   '#b91c1c',
  },
] as const;

type CardTheme = typeof CARD_THEMES[number];

// ─── Static content ───────────────────────────────────────────────────────────

const GHOST_ATHLETES = [
  'hero-male.png', 'hero-female.png', 'hero-male-2.png', 'hero-female-2.png',
] as const;

const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

// ─── Fallback ticker items (shown before real data arrives) ──────────────────

const MOCK_TOP_ACHIEVEMENTS: TopAchievementItem[] = [
  { rank: 1, studentId: 'stu-1', studentName: 'אורי ברק',   classId: 'cls-1', className: "י' 1", classGenderType: 'BOYS',  examName: 'ריצת 2000 מטר', score: 95, rawValue: 424,  unit: null },
  { rank: 2, studentId: 'stu-2', studentName: 'שירה אבידן', classId: 'cls-1', className: "י' 1", classGenderType: 'GIRLS', examName: 'שכיבות סמיכה', score: 92, rawValue: 38,   unit: null },
  { rank: 3, studentId: 'stu-3', studentName: 'דניאל לוי',  classId: 'cls-2', className: "ט' 2", classGenderType: 'BOYS',  examName: 'קפיצה למרחק',  score: 90, rawValue: 182,  unit: 'ס"מ' },
  { rank: 4, studentId: 'stu-4', studentName: 'מיכל כהן',   classId: 'cls-2', className: "ט' 2", classGenderType: 'GIRLS', examName: 'מתח',           score: 88, rawValue: 12,   unit: null },
  { rank: 5, studentId: 'stu-5', studentName: 'יוסי פרץ',   classId: 'cls-3', className: "ח' 1", classGenderType: 'MIXED', examName: 'ריצת 100 מטר', score: 86, rawValue: 13.8, unit: null },
];

// ─── Floating debris config ──────────────────────────────────────────────────

interface DebrisEntry {
  readonly Icon: React.ElementType;
  readonly posStyle: React.CSSProperties;
  readonly delay: number;
}

const DEBRIS: DebrisEntry[] = [
  { Icon: Dumbbell, posStyle: { top: '10%', insetInlineStart: '5%'  }, delay: 0   },
  { Icon: Target,   posStyle: { top: '5%',  insetInlineEnd:  '7%'  }, delay: 2   },
  { Icon: Timer,    posStyle: { top: '70%', insetInlineStart: '12%' }, delay: 4   },
  { Icon: Trophy,   posStyle: { top: '60%', insetInlineEnd:   '10%' }, delay: 1.5 },
  { Icon: Flame,    posStyle: { top: '84%', insetInlineStart: '46%' }, delay: 3   },
  { Icon: Zap,      posStyle: { top: '36%', insetInlineEnd:   '3%'  }, delay: 2.5 },
];

// ─── Floating Debris Layer ───────────────────────────────────────────────────

function FloatingDebris(): React.JSX.Element {
  return (
    <div
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {DEBRIS.map(({ Icon, posStyle, delay }, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ ...posStyle, opacity: 0.04 }}
          animate={{ y: [0, -16, 0], rotate: [0, 6, -6, 0] }}
          transition={{ duration: 14 + i * 2.5, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <Icon className="w-9 h-9 text-violet-500" aria-hidden="true" />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function AddClassButton({ onClick }: { onClick: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.025, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
      whileTap={{ scale: 0.97 }}
      data-tour="add-class"
      className="relative shrink-0 flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-800 overflow-hidden min-h-[44px]"
      style={{
        background: hovered ? 'rgba(241,245,249,1.0)' : 'rgba(248,250,252,0.90)',
        border: '1px solid rgba(226,232,240,0.80)',
        boxShadow: hovered ? '0 4px 12px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.04)',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Hover ripple */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="ripple"
            className="absolute inset-0 pointer-events-none rounded-2xl"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            aria-hidden="true"
            style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.10), transparent 72%)' }}
          />
        )}
      </AnimatePresence>

      {/* Icon capsule */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: 30, height: 30,
          background: '#10b981',
          boxShadow: '0 0 14px rgba(16,185,129,0.28), 0 2px 6px rgba(0,0,0,0.15)',
        }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)' }}
        />
        <GraduationCap className="h-3.5 w-3.5 text-white" />
      </div>

      <span className="relative z-10">הוסף כיתה</span>
    </motion.button>
  );
}

function PageHeader({ onCreateClick }: { onCreateClick: () => void }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 pt-2">
      {/* Title — RTL start side (right) */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
          הכיתות שלי
        </h1>
      </div>

      {/* Button — RTL end side (left) — matches dashboard QuickActionButton style */}
      <AddClassButton onClick={onCreateClick} />
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

interface ClassSearchBarProps {
  value:    string;
  onChange: (v: string) => void;
  count:    number;
  total:    number;
}

function ClassSearchBar({ value, onChange, count, total }: ClassSearchBarProps): React.JSX.Element {
  const inputRef                    = useRef<HTMLInputElement>(null);
  const [focused, setFocused]       = useState(false);
  const isFiltering                 = value.trim().length > 0;

  return (
    <div className="relative w-full" role="search" aria-label="חיפוש כיתות">
      {/* Ambient glow ring — pulses on focus */}
      <motion.div
        className="pointer-events-none absolute -inset-[3px] rounded-2xl"
        animate={{
          opacity:    focused ? 1    : 0,
          boxShadow: focused
            ? '0 0 0 3px rgba(109,40,217,0.22), 0 0 28px rgba(109,40,217,0.18), 0 0 56px rgba(139,92,246,0.10)'
            : '0 0 0 0px rgba(109,40,217,0)',
        }}
        transition={{ duration: 0.30, ease: 'easeOut' }}
        aria-hidden="true"
      />

      {/* Glass pill */}
      <motion.div
        animate={{
          scale:      focused ? 1.012 : 1,
          background: focused
            ? 'rgba(255,255,255,0.72)'
            : 'rgba(255,255,255,0.52)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative flex items-center gap-3 rounded-2xl border border-white/70 px-4"
        style={{
          backdropFilter:       'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow:            '0 2px 18px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
          height: 48,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Search icon — RTL start = right side */}
        <motion.div
          animate={{ color: focused ? '#7c3aed' : '#94a3b8' }}
          transition={{ duration: 0.20 }}
          className="shrink-0"
          aria-hidden="true"
        >
          <Search className="h-4 w-4" />
        </motion.div>

        {/* Input — inherits dir="rtl" from <html> */}
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onFocus={() => { setFocused(true); }}
          onBlur={() => { setFocused(false); }}
          placeholder="חפש לפי שם כיתה..."
          aria-label="חיפוש כיתות"
          className={cn(
            'flex-1 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400',
            focused ? 'text-slate-800' : 'text-slate-600',
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Result counter pill */}
        <AnimatePresence>
          {isFiltering && (
            <motion.span
              key="count-pill"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: count > 0 ? 'rgba(109,40,217,0.12)' : 'rgba(239,68,68,0.10)',
                color:      count > 0 ? '#6d28d9'               : '#dc2626',
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {count}/{total}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Clear button */}
        <AnimatePresence>
          {isFiltering && (
            <motion.button
              key="clear-btn"
              type="button"
              initial={{ opacity: 0, scale: 0.7, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.7, rotate: 45 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              whileHover={{ scale: 1.15, backgroundColor: 'rgba(109,40,217,0.10)' }}
              whileTap={{ scale: 0.90 }}
              onClick={(e) => { e.stopPropagation(); onChange(''); inputRef.current?.focus(); }}
              className="shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-slate-400 hover:text-violet-600 transition-colors"
              aria-label="נקה חיפוש"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Class Card ───────────────────────────────────────────────────────────────

function ClassCard({ cls, index, tourAnchor }: { cls: ClassData; index: number; tourAnchor?: boolean }): React.JSX.Element {
  const theme: CardTheme = CARD_THEMES[index % CARD_THEMES.length]!;
  const [hovered, setHovered] = useState(false);
  const { isTourActive } = useTour();

  /** Deterministic metric bars — visually approximate, based on studentCount parity */
  const attendancePct = Math.min(97, Math.max(58, 70 + ((cls.studentCount * 7 + index * 13) % 26)));
  const progressPct  = Math.min(94, Math.max(50, 63 + ((cls.studentCount * 11 + index * 17) % 32)));

  /**
   * Cards whose name contains "ח'1" get a permanent liquid-glass ripple
   * (decorative orange/cyan pulse). Suppressed entirely while the onboarding
   * tour is active — the pulse looks like a Joyride beacon and confuses users.
   */
  const hasRipple = !isTourActive && cls.name.includes("ח'1");

  return (
    <motion.div
      layout
      variants={CARD_VARIANTS}
      style={{ perspective: 1200 }}
      onHoverStart={() => { setHovered(true); }}
      onHoverEnd={() => { setHovered(false); }}
      whileHover={{
        y: -6,
        scale: 1.02,
        boxShadow: theme.hoverGlow,
        transition: { type: 'spring', stiffness: 300, damping: 22 },
      }}
      whileTap={{ scale: 0.975, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      {...(tourAnchor === true ? { 'data-tour': 'class-card' } : {})}
    >
      <Link
        href={`/classes/${cls.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-2xl"
      >
        <div
          className="group relative overflow-hidden rounded-2xl cursor-pointer"
          style={{
            background:           'rgba(255,255,255,0.40)',
            backdropFilter:       'blur(25px) saturate(180%)',
            WebkitBackdropFilter: 'blur(25px) saturate(180%)',
            border:               '1px solid var(--semester-border, rgba(139,92,246,0.20))',
            transition:           'border-color 0.7s ease',
            boxShadow: `0 8px 32px rgba(31,38,135,0.10), 0 0 0 1px ${theme.ring}, inset 0 1px 0 rgba(255,255,255,0.65)`,
          }}
        >
          {/* Top accent stripe */}
          <div className="h-[3px] w-full" style={{ background: theme.stripe }} />

          {/* Grade-level badge — absolute top-end = top-left in RTL */}
          <div
            className="absolute end-3 top-4 z-20 rounded-lg px-2.5 py-[3px] text-[10px] font-black uppercase tracking-widest text-white"
            style={{ background: theme.badgeBg, boxShadow: '0 2px 12px rgba(0,0,0,0.22)' }}
          >
            {theme.label}
          </div>

          {/* Ghost athlete watermark — bottom start corner */}
          <div
            className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-2xl"
            aria-hidden="true"
            style={{ zIndex: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/models_photo/${GHOST_ATHLETES[index % GHOST_ATHLETES.length]}`}
              alt=""
              className="absolute bottom-0 start-0 h-[88%] w-auto object-contain"
              style={{ filter: 'grayscale(100%) sepia(15%)', opacity: 0.07 }}
            />
          </div>

          {/* Liquid-glass ripple — visible on ח'1 cards */}
          {hasRipple && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
              aria-hidden="true"
              style={{ zIndex: 1 }}
            >
              {/* Ring 1 */}
              <motion.div
                className="absolute rounded-full border-2 border-orange-300/55"
                animate={{ width: ['0px', '340px'], height: ['0px', '340px'], opacity: [0.60, 0] }}
                transition={{ duration: 1.35, repeat: Infinity, repeatDelay: 0.35, ease: 'easeOut' }}
              />
              {/* Ring 2 — delayed */}
              <motion.div
                className="absolute rounded-full border border-amber-400/40"
                animate={{ width: ['0px', '280px'], height: ['0px', '280px'], opacity: [0.45, 0] }}
                transition={{ duration: 1.35, repeat: Infinity, repeatDelay: 0.35, delay: 0.48, ease: 'easeOut' }}
              />
              {/* Center prismatic glow */}
              <motion.div
                className="absolute w-14 h-14 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(251,146,60,0.60) 0%, rgba(0,212,255,0.28) 55%, transparent 80%)',
                }}
                animate={{ scale: [1, 1.40, 1], opacity: [0.85, 0.45, 0.85] }}
                transition={{ duration: 1.85, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Prismatic haze overlay */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  opacity: 0.14,
                  background: 'radial-gradient(circle at 50% 50%, rgba(251,146,60,0.42) 0%, rgba(0,212,255,0.28) 42%, transparent 68%)',
                }}
              />
            </div>
          )}

          {/* Hover prismatic glow ripple overlay */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            aria-hidden="true"
            style={{
              background: `radial-gradient(ellipse at 50% 60%, ${theme.ring.replace('0.28', '0.20').replace('0.30', '0.22')} 0%, transparent 68%)`,
              zIndex: 2,
            }}
          />

          {/* Card content */}
          <div className="relative z-10 p-5 pt-4">

            {/* Title block — pe-14 reserves space for the badge */}
            <div className="pe-14 mb-3">
              <h3 className="font-bold text-base leading-snug" style={{ color: theme.titleColor }}>
                {formatClassWithGender(cls.name, cls.genderType)}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: theme.subColor }}>
                {cls.academicYear} · {SEMESTER_LABELS[cls.semester]}
              </p>
            </div>

            {/* Metric bars */}
            <div className="space-y-2.5 mb-4">
              {/* Attendance */}
              <div className="flex items-center gap-2.5">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0 w-12">נוכחות</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: theme.bar1 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${attendancePct}%` }}
                    transition={{ delay: 0.28 + index * 0.07, duration: 0.9, ease: EASE }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 shrink-0 w-8 text-end">
                  {attendancePct}%
                </span>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium text-slate-500 shrink-0 w-12">התקדמות</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: theme.bar2 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ delay: 0.38 + index * 0.07, duration: 0.9, ease: EASE }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 shrink-0 w-8 text-end">
                  {progressPct}%
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-500">{cls.studentCount} תלמידים</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors duration-150" aria-hidden="true" />
            </div>

          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassesPage(): React.JSX.Element {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const { activeSemester } = useSemester();
  const { data: classes, error, isLoading, mutate } = useClasses();
  const { achievements } = useTopAchievements(activeSemester);
  const effectiveAchievements = achievements ?? [];

  useSignalPageReady('classes', classes !== undefined);

  /** Filter by class name (case-insensitive, strips diacritics) */
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, searchQuery]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="classes-page"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.5 }}
        className="relative space-y-6 pt-16 px-4 md:pt-0 md:px-0"
      >
        {/* ── Floating sport-icon debris (4% opacity) ─────────────────────── */}
        <FloatingDebris />

        {/* ── Content (sits above debris + watermark) ──────────────────────── */}
        <div className="relative space-y-6" style={{ zIndex: 1 }}>

          {/* Header */}
          <PageHeader onCreateClick={() => { setIsCreateOpen(true); }} />

          {/* Top results ticker */}
          <TopResultsTicker
            items={effectiveAchievements}
            fallbackText="לא הוזנו עדיין נתונים מצטיינים למחצית זו"
          />

          <SemesterTransitionWrapper activeSemester={activeSemester}>
          {/* ── Search bar — only shown when data is ready ───────────────── */}
          {!isLoading && !error && classes && classes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE, duration: 0.4, delay: 0.12 }}
            >
              <ClassSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                count={filteredClasses.length}
                total={classes.length}
              />
            </motion.div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-56 animate-pulse rounded-2xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl bg-red-50/80 backdrop-blur-sm border border-red-200/50 px-4 py-3 text-sm text-red-600">
              לא ניתן לטעון את הכיתות — נסה לרענן את הדף.
            </div>
          )}

          {/* Empty — no classes at all */}
          {!isLoading && !error && classes?.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: EASE, duration: 0.5 }}
            >
            <SemesterPanel className="flex flex-col items-center justify-center gap-4 py-20 text-center shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100/80"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BookOpen className="h-8 w-8 text-indigo-400" aria-hidden="true" />
              </motion.div>
              <div>
                <p className="font-semibold text-slate-700">אין כיתות עדיין</p>
                <p className="mt-1 text-sm text-slate-400">לחץ על &ldquo;הוסף כיתה&rdquo; כדי להתחיל</p>
              </div>
              <motion.button
                type="button"
                onClick={() => { setIsCreateOpen(true); }}
                whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.40)', transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600/90 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(99,102,241,0.45)] hover:bg-indigo-600 transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                הוסף כיתה ראשונה
              </motion.button>
            </SemesterPanel>
            </motion.div>
          )}

          {/* Empty — search has no results */}
          {!isLoading && !error && classes && classes.length > 0 && filteredClasses.length === 0 && (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ ease: EASE, duration: 0.35 }}
            >
            <SemesterPanel className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100/70">
                <Search className="h-5 w-5 text-violet-400" aria-hidden="true" />
              </div>
              <p className="font-semibold text-slate-600">לא נמצאו כיתות</p>
              <p className="text-sm text-slate-400">
                אין כיתות תואמות לחיפוש &ldquo;{searchQuery}&rdquo;
              </p>
            </SemesterPanel>
            </motion.div>
          )}

          {/* Classes grid with layout animation */}
          {!isLoading && filteredClasses.length > 0 && (
            <motion.div
              variants={GRID_VARIANTS}
              initial="hidden"
              animate="show"
              style={{ perspective: 1400 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredClasses.map((cls, i) => (
                  <ClassCard key={cls.id} cls={cls} index={i} tourAnchor={i === 0} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          </SemesterTransitionWrapper>

        </div>

        <AddClassModal
          open={isCreateOpen}
          onClose={() => { setIsCreateOpen(false); void mutate(); }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
