'use client';

/**
 * LongDistanceRunPage — full-screen immersive session for long-distance runs.
 *
 * State machine:
 *   racing  → All students shown in grid + right timer panel.
 *             START button initiates high-precision RAF timer.
 *             Tap a card when the student crosses the finish line.
 *             Last student done (or force-end) → advances to summary.
 *   summary → Ranked results with medals, two save options.
 *
 * Timer contract (zero React re-renders during race):
 *   Race start:   performance.now() → raceStartRef  (never state)
 *   Live display: RAF tick → timerDisplayRef.current.textContent
 *   Progress bar: width updated imperatively via progressBarRef
 *   Student tap:  performance.now() − raceStart captured in event handler
 *
 * RTL: dir="rtl" on portal root, logical Tailwind properties throughout.
 */

import { createPortal }          from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter }  from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link                      from 'next/link';
import type { LucideIcon }       from 'lucide-react';
import {
  BookOpen, CalendarDays, CheckCircle2, Crown, Dumbbell,
  FileDown, Flag, GraduationCap, LayoutDashboard, LogOut,
  Play, RotateCcw, Save, ShieldAlert, Swords, Target, Trophy, Users,
} from 'lucide-react';
import { cn }              from '@/lib/utils';
import { useTestSession }  from '@/hooks/use-test-session';
import { apiRequest, logout } from '@/lib/api-client';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { SessionStudent } from '@fitgrade/types';
import { PreTestRosterSelection } from '@/components/pre-test-roster-selection';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'roster' | 'racing' | 'summary';

/** Minimum ms between two taps on the same card. */
const TAP_DEBOUNCE_MS = 350;

// ─── Timer helpers ──────────────────────────────────────────────────────────────

function formatTimer(ms: number): string {
  const totalCs  = Math.floor(ms / 10);
  const cs       = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec      = totalSec % 60;
  const min      = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayDateStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ─── Navigation config ──────────────────────────────────────────────────────────

interface NavDef { href: string; label: string; icon: LucideIcon; active?: boolean }

const MAIN_NAV: NavDef[] = [
  { href: '/dashboard', label: 'ראשי',         icon: LayoutDashboard },
  { href: '/classes',   label: 'הכיתות שלי',   icon: BookOpen, active: true },
  { href: '/schedule',  label: 'מערכת שעות',   icon: CalendarDays },
];
const TOOLS_NAV: NavDef[] = [
  { href: '/norms',   label: 'טבלאות הישגים', icon: Target   },
  { href: '/reports', label: 'הפקת דוחות',    icon: FileDown },
];
const PE_NAV: NavDef[] = [
  { href: '/exemptions',           label: 'פטורים',            icon: ShieldAlert },
  { href: '/outstanding-students', label: 'תלמידים מצטיינים',  icon: Crown       },
  { href: '/events',               label: 'אירועים וטורנירים', icon: Swords      },
  { href: '/exercise-bank',        label: 'מתכנן שיעור',       icon: Dumbbell    },
];

// ─── Floating sports-icon config ────────────────────────────────────────────────

interface FloatDef {
  src: string; w: number;
  insetInlineStart: string; top: string;
  delay: number; dur: number;
  blur: number; opacity: number;
}

const FLOAT_ICONS: FloatDef[] = [
  { src: '/sports-icons/stopwatch.png',       w: 96,  insetInlineStart: '4%',   top: '8%',  delay: 0,   dur: 8.2,  blur: 0,   opacity: 0.90 },
  { src: '/sports-icons/football-player.png', w: 108, insetInlineStart: '66%',  top: '3%',  delay: 1.2, dur: 10.4, blur: 1,   opacity: 0.60 },
  { src: '/sports-icons/football.png',        w: 74,  insetInlineStart: '85%',  top: '50%', delay: 0.6, dur: 7.8,  blur: 2,   opacity: 0.48 },
  { src: '/sports-icons/baseball.png',        w: 62,  insetInlineStart: '8%',   top: '74%', delay: 2.0, dur: 9.2,  blur: 0.5, opacity: 0.72 },
  { src: '/sports-icons/stopwatch.png',       w: 50,  insetInlineStart: '48%',  top: '85%', delay: 1.5, dur: 11.8, blur: 3,   opacity: 0.38 },
  { src: '/sports-icons/football.png',        w: 82,  insetInlineStart: '0.5%', top: '40%', delay: 0.9, dur: 8.8,  blur: 1.5, opacity: 0.54 },
  { src: '/sports-icons/baseball.png',        w: 46,  insetInlineStart: '75%',  top: '20%', delay: 3.0, dur: 12.4, blur: 4,   opacity: 0.34 },
  { src: '/sports-icons/football-player.png', w: 60,  insetInlineStart: '33%',  top: '90%', delay: 0.4, dur: 9.8,  blur: 2,   opacity: 0.30 },
];

// ─── Rank badge style ────────────────────────────────────────────────────────────

function rankBadgeStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { background: 'rgba(251,191,36,0.32)', color: '#fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.60)' };
  if (rank === 2) return { background: 'rgba(209,213,219,0.22)', color: '#e5e7eb', boxShadow: '0 0 8px rgba(209,213,219,0.28)' };
  if (rank === 3) return { background: 'rgba(180,83,9,0.30)', color: '#d97706', boxShadow: '0 0 8px rgba(217,119,6,0.38)' };
  return { background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' };
}

// ─── NavItem ─────────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon: Icon, active = false }: NavDef): React.JSX.Element {
  return (
    <div className="px-2">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
          active ? 'text-white' : 'text-white/60 hover:text-white',
        )}
        style={active ? {
          background: 'linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(109,40,217,0.38) 100%)',
          border: '1px solid rgba(196,157,255,0.60)',
          boxShadow: [
            '0 0 24px rgba(168,85,247,0.45)',
            '0 0 48px rgba(168,85,247,0.18)',
            'inset 0 1px 0 rgba(255,255,255,0.20)',
            'inset 0 0 20px rgba(139,92,246,0.15)',
            '0 4px 12px rgba(0,0,0,0.25)',
          ].join(', '),
          backdropFilter: 'blur(12px)',
        } : { border: '1px solid transparent' }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = '';
            e.currentTarget.style.border = '1px solid transparent';
          }
        }}
      >
        <span className="truncate">{label}</span>
        <Icon
          className={cn(
            'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
            active ? 'text-violet-200' : 'text-white/35 group-hover:text-white/65',
          )}
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

// ─── StudentCard ─────────────────────────────────────────────────────────────────

interface StudentCardProps {
  student:  SessionStudent;
  index:    number;
  finishMs: number | undefined;
  rank:     number | null;
  disabled: boolean;
  onTap:    (id: string) => void;
}

function StudentCard({
  student, index, finishMs, rank, disabled, onTap,
}: StudentCardProps): React.JSX.Element {
  const lastTapRef = useRef<number>(0);
  const finished   = finishMs !== undefined;
  const initials   = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  function handleClick(): void {
    if (finished || disabled) return;
    const now = Date.now();
    if (now - lastTapRef.current < TAP_DEBOUNCE_MS) return;
    lastTapRef.current = now;
    onTap(student.id);
  }

  return (
    <motion.div
      layout
      layoutId={student.id}
      initial={{ opacity: 0, scale: 0.80, y: 14 }}
      animate={{ opacity: disabled && !finished ? 0.52 : 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: index * 0.018 }}
      whileHover={!finished && !disabled ? { y: -5, transition: { type: 'spring', stiffness: 420, damping: 24 } } : {}}
      whileTap={!finished && !disabled ? { scale: 0.93 } : {}}
      onClick={handleClick}
      role="button"
      tabIndex={finished || disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !finished && !disabled) onTap(student.id);
      }}
      aria-label={
        finished
          ? `${student.firstName} ${student.lastName} — סיים/ה ב-${formatTimer(finishMs!)}`
          : `${student.firstName} ${student.lastName} — לחץ לרישום סיום`
      }
      aria-disabled={finished || disabled}
      className="relative flex min-h-[136px] select-none flex-col items-center justify-center overflow-hidden rounded-2xl px-3 py-4 text-center"
      style={finished ? {
        cursor: 'default',
        background: 'linear-gradient(135deg, rgba(22,163,74,0.24) 0%, rgba(16,185,129,0.15) 100%)',
        border: '1px solid rgba(74,222,128,0.40)',
        boxShadow: ['0 0 32px rgba(34,197,94,0.30)', '0 8px 24px rgba(0,0,0,0.35)', 'inset 0 1px 0 rgba(255,255,255,0.10)'].join(', '),
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      } : {
        cursor: disabled ? 'default' : 'pointer',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Hover violet bloom */}
      {!finished && !disabled && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 hover:opacity-100"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.18), transparent 65%)' }}
          aria-hidden="true"
        />
      )}

      {/* Finish pulse */}
      {finished && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.38, 0.68, 0.38] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.22) 0%, transparent 65%)' }}
          aria-hidden="true"
        />
      )}

      {/* Rank badge */}
      {finished && rank !== null && (
        <div
          className="absolute start-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
          style={rankBadgeStyle(rank)}
          aria-label={`מקום ${rank}`}
        >
          {rank}
        </div>
      )}

      {/* Check icon */}
      {finished && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
          className="absolute end-1.5 top-1.5"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        </motion.div>
      )}

      {/* Avatar */}
      <div
        className="mb-2 flex h-11 w-11 items-center justify-center rounded-full text-sm font-black"
        style={finished
          ? { background: 'rgba(22,163,74,0.35)', color: 'rgba(134,239,172,0.95)', boxShadow: '0 0 16px rgba(34,197,94,0.48)' }
          : { background: 'rgba(139,92,246,0.24)', color: 'rgba(196,157,255,0.88)' }
        }
        aria-hidden="true"
      >
        {initials}
      </div>

      <span className="text-sm font-extrabold leading-tight tracking-tight text-white">
        {student.firstName}
      </span>
      <span className="mt-0.5 text-xs font-semibold leading-tight text-white/50">
        {student.lastName}
      </span>
      <span className="mt-0.5 text-[10px] font-bold tabular-nums text-white/22">
        #{student.studentCode}
      </span>

      <AnimatePresence>
        {finished && finishMs !== undefined && (
          <motion.div
            key="finish-time"
            initial={{ opacity: 0, scale: 0.60, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className="mt-2 rounded-full px-3 py-0.5"
            style={{ background: 'rgba(22,163,74,0.30)', border: '1px solid rgba(74,222,128,0.35)' }}
          >
            <span className="text-[11px] font-black tabular-nums text-emerald-300">
              {formatTimer(finishMs)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {!finished && !disabled && (
        <p className="mt-1.5 text-[9px] font-semibold text-white/25">לחץ בסיום</p>
      )}
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────────

export default function LongDistanceRunPage(): React.ReactNode {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();

  const { data: session, isLoading: sessionLoading } = useTestSession(sessionId);
  const sessionStudents: SessionStudent[] = session?.students ?? [];
  const testName = session?.testNameHe ?? 'ריצת מרחק';

  // Populated by PreTestRosterSelection before the race begins
  const [activeStudents, setActiveStudents] = useState<SessionStudent[]>([]);

  // Convenience alias used throughout the racing/summary phase
  const students = activeStudents.length > 0 ? activeStudents : sessionStudents;

  // ── Wall clock ───────────────────────────────────────────────────────────────
  const [clockTime, setClockTime] = useState(nowTimeStr);
  useEffect(() => {
    const id = setInterval(() => { setClockTime(nowTimeStr()); }, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Refs (zero-render timer contract) ────────────────────────────────────────
  const timerDisplayRef = useRef<HTMLSpanElement | null>(null);
  const progressBarRef  = useRef<HTMLDivElement   | null>(null);
  const raceStartRef    = useRef<number>(0);
  const rafRef          = useRef<number>(0);
  const finishedRef     = useRef<Map<string, number>>(new Map());

  // ── State ────────────────────────────────────────────────────────────────────
  const [phase,         setPhase]         = useState<Phase>('roster');
  const [raceStarted,   setRaceStarted]   = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [toast,         setToast]         = useState<string | null>(null);
  const [finishedTimes, setFinishedTimes] = useState<Map<string, number>>(new Map());
  const [savedGrades,   setSavedGrades]   = useState<Map<string, number>>(new Map());
  const [mounted,       setMounted]       = useState(false);

  const totalCount    = students.length;
  const finishedCount = finishedTimes.size;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleBeginRace(): void {
    finishedRef.current = new Map();
    setFinishedTimes(new Map());
    if (progressBarRef.current) progressBarRef.current.style.width = '0%';
    raceStartRef.current = performance.now();

    function tick(now: DOMHighResTimeStamp): void {
      if (timerDisplayRef.current !== null) {
        timerDisplayRef.current.textContent = formatTimer(now - raceStartRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    setRaceStarted(true);
  }

  const handleStudentTap = useCallback((studentId: string): void => {
    if (!raceStarted) {
      setToast('הפעל את הטיימר תחילה');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (finishedRef.current.has(studentId)) return;

    const elapsed = performance.now() - raceStartRef.current;
    finishedRef.current.set(studentId, elapsed);
    const snapshot = new Map(finishedRef.current);
    setFinishedTimes(snapshot);

    if (progressBarRef.current !== null) {
      progressBarRef.current.style.width = `${(snapshot.size / totalCount) * 100}%`;
    }
    if (snapshot.size >= totalCount) {
      cancelAnimationFrame(rafRef.current);
      setPhase('summary');
    }
  }, [raceStarted, totalCount]);

  function handleForceEnd(): void {
    cancelAnimationFrame(rafRef.current);
    setPhase('summary');
  }

  const handleSave = useCallback(async (continueRace: boolean): Promise<void> => {
    cancelAnimationFrame(rafRef.current);
    setIsSaving(true);
    const entries = Array.from(finishedRef.current.entries());
    const results = await Promise.allSettled(
      entries.map(([studentId, ms]) =>
        apiRequest<{ calculatedGrade: number }>(`/sessions/${sessionId}/results`, {
          method: 'POST',
          body: JSON.stringify({ studentId, rawValue: parseFloat((ms / 1000).toFixed(2)) }),
        }).then((res) => ({ studentId, calculatedGrade: res.calculatedGrade })),
      ),
    );

    const grades = new Map<string, number>();
    const failed: string[] = [];
    for (const [i, outcome] of results.entries()) {
      if (outcome.status === 'fulfilled') {
        grades.set(outcome.value.studentId, outcome.value.calculatedGrade);
      } else {
        failed.push(entries[i]![0]);
      }
    }
    setSavedGrades(grades);

    if (failed.length > 0) {
      const failedNames = failed
        .map((id) => students.find((s) => s.id === id)?.firstName ?? id)
        .join(', ');
      setToast(`שגיאה בשמירה עבור: ${failedNames}`);
      setTimeout(() => setToast(null), 5000);
      setIsSaving(false);
      return;
    }

    if (continueRace) {
      finishedRef.current = new Map();
      setFinishedTimes(new Map());
      setSavedGrades(new Map());
      if (progressBarRef.current) progressBarRef.current.style.width = '0%';
      if (timerDisplayRef.current) timerDisplayRef.current.textContent = '00:00.00';
      setRaceStarted(false);
      setPhase('racing');
      setIsSaving(false);
    } else {
      router.push(`/classes/${classId}`);
    }
  }, [sessionId, classId, router, students]);

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  function getRank(studentId: string): number | null {
    const myTime = finishedTimes.get(studentId);
    if (myTime === undefined) return null;
    const sorted = Array.from(finishedTimes.values()).sort((a, b) => a - b);
    return sorted.indexOf(myTime) + 1;
  }

  const sortedResults = Array.from(finishedTimes.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([id, ms], i) => ({
      student: students.find((s) => s.id === id),
      ms,
      rank: i + 1,
      grade: savedGrades.get(id),
    }))
    .filter((e) => e.student !== undefined) as { student: SessionStudent; ms: number; rank: number; grade?: number }[];

  const leaderboard = sortedResults.slice(0, 5);

  if (!mounted) return null;

  // ── Roster phase — shown before the race begins ───────────────────────────────
  if (phase === 'roster') {
    if (!sessionLoading && session != null && sessionStudents.length === 0) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
          <p className="text-xl font-bold text-foreground">אין תלמידים רשומים לכיתה זו</p>
          <p className="text-sm text-muted-foreground">יש להוסיף תלמידים לכיתה לפני ביצוע מבחן</p>
          <a href={`/classes/${classId}`} className="text-primary underline">חזור לכיתה</a>
        </div>
      );
    }
    return (
      <PreTestRosterSelection
        students={sessionStudents}
        testName={testName}
        isLoading={sessionLoading}
        onConfirm={(selected) => {
          setActiveStudents(selected);
          setPhase('racing');
        }}
      />
    );
  }

  // ── Portal ───────────────────────────────────────────────────────────────────

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[9999] flex overflow-hidden">

      {/* ─── Background ───────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(155deg, #030214 0%, #060424 30%, #0b0832 60%, #050319 100%)' }}
        aria-hidden="true"
      />
      {/* Primary violet orb */}
      <div
        className="pointer-events-none absolute"
        style={{ insetInlineStart: '24%', top: '-16%', width: '82%', height: '74%', background: 'radial-gradient(ellipse, rgba(109,40,217,0.50) 0%, rgba(79,22,180,0.24) 42%, transparent 70%)', filter: 'blur(72px)' }}
        aria-hidden="true"
      />
      {/* Indigo bottom orb */}
      <div
        className="pointer-events-none absolute"
        style={{ insetInlineEnd: '18%', bottom: '-10%', width: '62%', height: '56%', background: 'radial-gradient(ellipse, rgba(67,56,202,0.34) 0%, rgba(49,46,129,0.17) 45%, transparent 70%)', filter: 'blur(58px)' }}
        aria-hidden="true"
      />
      {/* Emerald energy accent */}
      <div
        className="pointer-events-none absolute"
        style={{ insetInlineStart: '-5%', bottom: '4%', width: '36%', height: '44%', background: 'radial-gradient(ellipse, rgba(16,185,129,0.13) 0%, transparent 65%)', filter: 'blur(46px)' }}
        aria-hidden="true"
      />
      {/* Diagonal light trails */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: ['linear-gradient(128deg, transparent 0%, rgba(139,92,246,0.07) 38%, transparent 58%)', 'linear-gradient(52deg, transparent 22%, rgba(99,102,241,0.055) 52%, transparent 72%)'].join(', ') }}
        aria-hidden="true"
      />
      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.90' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '160px 160px' }}
        aria-hidden="true"
      />
      {/* Ghost athlete watermark */}
      <div
        className="pointer-events-none absolute"
        style={{ insetInlineEnd: '22%', bottom: 0, width: '32%', height: '88%', zIndex: 1 }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/models_photo/hero-male-2.png"
          alt=""
          className="h-full w-full object-contain object-bottom"
          style={{ filter: 'grayscale(1) brightness(0.12) blur(3px)', opacity: 0.46 }}
        />
      </div>
      {/* Floating sports icons */}
      {FLOAT_ICONS.map((icon, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute"
          style={{ insetInlineStart: icon.insetInlineStart, top: icon.top, zIndex: 2, filter: `blur(${icon.blur}px) drop-shadow(0 0 16px rgba(139,92,246,0.62))`, opacity: icon.opacity }}
          animate={{ y: [0, -18, 3, -11, 0], rotate: [0, 3, -2, 4, 0] }}
          transition={{ duration: icon.dur, delay: icon.delay, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon.src} alt="" width={icon.w} height={icon.w} style={{ display: 'block' }} />
        </motion.div>
      ))}

      {/* ─── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className="relative z-20 flex h-full w-60 shrink-0 flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(45,28,95,0.88) 0%, rgba(28,16,68,0.92) 40%, rgba(18,10,48,0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderInlineEnd: '1px solid rgba(196,157,255,0.12)',
          boxShadow: 'inset -1px 0 0 rgba(168,85,247,0.08), 4px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.26) 0%, transparent 70%)' }} aria-hidden="true" />

        {/* Brand */}
        <div className="relative z-10 flex h-[68px] items-center justify-between px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="min-w-0">
            <span className="block text-[15px] font-black tracking-tight" style={{ background: 'linear-gradient(to left, #f9a8d4, #e879f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>FitGrade</span>
            <span className="block text-[11px] font-semibold leading-none tracking-wide text-white/80">מדדים, לא ניחושים</span>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.50) 0%, rgba(109,40,217,0.42) 100%)', border: '1px solid rgba(196,157,255,0.50)', boxShadow: '0 0 20px rgba(168,85,247,0.40), inset 0 1px 0 rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)' }}>
            <GraduationCap className="h-[18px] w-[18px] text-violet-100" aria-hidden="true" />
          </div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 overflow-y-auto py-3" aria-label="ניווט ראשי">
          <div className="space-y-0.5">{MAIN_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <div className="mb-2 px-5"><p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">כלים</p></div>
          <div className="space-y-0.5">{TOOLS_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <div className="mb-2 px-5"><p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">חינוך גופני</p></div>
          <div className="space-y-0.5">{PE_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
        </nav>

        {/* Logout */}
        <div className="relative z-10 p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={() => { void handleLogout(); }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(252,165,165,1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.border = '1px solid rgba(239,68,68,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.background = ''; e.currentTarget.style.border = ''; }}
            aria-label="התנתק מהמערכת"
          >
            <span>התנתק</span>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-1 flex-col overflow-hidden">

        {/* Toast */}
        <AnimatePresence>
          {toast !== null && (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 z-50 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ left: '50%', transform: 'translateX(-50%)', background: 'rgba(239,68,68,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(252,165,165,0.32)', boxShadow: '0 0 24px rgba(239,68,68,0.35)' }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar */}
        <header
          className="relative z-10 flex h-[62px] shrink-0 items-center justify-between px-5"
          style={{ background: 'rgba(0,0,0,0.24)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Student count */}
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.32)', boxShadow: '0 0 16px rgba(139,92,246,0.16)' }}>
            <Users className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            <span className="text-sm font-black tabular-nums text-violet-200">{finishedCount}/{totalCount}</span>
            <span className="text-[10px] font-semibold text-violet-400/55">תלמידים נרשמו</span>
          </div>

          {/* Breadcrumbs + title */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-white/35">
              <Link href="/classes" className="transition-colors hover:text-white/60">הכיתות שלי</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/classes/${classId}`} className="transition-colors hover:text-white/60">כיתה</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/55">{testName}</span>
            </div>
            <h1 className="text-[15px] font-black tracking-tight text-white">{testName}</h1>
          </div>

          {/* Clock */}
          <div className="text-start">
            <p className="text-base font-black tabular-nums leading-none text-white">{clockTime}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/40">{todayDateStr()}</p>
          </div>
        </header>

        {/* Body */}
        <div className="relative flex flex-1 overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── Racing phase ──────────────────────────────────────────────────── */}
            {phase === 'racing' && (
              <motion.div
                key="racing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.20 } }}
                className="flex flex-1 overflow-hidden"
              >
                {/* Student grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  <motion.div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(142px, 1fr))' }}
                  >
                    {students.map((student, index) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        index={index}
                        finishMs={finishedTimes.get(student.id)}
                        rank={getRank(student.id)}
                        disabled={!raceStarted}
                        onTap={handleStudentTap}
                      />
                    ))}
                  </motion.div>
                </div>

                {/* Timer panel */}
                <div
                  className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto p-4"
                  style={{ borderInlineStart: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Timer card */}
                  <div
                    className="relative select-none overflow-hidden rounded-3xl text-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)',
                      backdropFilter: 'blur(36px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      boxShadow: [
                        '0 8px 56px rgba(0,0,0,0.55)',
                        'inset 0 1px 0 rgba(255,255,255,0.14)',
                        '0 0 0 1px rgba(109,40,217,0.22)',
                        '0 0 52px rgba(109,40,217,0.20)',
                      ].join(', '),
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 78%, rgba(109,40,217,0.28) 0%, transparent 65%)' }} aria-hidden="true" />

                    <div className="relative z-10 px-5 pb-6 pt-5">
                      {/* Status badge */}
                      <div className="mb-3 flex items-center justify-center gap-1.5">
                        <motion.div
                          className="h-2 w-2 rounded-full"
                          style={{ background: raceStarted ? '#ef4444' : 'rgba(255,255,255,0.22)' }}
                          animate={raceStarted ? { opacity: [1, 0.18, 1] } : { opacity: 0.5 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                          aria-hidden="true"
                        />
                        <span
                          className="text-[10px] font-black uppercase tracking-[0.22em]"
                          style={{ color: raceStarted ? 'rgba(252,165,165,0.90)' : 'rgba(255,255,255,0.30)' }}
                        >
                          {raceStarted ? 'LIVE' : 'מוכן'}
                        </span>
                      </div>

                      <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">{testName}</p>
                      <p className="mb-4 text-[9px] font-semibold text-white/20">ריצה קבוצתית</p>

                      {/* Master timer */}
                      <span
                        ref={timerDisplayRef}
                        className="block font-black tabular-nums leading-none text-white"
                        style={{
                          fontSize: 'clamp(2.4rem, 5.8vw, 3.6rem)',
                          letterSpacing: '-0.04em',
                          textShadow: raceStarted
                            ? '0 0 52px rgba(139,92,246,0.60), 0 0 100px rgba(139,92,246,0.26)'
                            : '0 0 24px rgba(139,92,246,0.22)',
                        }}
                        aria-label="טיימר ריצה"
                      >
                        00:00.00
                      </span>

                      {/* Progress bar */}
                      <div
                        className="mt-5 overflow-hidden rounded-full"
                        style={{ height: 10, background: 'rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.38)' }}
                        role="progressbar"
                        aria-valuenow={finishedCount}
                        aria-valuemax={totalCount}
                        aria-label="אחוז תלמידים שסיימו"
                      >
                        <div
                          ref={progressBarRef}
                          className="h-full origin-start rounded-full"
                          style={{
                            width: '0%',
                            background: 'linear-gradient(90deg, #22c55e 0%, #84cc16 55%, #a3e635 100%)',
                            boxShadow: '0 0 14px rgba(34,197,94,0.72)',
                            transition: 'width 0.45s cubic-bezier(0.34,1.56,0.64,1)',
                          }}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-white/30">
                        {finishedCount} מתוך {totalCount} סיימו
                      </p>
                    </div>
                  </div>

                  {/* START button */}
                  <AnimatePresence>
                    {!raceStarted && (
                      <motion.button
                        key="start-btn"
                        type="button"
                        onClick={handleBeginRace}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88, y: -8, transition: { duration: 0.20 } }}
                        whileHover={{ scale: 1.03, boxShadow: '0 0 48px rgba(34,197,94,0.68)' }}
                        whileTap={{ scale: 0.96 }}
                        className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-6 py-4 text-base font-black text-white"
                        style={{
                          background: 'linear-gradient(135deg, rgba(22,163,74,0.90) 0%, rgba(16,185,129,0.85) 100%)',
                          border: '1px solid rgba(74,222,128,0.44)',
                          boxShadow: [
                            '0 0 32px rgba(34,197,94,0.55)',
                            '0 0 64px rgba(34,197,94,0.22)',
                            'inset 0 1px 0 rgba(255,255,255,0.30)',
                            '0 4px 24px rgba(0,0,0,0.35)',
                          ].join(', '),
                        }}
                        aria-label="התחל ריצה"
                      >
                        <motion.div
                          className="pointer-events-none absolute inset-0 rounded-2xl"
                          animate={{ boxShadow: ['0 0 0 0px rgba(34,197,94,0.42)', '0 0 0 16px rgba(34,197,94,0)', '0 0 0 0px rgba(34,197,94,0)'] }}
                          transition={{ duration: 2.0, repeat: Infinity, ease: 'easeOut' }}
                          aria-hidden="true"
                        />
                        <Play className="h-5 w-5" aria-hidden="true" />
                        <span>התחל ריצה</span>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Force-end button */}
                  {raceStarted && finishedCount > 0 && (
                    <motion.button
                      type="button"
                      onClick={handleForceEnd}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white/60 transition-colors hover:text-white/80"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
                      aria-label="סיים ריצה ידנית"
                    >
                      <Flag className="h-4 w-4" aria-hidden="true" />
                      סיים ריצה ידנית
                    </motion.button>
                  )}

                  {/* Live leaderboard */}
                  {leaderboard.length > 0 && (
                    <div
                      className="overflow-hidden rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">מובילים</p>
                      </div>
                      <div className="space-y-0.5 p-1.5">
                        {leaderboard.map(({ student, ms, rank }) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                            style={{ background: rank === 1 ? 'rgba(251,191,36,0.07)' : 'transparent' }}
                          >
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                              style={rankBadgeStyle(rank)}
                            >
                              {rank}
                            </div>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">
                              {student.firstName} {student.lastName}
                            </span>
                            <span className="shrink-0 text-[11px] font-black tabular-nums text-emerald-300">
                              {formatTimer(ms)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Summary phase ─────────────────────────────────────────────────── */}
            {phase === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {/* Summary hero */}
                <div
                  className="flex shrink-0 flex-col items-center py-8"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -18 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.05 }}
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(251,191,36,0.32) 0%, rgba(217,119,6,0.22) 100%)',
                      border: '1px solid rgba(251,191,36,0.42)',
                      boxShadow: '0 0 36px rgba(251,191,36,0.38), inset 0 1px 0 rgba(255,255,255,0.20)',
                    }}
                  >
                    <Trophy className="h-8 w-8 text-amber-300" aria-hidden="true" />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="text-2xl font-black tracking-tight text-white"
                  >
                    תוצאות הריצה
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.20 }}
                    className="mt-1 text-sm text-white/45"
                  >
                    {testName} — {sortedResults.length} תלמידים נרשמו
                  </motion.p>
                </div>

                {/* Results list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="mx-auto max-w-2xl space-y-2">
                    {sortedResults.map(({ student, ms, rank, grade }, i) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.032, type: 'spring', stiffness: 320, damping: 26 }}
                        className="flex items-center gap-4 rounded-2xl px-4 py-3"
                        style={rank === 1 ? {
                          background: 'linear-gradient(135deg, rgba(251,191,36,0.17) 0%, rgba(217,119,6,0.10) 100%)',
                          border: '1px solid rgba(251,191,36,0.35)',
                          boxShadow: '0 0 28px rgba(251,191,36,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
                        } : rank === 2 ? {
                          background: 'rgba(209,213,219,0.07)',
                          border: '1px solid rgba(209,213,219,0.18)',
                        } : rank === 3 ? {
                          background: 'rgba(180,83,9,0.10)',
                          border: '1px solid rgba(217,119,6,0.22)',
                        } : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black"
                          style={rankBadgeStyle(rank)}
                          aria-label={`מקום ${rank}`}
                        >
                          {rank}
                        </div>
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black"
                          style={rank <= 3 ? rankBadgeStyle(rank) : { background: 'rgba(139,92,246,0.22)', color: 'rgba(196,157,255,0.88)' }}
                          aria-hidden="true"
                        >
                          {`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-white">{student.firstName} {student.lastName}</p>
                          <p className="text-[11px] text-white/35">#{student.studentCode}</p>
                        </div>
                        <div
                          className="shrink-0 rounded-xl px-3 py-1 text-center"
                          style={rank === 1 ? {
                            background: 'rgba(251,191,36,0.24)',
                            border: '1px solid rgba(251,191,36,0.40)',
                          } : {
                            background: 'rgba(34,197,94,0.16)',
                            border: '1px solid rgba(74,222,128,0.30)',
                          }}
                        >
                          <span
                            className="block text-sm font-black tabular-nums"
                            style={{ color: rank === 1 ? '#fbbf24' : '#86efac' }}
                          >
                            {formatTimer(ms)}
                          </span>
                          {grade !== undefined && (
                            <span className="block text-[10px] font-semibold text-white/55">
                              {getHebrewGradeLabel(grade)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {/* Students who didn't finish */}
                    {students
                      .filter((s) => !finishedTimes.has(s.id))
                      .map((student, i) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0, x: 18 }}
                          animate={{ opacity: 0.45, x: 0 }}
                          transition={{ delay: (sortedResults.length + i) * 0.032, type: 'spring', stiffness: 320, damping: 26 }}
                          className="flex items-center gap-4 rounded-2xl px-4 py-3"
                          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.30)' }}>
                            —
                          </div>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }} aria-hidden="true">
                            {`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-white/40">{student.firstName} {student.lastName}</p>
                            <p className="text-[11px] text-white/22">#{student.studentCode}</p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-white/25">לא נרשם</span>
                        </motion.div>
                      ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  className="flex shrink-0 items-center justify-center gap-3 px-6 py-5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <motion.button
                    type="button"
                    onClick={() => { void handleSave(true); }}
                    disabled={isSaving}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 }}
                    whileHover={!isSaving ? { y: -2, boxShadow: '0 8px 28px rgba(139,92,246,0.38)' } : {}}
                    whileTap={!isSaving ? { scale: 0.97 } : {}}
                    className="flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg, rgba(109,40,217,0.55) 0%, rgba(139,92,246,0.48) 100%)',
                      border: '1px solid rgba(196,157,255,0.32)',
                      boxShadow: '0 4px 20px rgba(109,40,217,0.28)',
                      opacity: isSaving ? 0.5 : 1,
                    }}
                    aria-label="שמור והמשך לריצה נוספת"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    שמור והמשך לריצה נוספת
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => { void handleSave(false); }}
                    disabled={isSaving}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.34 }}
                    whileHover={!isSaving ? { y: -2, boxShadow: '0 10px 32px rgba(34,197,94,0.38)' } : {}}
                    whileTap={!isSaving ? { scale: 0.97 } : {}}
                    className="flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg, rgba(22,163,74,0.80) 0%, rgba(16,185,129,0.72) 100%)',
                      border: '1px solid rgba(74,222,128,0.44)',
                      boxShadow: '0 0 24px rgba(34,197,94,0.30)',
                      opacity: isSaving ? 0.5 : 1,
                    }}
                    aria-label="שמור וסיים"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? 'שומר...' : 'שמור וסיים'}
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>,
    document.body,
  );
}
