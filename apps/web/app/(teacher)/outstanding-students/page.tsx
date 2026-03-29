'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Crown, Search, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { TopStudentItem } from '@fitgrade/types';
import { useTopStudents, useTopStudentsByTest } from '@/hooks/use-top-students';
import { useClasses } from '@/hooks/use-classes';
import { useTestTypes } from '@/hooks/use-test-types';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';
import { cn } from '@/lib/utils';

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

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
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.45 } },
};

// ─── Medal config ─────────────────────────────────────────────────────────────

interface MedalConfig {
  emoji: string;
  ring: string;
  bg: string;
  border: string;
  nameColor: string;
  scoreColor: string;
  badge: string;
  badgeText: string;
  glow: string;
  scale: string;
}

const MEDAL_CONFIGS: [MedalConfig, MedalConfig, MedalConfig] = [
  {
    emoji: '🥇',
    ring: 'ring-4 ring-amber-400/60',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    border: 'border-amber-300/70',
    nameColor: 'text-amber-900',
    scoreColor: 'text-amber-700',
    badge: 'bg-amber-400',
    badgeText: 'text-white',
    glow: 'shadow-[0_8px_48px_rgba(251,191,36,0.50)]',
    scale: 'scale-100',
  },
  {
    emoji: '🥈',
    ring: 'ring-2 ring-slate-300/60',
    bg: 'bg-gradient-to-br from-slate-50 to-gray-50',
    border: 'border-slate-200/70',
    nameColor: 'text-slate-800',
    scoreColor: 'text-slate-600',
    badge: 'bg-slate-400',
    badgeText: 'text-white',
    glow: 'shadow-[0_8px_32px_rgba(148,163,184,0.40)]',
    scale: 'scale-95',
  },
  {
    emoji: '🥉',
    ring: 'ring-2 ring-orange-300/50',
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    border: 'border-orange-200/60',
    nameColor: 'text-orange-900',
    scoreColor: 'text-orange-700',
    badge: 'bg-orange-400',
    badgeText: 'text-white',
    glow: 'shadow-[0_8px_28px_rgba(251,146,60,0.35)]',
    scale: 'scale-95',
  },
];

// ─── Podium card ──────────────────────────────────────────────────────────────

interface PodiumCardProps {
  rank: 1 | 2 | 3;
  studentName: string;
  className: string;
  avgGrade: number;
  resultCount: number;
  classId: string;
  compact?: boolean;
}

function PodiumCard({
  rank, studentName, className, avgGrade, resultCount, classId, compact = false,
}: PodiumCardProps): React.JSX.Element {
  const cfg = MEDAL_CONFIGS[rank - 1]!;
  const initials = studentName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2);

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -8, scale: 1.04, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      className={cn(
        'flex flex-col items-center gap-2 rounded-3xl border p-4 backdrop-blur-2xl',
        cfg.bg, cfg.border, cfg.glow, cfg.ring, cfg.scale,
        compact && 'p-3 gap-1.5',
      )}
    >
      <motion.span
        className={cn('leading-none', compact ? 'text-3xl' : 'text-4xl')}
        animate={{ scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-label={`מדליה מקום ${rank}`}
      >
        {cfg.emoji}
      </motion.span>

      <div className={cn(
        'flex items-center justify-center rounded-full font-extrabold shadow-lg',
        cfg.badge, cfg.badgeText,
        compact ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-lg',
      )}>
        {initials}
      </div>

      <div className="text-center">
        <p className={cn('font-extrabold leading-tight', cfg.nameColor, compact ? 'text-xs' : 'text-sm')}>
          {studentName}
        </p>
        <Link
          href={`/classes/${classId}`}
          className="text-xs text-slate-500 hover:text-indigo-600 hover:underline underline-offset-2 transition-colors"
        >
          {className}
        </Link>
      </div>

      <div className="text-center">
        <p className={cn('font-black tabular-nums', cfg.scoreColor, compact ? 'text-2xl' : 'text-3xl')}>
          {avgGrade}
        </p>
        <p className="text-xs font-semibold text-slate-500">{getHebrewGradeLabel(avgGrade)}</p>
      </div>

      <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 border border-white/70">
        {resultCount} מבחנים
      </span>
    </motion.div>
  );
}

// ─── Ranked list row (rank 4+) ────────────────────────────────────────────────

interface RankRowProps {
  rank: number;
  studentName: string;
  className: string;
  avgGrade: number;
  resultCount: number;
  classId: string;
  index: number;
}

function RankRow({
  rank, studentName, className, avgGrade, resultCount, classId, index,
}: RankRowProps): React.JSX.Element {
  const gradeColor =
    avgGrade >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60' :
    avgGrade >= 75 ? 'text-indigo-700 bg-indigo-50 border-indigo-200/60' :
    avgGrade >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200/60' :
                     'text-red-700 bg-red-50 border-red-200/60';

  const initials = studentName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ ease: EASE, duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ x: -3, scale: 1.01, boxShadow: '0 8px 28px rgba(15,23,42,0.12)', transition: { type: 'spring', stiffness: 400, damping: 30 } }}
      whileTap={{ scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/60 px-4 py-3 backdrop-blur-xl shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
    >
      <span className="w-7 shrink-0 text-center text-sm font-extrabold text-slate-400 tabular-nums">{rank}</span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{studentName}</p>
        <Link href={`/classes/${classId}`} className="text-xs text-slate-500 hover:text-indigo-600 hover:underline underline-offset-2 transition-colors truncate block">
          {className}
        </Link>
      </div>
      <span className="shrink-0 text-xs text-slate-400 hidden sm:block">{resultCount} מבחנים</span>
      <span className={cn('shrink-0 rounded-xl border px-2.5 py-1 text-sm font-extrabold tabular-nums', gradeColor)}>
        {avgGrade}
      </span>
    </motion.div>
  );
}

// ─── Gender MVP mini-podium ────────────────────────────────────────────────────

interface GenderPodiumProps {
  title: string;
  emoji: string;
  students: TopStudentItem[];
  accentBg: string;
  accentBorder: string;
  accentText: string;
}

function GenderPodium({
  title, emoji, students, accentBg, accentBorder, accentText,
}: GenderPodiumProps): React.JSX.Element {
  const top3 = students.slice(0, 3);
  const podiumOrder = [1, 0, 2] as const;

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -4, scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
      className={cn(
        'flex-1 min-w-0 rounded-3xl border p-4 backdrop-blur-2xl',
        accentBg, accentBorder,
        'shadow-[0_8px_30px_rgb(0,0,0,0.09)]',
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">{emoji}</span>
        <h3 className={cn('text-sm font-extrabold', accentText)}>{title}</h3>
      </div>

      {top3.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">אין נתונים</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 items-end">
          {podiumOrder.map((idx) => {
            const student = top3[idx];
            if (!student) return <div key={idx} />;
            return (
              <PodiumCard
                key={student.studentId}
                rank={(idx + 1) as 1 | 2 | 3}
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-7 w-56 animate-pulse rounded-xl bg-white/60" />
      <div className="flex gap-4">
        <div className="flex-1 h-64 animate-pulse rounded-3xl bg-white/60" />
        <div className="flex-1 h-64 animate-pulse rounded-3xl bg-white/60" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => <div key={n} className="h-64 animate-pulse rounded-3xl bg-white/60" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-14 animate-pulse rounded-2xl bg-white/60" />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutstandingStudentsPage(): React.JSX.Element {
  const [search, setSearch]                 = useState('');
  const [classFilter, setClassFilter]       = useState<string>('all');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [testDropOpen, setTestDropOpen]     = useState(false);

  const { activeSemester } = useSemester();
  const { data: topStudents, isLoading: topLoading }   = useTopStudents(activeSemester);
  const { data: testStudents, isLoading: testLoading } = useTopStudentsByTest(selectedTestId || null, activeSemester);
  const { data: classes }                              = useClasses();
  const { data: testTypes }                            = useTestTypes();

  const isLoading = topLoading || (!!selectedTestId && testLoading);

  if (isLoading && !topStudents) return <PageSkeleton />;

  const displayStudents = (selectedTestId ? testStudents : topStudents) ?? [];

  const filtered = displayStudents.filter((s) => {
    const matchesClass  = classFilter === 'all' || s.classId === classFilter;
    const matchesSearch = search === '' || s.studentName.includes(search);
    return matchesClass && matchesSearch;
  });

  const top3  = filtered.slice(0, 3);
  const rest  = filtered.slice(3);
  const hasData = filtered.length > 0;

  const allStudents = topStudents ?? [];
  const maleTop     = allStudents.filter((s) => s.gender === 'MALE').slice(0, 3);
  const femaleTop   = allStudents.filter((s) => s.gender === 'FEMALE').slice(0, 3);

  const podiumOrder = [1, 0, 2] as const;
  const selectedTestName = testTypes?.find((t) => t.id === selectedTestId)?.nameHe;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="outstanding"
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        className="space-y-7"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <motion.div variants={ITEM} className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-l from-amber-600 via-orange-500 to-amber-700 bg-clip-text text-transparent">תלמידים מצטיינים</h1>
            </div>
            <p className="text-sm text-slate-500">לוח מצטיינים לפי ממוצע ציוני כושר גופני — כלל הכיתות</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-xl bg-white/60 border border-white/70 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white/80 transition-colors backdrop-blur-sm"
          >
            חזרה לדשבורד
          </Link>
        </motion.div>

        <SemesterTransitionWrapper activeSemester={activeSemester}>
        {/* ── School MVPs — gender split ───────────────────────────────── */}
        {!selectedTestId && (maleTop.length > 0 || femaleTop.length > 0) && (
          <motion.div variants={ITEM}>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-4 w-4 text-indigo-500" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-700">מצטייני בית הספר</h2>
              <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
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

        {/* ── Filters row ──────────────────────────────────────────────── */}
        <motion.div variants={ITEM} className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם..."
              className="w-full rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm ps-9 pe-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              aria-label="חיפוש תלמיד לפי שם"
            />
          </div>

          {/* Test type dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTestDropOpen((o) => !o)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all backdrop-blur-sm',
                selectedTestId
                  ? 'bg-violet-50 border-violet-300 text-violet-800 shadow-[0_2px_12px_rgba(139,92,246,0.20)]'
                  : 'bg-white/60 border-white/70 text-slate-600 hover:bg-white/80',
              )}
              aria-expanded={testDropOpen}
              aria-label="סינון לפי מבחן"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              {selectedTestId ? (selectedTestName ?? 'מבחן נבחר') : 'כל המבחנים'}
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', testDropOpen && 'rotate-180')}
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
                  className="absolute top-full start-0 z-30 mt-1 w-56 rounded-2xl border border-white/80 bg-white/95 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl overflow-hidden"
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

          {/* Class filter pills */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="סינון לפי כיתה">
            <button
              type="button"
              onClick={() => setClassFilter('all')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150',
                classFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.40)]'
                  : 'bg-white/60 text-slate-600 border border-white/70 hover:bg-white/80',
              )}
            >
              כל הכיתות
            </button>
            {(classes ?? []).map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setClassFilter(cls.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150',
                  classFilter === cls.id
                    ? 'bg-indigo-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.40)]'
                    : 'bg-white/60 text-slate-600 border border-white/70 hover:bg-white/80',
                )}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Active test type banner ───────────────────────────────────── */}
        {selectedTestId && (
          <motion.div
            variants={ITEM}
            className="flex items-center justify-between gap-3 rounded-2xl bg-violet-50 border border-violet-200 px-4 py-3"
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
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
            >
              הצג ממוצע כללי
            </button>
          </motion.div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {!hasData && (
          <motion.div
            variants={ITEM}
            className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/50 py-20 text-center"
          >
            <Trophy className="h-10 w-10 text-slate-200" aria-hidden="true" />
            {search === '' && classFilter === 'all' && !selectedTestId ? (
              <>
                <p className="font-semibold text-slate-500">
                  {`אין עדיין תוצאות למחצית ${activeSemester === 'A' ? 'א׳' : 'ב׳'}`}
                </p>
                <p className="text-sm text-slate-400">הגרף יתעדכן לאחר רישום תוצאות מבחן</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-500">אין תלמידים להצגה</p>
                <p className="text-sm text-slate-400">נסה לשנות את הסינון</p>
              </>
            )}
          </motion.div>
        )}

        {/* ── Main podium — top 3 ───────────────────────────────────────── */}
        {hasData && top3.length > 0 && (
          <motion.div variants={ITEM}>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-700">
                {selectedTestId
                  ? `מקומות ראשונים — ${selectedTestName}`
                  : 'מקומות ראשונים (ממוצע כללי)'}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              {podiumOrder.map((idx) => {
                const student = top3[idx];
                if (!student) return null;
                return (
                  <PodiumCard
                    key={student.studentId}
                    rank={(idx + 1) as 1 | 2 | 3}
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

        {/* ── Ranked list (rank 4+) ─────────────────────────────────────── */}
        {hasData && rest.length > 0 && (
          <motion.div variants={ITEM}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-700">דירוג מורחב</h2>
              <span className="rounded-full bg-white/60 border border-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {rest.length} תלמידים
              </span>
            </div>

            <AnimatePresence mode="popLayout">
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

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {hasData && (
          <motion.p variants={ITEM} className="text-center text-xs text-slate-400 pb-2">
            מציג {filtered.length} מתוך {displayStudents.length} תלמידים ·{' '}
            {selectedTestId
              ? `מדורג לפי ציון במבחן ${selectedTestName}`
              : 'מדורג לפי ממוצע ציוני כושר'}
          </motion.p>
        )}
        </SemesterTransitionWrapper>
      </motion.div>
    </AnimatePresence>
  );
}
