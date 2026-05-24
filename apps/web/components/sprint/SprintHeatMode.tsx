'use client';

/**
 * SprintHeatMode — reusable 3-phase Heat Mode engine for short-sprint tests.
 *
 * Used by:
 *   - /sprint           (60m sprint)
 *   - /sprint-10x4      (10×4m shuttle sprint)
 *
 * The only difference between sessions is the `testName` prop, which drives
 * the sidebar badge, setup header, and breadcrumb label.
 *
 * State machine:
 *   setup   → Select heat size (1–4 runners) + assign students to lanes.
 *   racing  → Full-screen massive lane cards + RAF master timer at top.
 *             Tap a card → locks individual split, card turns vivid green.
 *             All lanes done → auto-advance to summary.
 *   summary → Display this heat's results, option to start a new heat or
 *             save all accumulated results and exit.
 *
 * Timer contract (zero React re-renders during the race):
 *   Master timer:   RAF → masterTimerRef.current.textContent
 *   Individual tap: performance.now() - raceStartRef captured in event handler
 *   currentFinishedRef mirrors currentFinished state so both RAF callbacks and
 *   UI see fresh data without closures going stale.
 *
 * Accumulated results:
 *   allResults[] stores the best time per student across heats.
 *   On "Save all & exit" both allResults + current heat are merged and POSTed.
 *
 * RTL: dir="rtl" on root portal div, logical Tailwind properties throughout.
 */

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  Dumbbell,
  FileDown,
  Flag,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Swords,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowingSearch } from '@/components/ui/glowing-search';
import { useTestSession } from '@/hooks/use-test-session';
import { apiRequest, logout } from '@/lib/api-client';
import { ApiError } from '@fitgrade/types';
import type { SessionStudent } from '@fitgrade/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'racing' | 'summary';

interface HeatResult {
  studentId: string;
  ms: number;
}

// ─── Timer helpers ─────────────────────────────────────────────────────────────

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

// ─── Navigation config ─────────────────────────────────────────────────────────

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

// ─── Floating sports-icon config ───────────────────────────────────────────────

interface FloatDef {
  src: string; w: number;
  left: string; top: string;
  delay: number; dur: number;
  blur: number; opacity: number;
}

const FLOAT_ICONS: FloatDef[] = [
  { src: '/sports-icons/stopwatch.png',       w: 92,  left: '5%',  top: '10%', delay: 0,   dur: 8.0,  blur: 0,   opacity: 0.88 },
  { src: '/sports-icons/football-player.png', w: 106, left: '67%', top: '4%',  delay: 1.2, dur: 10.0, blur: 1,   opacity: 0.65 },
  { src: '/sports-icons/football.png',        w: 72,  left: '85%', top: '48%', delay: 0.6, dur: 7.5,  blur: 2,   opacity: 0.50 },
  { src: '/sports-icons/baseball.png',        w: 60,  left: '9%',  top: '72%', delay: 2.0, dur: 9.0,  blur: 0.5, opacity: 0.74 },
  { src: '/sports-icons/stopwatch.png',       w: 48,  left: '47%', top: '84%', delay: 1.5, dur: 11.5, blur: 3,   opacity: 0.40 },
  { src: '/sports-icons/football.png',        w: 80,  left: '1%',  top: '38%', delay: 0.9, dur: 8.5,  blur: 1.5, opacity: 0.56 },
  { src: '/sports-icons/baseball.png',        w: 44,  left: '76%', top: '22%', delay: 3.0, dur: 12.0, blur: 4,   opacity: 0.36 },
  { src: '/sports-icons/football-player.png', w: 58,  left: '32%', top: '88%', delay: 0.4, dur: 9.5,  blur: 2,   opacity: 0.32 },
];

// ─── Rank badge colours ────────────────────────────────────────────────────────

function rankStyle(rank: number): React.CSSProperties {
  if (rank === 1) return { background: 'rgba(251,191,36,0.32)', color: '#fbbf24', boxShadow: '0 0 10px rgba(251,191,36,0.55)' };
  if (rank === 2) return { background: 'rgba(209,213,219,0.22)', color: '#e5e7eb' };
  if (rank === 3) return { background: 'rgba(180,83,9,0.28)', color: '#d97706' };
  return { background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' };
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

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
        style={
          active
            ? {
                background: 'linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(109,40,217,0.38) 100%)',
                border: '1px solid rgba(196,157,255,0.60)',
                boxShadow: [
                  '0 0 24px rgba(168,85,247,0.45)',
                  '0 0 48px rgba(168,85,247,0.18)',
                  'inset 0 1px 0 rgba(255,255,255,0.20)',
                  '0 4px 12px rgba(0,0,0,0.25)',
                ].join(', '),
              }
            : { border: '1px solid transparent' }
        }
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

// ─── StudentPicker — searchable combobox ──────────────────────────────────────

interface StudentPickerProps {
  students:    SessionStudent[];
  selectedId:  string | null;
  disabledIds: string[];
  onChange:    (id: string | null) => void;
  placeholder: string;
}

function StudentPicker({ students, selectedId, disabledIds, onChange, placeholder }: StudentPickerProps): React.JSX.Element {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = students.find((s) => s.id === selectedId) ?? null;
  const filtered = students.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentCode.includes(q)
    );
  });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-start transition-all duration-200"
        style={
          open
            ? {
                background: 'linear-gradient(135deg, rgba(109,40,217,0.20) 0%, rgba(139,92,246,0.14) 100%)',
                border: '1px solid rgba(196,157,255,0.60)',
                boxShadow: '0 0 28px rgba(139,92,246,0.28), inset 0 1px 0 rgba(255,255,255,0.10)',
                backdropFilter: 'blur(16px)',
              }
            : {
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                backdropFilter: 'blur(16px)',
              }
        }
      >
        <span className={cn('truncate text-sm font-semibold', selected ? 'text-white' : 'text-white/40')}>
          {selected ? `${selected.firstName} ${selected.lastName}` : placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          style={{ color: open ? 'rgba(196,157,255,0.9)' : 'rgba(255,255,255,0.30)' }}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute start-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(160deg, rgba(28,16,68,0.97) 0%, rgba(18,10,48,0.98) 100%)',
              border: '1px solid rgba(196,157,255,0.22)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.60), 0 0 0 1px rgba(139,92,246,0.10)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <div className="border-b border-white/[0.08] p-2">
              <GlowingSearch
                value={query}
                onChange={setQuery}
                placeholder="חיפוש שם או קוד..."
                aria-label="חיפוש תלמיד לפי שם או קוד"
                autoFocus
                dark
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {selectedId && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); setQuery(''); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  נקה בחירה
                </button>
              )}
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-center text-sm text-white/35">לא נמצאו תלמידים</p>
              )}
              {filtered.map((s) => {
                const disabled = disabledIds.includes(s.id) && s.id !== selectedId;
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onChange(s.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors',
                      disabled ? 'cursor-not-allowed opacity-35' : 'hover:bg-white/[0.08]',
                      isSelected && 'bg-violet-500/[0.15]',
                    )}
                  >
                    <span className={cn('font-semibold', isSelected ? 'text-violet-200' : 'text-white')}>
                      {s.firstName} {s.lastName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-white/35">#{s.studentCode}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LaneCard — massive split-screen tap target ────────────────────────────────

interface LaneCardProps {
  lane:     number;
  student:  SessionStudent;
  finishMs: number | undefined;
  onTap:    (studentId: string) => void;
  /** When true the card is visible but unclickable (pre-start "ready" state). */
  disabled?: boolean;
}

function LaneCard({ lane, student, finishMs, onTap, disabled = false }: LaneCardProps): React.JSX.Element {
  const finished = finishMs !== undefined;
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    <motion.button
      type="button"
      onClick={() => { if (!finished && !disabled) onTap(student.id); }}
      disabled={finished || disabled}
      initial={{ opacity: 0, scale: 0.88, y: 20 }}
      animate={{ opacity: disabled ? 0.55 : 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: lane * 0.07 }}
      whileHover={!finished && !disabled ? { scale: 1.012, transition: { type: 'spring', stiffness: 420, damping: 26 } } : {}}
      whileTap={!finished && !disabled ? { scale: 0.97 } : {}}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden select-none"
      style={
        finished
          ? {
              background: 'linear-gradient(160deg, rgba(22,163,74,0.32) 0%, rgba(16,185,129,0.20) 50%, rgba(5,150,105,0.14) 100%)',
              border: '2px solid rgba(74,222,128,0.55)',
              boxShadow: [
                '0 0 60px rgba(34,197,94,0.42)',
                '0 0 120px rgba(34,197,94,0.20)',
                'inset 0 0 50px rgba(22,163,74,0.14)',
                'inset 0 2px 0 rgba(255,255,255,0.10)',
              ].join(', '),
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              cursor: 'default',
            }
          : {
              background: 'linear-gradient(160deg, rgba(109,40,217,0.12) 0%, rgba(255,255,255,0.04) 100%)',
              border: '2px solid rgba(196,157,255,0.20)',
              boxShadow: [
                '0 0 40px rgba(109,40,217,0.14)',
                'inset 0 0 30px rgba(139,92,246,0.06)',
                'inset 0 2px 0 rgba(255,255,255,0.08)',
              ].join(', '),
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              cursor: 'pointer',
            }
      }
      aria-label={
        finished
          ? `${student.firstName} ${student.lastName} — סיים/ה ב-${formatTimer(finishMs!)}`
          : `לחץ לעצירת הטיימר — ${student.firstName} ${student.lastName}`
      }
    >
      {/* Breathing glow — pending */}
      {!finished && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.20) 0%, transparent 60%)' }}
          aria-hidden="true"
        />
      )}

      {/* Green bloom — finished */}
      {finished && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 0.95, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(34,197,94,0.28) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
      )}

      {/* Lane badge — top start */}
      <div
        className="absolute start-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-base font-black"
        style={
          finished
            ? { background: 'rgba(22,163,74,0.40)', color: '#86efac', boxShadow: '0 0 16px rgba(34,197,94,0.55)' }
            : { background: 'rgba(139,92,246,0.30)', color: 'rgba(196,157,255,0.95)' }
        }
        aria-label={`מסלול ${lane + 1}`}
      >
        {lane + 1}
      </div>

      {/* Check badge — top end */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 540, damping: 26 }}
            className="absolute end-4 top-4"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'rgba(22,163,74,0.40)', boxShadow: '0 0 16px rgba(34,197,94,0.55)' }}
            >
              <Check className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar circle */}
      <motion.div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black"
        style={
          finished
            ? { background: 'rgba(22,163,74,0.32)', color: 'rgba(134,239,172,0.95)', boxShadow: '0 0 32px rgba(34,197,94,0.60)' }
            : { background: 'rgba(139,92,246,0.24)', color: 'rgba(196,157,255,0.92)' }
        }
        animate={finished ? {} : { boxShadow: ['0 0 0 0px rgba(139,92,246,0.30)', '0 0 0 12px rgba(139,92,246,0)', '0 0 0 0px rgba(139,92,246,0)'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        aria-hidden="true"
      >
        {initials}
      </motion.div>

      {/* Name */}
      <span
        className="text-4xl font-extrabold tracking-tight"
        style={{ color: finished ? 'rgba(187,247,208,1)' : 'rgba(255,255,255,1)' }}
      >
        {student.firstName}
      </span>
      <span
        className="mt-1 text-xl font-semibold"
        style={{ color: finished ? 'rgba(134,239,172,0.72)' : 'rgba(255,255,255,0.50)' }}
      >
        {student.lastName}
      </span>

      {/* Time badge — appears on finish */}
      <AnimatePresence>
        {finished && finishMs !== undefined && (
          <motion.div
            key="time"
            initial={{ opacity: 0, scale: 0.65, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className="mt-7 rounded-2xl px-7 py-3"
            style={{
              background: 'rgba(22,163,74,0.32)',
              border: '1px solid rgba(74,222,128,0.45)',
              boxShadow: '0 0 24px rgba(34,197,94,0.40)',
            }}
          >
            <span className="text-3xl font-black tabular-nums text-emerald-300">
              {formatTimer(finishMs)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap hint — pending + started only */}
      {!finished && !disabled && (
        <motion.p
          className="mt-8 text-sm font-semibold"
          style={{ color: 'rgba(196,157,255,0.45)' }}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
        >
          לחץ לעצירה
        </motion.p>
      )}
    </motion.button>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SprintHeatModeProps {
  /**
   * Display label for the test type — shown in the sidebar badge, setup header,
   * and breadcrumb. session.testNameHe takes priority once the API responds;
   * this prop acts as the immediate/demo-mode fallback so the page renders
   * instantly before any network round-trip.
   */
  testName: string;
  /**
   * Pre-filtered roster from PreTestRosterSelection. When provided, overrides
   * the session roster so only the confirmed participants appear in heat setup.
   */
  activeStudents?: SessionStudent[];
}

// ─── SprintHeatMode — main exported component ─────────────────────────────────

export function SprintHeatMode({ testName: defaultTestName, activeStudents }: SprintHeatModeProps): React.ReactNode {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();

  // ── Session data ─────────────────────────────────────────────────────────────
  const { data: session } = useTestSession(sessionId);
  const sessionStudents: SessionStudent[] = session?.students ?? [];
  // activeStudents (from PreTestRosterSelection) takes priority over session data
  const students: SessionStudent[] =
    activeStudents && activeStudents.length > 0 ? activeStudents : sessionStudents;

  /** Live test label: API value once loaded, prop fallback until then. */
  const testName = session?.testNameHe ?? defaultTestName;

  // ── Phase state machine ───────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('setup');
  const [heatSize,     setHeatSize]     = useState(2);
  const [laneStudents, setLaneStudents] = useState<(string | null)[]>([null, null]);

  // ── Accumulated results across all heats ─────────────────────────────────────
  const [allResults, setAllResults] = useState<HeatResult[]>([]);

  // ── Current heat: state mirrors ref so both RAF callbacks and UI see data ─────
  const [currentFinished, setCurrentFinished] = useState<Map<string, number>>(new Map());
  const currentFinishedRef = useRef<Map<string, number>>(new Map());

  // ── RAF timer refs (zero React re-renders during race) ────────────────────────
  const masterTimerRef = useRef<HTMLSpanElement | null>(null);
  const raceStartRef   = useRef<number>(0);
  const rafRef         = useRef<number>(0);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [toast,        setToast]        = useState<string | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [mounted,      setMounted]      = useState(false);
  /** True only after the teacher explicitly taps the START button in Phase 2. */
  const [raceStarted,  setRaceStarted]  = useState(false);

  // ── Clock ────────────────────────────────────────────────────────────────────
  const [clockTime, setClockTime] = useState(nowTimeStr);
  useEffect(() => {
    const id = setInterval(() => { setClockTime(nowTimeStr()); }, 60_000);
    return () => clearInterval(id);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Sync lane array length when heatSize changes ──────────────────────────────
  useEffect(() => {
    setLaneStudents((prev) =>
      Array.from({ length: heatSize }, (_, i) => prev[i] ?? null),
    );
  }, [heatSize]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(msg: string): void {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Validate lanes & transition to Phase 2 (timer NOT started yet) ────────────
  function handleStartHeat(): void {
    if (laneStudents.some((id) => id === null)) {
      showToast('יש לבחור תלמיד/ה לכל מסלול');
      return;
    }
    currentFinishedRef.current = new Map();
    setCurrentFinished(new Map());
    setRaceStarted(false);
    setPhase('racing');
  }

  // ── Teacher taps START → high-precision timer fires ─────────────────────────
  function handleBeginRace(): void {
    raceStartRef.current = performance.now();

    function tick(now: DOMHighResTimeStamp): void {
      if (masterTimerRef.current !== null) {
        masterTimerRef.current.textContent = formatTimer(now - raceStartRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    setRaceStarted(true);
  }

  // ── Tap a lane card ───────────────────────────────────────────────────────────
  const handleLaneTap = useCallback((studentId: string): void => {
    if (currentFinishedRef.current.has(studentId)) return;
    const ms = performance.now() - raceStartRef.current;
    currentFinishedRef.current.set(studentId, ms);
    const snapshot = new Map(currentFinishedRef.current);
    setCurrentFinished(snapshot);

    const totalLanes = laneStudents.filter(Boolean).length;
    if (snapshot.size >= totalLanes) {
      cancelAnimationFrame(rafRef.current);
      setPhase('summary');
    }
  }, [laneStudents]);

  // ── Manually end the heat (some runners didn't finish) ────────────────────────
  function handleForceFinish(): void {
    cancelAnimationFrame(rafRef.current);
    setPhase('summary');
  }

  // ── Accept this heat → commit results → back to setup ────────────────────────
  function handleNewHeat(): void {
    const newResults: HeatResult[] = Array.from(currentFinishedRef.current.entries()).map(
      ([studentId, ms]) => ({ studentId, ms }),
    );
    setAllResults((prev) => {
      const merged = new Map<string, number>(prev.map((r) => [r.studentId, r.ms]));
      for (const r of newResults) {
        const existing = merged.get(r.studentId);
        if (existing === undefined || r.ms < existing) merged.set(r.studentId, r.ms);
      }
      return Array.from(merged.entries()).map(([studentId, ms]) => ({ studentId, ms }));
    });
    setLaneStudents(Array.from({ length: heatSize }, () => null));
    currentFinishedRef.current = new Map();
    setCurrentFinished(new Map());
    setRaceStarted(false);
    setPhase('setup');
  }

  // ── Save all accumulated results + current heat → navigate back ───────────────
  const handleSaveAll = useCallback(async (): Promise<void> => {
    const merged = new Map<string, number>(allResults.map((r) => [r.studentId, r.ms]));
    Array.from(currentFinishedRef.current.entries()).forEach(([id, ms]) => {
      const existing = merged.get(id);
      if (existing === undefined || ms < existing) merged.set(id, ms);
    });
    if (merged.size === 0) {
      showToast('אין תוצאות לשמירה');
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(
        Array.from(merged.entries()).map(([studentId, ms]) =>
          apiRequest(`/sessions/${sessionId}/results`, {
            method: 'POST',
            body: JSON.stringify({ studentId, rawValue: parseFloat((ms / 1000).toFixed(2)) }),
          }),
        ),
      );
      router.push(`/classes/${classId}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'שגיאה בשמירת תוצאות — נסה שוב');
      setIsSaving(false);
    }
  }, [allResults, sessionId, classId, router]);

  // ── Logout ───────────────────────────────────────────────────────────────────
  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  // ── Cleanup & portal guard ────────────────────────────────────────────────────
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  // ── Computed helpers ──────────────────────────────────────────────────────────
  const assignedStudents = laneStudents.map((id) =>
    id ? (students.find((s) => s.id === id) ?? null) : null,
  );
  const disabledIds      = laneStudents.filter(Boolean) as string[];
  const alreadySavedIds  = allResults.map((r) => r.studentId);

  // Summary: merge allResults + current heat for rank display
  const summaryMap = new Map<string, number>(allResults.map((r) => [r.studentId, r.ms]));
  Array.from(currentFinishedRef.current.entries()).forEach(([id, ms]) => {
    const existing = summaryMap.get(id);
    if (existing === undefined || ms < existing) summaryMap.set(id, ms);
  });
  const grandLeaderboard = Array.from(summaryMap.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([id, ms], i) => ({ student: students.find((s) => s.id === id), ms, rank: i + 1 }))
    .filter((e) => e.student !== undefined) as { student: SessionStudent; ms: number; rank: number }[];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      ref={containerRef}
      dir="rtl"
      className="fixed inset-0 z-[9999] flex overflow-hidden"
    >
      {/* ════════════════════════════════════════════════════════════════════════
          BACKGROUND LAYERS
          ════════════════════════════════════════════════════════════════════════ */}

      {/* 0 — Deep void */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg, #050318 0%, #080524 35%, #0c0838 65%, #060420 100%)' }} aria-hidden="true" />

      {/* 1 — Violet spectral glow */}
      <div className="pointer-events-none absolute" style={{ insetInlineStart: '28%', top: '-12%', width: '72%', height: '68%', background: 'radial-gradient(ellipse, rgba(109,40,217,0.42) 0%, rgba(79,22,180,0.20) 42%, transparent 70%)', filter: 'blur(64px)' }} aria-hidden="true" />

      {/* 2 — Indigo haze */}
      <div className="pointer-events-none absolute" style={{ insetInlineEnd: '25%', bottom: '-6%', width: '55%', height: '52%', background: 'radial-gradient(ellipse, rgba(67,56,202,0.30) 0%, rgba(49,46,129,0.15) 45%, transparent 70%)', filter: 'blur(52px)' }} aria-hidden="true" />

      {/* 3 — Emerald accent */}
      <div className="pointer-events-none absolute" style={{ insetInlineStart: '-4%', bottom: '8%', width: '32%', height: '40%', background: 'radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, transparent 65%)', filter: 'blur(40px)' }} aria-hidden="true" />

      {/* 4 — Diagonal light trails */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(128deg, transparent 0%, rgba(139,92,246,0.06) 38%, transparent 58%), linear-gradient(52deg, transparent 22%, rgba(99,102,241,0.05) 52%, transparent 72%)' }} aria-hidden="true" />

      {/* 5 — SVG noise texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.032]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '180px 180px' }} aria-hidden="true" />

      {/* 6 — Floating 3D sports icons */}
      {FLOAT_ICONS.map((icon, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute"
          style={{ left: icon.left, top: icon.top, zIndex: 2, filter: `blur(${icon.blur}px) drop-shadow(0 0 14px rgba(139,92,246,0.55))`, opacity: icon.opacity }}
          animate={{ y: [0, -16, 2, -10, 0], rotate: [0, 3, -2, 4, 0] }}
          transition={{ duration: icon.dur, delay: icon.delay, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon.src} alt="" width={icon.w} height={icon.w} style={{ display: 'block' }} />
        </motion.div>
      ))}

      {/* ════════════════════════════════════════════════════════════════════════
          SIDEBAR (RTL first child → right side visually)
          ════════════════════════════════════════════════════════════════════════ */}

      <aside
        className="relative z-20 flex h-full w-56 shrink-0 flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(45,28,95,0.85) 0%, rgba(28,16,68,0.90) 40%, rgba(18,10,48,0.94) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderInlineEnd: '1px solid rgba(196,157,255,0.12)',
          boxShadow: 'inset -1px 0 0 rgba(168,85,247,0.08), 4px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.24) 0%, transparent 70%)' }} aria-hidden="true" />

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

        {/* Navigation */}
        <nav className="relative z-10 flex-1 overflow-y-auto py-3" aria-label="ניווט ראשי">
          <div className="space-y-0.5">{MAIN_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <div className="mb-2 px-5"><p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">כלים</p></div>
          <div className="space-y-0.5">{TOOLS_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <div className="mb-2 px-5"><p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">חינוך גופני</p></div>
          <div className="space-y-0.5">{PE_NAV.map((item) => <NavItem key={item.href} {...item} />)}</div>
        </nav>

        {/* Session badge */}
        <div className="relative z-10 px-3 py-2">
          <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(196,157,255,0.18)' }}>
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Zap className="h-3 w-3 text-violet-400" aria-hidden="true" />
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">{testName} — מקצים</p>
            </div>
            <p className="text-[9px] text-white/40">{clockTime} · {todayDateStr()}</p>
            {allResults.length > 0 && (
              <p className="mt-1 text-[10px] text-emerald-400">
                {allResults.length} תוצאות נרשמו
              </p>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="relative z-10 p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button type="button" onClick={() => { void handleLogout(); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200" style={{ color: 'rgba(255,255,255,0.40)' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(252,165,165,1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.background = ''; }} aria-label="התנתק מהמערכת">
            <span>התנתק</span>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ════════════════════════════════════════════════════════════════════════ */}

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div key="toast" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute start-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(252,165,165,0.30)', whiteSpace: 'nowrap' }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════════════════
              PHASE 1 — SETUP
              ══════════════════════════════════════════════════════════════════ */}

          {phase === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-8"
            >
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(196,157,255,0.28)', backdropFilter: 'blur(12px)' }}>
                  <Zap className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                  <span className="text-xs font-black uppercase tracking-widest text-violet-300">מצב מקצים</span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">{testName} — הגדרת מקצה</h1>
                <p className="mt-1.5 text-sm text-white/50">בחר את מספר הרצים ושייך תלמידים למסלולים</p>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <Link href={`/classes/${classId}`} className="text-xs text-white/35 transition-colors hover:text-white/60">הכיתות שלי</Link>
                  <span className="text-white/20" aria-hidden="true">/</span>
                  <span className="text-xs text-white/50">{testName}</span>
                </div>
              </div>

              {/* Heat size picker */}
              <div className="mb-8 w-full max-w-sm">
                <p className="mb-3 text-end text-xs font-black uppercase tracking-widest text-white/40">מספר רצים במקצה</p>
                <div className="grid grid-cols-4 gap-3">
                  {([1, 2, 3, 4] as const).map((n) => (
                    <motion.button
                      key={n}
                      type="button"
                      onClick={() => setHeatSize(n)}
                      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 24 } }}
                      whileTap={{ scale: 0.93 }}
                      className="flex flex-col items-center justify-center rounded-2xl py-4 text-2xl font-black transition-all duration-200"
                      style={
                        heatSize === n
                          ? {
                              background: 'linear-gradient(135deg, rgba(139,92,246,0.50) 0%, rgba(109,40,217,0.42) 100%)',
                              border: '2px solid rgba(196,157,255,0.68)',
                              boxShadow: '0 0 32px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
                              color: 'white',
                            }
                          : {
                              background: 'rgba(255,255,255,0.055)',
                              border: '1px solid rgba(255,255,255,0.10)',
                              color: 'rgba(255,255,255,0.45)',
                            }
                      }
                      aria-pressed={heatSize === n}
                      aria-label={`${n} ${n === 1 ? 'רץ' : 'רצים'}`}
                    >
                      {n}
                      <span
                        className="mt-0.5 text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: heatSize === n ? 'rgba(196,157,255,0.85)' : 'rgba(255,255,255,0.28)' }}
                      >
                        {n === 1 ? 'רץ' : 'רצים'}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Lane assignments */}
              <div className="w-full max-w-sm">
                <p className="mb-3 text-end text-xs font-black uppercase tracking-widest text-white/40">שיוך תלמידים למסלולים</p>
                <div className="space-y-3">
                  {laneStudents.map((selectedId, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black"
                        style={{ background: 'rgba(139,92,246,0.26)', color: 'rgba(196,157,255,0.95)' }}
                        aria-label={`מסלול ${i + 1}`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <StudentPicker
                          students={students.filter((s) => !alreadySavedIds.includes(s.id))}
                          selectedId={selectedId}
                          disabledIds={disabledIds}
                          onChange={(id) => {
                            setLaneStudents((prev) => {
                              const next = [...prev];
                              next[i] = id;
                              return next;
                            });
                          }}
                          placeholder={`מסלול ${i + 1} — בחר/י תלמיד`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Start button */}
              <motion.button
                type="button"
                onClick={handleStartHeat}
                whileHover={{ y: -3, boxShadow: '0 18px 44px rgba(109,40,217,0.65)', transition: { type: 'spring', stiffness: 380, damping: 24 } }}
                whileTap={{ scale: 0.96 }}
                className="mt-10 flex items-center gap-3 rounded-2xl px-10 py-4 text-lg font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.72) 0%, rgba(109,40,217,0.66) 100%)',
                  border: '1px solid rgba(196,157,255,0.55)',
                  boxShadow: '0 8px 32px rgba(109,40,217,0.50), inset 0 1px 0 rgba(255,255,255,0.20)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                התחל מקצה
              </motion.button>

              {/* Progress indicator */}
              {allResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center gap-2.5 rounded-2xl px-5 py-3"
                  style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(74,222,128,0.22)' }}
                >
                  <Flag className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span className="text-sm font-semibold text-emerald-300">
                    {allResults.length} תלמידים סיימו · {students.length - allResults.length} נותרו
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PHASE 2 — RACING
              ══════════════════════════════════════════════════════════════════ */}

          {phase === 'racing' && (
            <motion.div
              key="racing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.20 }}
              className="relative flex h-full flex-col"
            >
              {/* Master timer pill */}
              <div className="relative z-10 flex shrink-0 items-center justify-center py-5">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  className="flex items-center gap-3 rounded-[28px] px-8 py-3.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(28,16,68,0.92) 0%, rgba(18,10,48,0.96) 100%)',
                    border: '1px solid rgba(196,157,255,0.40)',
                    boxShadow: [
                      '0 0 48px rgba(139,92,246,0.38)',
                      '0 0 96px rgba(109,40,217,0.20)',
                      'inset 0 1px 0 rgba(255,255,255,0.14)',
                      '0 8px 32px rgba(0,0,0,0.40)',
                    ].join(', '),
                    backdropFilter: 'blur(24px)',
                  }}
                >
                  <motion.div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: raceStarted ? '#ef4444' : 'rgba(255,255,255,0.22)' }}
                    animate={raceStarted ? { opacity: [1, 0.15, 1] } : { opacity: 1 }}
                    transition={{ duration: 0.75, repeat: Infinity }}
                    aria-hidden="true"
                  />
                  <span
                    ref={masterTimerRef}
                    className="font-mono text-4xl font-black tabular-nums text-white"
                    style={{ letterSpacing: '-0.02em', textShadow: '0 0 32px rgba(139,92,246,0.55)' }}
                    aria-live="off"
                  >
                    00:00.00
                  </span>
                  <span
                    className="text-xs font-black uppercase tracking-widest"
                    style={{ color: raceStarted ? 'rgba(196,157,255,1)' : 'rgba(255,255,255,0.35)' }}
                  >
                    {raceStarted ? 'חי' : 'מוכן'}
                  </span>
                </motion.div>
              </div>

              {/* Lane cards — split screen */}
              <div className="flex flex-1 gap-2 px-3 pb-3">
                {assignedStudents.map((student, i) => {
                  if (!student) return null;
                  return (
                    <LaneCard
                      key={student.id}
                      lane={i}
                      student={student}
                      finishMs={currentFinished.get(student.id)}
                      onTap={handleLaneTap}
                      disabled={!raceStarted}
                    />
                  );
                })}
              </div>

              {/* Force finish button — only visible after race has started */}
              {raceStarted && (
                <div className="flex shrink-0 justify-center pb-4">
                  <button
                    type="button"
                    onClick={handleForceFinish}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = ''; }}
                  >
                    סיים מקצה ידנית
                  </button>
                </div>
              )}

              {/* ── START SPRINT overlay — shown until teacher taps START ─────── */}
              <AnimatePresence>
                {!raceStarted && (
                  <motion.div
                    key="start-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.88, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.20 }}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center"
                    style={{ background: 'rgba(5,3,24,0.42)', backdropFilter: 'blur(3px)' }}
                  >
                    {/* Ambient green glow behind button */}
                    <motion.div
                      className="pointer-events-none absolute"
                      animate={{ opacity: [0.30, 0.65, 0.30], scale: [1, 1.22, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: 320, height: 320,
                        background: 'radial-gradient(ellipse, rgba(34,197,94,0.30) 0%, transparent 65%)',
                        borderRadius: '50%',
                      }}
                      aria-hidden="true"
                    />

                    <motion.button
                      type="button"
                      onClick={handleBeginRace}
                      initial={{ scale: 0.78, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.08 }}
                      whileHover={{ scale: 1.06, boxShadow: '0 0 80px rgba(34,197,94,0.70), 0 20px 48px rgba(0,0,0,0.45)', transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                      whileTap={{ scale: 0.95 }}
                      className="relative flex flex-col items-center gap-3 rounded-[28px] px-16 py-8 text-white"
                      style={{
                        background: 'linear-gradient(135deg, rgba(22,163,74,0.72) 0%, rgba(16,185,129,0.62) 100%)',
                        border: '2px solid rgba(74,222,128,0.70)',
                        boxShadow: [
                          '0 0 56px rgba(34,197,94,0.55)',
                          '0 0 112px rgba(34,197,94,0.25)',
                          'inset 0 1px 0 rgba(255,255,255,0.22)',
                          '0 12px 40px rgba(0,0,0,0.45)',
                        ].join(', '),
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                      }}
                      aria-label="התחל מקצה — הפעל טיימר"
                    >
                      {/* Pulsing ring */}
                      <motion.div
                        className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-emerald-400"
                        animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.04, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        aria-hidden="true"
                      />
                      <Zap className="h-12 w-12 text-emerald-100" aria-hidden="true" />
                      <span className="text-3xl font-black tracking-tight">התחל</span>
                      <span className="text-sm font-semibold text-emerald-200/80">לחץ להפעלת הטיימר</span>
                    </motion.button>

                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.28 }}
                      className="mt-6 text-sm font-semibold text-white/40"
                    >
                      הרצים מוכנים — המתן לאות הזינוק
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PHASE 3 — SUMMARY
              ══════════════════════════════════════════════════════════════════ */}

          {phase === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-8"
            >
              {/* Trophy icon */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.08 }}
                className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.30) 0%, rgba(245,158,11,0.20) 100%)',
                  border: '1px solid rgba(251,191,36,0.40)',
                  boxShadow: '0 0 36px rgba(251,191,36,0.38)',
                }}
              >
                <Trophy className="h-8 w-8 text-amber-400" aria-hidden="true" />
              </motion.div>

              <h2 className="mb-1 text-2xl font-extrabold text-white">סיכום מקצה</h2>
              <p className="mb-7 text-sm text-white/45">תוצאות המקצה הנוכחי</p>

              {/* This heat's results */}
              <div className="mb-6 w-full max-w-sm space-y-2">
                {assignedStudents.filter(Boolean).map((student, i) => {
                  if (!student) return null;
                  const ms   = currentFinished.get(student.id);
                  const vals = Array.from(currentFinished.values()).sort((a, b) => a - b);
                  const rank = ms !== undefined ? vals.indexOf(ms) + 1 : null;
                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07, type: 'spring', stiffness: 360, damping: 28 }}
                      className="flex items-center justify-between rounded-2xl px-4 py-3"
                      style={
                        ms !== undefined
                          ? { background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(74,222,128,0.24)' }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                      }
                    >
                      <div className="flex items-center gap-3">
                        {rank !== null && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black" style={rankStyle(rank)}>
                            {rank}
                          </div>
                        )}
                        <span className="font-semibold text-white">{student.firstName} {student.lastName}</span>
                      </div>
                      {ms !== undefined
                        ? <span className="font-black tabular-nums text-emerald-300">{formatTimer(ms)}</span>
                        : <span className="text-sm text-white/35">לא סיים</span>
                      }
                    </motion.div>
                  );
                })}
              </div>

              {/* Grand leaderboard (all heats combined) */}
              {grandLeaderboard.length > assignedStudents.filter(Boolean).length && (
                <div className="mb-7 w-full max-w-sm">
                  <p className="mb-2 text-end text-xs font-black uppercase tracking-widest text-white/35">
                    <Users className="me-1 inline h-3 w-3" aria-hidden="true" />
                    כל התוצאות עד כה
                  </p>
                  <div className="space-y-1.5 overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {grandLeaderboard.map(({ student, ms, rank }) => (
                      <div key={student.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-white/35">#{rank}</span>
                          <span className="text-sm text-white/70">{student.firstName} {student.lastName}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-white/55">{formatTimer(ms)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={handleNewHeat}
                  whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 24 } }}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)' }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  מקצה חדש
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => { void handleSaveAll(); }}
                  disabled={isSaving}
                  whileHover={!isSaving ? { y: -2, boxShadow: '0 12px 32px rgba(22,163,74,0.50)', transition: { type: 'spring', stiffness: 400, damping: 24 } } : {}}
                  whileTap={!isSaving ? { scale: 0.96 } : {}}
                  className="flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgba(22,163,74,0.62) 0%, rgba(16,185,129,0.52) 100%)',
                    border: '1px solid rgba(74,222,128,0.40)',
                    boxShadow: '0 4px 20px rgba(22,163,74,0.30)',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? 'שומר...' : 'שמור הכל וצא'}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
