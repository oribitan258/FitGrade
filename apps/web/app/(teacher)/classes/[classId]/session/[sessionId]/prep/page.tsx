'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Dumbbell,
  Flame,
  Loader2,
  Play,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useTestSession } from '@/hooks/use-test-session';
import { useTestTypes } from '@/hooks/use-test-types';
import { ApiError } from '@fitgrade/types';
import { getExerciseConfig } from '@/lib/exercise-config';
import { AnatomyVideoPlayer } from '@/components/prep/anatomy-video-player';

// ─── Routing logic ─────────────────────────────────────────────────────────────

function getExecutionPath(
  classId: string,
  sessionId: string,
  testNameHe: string,
  inputType: string,
): string {
  const name = testNameHe;
  const isStopwatch = inputType === 'TIME';

  if (name.includes('ביפ') || name.includes('בי-פ')) {
    return `/classes/${classId}/session/${sessionId}/beep`;
  }

  const isLongDistance =
    isStopwatch &&
    (name.includes('800')  ||
     name.includes('1000') ||
     name.includes('1500') ||
     name.includes('2000') ||
     name.includes('3000') ||
     name.includes('מרחק'));

  if (isLongDistance) {
    return `/classes/${classId}/session/${sessionId}/long-distance`;
  }

  const isSprint10x4 =
    isStopwatch &&
    (name.includes('10X4') ||
     name.includes('10x4') ||
     name.includes('4×10') ||
     name.includes('4x10') ||
     (name.includes('10') && name.includes('4') && name.includes('שאטל')));

  if (isSprint10x4) {
    return `/classes/${classId}/session/${sessionId}/sprint-10x4`;
  }

  const isSprint60 = name.includes('60') || name.includes('ספרינט');
  if (isSprint60 && isStopwatch) {
    return `/classes/${classId}/session/${sessionId}/sprint`;
  }

  if (isStopwatch) {
    return `/classes/${classId}/session/${sessionId}/live`;
  }

  return `/classes/${classId}/session/${sessionId}/manual`;
}

// ─── Floating Lucide-icon background ──────────────────────────────────────────

interface FloatingIcon {
  Icon: React.ElementType;
  top: string;
  start: string;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  y: [number, number, number];
  x: [number, number, number];
  rotate: [number, number, number];
  color: string;
}

// Latin-square 3×4 grid — no identical icon adjacent horizontally or vertically.
//   Row 1: Dumbbell | Timer | Trophy | Flame
//   Row 2: Timer | Trophy | Flame | Dumbbell
//   Row 3: Trophy | Flame | Dumbbell | Timer
const FLOATING_ICONS: FloatingIcon[] = [
  // ── Row 1 — top ───────────────────────────────────────────────────────────
  { Icon: Dumbbell, top: '4%',  start: '6%',  size: 32, opacity: 0.13, duration: 13, delay: 0,   y: [0, -20, 0], x: [0,  14, 0],  rotate: [-8,  8, -8],  color: 'rgba(139,92,246,0.55)'  },
  { Icon: Timer,    top: '6%',  start: '32%', size: 28, opacity: 0.11, duration: 16, delay: 1.4, y: [0, -18, 0], x: [0, -10, 0],  rotate: [5,  -5,  5],  color: 'rgba(34,211,238,0.50)'  },
  { Icon: Trophy,   top: '5%',  start: '60%', size: 30, opacity: 0.12, duration: 14, delay: 3.0, y: [0, -24, 0], x: [0,  -8, 0],  rotate: [-5,  6, -5],  color: 'rgba(251,191,36,0.45)'  },
  { Icon: Flame,    top: '4%',  start: '84%', size: 28, opacity: 0.10, duration: 18, delay: 0.8, y: [0, -20, 0], x: [0, -12, 0],  rotate: [-4,  4, -4],  color: 'rgba(249,115,22,0.45)'  },
  // ── Row 2 — middle ────────────────────────────────────────────────────────
  { Icon: Timer,    top: '42%', start: '5%',  size: 30, opacity: 0.11, duration: 15, delay: 2.0, y: [0, -16, 0], x: [0,  12, 0],  rotate: [-6,  6, -6],  color: 'rgba(34,211,238,0.50)'  },
  { Icon: Trophy,   top: '40%', start: '30%', size: 28, opacity: 0.11, duration: 17, delay: 4.2, y: [0, -22, 0], x: [0, -18, 0],  rotate: [4,  -8,  4],  color: 'rgba(251,191,36,0.45)'  },
  { Icon: Flame,    top: '44%', start: '57%', size: 32, opacity: 0.10, duration: 14, delay: 0.4, y: [0, -18, 0], x: [0,  10, 0],  rotate: [-3,  7, -3],  color: 'rgba(249,115,22,0.45)'  },
  { Icon: Dumbbell, top: '42%', start: '84%', size: 30, opacity: 0.12, duration: 12, delay: 5.0, y: [0, -28, 0], x: [0, -14, 0],  rotate: [10,-10, 10],  color: 'rgba(139,92,246,0.55)'  },
  // ── Row 3 — bottom ────────────────────────────────────────────────────────
  { Icon: Trophy,   top: '78%', start: '8%',  size: 28, opacity: 0.12, duration: 16, delay: 1.2, y: [0, -20, 0], x: [0,  16, 0],  rotate: [7,  -5,  7],  color: 'rgba(251,191,36,0.45)'  },
  { Icon: Flame,    top: '76%', start: '34%', size: 30, opacity: 0.10, duration: 11, delay: 3.6, y: [0, -26, 0], x: [0, -10, 0],  rotate: [-5,  5, -5],  color: 'rgba(249,115,22,0.45)'  },
  { Icon: Dumbbell, top: '80%', start: '62%', size: 32, opacity: 0.12, duration: 19, delay: 2.6, y: [0, -14, 0], x: [0,  12, 0],  rotate: [3,  -6,  3],  color: 'rgba(139,92,246,0.55)'  },
  { Icon: Timer,    top: '78%', start: '88%', size: 28, opacity: 0.11, duration: 13, delay: 0.2, y: [0, -22, 0], x: [0,  -8, 0],  rotate: [-7,  8, -7],  color: 'rgba(34,211,238,0.50)'  },
];

function FloatingIcons(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {FLOATING_ICONS.map(({ Icon, top, start, size, opacity, duration, delay, y, x, rotate, color }, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top, insetInlineStart: start }}
          animate={{ y, x, rotate, opacity: [opacity, opacity * 1.7, opacity] }}
          transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon style={{ width: size, height: size, color, filter: 'drop-shadow(0 0 8px currentColor)' }} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Physio stat card ──────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  delay: number;
}

function StatCard({ icon: Icon, label, value, accentColor, borderColor, bgColor, delay }: StatCardProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.50, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-1 items-start gap-3 rounded-2xl border px-4 py-4"
      style={{
        background: bgColor,
        borderColor,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: bgColor, border: `1px solid ${borderColor}` }}
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'rgba(148,163,184,0.50)' }}
        >
          {label}
        </span>
        <span className="text-sm font-semibold leading-snug" style={{ color: accentColor }}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; onDismiss: () => void }

function Toast({ message, onDismiss }: ToastProps): React.JSX.Element {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      className="fixed bottom-24 start-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl"
      style={{
        transform: 'translateX(-50%)',
        background: 'rgba(220,38,38,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(239,68,68,0.40)',
      }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
      <button type="button" onClick={onDismiss} className="ms-1 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function PrepSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0A1F]" dir="rtl">
      <div className="border-b border-white/8 px-6 py-5">
        <div className="h-3.5 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 h-7 w-64 animate-pulse rounded-lg bg-white/8" />
      </div>
      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-8">
        <div className="h-[420px] w-full max-w-2xl animate-pulse rounded-3xl bg-white/5" />
        <div className="flex w-full max-w-2xl gap-4">
          <div className="h-24 flex-1 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-24 flex-1 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-24 flex-1 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PrepPage(): React.JSX.Element {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();

  const { data: session, isLoading } = useTestSession(sessionId);
  const { data: testTypes } = useTestTypes();

  const fullTestType = testTypes?.find((t) => t.id === session?.testTypeId);
  const physioData = session
    ? getExerciseConfig(session.testNameHe, fullTestType?.category)
    : null;

  const [isStarting, setIsStarting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function handleStartTest(): void {
    if (!session || isStarting) return;
    setIsStarting(true);
    try {
      router.push(getExecutionPath(classId, sessionId, session.testNameHe, session.testInputType));
    } catch (err) {
      setIsStarting(false);
      setToastMsg(err instanceof ApiError ? err.message : 'שגיאה בניתוב — נסה שוב');
    }
  }

  if (isLoading || !session) return <PrepSkeleton />;

  const inputTypeLabel =
    session.testInputType === 'TIME'      ? 'שעון עצור'    :
    session.testInputType === 'REPS'      ? 'חזרות'         :
    session.testInputType === 'PASS_FAIL' ? 'עובר / נכשל' : 'הזנה';

  return (
    <>
      <BackButton />
      <div className="flex min-h-screen flex-col bg-[#0B0A1F] text-white" dir="rtl">

      {/* ── Floating sports-icon background images ────────────────────────── */}
      <FloatingIcons />

      {/* ── Ambient page glow ─────────────────────────────────────────────── */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full blur-[160px]"
        style={{
          width: 800,
          height: 800,
          top: '-25%',
          insetInlineEnd: '-20%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, rgba(139,92,246,0.06) 45%, transparent 70%)',
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.08, 0.94, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-full blur-[120px]"
        style={{
          width: 500,
          height: 500,
          bottom: '10%',
          insetInlineStart: '-10%',
          background: 'radial-gradient(ellipse, rgba(34,211,238,0.08) 0%, transparent 70%)',
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 border-b px-6 py-5"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <nav className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(148,163,184,0.55)' }}>
          <button
            type="button"
            onClick={() => { router.push(`/classes/${classId}`); }}
            className="transition-colors hover:text-slate-300"
          >
            כיתה
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span style={{ color: 'rgba(148,163,184,0.38)' }}>הכנה למבחן</span>
        </nav>

        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">{session.testNameHe}</h1>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(139,92,246,0.15)',
              color: 'rgba(196,157,255,0.85)',
              border: '1px solid rgba(139,92,246,0.28)',
            }}
          >
            {inputTypeLabel}
          </span>
        </div>
      </header>

      {/* ── Main cinematic content ─────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center gap-8 px-4 py-8 pb-28 sm:px-8">

        {/* ── Hero anatomy section ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.60, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md mx-auto"
        >
          <AnatomyVideoPlayer
            imageUrl={physioData?.anatomyImageUrl ?? ''}
            fallbackTitle={session.testNameHe}
          />
        </motion.div>

        {/* ── Physio stat cards grid ──────────────────────────────────────── */}
        {physioData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto mt-16">
            <StatCard
              icon={Zap}
              label="מיקוד עיקרי"
              value={physioData.primaryFocus}
              accentColor="rgba(196,157,255,0.92)"
              borderColor="rgba(139,92,246,0.25)"
              bgColor="rgba(139,92,246,0.10)"
              delay={0.20}
            />
            <StatCard
              icon={Target}
              label="שרירי מטרה"
              value={physioData.targetMuscles}
              accentColor="rgba(103,232,249,0.90)"
              borderColor="rgba(34,211,238,0.22)"
              bgColor="rgba(34,211,238,0.07)"
              delay={0.32}
            />
            <StatCard
              icon={Activity}
              label="תיאור"
              value={physioData.briefDescription}
              accentColor="rgba(148,163,184,0.85)"
              borderColor="rgba(100,116,139,0.22)"
              bgColor="rgba(100,116,139,0.08)"
              delay={0.44}
            />
          </div>
        )}
      </main>

      {/* ── Sticky action bar ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 border-t px-6 py-4"
        style={{
          background: 'rgba(11,10,31,0.88)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderColor: 'rgba(255,255,255,0.09)',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">

          {/* Cancel */}
          <button
            type="button"
            onClick={() => { router.push(`/classes/${classId}`); }}
            disabled={isStarting}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-40"
            style={{
              color: 'rgba(148,163,184,0.80)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            ביטול
          </button>

          {/* Start test CTA */}
          <div className="relative">
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-6 -bottom-2 h-6 rounded-full blur-xl"
              animate={{ opacity: isStarting ? 0.20 : [0.35, 0.72, 0.35] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(90deg, #7c3aed, #4f46e5, #a855f7)' }}
            />
            <button
              type="button"
              onClick={handleStartTest}
              disabled={isStarting}
              className="relative h-14 w-56 overflow-hidden rounded-2xl text-sm font-semibold text-white shadow-[0_4px_24px_rgba(99,102,241,0.38)] transition-transform hover:scale-[1.025] active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-0"
                animate={isStarting ? {} : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                style={{
                  background: 'linear-gradient(135deg, #3730a3, #6d28d9, #4f46e5, #7c3aed, #4338ca, #8b5cf6, #3730a3)',
                  backgroundSize: '300% 300%',
                }}
              />
              {!isStarting && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  animate={{ x: ['-100%', '220%'] }}
                  transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                  style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)' }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2.5">
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    מתחיל...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                    התחל מבחן
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <Toast
            key="prep-toast"
            message={toastMsg}
            onDismiss={() => { setToastMsg(null); }}
          />
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
