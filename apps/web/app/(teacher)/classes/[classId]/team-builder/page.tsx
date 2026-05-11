'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  ChevronRight,
  Cpu,
  Dumbbell,
  Loader2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useStudents, useClassDetails, useClass } from '@/hooks/use-classes';
import { useSemester } from '@/contexts/semester-context';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { ClassDetails, StudentData } from '@fitgrade/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE, duration: 0.6, staggerChildren: 0.09 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.5 } },
};

/** Prismatic per-team color themes — distinctly different, zero purple monotony. */
const TEAM_PALETTE = [
  {
    // Team א — Emerald / Teal
    headerGradient: 'from-emerald-500 to-teal-600',
    cardBg:         'bg-gradient-to-b from-emerald-50 to-teal-50',
    border:         'border-teal-200/70',
    divider:        'divide-teal-100',
    rosterHover:    'hover:bg-teal-50',
    pillBg:         'bg-teal-100',
    pillText:       'text-teal-800',
    glow:           'rgba(20,184,166,0.40)',
    labelGlow:      'shadow-[0_0_20px_rgba(20,184,166,0.60)]',
  },
  {
    // Team ב — Orange / Amber
    headerGradient: 'from-orange-400 to-amber-500',
    cardBg:         'bg-gradient-to-b from-orange-50 to-amber-50',
    border:         'border-orange-200/70',
    divider:        'divide-orange-100',
    rosterHover:    'hover:bg-amber-50',
    pillBg:         'bg-amber-100',
    pillText:       'text-orange-800',
    glow:           'rgba(251,146,60,0.40)',
    labelGlow:      'shadow-[0_0_20px_rgba(251,146,60,0.60)]',
  },
  {
    // Team ג — Rose / Pink
    headerGradient: 'from-rose-500 to-pink-600',
    cardBg:         'bg-gradient-to-b from-rose-50 to-pink-50',
    border:         'border-rose-200/70',
    divider:        'divide-rose-100',
    rosterHover:    'hover:bg-rose-50',
    pillBg:         'bg-pink-100',
    pillText:       'text-rose-800',
    glow:           'rgba(244,63,94,0.40)',
    labelGlow:      'shadow-[0_0_20px_rgba(244,63,94,0.60)]',
  },
  {
    // Team ד — Blue / Cyan
    headerGradient: 'from-blue-500 to-cyan-600',
    cardBg:         'bg-gradient-to-b from-blue-50 to-cyan-50',
    border:         'border-blue-200/70',
    divider:        'divide-blue-100',
    rosterHover:    'hover:bg-cyan-50',
    pillBg:         'bg-cyan-100',
    pillText:       'text-blue-800',
    glow:           'rgba(59,130,246,0.40)',
    labelGlow:      'shadow-[0_0_20px_rgba(59,130,246,0.60)]',
  },
  {
    // Team ה — Violet / Purple (only one that gets purple)
    headerGradient: 'from-violet-500 to-purple-600',
    cardBg:         'bg-gradient-to-b from-violet-50 to-purple-50',
    border:         'border-violet-200/70',
    divider:        'divide-violet-100',
    rosterHover:    'hover:bg-violet-50',
    pillBg:         'bg-violet-100',
    pillText:       'text-violet-800',
    glow:           'rgba(139,92,246,0.40)',
    labelGlow:      'shadow-[0_0_20px_rgba(139,92,246,0.60)]',
  },
] as const;

const TEAM_COUNT_OPTIONS = [2, 3, 4, 5] as const;
type TeamCount = (typeof TEAM_COUNT_OPTIONS)[number];

type Metric = 'FITNESS' | 'RANDOM';

const METRIC_OPTIONS: { value: Metric; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'FITNESS', label: 'לפי כושר',   icon: Dumbbell, desc: 'מאוזן לפי ממוצע ציוני כושר' },
  { value: 'RANDOM',  label: 'אקראי',       icon: Shuffle,  desc: 'חלוקה אקראית מלאה' },
];

/** Hebrew ordinal labels for teams. */
const TEAM_ORDINALS = ['א', 'ב', 'ג', 'ד', 'ה'];

// ─── Algorithm ────────────────────────────────────────────────────────────────

interface TeamStudent {
  id: string;
  firstName: string;
  lastName: string;
  fitnessAvg: number;
}

interface Team {
  label: string;
  students: TeamStudent[];
  teamAvg: number;
}

/** Compute per-student fitness average from class-level test summaries. */
function buildFitnessMap(details: ClassDetails): Map<string, number> {
  const totals  = new Map<string, number>();
  const counts  = new Map<string, number>();

  for (const summary of details.testSummaries) {
    for (const sg of summary.studentGrades) {
      totals.set(sg.studentId, (totals.get(sg.studentId) ?? 0) + sg.effectiveGrade);
      counts.set(sg.studentId, (counts.get(sg.studentId) ?? 0) + 1);
    }
  }

  const result = new Map<string, number>();
  for (const [id, total] of totals.entries()) {
    result.set(id, Math.round(total / (counts.get(id) ?? 1)));
  }
  return result;
}

/**
 * Snake-draft team builder.
 *
 * Sorts students by fitness (descending) then distributes using a zig-zag
 * snake draft so that top and bottom performers are spread evenly:
 *   Round 1 forward:  team 0, 1, 2 …
 *   Round 2 backward: … 2, 1, 0
 *   Round 3 forward again, etc.
 */
function buildTeams(pool: TeamStudent[], numTeams: number, metric: Metric): Team[] {
  const sorted =
    metric === 'FITNESS'
      ? [...pool].sort((a, b) => b.fitnessAvg - a.fitnessAvg)
      : [...pool].sort(() => Math.random() - 0.5);

  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    label: `קבוצה ${TEAM_ORDINALS[i] ?? String(i + 1)}`,
    students: [],
    teamAvg: 0,
  }));

  let idx = 0;
  let forward = true;

  while (idx < sorted.length) {
    const pass = forward
      ? Array.from({ length: numTeams }, (_, i) => i)
      : Array.from({ length: numTeams }, (_, i) => numTeams - 1 - i);

    for (const t of pass) {
      if (idx >= sorted.length) break;
      teams[t]!.students.push(sorted[idx]!);
      idx++;
    }
    forward = !forward;
  }

  for (const team of teams) {
    team.teamAvg =
      team.students.length === 0
        ? 0
        : Math.round(
            team.students.reduce((s, st) => s + st.fitnessAvg, 0) / team.students.length,
          );
  }

  return teams;
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

/** Semantic score coloring: vibrant green → sky → warm orange → rose. */
function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-500';
  if (score >= 70) return 'text-sky-500';
  if (score >= 55) return 'text-orange-500';
  return 'text-rose-500';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-5 w-40 rounded-lg bg-white/70" />
      <div className="h-40 rounded-3xl bg-white/60" />
      <div className="h-16 rounded-2xl bg-white/60" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-64 rounded-3xl bg-white/60" />
        ))}
      </div>
    </div>
  );
}

// ─── Calculating Animation ────────────────────────────────────────────────────

function CalculatingOverlay(): React.JSX.Element {
  const icons = [Brain, Cpu, Zap, Sparkles];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ ease: EASE, duration: 0.4 }}
      className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-violet-200/60 bg-white/60 py-16 shadow-xl shadow-purple-900/10 backdrop-blur-2xl"
    >
      {/* Spinning icon ring */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        {icons.map((Icon, i) => (
          <motion.div
            key={i}
            className="absolute"
            animate={{ rotate: [0, 360] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.6,
            }}
            style={{
              transformOrigin: '40px 0',
              top: '50%',
              marginTop: -10,
            }}
          >
            <Icon className="h-5 w-5 text-violet-500" aria-hidden="true" />
          </motion.div>
        ))}
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-8 w-8 text-violet-600" aria-hidden="true" />
        </motion.div>
      </div>

      <div className="text-center">
        <motion.p
          className="text-lg font-extrabold text-slate-800"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          מחשב קבוצות מאוזנות...
        </motion.p>
        <p className="mt-1 text-sm text-slate-500">אלגוריתם Snake Draft בפעולה</p>
      </div>
    </motion.div>
  );
}

// ─── Roster animations ────────────────────────────────────────────────────────

const ROSTER_CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const ROSTER_ITEM = {
  hidden: { opacity: 0, x: 12 },
  show:   { opacity: 1, x: 0, transition: { ease: EASE, duration: 0.3 } },
};

// ─── Team Card ────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team;
  index: number;
  metric: Metric;
}

function TeamCard({ team, index, metric }: TeamCardProps): React.JSX.Element {
  const palette = TEAM_PALETTE[index % TEAM_PALETTE.length]!;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ease: EASE, duration: 0.5, delay: index * 0.08 }}
      whileHover={{
        y: -6,
        boxShadow: `0 24px 56px ${palette.glow}`,
        transition: { type: 'spring', stiffness: 360, damping: 22 },
      }}
      className={cn(
        'overflow-hidden rounded-3xl border shadow-xl shadow-slate-900/8 backdrop-blur-sm',
        palette.cardBg,
        palette.border,
      )}
    >
      {/* Gradient header — each team's own vivid color */}
      <div className={cn('relative overflow-hidden bg-gradient-to-br px-5 py-4', palette.headerGradient)}>
        <div className="pointer-events-none absolute -end-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -start-4 -bottom-8 h-24 w-24 rounded-full bg-black/5" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">קבוצה</p>
            <h3 className="text-2xl font-extrabold text-white">{team.label}</h3>
            <p className="mt-0.5 text-xs text-white/70">{team.students.length} תלמידים</p>
          </div>

          {/* Team average pill */}
          <div className="text-center">
            {metric === 'FITNESS' ? (
              <div className={cn('rounded-2xl bg-white/20 px-3.5 py-2 backdrop-blur-sm', palette.labelGlow)}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">ממוצע כושר</p>
                <p className="text-2xl font-extrabold text-white tabular-nums">{team.teamAvg}</p>
                <p className="text-[10px] font-semibold text-white/70">{getHebrewGradeLabel(team.teamAvg)}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/20 px-3.5 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">קבוצה</p>
                <p className="text-2xl font-extrabold text-white">{index + 1}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Roster — staggered cascade animation */}
      <motion.ul
        variants={ROSTER_CONTAINER}
        initial="hidden"
        animate="show"
        className={cn('divide-y', palette.divider)}
      >
        {team.students.map((student, si) => (
          <motion.li
            key={student.id}
            variants={ROSTER_ITEM}
            whileHover={{ x: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex cursor-default items-center justify-between gap-3 px-5 py-2.5 transition-colors',
              palette.rosterHover,
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Rank circle */}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  palette.pillBg,
                  palette.pillText,
                )}
              >
                {si + 1}
              </div>
              <span className="truncate text-sm font-semibold text-slate-800">
                {student.firstName} {student.lastName}
              </span>
            </div>

            {/* Fitness score with semantic color */}
            {metric === 'FITNESS' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('text-sm font-extrabold tabular-nums', scoreColor(student.fitnessAvg))}>
                  {student.fitnessAvg}
                </span>
                <span className={cn('text-[10px] font-semibold', scoreColor(student.fitnessAvg))}>
                  {getHebrewGradeLabel(student.fitnessAvg)}
                </span>
              </div>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamBuilderPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const { activeSemester } = useSemester();

  const { data: cls }     = useClass(classId);
  const { data: students, isLoading: studentsLoading } = useStudents(classId);
  const { data: details, isLoading: detailsLoading }   = useClassDetails(classId, activeSemester);

  const isLoading = studentsLoading || detailsLoading;

  const [numTeams,    setNumTeams]    = useState<TeamCount>(2);
  const [metric,      setMetric]      = useState<Metric>('FITNESS');
  const [teams,       setTeams]       = useState<Team[] | null>(null);
  const [calculating, setCalculating] = useState(false);

  /** Fitness average per student, computed from class details. */
  const fitnessMap = useMemo<Map<string, number>>(
    () => (details ? buildFitnessMap(details) : new Map()),
    [details],
  );

  /** Combined student list enriched with fitnessAvg. */
  const enrichedStudents = useMemo<TeamStudent[]>(
    () =>
      (students ?? []).map((s: StudentData) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        fitnessAvg: fitnessMap.get(s.id) ?? 0,
      })),
    [students, fitnessMap],
  );

  function handleGenerate(): void {
    if (enrichedStudents.length === 0) return;
    setCalculating(true);
    setTeams(null);

    // Simulate a 1.5s "calculation" phase for UX drama
    setTimeout(() => {
      const result = buildTeams(enrichedStudents, numTeams, metric);
      setTeams(result);
      setCalculating(false);
    }, 1500);
  }

  function handleReset(): void {
    setTeams(null);
  }

  if (isLoading) return <PageSkeleton />;

  return (
    <motion.div variants={PAGE_ENTER} initial="hidden" animate="show" className="space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <motion.nav variants={ITEM} aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm">
        <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          הכיתות שלי
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <Link href={`/classes/${classId}`} className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          {cls?.name ?? '...'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <span className="font-semibold text-slate-700">חלוקת קבוצות חכמה</span>
      </motion.nav>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_4px_16px_rgba(139,92,246,0.45)]"
            >
              <Users className="h-5 w-5 text-white" aria-hidden="true" />
            </motion.div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              חלוקת קבוצות חכמה
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            אלגוריתם Snake Draft — קבוצות מאוזנות מבחינת רמת כושר בלחיצה אחת
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-500">תלמידים</p>
          <p className="text-2xl font-extrabold text-violet-700">{enrichedStudents.length}</p>
        </div>
      </motion.div>

      {/* ── Configuration panel ─────────────────────────────────────────── */}
      <motion.div
        variants={ITEM}
        className="rounded-3xl border border-white/60 bg-white/60 p-6 shadow-xl shadow-purple-900/10 backdrop-blur-2xl"
      >
        <div className="flex flex-wrap gap-8 items-start">

          {/* Number of teams — active toggle: vibrant Cyan */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              מספר קבוצות
            </p>
            <div className="flex gap-2">
              {TEAM_COUNT_OPTIONS.map((n) => {
                const active = numTeams === n;
                return (
                  <motion.button
                    key={n}
                    type="button"
                    onClick={() => { setNumTeams(n); setTeams(null); }}
                    whileTap={{ scale: 0.93 }}
                    className={cn(
                      'relative h-11 w-11 rounded-2xl text-lg font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                      active ? 'text-white' : 'text-slate-600 hover:bg-cyan-50 hover:text-cyan-700',
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="team-count-pill"
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-[0_4px_16px_rgba(6,182,212,0.50)]"
                        transition={{ ease: EASE, duration: 0.3 }}
                      />
                    )}
                    <span className="relative z-10">{n}</span>
                  </motion.button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              {Math.floor(enrichedStudents.length / numTeams)}–{Math.ceil(enrichedStudents.length / numTeams)} תלמידים לקבוצה
            </p>
          </div>

          {/* Metric — active toggle: hot Fuchsia/Pink */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              שיטת איזון
            </p>
            <div className="flex gap-2">
              {METRIC_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = metric === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => { setMetric(value); setTeams(null); }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400',
                      active ? 'text-white' : 'text-slate-600 hover:bg-fuchsia-50 hover:text-fuchsia-700',
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="metric-pill"
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-[0_4px_16px_rgba(217,70,239,0.45)]"
                        transition={{ ease: EASE, duration: 0.3 }}
                      />
                    )}
                    <Icon className={cn('relative z-10 h-4 w-4', active ? 'text-white' : 'text-slate-500')} aria-hidden="true" />
                    <span className="relative z-10">{label}</span>
                  </motion.button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              {METRIC_OPTIONS.find((m) => m.value === metric)?.desc}
            </p>
          </div>
        </div>

        {/* Generate button */}
        <div className="mt-6 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={handleGenerate}
            disabled={calculating || enrichedStudents.length < numTeams}
            whileHover={
              !calculating && enrichedStudents.length >= numTeams
                ? {
                    scale: 1.03,
                    boxShadow: '0 12px 40px rgba(139,92,246,0.55)',
                    transition: { type: 'spring', stiffness: 400, damping: 22 },
                  }
                : {}
            }
            whileTap={!calculating ? { scale: 0.97 } : {}}
            className={cn(
              'relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl px-8 text-base font-extrabold text-white transition-opacity',
              calculating || enrichedStudents.length < numTeams
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_4px_24px_rgba(139,92,246,0.45)]',
            )}
          >
            {/* Shimmer sweep */}
            {!calculating && enrichedStudents.length >= numTeams && (
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
              />
            )}
            {calculating ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="relative z-10">
              {calculating ? 'מחשב...' : 'צור קבוצות מאוזנות'}
            </span>
          </motion.button>

          {teams && (
            <motion.button
              type="button"
              onClick={handleReset}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: EASE, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="flex h-14 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 text-sm font-bold text-slate-600 shadow-sm hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              חשב מחדש
            </motion.button>
          )}

          {enrichedStudents.length < numTeams && (
            <p className="text-sm font-semibold text-red-500">
              צריך לפחות {numTeams} תלמידים
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Algorithm explainer pill ─────────────────────────────────────── */}
      {!teams && !calculating && (
        <motion.div
          variants={ITEM}
          className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3.5 backdrop-blur-sm"
        >
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden="true" />
          <p className="text-sm text-violet-800">
            <strong>אלגוריתם Snake Draft:</strong> התלמידים ממויינים לפי ממוצע ציוני הכושר.
            הבחירה מתנהלת לסירוגין קדימה-אחורה — כמו בדראפט NBA — כדי להבטיח פיזור מרבי של רמות הביצוע בין הקבוצות.
          </p>
        </motion.div>
      )}

      {/* ── Calculating overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {calculating && (
          <motion.div key="calculating" exit={{ opacity: 0, scale: 0.96 }}>
            <CalculatingOverlay />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results grid (layout-animated for fluid team count changes) ─── */}
      <AnimatePresence>
        {teams && !calculating && (
          <motion.section
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ease: EASE, duration: 0.4 }}
            aria-label="תוצאות חלוקת הקבוצות"
          >
            {/* Balance proof banner */}
            {metric === 'FITNESS' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: EASE, duration: 0.5 }}
                className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="text-sm font-semibold text-emerald-800">
                  הקבוצות מאוזנות — טווח הממוצעים:{' '}
                  <strong>
                    {Math.max(...teams.map((t) => t.teamAvg)) -
                      Math.min(...teams.map((t) => t.teamAvg))}{' '}
                    נקודות
                  </strong>
                  {' '}בלבד
                </p>
              </motion.div>
            )}

            {/* Fluid layout grid — morphs when team count changes */}
            <motion.div
              layout
              className={cn(
                'grid gap-4',
                teams.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                teams.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                teams.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {teams.map((team, i) => (
                <TeamCard key={team.label} team={team} index={i} metric={metric} />
              ))}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
