'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CountUp from 'react-countup';
import type {
  BelowNormItem,
  ClassData,
  DashboardStats,
  EventData,
  Gender,
  MissingResultItem,
  RecentSession,
} from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { useUpcomingEvent } from '@/hooks/use-events';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ClipboardX,
  Dumbbell,
  GraduationCap,
  Heart,
  History,
  Info,
  Loader2,
  Plus,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useCurrentTeacher } from '@/hooks/use-current-teacher';
import { useReportSettings } from '@/hooks/use-report-settings';
import { useTodaySchedule } from '@/hooks/use-today-schedule';
import type { TodayScheduleItem } from '@/hooks/use-today-schedule';
import { useClassAverages } from '@/hooks/use-class-averages';
import type { MonthlyClassAverage } from '@/hooks/use-class-averages';
import { SemesterPanel } from '@/components/ui/semester-panel';
import { apiRequest } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AddClassModal } from '@/components/classes/add-class-modal';
import { getHebrewGradeLabel } from '@fitgrade/types';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';
import { SemesterEmptyBanner } from '@/components/layout/semester-empty-banner';
import { useSignalPageReady } from '@/components/tour/use-signal-page-ready';

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE, duration: 0.65, staggerChildren: 0.10, delayChildren: 0.05 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.55 } },
};

const STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

// Widget bento cluster animations — stagger 0.15s each card
const WIDGET_ENTER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.30 } },
};

const WIDGET_ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.50 } },
};

// ─── 3D Tilt hook — mouse-tracking perspective rotation ──────────────────────

function useTilt(maxDeg = 10): {
  motionStyle: { rotateX: ReturnType<typeof useSpring>; rotateY: ReturnType<typeof useSpring>; perspective: number };
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
} {
  const rawX  = useMotionValue(0);
  const rawY  = useMotionValue(0);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-maxDeg, maxDeg]), { stiffness: 300, damping: 28 });
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [maxDeg, -maxDeg]), { stiffness: 300, damping: 28 });
  const rafRef  = useRef<number | null>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    // Throttle to one update per animation frame — prevents saturating the JS
    // main thread with mousemove callbacks at ~120Hz on high-refresh displays.
    if (rafRef.current !== null) return;
    const { clientX, clientY, currentTarget } = e;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const rect = currentTarget.getBoundingClientRect();
      rawX.set((clientX - rect.left) / rect.width  - 0.5);
      rawY.set((clientY - rect.top)  / rect.height - 0.5);
    });
  }
  function onMouseLeave(): void { rawX.set(0); rawY.set(0); }

  return { motionStyle: { rotateX, rotateY, perspective: 1000 }, onMouseMove, onMouseLeave };
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-[300px] animate-pulse rounded-3xl"
        style={{ background: 'linear-gradient(135deg, rgba(30,27,75,0.15) 0%, rgba(76,29,149,0.10) 100%)' }} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-36 animate-pulse rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(20px)' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-3xl lg:col-span-2"
          style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(20px)' }} />
        <div className="h-72 animate-pulse rounded-3xl"
          style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(20px)' }} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-52 animate-pulse rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.50)', backdropFilter: 'blur(20px)' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Hero Banner ——————————————————————————————————————————————————————————————

const HEBREW_DAYS   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'] as const;

function DigitalClock(): React.JSX.Element {
  const [parts, setParts] = useState({ h: '00', m: '00', colon: true });

  useEffect(() => {
    function tick(): void {
      const now = new Date();
      setParts({
        h: now.getHours().toString().padStart(2, '0'),
        m: now.getMinutes().toString().padStart(2, '0'),
        colon: now.getSeconds() % 2 === 0,
      });
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <span>{parts.h}</span>
      <motion.span
        animate={{ opacity: parts.colon ? 1 : 0.18 }}
        transition={{ duration: 0.12 }}
        style={{ display: 'inline-block', width: '0.38em', textAlign: 'center' }}
        aria-hidden="true"
      >:</motion.span>
      <span>{parts.m}</span>
    </>
  );
}

function HebrewDate(): React.JSX.Element {
  const now        = new Date();
  const dayOfWeek  = HEBREW_DAYS[now.getDay()]   ?? '';
  const month      = HEBREW_MONTHS[now.getMonth()] ?? '';
  return <>{`יום ${dayOfWeek}, ${now.getDate()} ב${month} ${now.getFullYear()}`}</>;
}

// ─── Schedule status config ───────────────────────────────────────────────────

type ScheduleStatus = 'now' | 'next' | 'later' | 'past';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SCHEDULE_STATUS_CONFIG: Record<ScheduleStatus, { label: string; dotColor: string; textColor: string; trackColor: string; cometColor: string }> = {
  now:   { label: 'עכשיו',      dotColor: '#10b981', textColor: '#065f46', trackColor: 'rgba(16,185,129,0.18)',  cometColor: 'rgba(16,185,129,0.90)' },
  next:  { label: 'הבא',        dotColor: '#7c3aed', textColor: '#4c1d95', trackColor: 'rgba(124,58,237,0.12)', cometColor: 'rgba(192,132,252,0.95)' },
  later: { label: 'מאוחר יותר', dotColor: '#a78bfa', textColor: '#6d28d9', trackColor: 'rgba(167,139,250,0.10)', cometColor: 'rgba(192,132,252,0.80)' },
  past:  { label: 'עבר',        dotColor: '#cbd5e1', textColor: '#94a3b8', trackColor: 'rgba(203,213,225,0.10)', cometColor: 'rgba(203,213,225,0.50)' },
};

// ─── Class ranking constants ──────────────────────────────────────────────────

const RANKING_MEDALS = [
  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245,158,11,0.40)',  text: '#92400e' }, // gold
  { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', glow: 'rgba(148,163,184,0.35)', text: '#1e293b' }, // silver
  { bg: 'linear-gradient(135deg, #cd7c3c, #92400e)', glow: 'rgba(180,83,9,0.40)',    text: '#78350f' }, // bronze
] as const;

const BAR_GRADIENTS = [
  'linear-gradient(90deg, #7c3aed, #a855f7)',
  'linear-gradient(90deg, #2563eb, #7c3aed)',
  'linear-gradient(90deg, #0891b2, #2563eb)',
  'linear-gradient(90deg, #059669, #0891b2)',
  'linear-gradient(90deg, #d97706, #059669)',
  'linear-gradient(90deg, #dc2626, #d97706)',
] as const;

const RANKING_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.10, delayChildren: 0.15 } },
};

const RANKING_ITEM = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { ease: [0.22, 1, 0.36, 1] as const, duration: 0.45 } },
};

const TIMELINE_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.10 } },
};

const TIMELINE_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { ease: [0.22, 1, 0.36, 1] as const, duration: 0.40 } },
};

// ─── Class Ranking Row ────────────────────────────────────────────────────────

function ClassRankingRow({
  item, rank, delay,
}: {
  item:  { className: string; avgScore: number };
  rank:  number;
  delay: number;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const isTop3   = rank < 3;
  const medal    = RANKING_MEDALS[rank] ?? RANKING_MEDALS[2]!;
  const barGrad  = BAR_GRADIENTS[rank % BAR_GRADIENTS.length]!;
  const fillPct  = Math.min(item.avgScore, 100);

  return (
    <motion.div
      variants={RANKING_ITEM}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.025, x: -2, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      className="relative flex items-center gap-2 rounded-xl px-2 py-1.5 overflow-hidden"
      style={{
        background: hovered
          ? `radial-gradient(ellipse at 0% 50%, ${isTop3 ? medal.glow.replace('0.40', '0.13').replace('0.35', '0.11') : 'rgba(124,58,237,0.10)'} 0%, transparent 70%), rgba(255,255,255,0.45)`
          : 'rgba(255,255,255,0.22)',
        border: '1px solid rgba(255,255,255,0.50)',
        boxShadow: hovered ? '0 4px 14px rgba(109,40,217,0.12)' : 'none',
        transition: 'background 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {/* Rank badge */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 20, height: 20, minWidth: 20,
          background: isTop3 ? medal.bg : 'rgba(139,92,246,0.12)',
          boxShadow: isTop3 ? `0 0 8px ${medal.glow}` : 'none',
        }}
        aria-label={`מקום ${rank + 1}`}
      >
        <span dir="ltr" style={{ fontSize: '0.54rem', fontWeight: 900, color: isTop3 ? medal.text : '#6d28d9' }}>
          {rank + 1}
        </span>
      </div>

      {/* Class name + animated fill bar */}
      <div className="flex-1 min-w-0">
        <p className="text-[0.62rem] font-bold text-slate-700 leading-none mb-0.5 break-words">{item.className}</p>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: barGrad }}
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay }}
          />
        </div>
      </div>

      {/* Score — Hebrew grade label */}
      <div className="shrink-0 font-black" style={{ fontSize: '0.85rem', color: '#4c1d95', minWidth: 40, textAlign: 'center' }}>
        {getHebrewGradeLabel(item.avgScore)}
      </div>
    </motion.div>
  );
}

// ─── Class Ranking Widget (replaces BarChart) ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ClassRankingWidget({ classAverages }: { classAverages: { className: string; avgScore: number }[] }): React.JSX.Element {
  const ranked = [...classAverages].sort((a, b) => b.avgScore - a.avgScore).slice(0, 6);

  return (
    <motion.div
      variants={WIDGET_ITEM}
      whileHover={{ y: -3, scale: 1.02, transition: { type: 'spring', stiffness: 280, damping: 20 } }}
      className="flex flex-col gap-2 cursor-default rounded-2xl h-full"
      style={{
        padding: '12px 12px 8px',
        background: 'rgba(255,255,255,0.40)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: '0 8px 32px rgba(31,38,135,0.07)',
        minHeight: 200,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-500/70">דירוג כיתות</span>
        <span className="text-sm leading-none" aria-hidden="true">🏆</span>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-slate-400">אין נתונים</p>
        </div>
      ) : (
        <motion.div
          variants={RANKING_STAGGER}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-1 flex-1"
        >
          {ranked.map((item, i) => (
            <ClassRankingRow key={item.className} item={item} rank={i} delay={i * 0.10} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Schedule lesson row — Command Card ──────────────────────────────────────

function ScheduleLessonRow({ lesson, isLast, studentCount }: {
  lesson: TodayScheduleItem;
  index: number;
  isLast: boolean;
  studentCount: number;
}): React.JSX.Element {
  const isNow  = lesson.status === 'now';
  const isNext = lesson.status === 'next';
  const isPast = lesson.status === 'past';

  return (
    <motion.div variants={TIMELINE_ITEM} className="relative">
      <div
        className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 overflow-hidden"
        style={{
          background:
            isNow  ? 'rgba(16,185,129,0.13)'  :
            isNext ? 'rgba(79,70,229,0.06)'   : 'transparent',
          border:
            isNow  ? '2px solid rgba(16,185,129,0.55)' :
            isNext ? '1px solid rgba(79,70,229,0.28)'  : '1px solid rgba(203,213,225,0.30)',
          boxShadow: isNow ? '0 0 0 3px rgba(16,185,129,0.10), 0 2px 12px rgba(16,185,129,0.15)' : undefined,
          opacity: isPast ? 0.55 : 1,
        }}
      >
        {/* Slow shimmer wave — NOW only */}
        {isNow && (
          <motion.div
            className="pointer-events-none absolute inset-y-0"
            style={{
              insetInlineStart: 0,
              width: '50%',
              background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.18), transparent)',
            }}
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.0 }}
            aria-hidden="true"
          />
        )}
        {/* Live indicator — only for NOW */}
        {isNow && (
          <span className="relative flex h-2 w-2 shrink-0 z-10">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{ background: 'rgba(16,185,129,0.45)' }}
              animate={{ scale: [1, 2.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: '#10b981' }}
            />
          </span>
        )}

        {/* Time */}
        <span
          dir="ltr"
          className="shrink-0 tabular-nums font-semibold text-sm leading-none relative z-10"
          style={{
            minWidth: 42,
            color: isNow ? '#059669' : isPast ? '#94a3b8' : isNext ? '#4338ca' : '#64748b',
          }}
        >
          {lesson.startTime}
        </span>

        {/* Class name */}
        <p
          className="flex-1 min-w-0 leading-none truncate relative z-10"
          style={{
            fontSize: '0.875rem',
            fontWeight: isNow ? 700 : 600,
            color: isNow ? '#065f46' : isPast ? '#94a3b8' : isNext ? '#3730a3' : '#334155',
          }}
        >
          {lesson.className}
        </p>

        {/* Student count */}
        {studentCount > 0 && (
          <div className="flex items-center gap-1 shrink-0 relative z-10">
            <Users
              className="h-3 w-3"
              style={{ color: isPast ? '#94a3b8' : '#64748b' }}
              aria-hidden="true"
            />
            <span
              dir="ltr"
              className="text-xs tabular-nums"
              style={{ color: isPast ? '#94a3b8' : '#64748b' }}
            >
              {studentCount}
            </span>
          </div>
        )}

        {/* Status pill */}
        {(isNow || isNext) && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap relative z-10"
            style={{
              background: isNow ? 'rgba(16,185,129,0.12)' : 'rgba(79,70,229,0.10)',
              color: isNow ? '#059669' : '#4338ca',
            }}
          >
            {isNow ? 'עכשיו' : 'הבא'}
          </span>
        )}
      </div>

      {/* Simple separator */}
      {!isLast && (
        <div style={{ height: 1, background: 'rgba(203,213,225,0.25)', margin: '2px 12px' }} aria-hidden="true" />
      )}
    </motion.div>
  );
}

// ─── Daily Pulse Widget ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DailyPulse({ lessons }: { lessons: TodayScheduleItem[] }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);

  const total    = lessons.length;
  const done     = lessons.filter(l => l.status === 'past').length
                 + (lessons.some(l => l.status === 'now') ? 1 : 0);
  const progress = total > 0 ? done / total : 0;

  const R            = 30;
  const circumference = 2 * Math.PI * R;
  const offset       = circumference * (1 - progress);

  const statusText =
    total === 0        ? 'אין שיעורים היום'          :
    done === 0         ? 'טרם החל'                   :
    done === total     ? 'כל השיעורים הסתיימו 🎉'   :
                         `${done} מתוך ${total} שיעורים`;

  return (
    <motion.div
      className="relative mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-default overflow-hidden"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 340, damping: 24 } }}
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: '0 6px 24px rgba(109,40,217,0.10)',
      }}
    >
      {/* Liquid ripple on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="dp-ripple"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
            style={{
              background: 'radial-gradient(ellipse at 30% 50%, rgba(124,58,237,0.20), transparent 65%)',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* Circular progress ring */}
      <div className="relative shrink-0" style={{ width: 68, height: 68 }}>
        <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
          <defs>
            <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="34" cy="34" r={R} fill="none"
            stroke="rgba(139,92,246,0.10)" strokeWidth="5" />
          {/* Animated fill */}
          <motion.circle
            cx="34" cy="34" r={R}
            fill="none"
            stroke="url(#pulseGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as const, delay: 0.4 }}
            style={{ transformOrigin: '34px 34px', transform: 'rotate(-90deg)' }}
          />
        </svg>
        {/* Center counter */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div dir="ltr" className="text-center leading-none">
            <span className="font-black tabular-nums" style={{ fontSize: '1.05rem', color: '#4c1d95' }}>
              {done}
            </span>
            <span className="font-semibold" style={{ fontSize: '0.58rem', color: '#7c3aed', opacity: 0.75 }}>
              /{total}
            </span>
          </div>
        </div>
      </div>

      {/* Text label + mini bar */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.18em] text-violet-500/70 leading-none mb-1">
          דופק יומי
        </p>
        <p className="text-[0.72rem] font-bold text-slate-700 leading-tight break-words">{statusText}</p>
        {total > 0 && (
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #10b981)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] as const, delay: 0.5 }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Achievement Gem Widget ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AchievementGem(): React.JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="relative mt-2 flex items-center gap-2.5 rounded-2xl px-3 py-2 cursor-default overflow-hidden"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 340, damping: 24 } }}
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: '0 6px 24px rgba(245,158,11,0.13)',
      }}
    >
      {/* Liquid ripple on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="gem-ripple"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
            style={{
              background: 'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.18), transparent 65%)',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* Glowing trophy icon */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: 36, height: 36,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 0 16px rgba(245,158,11,0.55), 0 0 36px rgba(245,158,11,0.25)',
        }}
      >
        <Trophy className="h-4 w-4 text-white" aria-hidden="true" />
        {/* Inner shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
      </div>

      {/* Text */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] leading-none mb-0.5"
          style={{ color: 'rgba(245,158,11,0.80)' }}>
          הישג חדש
        </p>
        <p className="text-[0.72rem] font-black leading-snug text-violet-950 break-words">
          כיתה י&#x27; 1 שברה שיא ריצה! 🚀
        </p>
      </div>
    </motion.div>
  );
}

// ─── Quick Entry Widget ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function QuickEntry({ lessons }: { lessons: TodayScheduleItem[] }): React.JSX.Element {
  const [hovered, setHovered]       = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  const nextLesson =
    lessons.find(l => l.status === 'next') ??
    lessons.find(l => l.status === 'now')  ??
    null;

  if (nextLesson === null) return <></>;

  return (
    <motion.div
      className="relative mt-2 flex flex-col gap-2 rounded-2xl px-3 py-2.5 cursor-default overflow-hidden"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 340, damping: 24 } }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.45, delay: 0.6 }}
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: '0 6px 24px rgba(245,158,11,0.10)',
      }}
    >
      {/* Liquid ripple on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="qe-ripple"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
            style={{
              background: 'radial-gradient(ellipse at 50% 110%, rgba(245,158,11,0.18), transparent 65%)',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* Eyebrow + time */}
      <div className="relative z-10 flex items-center gap-1.5">
        <span
          className="text-[0.56rem] font-black uppercase tracking-[0.18em] leading-none"
          style={{ color: 'rgba(245,158,11,0.82)' }}
        >
          כניסה מהירה
        </span>
        <span className="h-1 w-1 rounded-full bg-amber-400/60" aria-hidden="true" />
        <span dir="ltr" className="text-[0.58rem] font-bold tabular-nums" style={{ color: '#4c1d95', opacity: 0.75 }}>
          {nextLesson.startTime}
        </span>
      </div>

      {/* Class name */}
      <p className="relative z-10 -mt-0.5 text-[0.70rem] font-black text-violet-950 leading-none break-words">
        {nextLesson.className}
      </p>

      {/* Enter button */}
      <Link href={`/classes/${nextLesson.classId}`} className="relative z-10 block">
        <motion.div
          onHoverStart={() => setBtnHovered(true)}
          onHoverEnd={() => setBtnHovered(false)}
          whileHover={{
            scale: 1.03,
            boxShadow: '0 6px 20px rgba(245,158,11,0.60), 0 0 32px rgba(245,158,11,0.30)',
            transition: { type: 'spring', stiffness: 380, damping: 22 },
          }}
          whileTap={{ scale: 0.97 }}
          className="relative w-full flex items-center justify-center gap-1.5 rounded-xl overflow-hidden py-2 text-white font-black text-[0.68rem] tracking-wide"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            boxShadow: '0 3px 14px rgba(245,158,11,0.45)',
          }}
        >
          {/* Inner shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)' }}
            aria-hidden="true"
          />
          {/* Button hover liquid ripple */}
          <AnimatePresence>
            {btnHovered && (
              <motion.div
                key="btn-ripple"
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.38 }}
                aria-hidden="true"
                style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.26), transparent 65%)' }}
              />
            )}
          </AnimatePresence>
          <span className="relative z-10">כנס לשיעור... ⏱️</span>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
  iconGlow: string;
  rippleColor: string;
  onClick: () => void;
  variant?: 'light' | 'glass';
}

function QuickActionButton({ icon, label, iconBg, iconGlow, rippleColor, onClick, variant = 'light' }: QuickActionButtonProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const isGlass = variant === 'glass';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.025, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 text-center overflow-hidden cursor-pointer md:flex-row md:items-center md:gap-3 md:px-3.5 md:py-3 md:text-start"
      style={isGlass ? {
        background: hovered ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.15)',
        border: hovered ? `1px solid ${iconBg}55` : '1px solid rgba(255,255,255,0.35)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        boxShadow: hovered
          ? `0 6px 24px ${iconGlow}, inset 0 1px 0 rgba(255,255,255,0.50)`
          : 'inset 0 1px 0 rgba(255,255,255,0.40)',
        transition: 'background 0.18s, box-shadow 0.18s, border-color 0.18s',
      } : {
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
            style={{ background: `radial-gradient(ellipse at 20% 50%, ${rippleColor}, transparent 72%)` }}
          />
        )}
      </AnimatePresence>

      {/* Icon capsule */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
        style={{
          width: 38, height: 38,
          background: iconBg,
          boxShadow: isGlass
            ? `0 0 18px ${iconGlow}, 0 0 6px ${iconGlow}`
            : `0 0 14px ${iconGlow}, 0 2px 6px rgba(0,0,0,0.15)`,
        }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)' }}
        />
        {icon}
      </div>

      {/* Label */}
      <span className="relative z-10 text-[11px] font-bold leading-tight text-slate-800 md:text-sm">{label}</span>
    </motion.button>
  );
}

// ─── Quick Actions Panel ──────────────────────────────────────────────────────

interface QuickActionsPanelProps {
  onAddStudent: () => void;
  onAddClass: () => void;
  variant?: 'light' | 'glass';
}

function QuickActionsPanel({ onAddStudent, onAddClass, variant = 'light' }: QuickActionsPanelProps): React.JSX.Element {
  const router = useRouter();
  const isGlass = variant === 'glass';

  const actions: QuickActionButtonProps[] = [
    {
      icon: <UserPlus className="h-4 w-4 text-white" />,
      label: 'הוסף תלמיד',
      iconBg: '#6366f1',
      iconGlow: 'rgba(99,102,241,0.30)',
      rippleColor: 'rgba(99,102,241,0.10)',
      onClick: onAddStudent,
    },
    {
      icon: <CalendarPlus className="h-4 w-4 text-white" />,
      label: 'תכנן שיעור',
      iconBg: '#0ea5e9',
      iconGlow: 'rgba(14,165,233,0.28)',
      rippleColor: 'rgba(14,165,233,0.10)',
      onClick: () => { router.push('/exercise-bank'); },
    },
    {
      icon: <GraduationCap className="h-4 w-4 text-white" />,
      label: 'הוסף כיתה',
      iconBg: '#10b981',
      iconGlow: 'rgba(16,185,129,0.28)',
      rippleColor: 'rgba(16,185,129,0.10)',
      onClick: onAddClass,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.45, delay: 0.35 }}
      className="mt-3 grid grid-cols-3 gap-2 rounded-3xl p-2 md:flex md:flex-col"
      style={isGlass ? {
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(255,255,255,0.70)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
      } : {
        background: 'rgba(255,255,255,0.70)',
        border: '1px solid rgba(226,232,240,0.80)',
        boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
      }}
    >
      {actions.map((action) => (
        <QuickActionButton key={action.label} {...action} variant={variant} />
      ))}
    </motion.div>
  );
}

// ─── Master Session CTA ───────────────────────────────────────────────────────

interface MasterSessionCTAProps {
  activeLesson: TodayScheduleItem | null;
  scheduleLoading: boolean;
}

function MasterSessionCTA({ activeLesson, scheduleLoading }: MasterSessionCTAProps): React.JSX.Element {
  const router = useRouter();
  const hasLesson = activeLesson !== null;

  if (!hasLesson) {
    return (
      <div
        className="relative w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 cursor-not-allowed pointer-events-none select-none"
        style={{
          background: 'rgba(248,250,252,0.80)',
          border: '1px solid rgba(203,213,225,0.60)',
          color: 'rgba(148,163,184,0.90)',
        }}
        aria-disabled="true"
      >
        <Timer className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-black">
          {scheduleLoading ? 'טוען...' : 'אין שיעור פעיל'}
        </span>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => { router.push(`/classes/${activeLesson.classId}`); }}
      whileHover={{
        scale: 1.015,
        boxShadow: '0 10px 30px rgba(5,150,105,0.45)',
        transition: { type: 'spring', stiffness: 360, damping: 24 },
      }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full flex items-center justify-center gap-2.5 rounded-2xl px-4 font-bold overflow-hidden"
      style={{
        height: 48,
        background: 'linear-gradient(135deg, rgba(4,108,78,0.90) 0%, rgba(5,130,95,0.88) 50%, rgba(4,108,78,0.90) 100%)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: '1px solid rgba(110,231,183,0.40)',
        boxShadow: '0 4px 20px rgba(16,185,129,0.28), inset 0 1px 0 rgba(187,247,208,0.22)',
        color: '#ffffff',
      }}
    >
      {/* Glossy top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 rounded-t-2xl"
        style={{ height: '45%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)' }}
        aria-hidden="true"
      />
      {/* Slow wave sweep — soft teal/mint against dark bottle green */}
      <motion.div
        className="pointer-events-none absolute inset-y-0"
        style={{
          insetInlineStart: 0,
          width: '60%',
          background: 'linear-gradient(105deg, transparent 20%, rgba(110,231,183,0.22) 50%, rgba(52,211,153,0.10) 65%, transparent 80%)',
        }}
        animate={{ x: ['-100%', '220%'] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.0 }}
        aria-hidden="true"
      />
      <Timer className="h-5 w-5 shrink-0 relative z-10" aria-hidden="true" />
      <span className="text-center leading-snug relative z-10">
        התחל שיעור
        <br />
        <span className="text-[11px] font-medium opacity-65">{activeLesson.className}</span>
      </span>
    </motion.button>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────

function AddStudentModal({
  open,
  onClose,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassData[];
}): React.JSX.Element {
  const router = useRouter();
  const [classId,   setClassId]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [gender,    setGender]    = useState<Gender>('MALE');
  const [nationalId, setNationalId] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  function reset(): void {
    setClassId(''); setFirstName(''); setLastName('');
    setGender('MALE'); setNationalId(''); setError(null);
  }

  const selectedClass = classes.find((c) => c.id === classId) ?? null;

  const genderMismatch: string | null = (() => {
    if (!selectedClass || selectedClass.genderType === 'MIXED') return null;
    if (selectedClass.genderType === 'BOYS'  && gender === 'FEMALE') return 'לא ניתן להוסיף תלמידה לכיתת בנים';
    if (selectedClass.genderType === 'GIRLS' && gender === 'MALE')   return 'לא ניתן להוסיף תלמיד לכיתת בנות';
    return null;
  })();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (classId === '')    { setError('יש לבחור כיתה'); return; }
    if (genderMismatch)    { setError(genderMismatch);   return; }
    if (!/^\d{1,9}$/.test(nationalId)) { setError('תעודת זהות חייבת להכיל ספרות בלבד (עד 9)'); return; }
    setLoading(true); setError(null);
    try {
      await apiRequest(`/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, gender, nationalId }),
      });
      router.refresh();
      onClose();
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת התלמיד');
    } finally {
      setLoading(false);
    }
  }

  const INPUT_CLS = 'w-full rounded-xl border border-slate-200/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-300 transition-all backdrop-blur-sm';
  const LABEL_CLS = 'block text-xs font-bold text-slate-500 mb-1.5 tracking-wide uppercase';

  const GENDER_OPTIONS: Array<{ value: Gender; label: string; icon: string }> = [
    { value: 'MALE',   label: 'זכר',  icon: '♂' },
    { value: 'FEMALE', label: 'נקבה', icon: '♀' },
    { value: 'OTHER',  label: 'אחר',  icon: '◎' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-3xl p-0"
        dir="rtl"
        style={{
          background:           'rgba(255,255,255,0.92)',
          backdropFilter:       'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border:               '1px solid rgba(255,255,255,0.80)',
          boxShadow:            '0 24px 64px rgba(109,40,217,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
        } as React.CSSProperties}
      >
        {/* Header band */}
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.08) 0%, rgba(124,58,237,0.04) 100%)', borderBottom: '1px solid rgba(109,40,217,0.10)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100">
              <UserPlus className="h-5 w-5 text-violet-600" aria-hidden="true" />
            </div>
            <div>
              <DialogHeader>
                <DialogTitle className="text-start text-base font-black text-slate-800">הוספת תלמיד חדש</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-slate-500 mt-0.5">ת.ז משמשת כסיסמת כניסה ברירת מחדל</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6" noValidate>
          {/* Class */}
          <div>
            <label className={LABEL_CLS}>כיתה</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setError(null); }} required className={INPUT_CLS}>
              <option value="">בחר כיתה...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>שם פרטי</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="ישראל" required className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>שם משפחה</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="ישראלי" required className={INPUT_CLS} />
            </div>
          </div>

          {/* Gender pill selector */}
          <div>
            <label className={LABEL_CLS}>מין</label>
            <div className="grid grid-cols-3 gap-2">
              {GENDER_OPTIONS.map(({ value, label, icon }) => {
                const active = gender === value;
                const blocked = (selectedClass?.genderType === 'BOYS' && value === 'FEMALE')
                             || (selectedClass?.genderType === 'GIRLS' && value === 'MALE');
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={blocked}
                    onClick={() => { setGender(value); setError(null); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={active ? {
                      background: 'linear-gradient(135deg,#6d28d9,#7c3aed)',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(109,40,217,0.35)',
                    } : {
                      background: 'rgba(248,250,252,0.80)',
                      color: '#64748b',
                      border: '1px solid rgba(226,232,240,0.80)',
                    }}
                  >
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            {genderMismatch !== null && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-500">{genderMismatch}</p>
            )}
          </div>

          {/* National ID */}
          <div>
            <label className={LABEL_CLS}>תעודת זהות (ת.ז)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{1,9}"
              maxLength={9}
              value={nationalId}
              onChange={(e) => { setNationalId(e.target.value.replace(/\D/g, '')); setError(null); }}
              placeholder="123456789"
              required
              className={INPUT_CLS}
            />
            <p className="mt-1 text-[11px] text-slate-400">ת.ז תשמש גם כסיסמת כניסה ראשונית לתלמיד</p>
          </div>

          {error !== null && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-red-700"
              style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading || genderMismatch !== null}
            whileHover={!loading ? { y: -1, boxShadow: '0 10px 28px rgba(109,40,217,0.45)' } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', boxShadow: '0 4px 16px rgba(109,40,217,0.32)' }}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>שומר...</span></>
              : <><UserPlus className="h-4 w-4" aria-hidden="true" /><span>הוסף תלמיד</span></>}
          </motion.button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attention Panel — stagger presets ───────────────────────────────────────

const ATTENTION_STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.20 } },
};

const ATTENTION_ITEM = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { ease: [0.22, 1, 0.36, 1] as const, duration: 0.40 } },
};

// ─── Mock data for alerts & reminders ────────────────────────────────────────

type AlertVariant = 'warning' | 'info';

interface MockAlert    { id: string; variant: AlertVariant; text: string }
interface MockReminder { id: string; text: string; badge: string }

const MOCK_ALERTS: MockAlert[] = [
  { id: 'a1', variant: 'warning', text: "3 תלמידים נעדרו השבוע מכיתה ז' 2" },
  { id: 'a2', variant: 'info',    text: "2 תלמידים חדשים מחכים לשיבוץ" },
];

const MOCK_REMINDERS: MockReminder[] = [
  { id: 'r1', text: "לערוך מבחן ריצה לכיתה ט' 1", badge: 'בעוד 3 ימים' },
  { id: 'r2', text: "לעדכן ציונים לסמסטר ב'",      badge: 'בעוד 5 ימים' },
];

// Alert variant visual config
const ALERT_VISUAL: Record<AlertVariant, { iconEl: React.JSX.Element; bg: string; border: string }> = {
  warning: {
    iconEl: <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: '#d97706' }} aria-hidden="true" />,
    bg:     'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.22)',
  },
  info: {
    iconEl: <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: '#2563eb' }} aria-hidden="true" />,
    bg:     'rgba(37,99,235,0.07)',
    border: 'rgba(37,99,235,0.18)',
  },
};

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ variant, text }: MockAlert): React.JSX.Element {
  const cfg = ALERT_VISUAL[variant];
  return (
    <motion.div
      variants={ATTENTION_ITEM}
      className="flex items-start gap-2 rounded-xl px-2.5 py-1.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.iconEl}
      <span className="text-xs font-semibold text-slate-700 leading-snug">{text}</span>
    </motion.div>
  );
}

// ─── Reminder Row ─────────────────────────────────────────────────────────────

function ReminderRow({ text, badge }: MockReminder): React.JSX.Element {
  return (
    <motion.div
      variants={ATTENTION_ITEM}
      className="flex items-start justify-between gap-1.5"
    >
      <div className="flex items-start gap-1.5 min-w-0">
        <div
          className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: '#7c3aed', boxShadow: '0 0 6px rgba(124,58,237,0.50)' }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-slate-700 leading-snug break-words">{text}</span>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[0.58rem] font-bold leading-none whitespace-nowrap"
        style={{ background: 'rgba(109,40,217,0.10)', color: '#6d28d9', border: '1px solid rgba(109,40,217,0.18)' }}
      >
        {badge}
      </span>
    </motion.div>
  );
}

// ─── Attention Panel ──────────────────────────────────────────────────────────

interface AttentionPanelProps { onAddReminder: () => void }

function AttentionPanel({ onAddReminder }: AttentionPanelProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE, duration: 0.50, delay: 0.28 }}
      className="flex flex-col gap-2.5 rounded-2xl p-3 flex-1"
      style={{
        background: 'rgba(255,255,255,0.40)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: '0 4px 16px rgba(15,23,42,0.07)',
      }}
    >
      {/* ── Section A: Alerts ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
          <span className="text-[9px] font-black uppercase tracking-[0.20em] text-slate-400">דורש טיפול</span>
        </div>
        <motion.div variants={ATTENTION_STAGGER} initial="hidden" animate="show" className="flex flex-col gap-1.5">
          {MOCK_ALERTS.map((alert) => (
            <AlertRow key={alert.id} {...alert} />
          ))}
        </motion.div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} aria-hidden="true" />

      {/* ── Section B: Reminders ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-violet-400 shrink-0" aria-hidden="true" />
          <span className="text-[9px] font-black uppercase tracking-[0.20em] text-slate-400">תזכורות</span>
          {/* Compact add button — replaces the full-width button */}
          <motion.button
            type="button"
            onClick={onAddReminder}
            whileHover={{
              scale: 1.15,
              boxShadow: '0 0 10px rgba(109,40,217,0.45)',
              transition: { type: 'spring', stiffness: 400, damping: 22 },
            }}
            whileTap={{ scale: 0.90 }}
            className="ms-auto flex h-5 w-5 items-center justify-center rounded-full text-violet-600"
            style={{
              background: 'rgba(109,40,217,0.10)',
              border: '1px solid rgba(109,40,217,0.25)',
              boxShadow: '0 0 6px rgba(109,40,217,0.22)',
            }}
            aria-label="הוסף תזכורת"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </motion.button>
        </div>
        <motion.div variants={ATTENTION_STAGGER} initial="hidden" animate="show" className="flex flex-col gap-2">
          {MOCK_REMINDERS.map((reminder) => (
            <ReminderRow key={reminder.id} {...reminder} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Add Reminder Modal ───────────────────────────────────────────────────────

function AddReminderModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const router = useRouter();
  const [title, setTitle]     = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function reset(): void { setTitle(''); setDueDate(''); setError(null); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/events', {
        method: 'POST',
        body: JSON.stringify({ title, eventDate: `${dueDate}T00:00:00.000Z` }),
      });
      router.refresh();
      onClose();
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת התזכורת');
    } finally {
      setLoading(false);
    }
  }

  const INPUT_CLS = 'w-full rounded-xl border border-white/30 bg-white/20 px-4 py-2.5 text-sm font-semibold text-violet-950 placeholder:text-violet-950/40 outline-none focus:ring-2 focus:ring-violet-500/60 transition-shadow';
  const LABEL_CLS = 'block text-xs font-black text-slate-600 mb-1.5 tracking-wide';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start text-lg font-black text-violet-950">הוספת תזכורת חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1" noValidate>
          {/* Title */}
          <div>
            <label className={LABEL_CLS}>תיאור המשימה</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: לעדכן ציונים לסמסטר ב'" required className={INPUT_CLS} />
          </div>

          {/* Due date */}
          <div>
            <label className={LABEL_CLS}>תאריך לביצוע</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              required className={INPUT_CLS} style={{ colorScheme: 'light' }} />
          </div>

          {error !== null && (
            <div className="rounded-xl px-3 py-2 text-xs font-semibold text-red-700"
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)' }}>
              {error}
            </div>
          )}

          <motion.button type="submit" disabled={loading}
            whileHover={!loading ? { y: -1, boxShadow: '0 8px 24px rgba(109,40,217,0.45)', transition: { type: 'spring', stiffness: 380, damping: 24 } } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed)', boxShadow: '0 4px 16px rgba(109,40,217,0.35)' }}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>שומר...</span></>
              : <span>הוסף תזכורת</span>}
          </motion.button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner(): React.JSX.Element {
  const { teacher } = useCurrentTeacher();
  const { data: reportSettings } = useReportSettings();
  const { activeSemester } = useSemester();
  const { lessons, isLoading: scheduleLoading } = useTodaySchedule(activeSemester);
  const { data: classesData } = useClasses();

  const [isAddStudentOpen,  setIsAddStudentOpen]  = useState(false);
  const [isAddClassOpen,    setIsAddClassOpen]    = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);

  // Prefer the teacher's custom name; fall back to first word of the Google display name.
  const teacherFirstName = reportSettings?.teacherName ?? teacher?.name?.split(' ')[0] ?? '...';
  const teacherSchool    = reportSettings?.schoolName ?? teacher?.school ?? null;

  const studentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (classesData ?? []).forEach((c: ClassData) => map.set(c.id, c.studentCount));
    return map;
  }, [classesData]);

  const activeLesson = useMemo(
    () =>
      lessons?.find((l) => l.status === 'now') ??
      lessons?.find((l) => l.status === 'next') ??
      null,
    [lessons],
  );

  return (
    <motion.div variants={ITEM} className="relative overflow-hidden rounded-3xl">
      {/* ── Modals ── */}
      <AddStudentModal  open={isAddStudentOpen}  onClose={() => setIsAddStudentOpen(false)} classes={classesData ?? []} />
      <AddClassModal    open={isAddClassOpen}    onClose={() => setIsAddClassOpen(false)} />
      <AddReminderModal open={isAddReminderOpen} onClose={() => setIsAddReminderOpen(false)} />

      {/* ── Frosted-glass shell ── */}
      <div
        className="absolute inset-0 rounded-3xl overflow-hidden"
        aria-hidden="true"
        style={{
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.20)',
          boxShadow: '0 8px 32px rgba(15,23,42,0.06)',
        }}
      >
        {/* Wave orb 1 — violet/indigo drift (top-start) */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 900, height: 900,
            top: '-50%', insetInlineStart: '-20%',
            background: activeSemester === 'A'
              ? 'radial-gradient(circle, rgba(109,40,217,0.18) 0%, rgba(99,102,241,0.10) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(34,197,94,0.14) 0%, rgba(16,185,129,0.08) 40%, transparent 70%)',
            filter: 'blur(42px)',
          }}
          animate={{ x: [0, 80, 20, 0], y: [0, 40, -10, 0], scale: [1, 1.14, 1.05, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Wave orb 2 — ambient drift (bottom-end), semester-aware */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 700, height: 700,
            bottom: '-40%', insetInlineEnd: '5%',
            background: activeSemester === 'A'
              ? 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.07) 45%, transparent 70%)'
              : 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, rgba(52,211,153,0.07) 45%, transparent 70%)',
            filter: 'blur(38px)',
          }}
          animate={{ x: [0, -60, -20, 0], y: [0, -30, 10, 0], scale: [1, 1.12, 1.04, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        {/* Wave orb 3 — violet accent (center) */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 500, height: 500,
            top: '20%', insetInlineStart: '30%',
            background: 'radial-gradient(circle, rgba(109,40,217,0.10) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)',
            filter: 'blur(50px)',
          }}
          animate={{ x: [0, 40, -30, 0], y: [0, -20, 30, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        />
        {/* Wave orb 4 — indigo/fuchsia accent (top-end) */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 600, height: 600,
            top: '-20%', insetInlineEnd: '-10%',
            background: activeSemester === 'A'
              ? 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.07) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, rgba(20,184,166,0.06) 50%, transparent 70%)',
            filter: 'blur(44px)',
          }}
          animate={{ x: [0, -40, 10, 0], y: [0, 50, 20, 0], scale: [1, 1.10, 1.02, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 11 }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-12"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.12), transparent)' }}
        />
      </div>

      {/* ── greeting-wave keyframes (used by desktop h1/h2 below) ── */}
      <style>{`
        @keyframes greeting-wave {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      {/* ── Three-column grid — compressed, tight bento ── */}
      <div
        dir="ltr"
        className="relative grid grid-cols-1 md:grid-cols-[238px_1fr_208px] gap-2 px-4 pb-3"
        style={{ zIndex: 2, paddingTop: 4 }}
      >

        {/* ── LEFT: greeting + quick actions + master CTA (desktop only) ── */}
        <div dir="rtl" className="relative hidden md:flex flex-col justify-between h-full pb-2 overflow-hidden">
          {/* Top group: Greeting + Quick Actions */}
          <div>
            {/* Greeting — desktop only; mobile uses the micro-header above */}
            <div className="relative z-10 pt-4 hidden md:block">
              <h1
                className="text-3xl font-black tracking-tight leading-none mb-2"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #1e1b4b 0%, #4c1d95 25%, #7c3aed 50%, #4c1d95 75%, #1e1b4b 100%)',
                  backgroundSize: '200% auto',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                  animation: 'greeting-wave 6s linear infinite',
                }}
              >
                שלום, {teacherFirstName}!
              </h1>
              {teacherSchool !== null && (
                <h2
                  className="text-3xl font-black tracking-tight leading-none"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #1e1b4b 0%, #4c1d95 25%, #7c3aed 50%, #4c1d95 75%, #1e1b4b 100%)',
                    backgroundSize: '200% auto',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                    animation: 'greeting-wave 6s linear infinite',
                  }}
                >{teacherSchool}</h2>
              )}
            </div>

            <div className="hidden md:block">
              <QuickActionsPanel
                onAddStudent={() => setIsAddStudentOpen(true)}
                onAddClass={() => setIsAddClassOpen(true)}
              />
            </div>
          </div>

          {/* Bottom: Master Session CTA (desktop only) */}
          <div className="hidden md:block">
            <MasterSessionCTA activeLesson={activeLesson} scheduleLoading={scheduleLoading} />
          </div>
        </div>

        {/* ── CENTER: shimmer clock + redesigned schedule panel ── */}
        <motion.div
          dir="rtl"
          variants={WIDGET_ENTER}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2 overflow-hidden"
        >
          {/* Clock card — unchanged */}
          <motion.div
            variants={WIDGET_ITEM}
            whileHover={{ y: -3, scale: 1.02, transition: { type: 'spring', stiffness: 280, damping: 20 } }}
            className="flex flex-col items-center justify-center cursor-default rounded-2xl"
            style={{
              padding: '9px 14px',
              background: 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.60)',
              boxShadow: '0 8px 32px rgba(31,38,135,0.07)',
            }}
          >
            <style>{`
              @keyframes shimmer-wave {
                0%   { background-position: 200% center; }
                100% { background-position: -200% center; }
              }
            `}</style>
            {/* ── Mobile greeting — top-left corner of clock card ── */}
            <div className="md:hidden w-full flex justify-end items-start px-2 pt-2 pb-3" dir="rtl">
              <span className="text-lg font-semibold tracking-tight" style={{ color: 'rgba(76,29,149,0.90)' }}>
                שלום, {teacherFirstName} 👋
              </span>
            </div>

            <div
              dir="ltr"
              className="flex items-baseline leading-none select-none tabular-nums"
              style={{
                fontFamily: "'Bebas Neue', cursive",
                letterSpacing: '0.02em',
                fontSize: '2.3rem',
                fontWeight: 900,
                lineHeight: 1,
                backgroundImage: 'linear-gradient(90deg, #0f0c29 0%, #1e1b4b 18%, #4c1d95 35%, #7c3aed 50%, #4c1d95 65%, #1e1b4b 82%, #0f0c29 100%)',
                backgroundSize: '200% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer-wave 10s linear infinite',
              }}
            >
              <DigitalClock />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(99,102,241,0.80)' }} aria-hidden="true" />
              <span className="text-sm font-medium leading-tight" style={{ color: 'rgba(51,65,85,0.75)' }}>
                <HebrewDate />
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSemester}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center gap-1.5 mt-1.5"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{
                    background: activeSemester === 'A'
                      ? 'rgba(139,92,246,0.85)'
                      : 'rgba(34,197,94,0.85)',
                    boxShadow: activeSemester === 'A'
                      ? '0 0 6px rgba(139,92,246,0.50)'
                      : '0 0 6px rgba(34,197,94,0.50)',
                  }}
                  aria-hidden="true"
                />
                <span
                  className="text-[0.68rem] font-bold tracking-wide"
                  style={{
                    color: activeSemester === 'A'
                      ? 'rgba(109,40,217,0.80)'
                      : 'rgba(22,163,74,0.85)',
                  }}
                >
                  {activeSemester === 'A' ? 'מחצית א׳ פעילה' : 'מחצית ב׳ פעילה'}
                </span>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* ── Schedule panel — fills remaining height, no dead space ── */}
          <motion.div
            variants={WIDGET_ITEM}
            className="relative flex flex-col cursor-default rounded-3xl overflow-hidden"
            style={{
              flex: 1,
              padding: '16px 16px',
              background: 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
            }}
          >
            {/* Panel header + daily progress */}
            <div className="relative z-10 mb-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-violet-400 shrink-0" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-[0.20em] text-slate-400">לוח שיעורים היום</span>
              </div>
              {lessons && lessons.length > 0 && (() => {
                const done  = lessons.filter(l => l.status === 'past').length + (lessons.some(l => l.status === 'now') ? 1 : 0);
                const total = lessons.length;
                const pct   = total > 0 ? done / total : 0;
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.58rem] font-bold text-slate-500">
                        {done} מתוך {total} שיעורים הסתיימו
                      </span>
                      <span dir="ltr" className="text-[0.58rem] font-black tabular-nums" style={{ color: '#6d28d9' }}>
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #0d9488, #14b8a6, #5eead4)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct * 100}%` }}
                        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] as const, delay: 0.4 }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col flex-1">
              {scheduleLoading ? (
                /* Loading skeleton */
                [1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="mb-2 h-10 animate-pulse rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.05)' }}
                  />
                ))
              ) : !lessons || lessons.length === 0 ? (
                /* Empty state */
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm font-medium text-slate-400">אין שיעורים מתוכננים להיום</p>
                </div>
              ) : (
                /* Lesson rows — stagger entrance with breathing room */
                <motion.div
                  variants={TIMELINE_STAGGER}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-2"
                >
                  {lessons.map((lesson, idx) => (
                    <ScheduleLessonRow
                      key={lesson.period}
                      lesson={lesson}
                      index={idx}
                      isLast={idx === lessons.length - 1}
                      studentCount={studentCountMap.get(lesson.classId) ?? 0}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            {/* Mobile-only: Master Session CTA inside schedule card */}
            <div className="block md:hidden mt-3">
              <MasterSessionCTA activeLesson={activeLesson} scheduleLoading={scheduleLoading} />
            </div>
          </motion.div>

          {/* Mobile-only: Quick actions side-by-side beneath schedule */}
          <div className="block md:hidden">
            <QuickActionsPanel
              onAddStudent={() => setIsAddStudentOpen(true)}
              onAddClass={() => setIsAddClassOpen(true)}
              variant="glass"
            />
          </div>
        </motion.div>

        {/* ── RIGHT: attention panel ── */}
        <div dir="rtl" className="flex flex-col h-full">
          <AttentionPanel onAddReminder={() => setIsAddReminderOpen(true)} />
        </div>

      </div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ministry of Education national fitness norm average. */
const MINISTRY_NORM = 74;

type FitnessLevel = 'above' | 'average' | 'below';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fitnessLevel(avg: number): FitnessLevel {
  if (avg >= 80) return 'above';
  if (avg >= 65) return 'average';
  return 'below';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LEVEL_CONFIG: Record<FitnessLevel, { label: string; bg: string; text: string; dot: string }> = {
  above:   { label: 'מעל לנורמה',  bg: 'bg-emerald-100',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  average: { label: 'ממוצע',        bg: 'bg-amber-100',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  below:   { label: 'מתחת לנורמה', bg: 'bg-red-100',      text: 'text-red-700',     dot: 'bg-red-500'     },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SEMESTER_LABELS: Record<'A' | 'B', string> = { A: "סמסטר א'", B: "סמסטר ב'" };

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

function formatSession(isoString: string): { day: string; month: string; dayLabel: string } {
  const date = new Date(isoString);
  return {
    day:      date.getDate().toString().padStart(2, '0'),
    month:    (date.getMonth() + 1).toString().padStart(2, '0'),
    dayLabel: DAY_NAMES[date.getDay()] ?? '',
  };
}

// ─── Mock / demo data ─────────────────────────────────────────────────────────

const MOCK_STATS: DashboardStats = {
  overallFitnessAvg:    76,
  overallAttendancePct: 88,
  totalBelowNormCount:  4,
  totalStudents:        67,
  pendingResultsCount:  3,
  classStats: [
    { classId: 'cls-1', fitnessAvg: 79, attendancePct: 91, belowNormCount: 1 },
    { classId: 'cls-2', fitnessAvg: 71, attendancePct: 84, belowNormCount: 2 },
    { classId: 'cls-3', fitnessAvg: 82, attendancePct: 93, belowNormCount: 0 },
  ],
  recentSessions: [
    { sessionId: 'sess-1', classId: 'cls-1', className: "י'1", testNameHe: 'ריצת 2000 מטר',   conductedAt: '2026-03-13T10:00:00.000Z' },
    { sessionId: 'sess-2', classId: 'cls-2', className: "י'2", testNameHe: 'כפיפות בטן',      conductedAt: '2026-03-11T09:00:00.000Z' },
    { sessionId: 'sess-3', classId: 'cls-3', className: "ט'1", testNameHe: 'שכיבות סמיכה',    conductedAt: '2026-03-10T11:00:00.000Z' },
    { sessionId: 'sess-4', classId: 'cls-1', className: "י'1", testNameHe: 'קפיצה למרחק',     conductedAt: '2026-03-06T10:00:00.000Z' },
    { sessionId: 'sess-5', classId: 'cls-2', className: "ח'2", testNameHe: 'ריצת מקום',       conductedAt: '2026-03-04T08:30:00.000Z' },
  ],
};


const MOCK_UPCOMING_EVENT: EventData = {
  id:          'evt-1',
  title:       'יום ספורט בית-ספרי',
  description: null,
  eventDate:   '2026-03-25T09:00:00.000Z',
  location:    'מגרש החוץ',
  teacherId:   'teacher-mock',
  createdAt:   '2026-03-01T00:00:00.000Z',
  updatedAt:   '2026-03-01T00:00:00.000Z',
};

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Missing Results Modal ────────────────────────────────────────────────────

function MissingResultsModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const { activeSemester } = useSemester();
  const { data, isLoading, error } = useSWR<MissingResultItem[]>(
    open ? `/dashboard/missing-results?semester=${activeSemester}` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-lg rounded-3xl border border-amber-200/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
              <ClipboardX className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-amber-900">
                {`תוצאות חסרות — מחצית ${activeSemester === 'A' ? 'א׳' : 'ב׳'}`}
              </DialogTitle>
              <p className="text-xs text-amber-700/70">תלמידים שלא ניגשו למבחן</p>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2 mt-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-2xl bg-amber-50" />
              ))}
            </div>
          )}
          {error && (
            <p className="py-6 text-center text-sm text-red-500">שגיאה בטעינת הנתונים. נסה שוב.</p>
          )}
          {!isLoading && data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardX className="h-8 w-8 text-amber-400/60" aria-hidden="true" />
              <p className="text-sm font-semibold text-amber-700">אין תוצאות חסרות</p>
              <p className="text-xs text-amber-600/70">כל התלמידים ניגשו לכל המבחנים</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && data.map((item, i) => {
            const { day, month } = formatSession(item.sessionDate);
            return (
              <motion.div
                key={`${item.studentId}-${item.sessionId}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: EASE, duration: 0.35, delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200/60 px-4 py-3"
              >
                <div className="shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-amber-500 text-white">
                  <span className="text-xs font-extrabold leading-none">{day}</span>
                  <span className="text-[9px] leading-none opacity-80 mt-0.5">{month}/</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.studentName}</p>
                  <p className="text-xs text-slate-500 truncate">{item.className} · {item.testNameHe}</p>
                </div>
                <Link
                  href={`/classes/${item.classId}/session/${item.sessionId}/manual`}
                  className="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-800 hover:underline underline-offset-2 transition-colors"
                >
                  הזן עכשיו
                </Link>
              </motion.div>
            );
          })}
        </div>
        {!isLoading && data && data.length > 0 && (
          <p className="text-center text-xs text-amber-600/70 pt-1">{data.length} תוצאות חסרות</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Below Norm Modal ─────────────────────────────────────────────────────────

function BelowNormModal({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const { activeSemester } = useSemester();
  const { data, isLoading, error } = useSWR<BelowNormItem[]>(
    open ? `/dashboard/below-norm-details?semester=${activeSemester}` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-lg rounded-3xl border border-red-200/60 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
      >
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-red-900">
                {`תלמידים לטיפול — מחצית ${activeSemester === 'A' ? 'א׳' : 'ב׳'}`}
              </DialogTitle>
              <p className="text-xs text-red-600/70">ציון מתחת לנורמה ({data?.[0]?.normThreshold ?? 57})</p>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-2 mt-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-2xl bg-red-50" />
              ))}
            </div>
          )}
          {error && (
            <p className="py-6 text-center text-sm text-red-500">שגיאה בטעינת הנתונים. נסה שוב.</p>
          )}
          {!isLoading && data?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-red-400/60" aria-hidden="true" />
              <p className="text-sm font-semibold text-red-700">אין תלמידים מתחת לנורמה</p>
              <p className="text-xs text-red-600/60">כל התלמידים עומדים בנורמה</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && data.map((item, i) => (
            <motion.div
              key={`${item.studentId}-${item.testNameHe}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE, duration: 0.35, delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200/60 px-4 py-3"
            >
              <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-red-500 text-white">
                <span className="text-sm font-extrabold leading-none">{getHebrewGradeLabel(item.score)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.studentName}</p>
                <p className="text-xs text-slate-500 truncate">{item.className} · {item.testNameHe}</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-xs font-bold text-red-600">{item.score - item.normThreshold}</p>
                <p className="text-[10px] text-red-500/70">מנורמה</p>
              </div>
            </motion.div>
          ))}
        </div>
        {!isLoading && data && data.length > 0 && (
          <p className="text-center text-xs text-red-600/60 pt-1">{data.length} תוצאות מתחת לנורמה</p>
        )}
      </DialogContent>
    </Dialog>
  );
}


// ─── KPI Card — Mode A white surface ─────────────────────────────────────────

interface KpiCardProps {
  label:        string;
  value:        number;
  valueSuffix?: string;
  sub:          string;
  icon:         typeof Dumbbell;
  iconBg:       string;
  valueColor:   string;
  accentGrad:   string;
  /** CSS rgba color for the liquid-wave bottom-bloom ripple */
  glowColor:    string;
  trend?:       'up' | 'down' | 'alert' | 'neutral';
  onClick?:     () => void;
}

function KpiCard({
  label, value, valueSuffix, sub, icon: Icon,
  iconBg, valueColor, accentGrad, glowColor, trend, onClick,
}: KpiCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const { motionStyle, onMouseMove, onMouseLeave } = useTilt(8);
  const { activeSemester: cardSemester } = useSemester();
  const semHoverShadow = cardSemester === 'A'
    ? `0 0 0 1px rgba(139,92,246,0.22), 0 28px 52px -12px rgba(109,40,217,0.22), 0 0 44px rgba(0,212,255,0.10)`
    : `0 0 0 1px rgba(34,197,94,0.22), 0 28px 52px -12px rgba(22,163,74,0.22), 0 0 44px rgba(0,212,255,0.10)`;
  const semLinkColor = cardSemester === 'A' ? '#7c3aed' : '#15803d';

  return (
    <motion.div
      variants={ITEM}
      style={{ ...motionStyle, background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(25px) saturate(180%)', WebkitBackdropFilter: 'blur(25px) saturate(180%)' }}
      onMouseMove={onMouseMove}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => { setHovered(false); onMouseLeave(); }}
      whileHover={{
        y: -6,
        scale: 1.01,
        boxShadow: semHoverShadow,
        transition: { type: 'spring', stiffness: 280, damping: 20 },
      }}
      whileTap={{ scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
      onClick={onClick}
      className={`relative flex flex-col gap-3 overflow-hidden rounded-3xl p-4 md:p-5 border border-[var(--semester-border,rgba(139,92,246,0.20))] transition-[border-color] duration-700 shadow-[0_8px_32px_rgba(31,38,135,0.13)] ${onClick ? 'cursor-pointer select-none' : 'cursor-default'}`}
    >
      {/* Top accent gradient bar */}
      <div
        className={`absolute top-0 inset-x-0 h-[3px] rounded-t-3xl bg-gradient-to-r ${accentGrad}`}
        style={{ filter: 'blur(0.4px)', boxShadow: '0 1px 8px 0 rgba(109,40,217,0.25)' }}
      />

      {/* Liquid-wave bottom-bloom ripple — blooms upward on hover */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-3xl"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.42, ease: 'easeOut' }}
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 115%, ${glowColor} 0%, transparent 62%)`,
          zIndex: 0,
        }}
      />

      {/* Card content — z-10 to sit above ripple */}
      <div className="relative z-10 flex items-center justify-between mt-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <motion.div
          className={`pointer-events-none flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}
          animate={hovered ? { rotate: 8, scale: 1.12 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        >
          <Icon className="h-5 w-5 text-white" aria-hidden="true" />
        </motion.div>
      </div>

      <div className="relative z-10">
        <CountUp
          end={value}
          suffix={valueSuffix ?? ''}
          className={`text-4xl md:text-5xl font-extrabold tabular-nums leading-none ${valueColor}`}
          duration={1.6}
          useEasing
        />
        <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
          trend === 'up'    ? 'text-emerald-600' :
          trend === 'down'  ? 'text-red-500'     :
          trend === 'alert' ? 'text-red-500'     :
                              'text-slate-500'
        }`}>
          {trend === 'up'    && <TrendingUp    className="h-3 w-3" />}
          {trend === 'down'  && <TrendingDown  className="h-3 w-3" />}
          {trend === 'alert' && <AlertTriangle className="h-3 w-3" />}
          <span className="truncate">{sub}</span>
        </div>
      </div>

      {onClick && (
        <p className="relative z-10 flex items-center gap-1 text-[10px] font-semibold tracking-wide -mt-1" style={{ color: semLinkColor }}>
          לחץ לפרטים
          <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        </p>
      )}
    </motion.div>
  );
}

// ─── Class Average Trend Chart ────────────────────────────────────────────────

const CHART_LINE_COLORS = [
  '#7c3aed', '#10b981', '#06b6d4', '#f59e0b', '#e11d48', '#6366f1',
] as const;

interface TrendTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ color: string; name: string; value: number }>;
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl border border-white/10 px-3.5 py-2.5 min-w-[130px]"
      style={{ background: 'rgba(10,5,28,0.94)', backdropFilter: 'blur(20px)' }}
    >
      <p className="text-[10px] font-black tracking-widest uppercase text-white/40 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs mb-1 last:mb-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-white/60 flex-1">{entry.name}</span>
          <span className="font-black tabular-nums" style={{ color: entry.color }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Format "YYYY-MM" → short Hebrew month label e.g. "ספט׳" */
function formatMonthLabel(yyyyMm: string): string {
  const LABELS: Record<string, string> = {
    '01': 'ינו׳', '02': 'פבר׳', '03': 'מרץ׳', '04': 'אפר׳',
    '05': 'מאי',  '06': 'יוני', '07': 'יול׳', '08': 'אוג׳',
    '09': 'ספט׳', '10': 'אוק׳', '11': 'נוב׳', '12': 'דצמ׳',
  };
  const mm = yyyyMm.slice(5, 7);
  return LABELS[mm] ?? mm;
}

/**
 * Pivot flat MonthlyClassAverage rows into wide Recharts rows.
 * Input:  [{ month: '2025-09', className: 'כיתה ז 1', avg: 78 }, ...]
 * Output: [{ month: 'ספט׳', 'כיתה ז 1': 78, ... }, ...]
 */
function pivotToChartRows(
  rows: MonthlyClassAverage[],
): Array<Record<string, string | number>> {
  const monthMap = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const label = formatMonthLabel(row.month);
    if (!monthMap.has(row.month)) {
      monthMap.set(row.month, { month: label });
    }
    monthMap.get(row.month)![row.className] = row.avg;
  }
  return Array.from(monthMap.values());
}

interface ClassAverageTrendChartProps {
  semester: import('@fitgrade/types').Semester;
}

function ClassAverageTrendChart({ semester }: ClassAverageTrendChartProps): React.JSX.Element {
  const { data: rawRows, isLoading } = useClassAverages(semester);

  const { chartRows, classNames } = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return { chartRows: [], classNames: [] };
    const pivoted = pivotToChartRows(rawRows);
    const names = Array.from(new Set(rawRows.map((r) => r.className))).slice(0, 6);
    return { chartRows: pivoted, classNames: names };
  }, [rawRows]);

  const lines = classNames.map((name, i) => ({
    key:    name,
    label:  name,
    color:  CHART_LINE_COLORS[i % CHART_LINE_COLORS.length] ?? '#7c3aed',
    gradId: `grad-cls-${i}`,
  }));

  return (
    <motion.div
      variants={ITEM}
      className="flex flex-col rounded-3xl overflow-hidden h-full min-h-[280px] md:min-h-0 relative"
      style={{
        background:           'rgba(255,255,255,0.38)',
        backdropFilter:       'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        border:               '1px solid var(--semester-border, rgba(139,92,246,0.20))',
        transition:           'border-color 0.7s ease',
        boxShadow:            '0 0 80px rgba(109,40,217,0.13), 0 0 40px rgba(79,70,229,0.09), 0 8px 32px rgba(31,38,135,0.12)',
      }}
    >
      {/* Ambient halo */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at 30% 0%, rgba(109,40,217,0.10) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(79,70,229,0.08) 0%, transparent 50%)',
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex h-1.5 w-6 rounded-full"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
              aria-hidden="true"
            />
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-500/60">מגמת שיפור</span>
          </div>
          <h2
            className="text-base font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #5b21b6 0%, #0e7490 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ממוצעי כיתות - מגמת שיפור
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">ביצועים לפי חודש</p>
        </div>
        {/* Legend pills */}
        {lines.length > 0 && (
          <div className="flex flex-col gap-1 items-end">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-slate-600">{l.label}</span>
                <span className="h-1.5 w-4 rounded-full" style={{ background: l.color }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart or empty state */}
      <div className="relative flex-1 min-h-0 px-2 pb-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : chartRows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
            <BookOpen className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-500">אין עדיין נתונים למחצית זו</p>
            <p className="text-xs text-slate-400">הגרף יתעדכן לאחר רישום תוצאות מבחן</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartRows}
              margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
            >
              <defs>
                {lines.map((l) => (
                  <linearGradient key={l.gradId} id={l.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={l.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={l.color} stopOpacity={0}    />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid stroke="rgba(109,40,217,0.07)" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'rgba(30,20,60,0.52)', fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[50, 100]}
                tick={{ fill: 'rgba(30,20,60,0.42)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: 'rgba(109,40,217,0.18)', strokeWidth: 1 }}
              />
              {lines.map((l) => (
                <Area
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.label}
                  stroke={l.color}
                  strokeWidth={2.5}
                  fill={`url(#${l.gradId})`}
                  dot={{ r: 3.5, fill: l.color, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: l.color, strokeWidth: 2, stroke: 'rgba(255,255,255,0.3)' }}
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const { activeSemester } = useSemester();
  // useDeferredValue lets React deprioritize the data-hook re-renders triggered
  // by a semester change, so the sidebar toggle feels instant while the mass
  // SWR refetch is scheduled as low-priority work — eliminating the freeze.
  const deferredSemester = useDeferredValue(activeSemester);
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats(deferredSemester);
  const { data: upcomingEvent, isLoading: eventLoading } = useUpcomingEvent();

  useSignalPageReady('dashboard', stats !== undefined);

  const [missingOpen,   setMissingOpen]   = useState(false);
  const [belowNormOpen, setBelowNormOpen] = useState(false);

  const isLoading = statsLoading;

  const hasRealData           = Boolean(stats && stats.totalStudents > 0);
  const effectiveStats        = hasRealData ? stats! : MOCK_STATS;
  const effectiveEvent        = upcomingEvent ?? MOCK_UPCOMING_EVENT;

  const fitnessAvg     = effectiveStats.overallFitnessAvg;
  const attendancePct  = effectiveStats.overallAttendancePct;
  const belowNormCount = effectiveStats.totalBelowNormCount;
  const totalStudents  = effectiveStats.totalStudents;
  const pendingResults = effectiveStats.pendingResultsCount;
  const recentSessions: RecentSession[] = effectiveStats.recentSessions;

  const normDeltaLabel = fitnessAvg > 0
    ? `${fitnessAvg >= MINISTRY_NORM ? '+' : ''}${fitnessAvg - MINISTRY_NORM} מנורמה`
    : 'אין נתונים עדיין';

  if (isLoading) return <DashboardSkeleton />;

  if (statsError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" />
        <p className="text-base font-semibold text-red-700">שגיאה בטעינת הנתונים</p>
        <p className="text-sm text-red-500">לא ניתן לטעון את נתוני לוח הבקרה — נסה לרענן את הדף</p>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="dashboard"
          variants={PAGE_ENTER}
          initial="hidden"
          animate="show"
          className="relative space-y-2 mt-0 pt-0"
        >

          {/* ── Subtle 4% mesh grid overlay ───────────────────────────────── */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              zIndex: 0,
              backgroundImage: 'linear-gradient(rgba(109,40,217,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(109,40,217,0.04) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          {/* ── 8% athlete grayscale watermark — pinned to the start side ── */}
          <div
            className="pointer-events-none select-none absolute inset-y-0 start-0 hidden md:block"
            aria-hidden="true"
            style={{ zIndex: 0, width: 260, overflow: 'hidden' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/models_photo/hero-female.png"
              alt=""
              className="absolute bottom-0 w-auto object-contain object-bottom"
              style={{
                height: '55%',
                insetInlineStart: '-40px',
                filter: 'grayscale(100%) sepia(8%)',
                opacity: 0.08,
              }}
            />
          </div>

          {/* ── Floating ambient sport icons — behind all content ─────────── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ zIndex: 0 }}>
            <motion.div
              className="absolute text-violet-400/[0.12]"
              style={{ top: '22%', insetInlineEnd: '4%' }}
              animate={{ y: [0, -22, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Dumbbell className="h-20 w-20" />
            </motion.div>
            <motion.div
              className="absolute text-indigo-400/[0.09]"
              style={{ top: '52%', insetInlineStart: '3%' }}
              animate={{ y: [0, 18, 0], rotate: [0, -8, 0] }}
              transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            >
              <Timer className="h-16 w-16" />
            </motion.div>
            <motion.div
              className="absolute text-emerald-400/[0.08]"
              style={{ top: '78%', insetInlineEnd: '12%' }}
              animate={{ y: [0, -14, 0], rotate: [0, 6, 0] }}
              transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
            >
              <Dumbbell className="h-24 w-24" />
            </motion.div>
            <motion.div
              className="absolute text-violet-300/[0.07]"
              style={{ top: '38%', insetInlineStart: '8%' }}
              animate={{ y: [0, 12, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut', delay: 11 }}
            >
              <Timer className="h-14 w-14" />
            </motion.div>
            <motion.div
              className="absolute text-pink-400/[0.07]"
              style={{ top: '62%', insetInlineEnd: '6%' }}
              animate={{ y: [0, -18, 0], rotate: [0, 12, 0] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
            >
              <Heart className="h-16 w-16" />
            </motion.div>
            <motion.div
              className="absolute text-cyan-400/[0.06]"
              style={{ top: '18%', insetInlineStart: '22%' }}
              animate={{ y: [0, 14, 0], rotate: [0, -9, 0] }}
              transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 14 }}
            >
              <Activity className="h-12 w-12" />
            </motion.div>
          </div>

          {/* ── 1. HERO CARD ──────────────────────────────────────────────── */}
          <HeroBanner />

          <SemesterEmptyBanner
            visible={activeSemester === 'B' && stats !== undefined && stats.recentSessions.length === 0}
          />

          <SemesterTransitionWrapper activeSemester={activeSemester}>
          {/* data-tour wrapper spans both mobile chips and desktop KPI grid so
              the tour spotlight finds a rendered element on any viewport width. */}
          <div data-tour="dashboard-stats">
          {/* ── 2a. MOBILE: horizontally scrollable stat chips ────────────── */}
          <div
            className="flex justify-center gap-3 overflow-x-auto pb-2 md:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {[
              { label: 'ממוצע כושר', value: fitnessAvg,    suffix: '',  color: 'text-emerald-600', accentBorder: 'rgba(52,211,153,0.35)',   onClick: undefined },
              { label: 'נוכחות',     value: attendancePct, suffix: '%', color: activeSemester === 'A' ? 'text-violet-600' : 'text-emerald-600', accentBorder: activeSemester === 'A' ? 'rgba(139,92,246,0.35)' : 'rgba(52,211,153,0.35)', onClick: undefined },
              { label: 'לטיפול',     value: belowNormCount, suffix: '', color: 'text-red-500',    accentBorder: 'rgba(239,68,68,0.35)',   onClick: () => { setBelowNormOpen(true); } },
              { label: 'חסרות',      value: pendingResults, suffix: '', color: 'text-amber-600', accentBorder: 'rgba(245,158,11,0.35)',  onClick: () => { setMissingOpen(true); } },
            ].map(({ label, value, suffix, color, accentBorder, onClick }) => (
              <motion.button
                key={label}
                type="button"
                onClick={onClick}
                disabled={onClick === undefined}
                whileTap={onClick !== undefined ? { scale: 0.95 } : {}}
                className={`snap-start shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl ${onClick !== undefined ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ width: 88, minHeight: 80, background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)', border: `1px solid ${accentBorder}`, boxShadow: '0 2px 12px rgba(15,23,42,0.08)', padding: '10px 8px' }}
              >
                <span className={`text-2xl font-black tabular-nums ${color}`}>
                  <CountUp end={value} suffix={suffix} duration={1.2} useEasing />
                </span>
                <span className="text-[10px] font-semibold text-slate-500 text-center leading-tight">{label}</span>
              </motion.button>
            ))}
          </div>

          {/* ── 2b. DESKTOP: KPI STATS ROW — 4 white Tier-2 cards ────────── */}
          <motion.div variants={STAGGER} className="hidden md:grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiCard
              label="ממוצע כושר כללי"
              value={fitnessAvg}
              sub={normDeltaLabel}
              icon={Dumbbell}
              iconBg="bg-emerald-500"
              valueColor="text-emerald-600"
              accentGrad="from-emerald-400 to-teal-500"
              glowColor="rgba(16,185,129,0.24)"
              trend={fitnessAvg >= MINISTRY_NORM ? 'up' : 'down'}
            />
            <KpiCard
              label="נוכחות ממוצעת"
              value={attendancePct}
              valueSuffix="%"
              sub="יציב לאורך הסמסטר"
              icon={Users}
              iconBg={activeSemester === 'A' ? 'bg-violet-600' : 'bg-emerald-600'}
              valueColor={activeSemester === 'A' ? 'text-violet-600' : 'text-emerald-600'}
              accentGrad={activeSemester === 'A' ? 'from-violet-500 to-purple-600' : 'from-emerald-500 to-green-600'}
              glowColor={activeSemester === 'A' ? 'rgba(124,58,237,0.26)' : 'rgba(34,197,94,0.26)'}
              trend="neutral"
            />
            <KpiCard
              label="תלמידים לטיפול"
              value={belowNormCount}
              sub="לחץ לרשימה המלאה"
              icon={AlertTriangle}
              iconBg="bg-red-500"
              valueColor="text-red-500"
              accentGrad="from-red-400 to-orange-500"
              glowColor="rgba(239,68,68,0.24)"
              trend="alert"
              onClick={() => setBelowNormOpen(true)}
            />
            <KpiCard
              label="תוצאות חסרות"
              value={pendingResults}
              sub="לחץ לרשימה המלאה"
              icon={ClipboardX}
              iconBg="bg-amber-500"
              valueColor="text-amber-600"
              accentGrad="from-amber-400 to-orange-400"
              glowColor="rgba(245,158,11,0.24)"
              trend="neutral"
              onClick={() => setMissingOpen(true)}
            />
          </motion.div>
          </div>{/* /data-tour="dashboard-stats" */}

          {/* ── 3. UPCOMING EVENT ────────────────────────────────────────── */}
          <motion.div
            data-tour="dashboard-event"
            variants={ITEM}
            whileHover={{ y: -6, scale: 1.01, boxShadow: '0 28px 52px -12px rgba(109,40,217,0.30)', filter: 'saturate(160%) brightness(1.02)', transition: { type: 'spring', stiffness: 280, damping: 20 } }}
            className="relative overflow-hidden rounded-3xl border border-[var(--semester-border,rgba(139,92,246,0.20))] transition-[border-color] duration-700 shadow-[0_8px_32px_rgba(31,38,135,0.13)] p-5"
            style={{ background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(25px) saturate(180%)', WebkitBackdropFilter: 'blur(25px) saturate(180%)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${activeSemester === 'A' ? 'bg-violet-600' : 'bg-emerald-600'}`}
                whileHover={{ rotate: 12 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
              >
                <Calendar className="h-5 w-5 text-white" aria-hidden="true" />
              </motion.div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">אירוע קרוב</h2>
                <p className="text-xs text-slate-500">לוח אירועים בית-ספרי</p>
              </div>
            </div>

            {eventLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 rounded-2xl bg-slate-100" />
                <div className="h-4 w-24 rounded-xl bg-slate-100" />
              </div>
            ) : (() => {
              const days = Math.ceil(
                (new Date(effectiveEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const dayLabel = days === 0 ? 'היום' : days === 1 ? 'מחר' : `עוד ${days} ימים`;
              const monthYear = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(effectiveEvent.eventDate));
              return (
                <>
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: 'rgba(255,255,255,0.40)',
                      backdropFilter: 'blur(20px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                      border: activeSemester === 'A' ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(34,197,94,0.25)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-sm font-extrabold ${activeSemester === 'A' ? 'bg-violet-600' : 'bg-emerald-600'}`}>
                        {new Date(effectiveEvent.eventDate).getDate()}
                      </span>
                      <div className="text-start">
                        <p className="text-sm font-bold text-slate-900 truncate">{effectiveEvent.title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {monthYear}{effectiveEvent.location ? ` · ${effectiveEvent.location}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${activeSemester === 'A' ? 'bg-violet-100 border border-violet-300/50 text-violet-700' : 'bg-emerald-100 border border-emerald-300/50 text-emerald-700'}`}>
                      {dayLabel}
                    </span>
                  </div>
                </>
              );
            })()}

            <Link
              href="/events"
              className={`mt-3 flex items-center gap-1 text-xs font-semibold transition-colors ${activeSemester === 'A' ? 'text-violet-600 hover:text-violet-800' : 'text-emerald-600 hover:text-emerald-800'}`}
            >
              <ChevronLeft className="h-3 w-3" aria-hidden="true" />
              לכל האירועים
            </Link>
          </motion.div>

          {/* ── 4. HERO CHART ROW — mobile: chart first; desktop: 3-col ────── */}
          <motion.div
            variants={STAGGER}
            className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch"
            style={{ minHeight: 320 }}
          >

            {/* ── CENTER on desktop / FIRST on mobile: Class Averages Chart ── */}
            <div className="lg:col-span-6 lg:order-2 flex flex-col">
              <ClassAverageTrendChart semester={deferredSemester} />
            </div>

            {/* ── LEFT on desktop / SECOND on mobile: דורש טיפול ─────────── */}
            <motion.div data-tour="dashboard-alerts" variants={ITEM} className="lg:col-span-3 lg:order-1">
              <SemesterPanel className="flex flex-col gap-3 p-5 h-full"
                style={{
                  backdropFilter:       'blur(22px) saturate(170%)',
                  WebkitBackdropFilter: 'blur(22px) saturate(170%)',
                  boxShadow:            '0 8px 32px rgba(31,38,135,0.10)',
                  background:           'rgba(255,255,255,0.32)',
                } as React.CSSProperties}
              >
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-white" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">דורש טיפול</h2>
                  <p className="text-[10px] text-slate-500">מבט כולל מהיר</p>
                </div>
              </div>

              <div className="flex flex-row gap-2 flex-1 md:flex-col md:gap-2.5">
                <motion.button
                  type="button"
                  onClick={() => setBelowNormOpen(true)}
                  whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(239,68,68,0.22)', transition: { type: 'spring', stiffness: 400, damping: 26 } }}
                  className="flex-1 rounded-2xl border border-red-200/50 px-2 py-2 text-center overflow-hidden relative md:px-3 md:py-4"
                  style={{ background: 'linear-gradient(135deg, rgba(254,242,242,0.90) 0%, rgba(255,255,255,0.70) 100%)' }}
                >
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-400 to-orange-400" />
                  <CountUp
                    end={belowNormCount}
                    className="text-2xl font-extrabold text-red-500 tabular-nums leading-none md:text-4xl"
                    duration={1.6}
                    useEasing
                  />
                  <p className="mt-1 text-[10px] font-semibold text-red-500/80 md:mt-1.5 md:text-xs">מתחת לנורמה</p>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setMissingOpen(true)}
                  whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(245,158,11,0.22)', transition: { type: 'spring', stiffness: 400, damping: 26 } }}
                  className="flex-1 rounded-2xl border border-amber-200/50 px-2 py-2 text-center overflow-hidden relative md:px-3 md:py-4"
                  style={{ background: 'linear-gradient(135deg, rgba(255,251,235,0.90) 0%, rgba(255,255,255,0.70) 100%)' }}
                >
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-400" />
                  <CountUp
                    end={pendingResults}
                    className="text-2xl font-extrabold text-amber-600 tabular-nums leading-none md:text-4xl"
                    duration={1.2}
                    useEasing
                  />
                  <p className="mt-1 text-[10px] font-semibold text-amber-600/80 md:mt-1.5 md:text-xs">לא הוזנו</p>
                </motion.button>
                <div
                  className="flex-1 rounded-2xl border border-emerald-200/50 px-2 py-2 text-center overflow-hidden relative md:px-3 md:py-4"
                  style={{ background: 'linear-gradient(135deg, rgba(240,253,244,0.90) 0%, rgba(255,255,255,0.70) 100%)' }}
                >
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-500" />
                  <CountUp
                    end={totalStudents}
                    className="text-2xl font-extrabold text-emerald-600 tabular-nums leading-none md:text-4xl"
                    duration={1.8}
                    useEasing
                  />
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600/80 md:mt-1.5 md:text-xs">פעילים סה&quot;כ</p>
                </div>
              </div>
              </SemesterPanel>
            </motion.div>

            {/* ── RIGHT on desktop / THIRD on mobile: מפגשי מבחן אחרונים ── */}
            <motion.div variants={ITEM} className="lg:col-span-3 lg:order-3">
              <SemesterPanel className="flex flex-col p-5 h-full"
                style={{
                  backdropFilter:       'blur(22px) saturate(170%)',
                  WebkitBackdropFilter: 'blur(22px) saturate(170%)',
                  boxShadow:            '0 8px 32px rgba(31,38,135,0.10)',
                  background:           'rgba(255,255,255,0.32)',
                } as React.CSSProperties}
              >
              <div className="flex items-center gap-2.5 mb-3">
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shrink-0"
                  whileHover={{ rotate: 10 }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                >
                  <History className="h-4 w-4 text-white" aria-hidden="true" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">מפגשי מבחן אחרונים</h2>
                  <p className="text-[10px] text-slate-500">5 המפגשים האחרונים שנערכו</p>
                </div>
              </div>

              {recentSessions.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <History className="h-8 w-8 text-slate-300" aria-hidden="true" />
                  <p className="text-sm text-slate-500">אין מפגשי מבחן עדיין</p>
                </div>
              ) : (
                <ol className="flex flex-col gap-2 flex-1">
                  {recentSessions.map((session, i) => {
                    const { day, month, dayLabel } = formatSession(session.conductedAt);
                    const accentColors = [
                      { badge: 'bg-indigo-600 text-white',  pill: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
                      { badge: 'bg-teal-600 text-white',    pill: 'bg-teal-100 text-teal-700 border-teal-200'       },
                      { badge: 'bg-violet-600 text-white',  pill: 'bg-violet-100 text-violet-700 border-violet-200' },
                      { badge: 'bg-emerald-600 text-white', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                      { badge: 'bg-amber-500 text-white',   pill: 'bg-amber-100 text-amber-700 border-amber-200'   },
                    ] as const;
                    const ac = accentColors[i % accentColors.length]!;
                    return (
                      <motion.li
                        key={session.sessionId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ease: EASE, duration: 0.45, delay: i * 0.06 }}
                        whileHover={{ x: -2, transition: { duration: 0.2 } }}
                        className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/30 px-3 py-2.5 backdrop-blur-md"
                      >
                        <div className={`shrink-0 flex flex-col items-center justify-center rounded-xl ${ac.badge} w-10 h-10`}>
                          <span className="text-xs font-extrabold leading-none">{day}</span>
                          <span className="text-[9px] font-medium leading-none opacity-80 mt-0.5">{month}/</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{session.testNameHe}</p>
                          <p className="text-[10px] text-slate-500 truncate">{session.className} · {dayLabel}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ac.pill}`}>
                          הושלם
                        </span>
                      </motion.li>
                    );
                  })}
                </ol>
              )}
              </SemesterPanel>
            </motion.div>

          </motion.div>
          </SemesterTransitionWrapper>

        </motion.div>
      </AnimatePresence>

      {/* ── Drill-down modals ── */}
      <MissingResultsModal open={missingOpen}   onClose={() => setMissingOpen(false)} />
      <BelowNormModal      open={belowNormOpen} onClose={() => setBelowNormOpen(false)} />
    </>
  );
}
