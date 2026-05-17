'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BackButton } from '@/components/ui/back-button';
import { ChevronDown, Crown, Medal, Trophy, Users } from 'lucide-react';
import { GlowingSearch } from '@/components/ui/glowing-search';
import Link from 'next/link';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { TopStudentItem } from '@fitgrade/types';
import { useTopStudents, useTopStudentsByTest } from '@/hooks/use-top-students';
import { useClasses } from '@/hooks/use-classes';
import { useTestTypes } from '@/hooks/use-test-types';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

// Hebrew grade prefixes used in Israeli school class names (ז'1, ח'2, etc.)
const GRADE_PREFIXES = ["יב'", "יא'", "י'", "ט'", "ח'", "ז'"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tries to extract the Hebrew grade prefix from a class name. */
function extractGrade(className: string): string | null {
  for (const prefix of GRADE_PREFIXES) {
    if (className.startsWith(prefix)) return prefix;
  }
  return null;
}

/** Unique sorted grades present in a student list. */
function uniqueGrades(students: TopStudentItem[]): string[] {
  const seen = new Set<string>();
  for (const s of students) {
    const g = extractGrade(s.className);
    if (g) seen.add(g);
  }
  // Return in natural school order
  return GRADE_PREFIXES.filter((p) => seen.has(p));
}

// ─── Animation variants ───────────────────────────────────────────────────────

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE, duration: 0.55, staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.45 } },
};

// ─── Podium glass config ──────────────────────────────────────────────────────

interface PodiumGlass {
  rank:       1 | 2 | 3;
  emoji:      string;
  bg:         string;
  border:     string;
  shadow:     string;
  avatarBg:   string;
  avatarText: string;
  nameColor:  string;
  scoreColor: string;
  badgeBg:    string;
  badgeText:  string;
  heightClass: string;
}

const PODIUM_GLASS: [PodiumGlass, PodiumGlass, PodiumGlass] = [
  {
    rank: 1,
    emoji: '🥇',
    bg:         'rgba(255,248,220,0.55)',
    border:     'rgba(251,191,36,0.55)',
    shadow:     '0 0 0 1px rgba(251,191,36,0.25), 0 12px 48px rgba(251,191,36,0.40), inset 0 1px 0 rgba(255,255,255,0.75)',
    avatarBg:   'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)',
    avatarText: '#78350f',
    nameColor:  '#78350f',
    scoreColor: '#b45309',
    badgeBg:    'rgba(251,191,36,0.20)',
    badgeText:  '#92400e',
    heightClass: 'min-h-[220px]',
  },
  {
    rank: 2,
    emoji: '🥈',
    bg:         'rgba(248,250,252,0.50)',
    border:     'rgba(148,163,184,0.45)',
    shadow:     '0 0 0 1px rgba(148,163,184,0.20), 0 8px 32px rgba(148,163,184,0.28), inset 0 1px 0 rgba(255,255,255,0.70)',
    avatarBg:   'linear-gradient(135deg,#94a3b8 0%,#64748b 100%)',
    avatarText: '#f8fafc',
    nameColor:  '#1e293b',
    scoreColor: '#475569',
    badgeBg:    'rgba(148,163,184,0.15)',
    badgeText:  '#475569',
    heightClass: 'min-h-[190px]',
  },
  {
    rank: 3,
    emoji: '🥉',
    bg:         'rgba(255,247,237,0.50)',
    border:     'rgba(180,83,9,0.40)',
    shadow:     '0 0 0 1px rgba(180,83,9,0.15), 0 8px 28px rgba(180,83,9,0.22), inset 0 1px 0 rgba(255,255,255,0.70)',
    avatarBg:   'linear-gradient(135deg,#fb923c 0%,#ea580c 100%)',
    avatarText: '#fff7ed',
    nameColor:  '#7c2d12',
    scoreColor: '#9a3412',
    badgeBg:    'rgba(180,83,9,0.12)',
    badgeText:  '#7c2d12',
    heightClass: 'min-h-[190px]',
  },
];

// ─── Podium Card ──────────────────────────────────────────────────────────────

interface PodiumCardProps {
  cfg:         PodiumGlass;
  studentName: string;
  className:   string;
  avgGrade:    number;
  resultCount: number;
  classId:     string;
  compact?:    boolean;
}

function PodiumCard({
  cfg, studentName, className, avgGrade, resultCount, classId, compact = false,
}: PodiumCardProps): React.JSX.Element {
  const initials = studentName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2);

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -8, scale: 1.04, transition: { type: 'spring', stiffness: 380, damping: 26 } }}
      whileTap={{ scale: 0.96 }}
      className={cn(
        'relative flex flex-col items-center gap-2.5 rounded-3xl p-4 overflow-hidden',
        cfg.heightClass,
        compact && 'min-h-0 p-3 gap-1.5 rounded-2xl',
      )}
      style={{
        background:           cfg.bg,
        backdropFilter:       'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:               `1px solid ${cfg.border}`,
        boxShadow:            cfg.shadow,
      }}
    >
      {/* Shimmer top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9), transparent)' }}
        aria-hidden="true"
      />

      {/* Medal emoji */}
      <motion.span
        className={cn('leading-none select-none', compact ? 'text-2xl' : 'text-4xl')}
        animate={{ scale: [1, 1.14, 1], rotate: [0, -5, 5, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-label={`מדליה מקום ${cfg.rank}`}
      >
        {cfg.emoji}
      </motion.span>

      {/* Avatar */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full font-extrabold shadow-md',
          compact ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-lg',
        )}
        style={{ background: cfg.avatarBg, color: cfg.avatarText }}
      >
        {initials}
      </div>

      {/* Name + class */}
      <div className="text-center min-w-0 w-full">
        <p
          className={cn('font-extrabold leading-tight truncate', compact ? 'text-[11px]' : 'text-sm')}
          style={{ color: cfg.nameColor }}
        >
          {studentName}
        </p>
        <Link
          href={`/classes/${classId}`}
          className="text-xs text-slate-500 hover:text-indigo-600 hover:underline underline-offset-2 transition-colors truncate block"
        >
          {className}
        </Link>
      </div>

      {/* Score */}
      <div className="text-center">
        <p
          className={cn('font-black tabular-nums leading-none', compact ? 'text-2xl' : 'text-3xl')}
          style={{ color: cfg.scoreColor }}
        >
          {avgGrade}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
          {getHebrewGradeLabel(avgGrade)}
        </p>
      </div>

      {/* Result count badge */}
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
          compact && 'hidden',
        )}
        style={{ background: cfg.badgeBg, color: cfg.badgeText, border: `1px solid ${cfg.border}` }}
      >
        {resultCount} מבחנים
      </span>
    </motion.div>
  );
}

// ─── Rank Row (4th+) ──────────────────────────────────────────────────────────

interface RankRowProps {
  rank:        number;
  studentName: string;
  className:   string;
  avgGrade:    number;
  resultCount: number;
  classId:     string;
  index:       number;
}

function RankRow({
  rank, studentName, className, avgGrade, resultCount, classId, index,
}: RankRowProps): React.JSX.Element {
  const gradeStyle =
    avgGrade >= 90 ? { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)', text: '#065f46' } :
    avgGrade >= 75 ? { bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.28)', text: '#3730a3' } :
    avgGrade >= 60 ? { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', text: '#92400e' } :
                     { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  text: '#991b1b' };

  const initials = studentName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2);

  return (
    <motion.div
      key={`${rank}-${studentName}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8, scale: 0.97 }}
      transition={{ ease: EASE, duration: 0.38, delay: Math.min(index * 0.045, 0.36) }}
      whileHover={{
        x: -3, scale: 1.01,
        boxShadow: '0 8px 28px rgba(15,23,42,0.12)',
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3 overflow-hidden"
      style={{
        background:           'rgba(255,255,255,0.60)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border:               '1px solid rgba(255,255,255,0.75)',
        boxShadow:            '0 2px 12px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.80)',
      }}
    >
      <span className="w-7 shrink-0 text-center text-sm font-extrabold text-slate-400 tabular-nums">
        {rank}
      </span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{studentName}</p>
        <Link
          href={`/classes/${classId}`}
          className="block truncate text-xs text-slate-500 hover:text-indigo-600 hover:underline underline-offset-2 transition-colors"
        >
          {className}
        </Link>
      </div>
      <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{resultCount} מבחנים</span>
      <span
        className="shrink-0 rounded-xl px-2.5 py-1 text-sm font-extrabold"
        style={{ background: gradeStyle.bg, border: `1px solid ${gradeStyle.border}`, color: gradeStyle.text }}
      >
        {getHebrewGradeLabel(avgGrade)}
      </span>
    </motion.div>
  );
}

// ─── Gender Mini-Podium ───────────────────────────────────────────────────────

interface GenderPodiumProps {
  title:        string;
  emoji:        string;
  students:     TopStudentItem[];
  accentBg:     string;
  accentBorder: string;
  accentText:   string;
}

function GenderPodium({
  title, emoji, students, accentBg, accentBorder, accentText,
}: GenderPodiumProps): React.JSX.Element {
  const top3        = students.slice(0, 3);
  const podiumOrder = [1, 0, 2] as const;

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
      className={cn('flex-1 min-w-0 rounded-3xl border p-4', accentBg, accentBorder)}
      style={{
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:            '0 8px 30px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.60)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">{emoji}</span>
        <h3 className={cn('text-sm font-extrabold', accentText)}>{title}</h3>
      </div>

      {top3.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">אין נתונים</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 items-end">
          {podiumOrder.map((idx) => {
            const student = top3[idx];
            if (!student) return <div key={idx} />;
            const cfg = PODIUM_GLASS[idx]!;
            return (
              <PodiumCard
                key={student.studentId}
                cfg={cfg}
                studentName={student.studentName}
                className={student.className}
                avgGrade={student.avgGrade}
                resultCount={student.resultCount}
                classId={student.classId}
                compact
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────

interface FilterPillsProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value:   T;
  onChange: (v: T) => void;
}

function FilterPills<T extends string>({ options, value, onChange }: FilterPillsProps<T>): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150',
              active
                ? 'bg-indigo-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.40)]'
                : 'bg-white/60 text-slate-600 hover:bg-white/80',
            )}
            style={active ? undefined : {
              border:               '1px solid rgba(255,255,255,0.70)',
              backdropFilter:       'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 pt-16 px-4 md:pt-0 md:px-0">
      <div className="h-7 w-56 animate-pulse rounded-xl bg-white/60" />
      <div className="flex gap-4">
        <div className="h-56 flex-1 animate-pulse rounded-3xl bg-white/60" />
        <div className="h-56 flex-1 animate-pulse rounded-3xl bg-white/60" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-56 animate-pulse rounded-3xl bg-white/60" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-2xl bg-white/60" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type GenderFilter = 'all' | 'MALE' | 'FEMALE';

const GENDER_OPTIONS: Array<{ value: GenderFilter; label: string }> = [
  { value: 'all',    label: 'כולם'  },
  { value: 'MALE',   label: 'בנים'  },
  { value: 'FEMALE', label: 'בנות'  },
];

export default function OutstandingStudentsPage(): React.JSX.Element {
  const [search,         setSearch]         = useState('');
  const [classFilter,    setClassFilter]     = useState<string>('all');
  const [gradeFilter,    setGradeFilter]     = useState<string>('all');
  const [genderFilter,   setGenderFilter]    = useState<GenderFilter>('all');
  const [selectedTestId, setSelectedTestId]  = useState<string>('');
  const [testDropOpen,   setTestDropOpen]    = useState(false);

  const { activeSemester }                                         = useSemester();
  const { data: topStudents,  isLoading: topLoading }              = useTopStudents(activeSemester);
  const { data: testStudents, isLoading: testLoading }             = useTopStudentsByTest(selectedTestId || null, activeSemester);
  const { data: classes }                                          = useClasses();
  const { data: testTypes }                                        = useTestTypes();

  const isLoading = topLoading || (!!selectedTestId && testLoading);

  // Unique grade levels present in the full dataset (for filter pills)
  const gradeOptions = useMemo(() => {
    const base = topStudents ?? [];
    const grades = uniqueGrades(base);
    return [
      { value: 'all', label: 'כל השכבות' },
      ...grades.map((g) => ({ value: g, label: `שכבת ${g}` })),
    ];
  }, [topStudents]);

  const displayStudents = (selectedTestId ? testStudents : topStudents) ?? [];

  // Apply all four filters
  const filtered = useMemo(() => {
    return displayStudents.filter((s) => {
      if (classFilter  !== 'all' && s.classId !== classFilter)                      return false;
      if (genderFilter !== 'all' && s.gender  !== genderFilter)                     return false;
      if (gradeFilter  !== 'all' && extractGrade(s.className) !== gradeFilter)      return false;
      if (search       !== ''    && !s.studentName.includes(search))               return false;
      return true;
    });
  }, [displayStudents, classFilter, genderFilter, gradeFilter, search]);

  // Changing any filter re-keys the list → AnimatePresence replays entry animations
  const filterKey = `${classFilter}|${genderFilter}|${gradeFilter}|${selectedTestId}|${search}`;

  if (isLoading && !topStudents) return <PageSkeleton />;

  const top3    = filtered.slice(0, 3);
  const rest    = filtered.slice(3);
  const hasData = filtered.length > 0;

  const allStudents  = topStudents ?? [];
  const maleTop      = allStudents.filter((s) => s.gender === 'MALE').slice(0, 3);
  const femaleTop    = allStudents.filter((s) => s.gender === 'FEMALE').slice(0, 3);
  const podiumOrder  = [1, 0, 2] as const;
  const selectedTestName = testTypes?.find((t) => t.id === selectedTestId)?.nameHe;

  return (
    <>
      <BackButton />
      <AnimatePresence mode="wait">
      <motion.div
        key="outstanding"
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        // pt-16 on mobile clears the fixed hamburger (44px at top:14px).
        // px-4 adds side margin the layout doesn't provide on mobile.
        className="space-y-7 pt-16 px-4 pb-8 md:pt-0 md:px-0 md:pb-0"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <motion.div variants={ITEM} className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <h1 className="bg-gradient-to-l from-amber-600 via-orange-500 to-amber-700 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                תלמידים מצטיינים
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              לוח מצטיינים לפי ממוצע ציוני כושר גופני — כלל הכיתות
            </p>
          </div>
        </motion.div>

        <SemesterTransitionWrapper activeSemester={activeSemester}>

          {/* ── Gender MVP mini-podiums ───────────────────────────────── */}
          {!selectedTestId && (maleTop.length > 0 || femaleTop.length > 0) && (
            <motion.div variants={ITEM}>
              <div className="mb-4 flex items-center gap-2">
                <Crown className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-700">מצטייני בית הספר</h2>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                  לפי מגדר
                </span>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <GenderPodium
                  title="בנים — מצטיינים"
                  emoji="🏅"
                  students={maleTop}
                  accentBg="bg-gradient-to-br from-blue-50/80 to-indigo-50/80"
                  accentBorder="border-blue-200/70"
                  accentText="text-blue-800"
                />
                <GenderPodium
                  title="בנות — מצטיינות"
                  emoji="🏅"
                  students={femaleTop}
                  accentBg="bg-gradient-to-br from-pink-50/80 to-rose-50/80"
                  accentBorder="border-pink-200/70"
                  accentText="text-pink-800"
                />
              </div>
            </motion.div>
          )}

          {/* ── Filters ──────────────────────────────────────────────── */}
          <motion.div variants={ITEM} className="flex flex-col gap-3">
            {/* Row 1: search + test picker */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <GlowingSearch
                value={search}
                onChange={setSearch}
                placeholder="חיפוש לפי שם..."
                aria-label="חיפוש תלמיד לפי שם"
                className="w-full sm:max-w-xs"
              />

              {/* Test type dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTestDropOpen((o) => !o)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all backdrop-blur-sm',
                    selectedTestId
                      ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-[0_2px_12px_rgba(139,92,246,0.20)]'
                      : 'border-white/70 bg-white/60 text-slate-600 hover:bg-white/80',
                  )}
                  aria-expanded={testDropOpen}
                  aria-haspopup="listbox"
                  aria-label="סינון לפי מבחן"
                >
                  <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  {selectedTestId ? (selectedTestName ?? 'מבחן נבחר') : 'כל המבחנים'}
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform duration-200', testDropOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {testDropOpen && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
                      animate={{ opacity: 1, y: 0, scaleY: 1 }}
                      exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
                      transition={{ ease: EASE, duration: 0.18 }}
                      className="absolute start-0 top-full z-30 mt-1 w-60 origin-top overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                      role="listbox"
                    >
                      <li>
                        <button
                          type="button"
                          role="option"
                          aria-selected={!selectedTestId}
                          onClick={() => { setSelectedTestId(''); setTestDropOpen(false); }}
                          className={cn(
                            'w-full px-4 py-2.5 text-start text-sm font-semibold transition-colors hover:bg-indigo-50',
                            !selectedTestId && 'bg-indigo-50 text-indigo-700',
                          )}
                        >
                          כל המבחנים (ממוצע כללי)
                        </button>
                      </li>
                      {(testTypes ?? []).map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedTestId === t.id}
                            onClick={() => { setSelectedTestId(t.id); setTestDropOpen(false); }}
                            className={cn(
                              'w-full px-4 py-2 text-start text-sm transition-colors hover:bg-indigo-50',
                              selectedTestId === t.id && 'bg-indigo-50 font-semibold text-indigo-700',
                            )}
                          >
                            {t.nameHe}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Row 2: class filter */}
            <div role="group" aria-label="סינון לפי כיתה">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                כיתה
              </p>
              <FilterPills
                options={[
                  { value: 'all', label: 'כל הכיתות' },
                  ...(classes ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={classFilter}
                onChange={setClassFilter}
              />
            </div>

            {/* Row 3: grade level filter (parsed from class names) */}
            {gradeOptions.length > 1 && (
              <div role="group" aria-label="סינון לפי שכבה">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  שכבה
                </p>
                <FilterPills
                  options={gradeOptions}
                  value={gradeFilter}
                  onChange={setGradeFilter}
                />
              </div>
            )}

            {/* Row 4: gender filter */}
            <div role="group" aria-label="סינון לפי מגדר">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                מגדר
              </p>
              <FilterPills
                options={GENDER_OPTIONS}
                value={genderFilter}
                onChange={setGenderFilter}
              />
            </div>
          </motion.div>

          {/* ── Active test type banner ───────────────────────────────── */}
          {selectedTestId && (
            <motion.div
              variants={ITEM}
              className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-violet-600" aria-hidden="true" />
                <span className="text-sm font-bold text-violet-800">
                  מציג מצטיינים עבור: {selectedTestName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTestId('')}
                className="text-xs font-semibold text-violet-600 underline underline-offset-2 transition-colors hover:text-violet-800"
              >
                הצג ממוצע כללי
              </button>
            </motion.div>
          )}

          {/* ── Empty state ──────────────────────────────────────────── */}
          {!hasData && (
            <motion.div
              variants={ITEM}
              className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 py-20 text-center"
              style={{
                background:           'rgba(255,255,255,0.50)',
                backdropFilter:       'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <Medal className="h-10 w-10 text-slate-200" aria-hidden="true" />
              {search === '' && classFilter === 'all' && genderFilter === 'all' && gradeFilter === 'all' && !selectedTestId ? (
                <>
                  <p className="font-semibold text-slate-500">
                    {`אין עדיין תוצאות למחצית ${activeSemester === 'A' ? 'א׳' : 'ב׳'}`}
                  </p>
                  <p className="text-sm text-slate-400">הדירוג יתעדכן לאחר רישום תוצאות מבחן</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-500">אין תלמידים להצגה</p>
                  <p className="text-sm text-slate-400">נסה לשנות את הסינון</p>
                </>
              )}
            </motion.div>
          )}

          {/* ── Main podium — top 3 ───────────────────────────────────── */}
          {hasData && top3.length > 0 && (
            <motion.div variants={ITEM}>
              <div className="mb-4 flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-700">
                  {selectedTestId
                    ? `מקומות ראשונים — ${selectedTestName}`
                    : 'מקומות ראשונים (ממוצע כללי)'}
                </h2>
              </div>

              {/* Podium layout: 2nd | 1st (tallest) | 3rd */}
              <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
                {podiumOrder.map((idx) => {
                  const student = top3[idx];
                  if (!student) return null;
                  const cfg = PODIUM_GLASS[idx]!;
                  return (
                    <PodiumCard
                      key={student.studentId}
                      cfg={cfg}
                      studentName={student.studentName}
                      className={student.className}
                      avgGrade={student.avgGrade}
                      resultCount={student.resultCount}
                      classId={student.classId}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Ranked list (4th+) — re-animates on every filter change ─ */}
          {hasData && rest.length > 0 && (
            <motion.div variants={ITEM}>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-700">דירוג מורחב</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-500"
                  style={{
                    background:           'rgba(255,255,255,0.60)',
                    border:               '1px solid rgba(255,255,255,0.70)',
                    backdropFilter:       'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  {rest.length} תלמידים
                </span>
              </div>

              <AnimatePresence mode="popLayout" key={filterKey}>
                <div className="space-y-2">
                  {rest.map((student, i) => (
                    <RankRow
                      key={student.studentId}
                      rank={student.rank}
                      studentName={student.studentName}
                      className={student.className}
                      avgGrade={student.avgGrade}
                      resultCount={student.resultCount}
                      classId={student.classId}
                      index={i}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Footer ───────────────────────────────────────────────── */}
          {hasData && (
            <motion.p variants={ITEM} className="pb-2 text-center text-xs text-slate-400">
              מציג {filtered.length} מתוך {displayStudents.length} תלמידים
              {' · '}
              {selectedTestId
                ? `מדורג לפי ציון — ${selectedTestName}`
                : 'מדורג לפי ממוצע ציוני כושר'}
            </motion.p>
          )}

        </SemesterTransitionWrapper>
      </motion.div>
    </AnimatePresence>
    </>
  );
}
