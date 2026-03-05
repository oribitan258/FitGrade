'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { getHebrewGradeLabel } from '@fitgrade/types';
import { useClass, useStudents } from '@/hooks/use-classes';
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from 'recharts';

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1, y: 0,
    transition: { ease: EASE, duration: 0.65, staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.55 } },
};

const STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ─── Animated number counter ─────────────────────────────────────────────────

interface AnimatedNumberProps { to: number; suffix?: string; className?: string; duration?: number }

function AnimatedNumber({ to, suffix = '', className, duration = 1.2 }: AnimatedNumberProps): React.JSX.Element {
  const count   = useMotionValue(0);
  const display = useTransform(count, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    const controls = animate(count, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [to, duration, count]);

  return <motion.span className={className}>{display}</motion.span>;
}

// ─── Test definitions & mock data ────────────────────────────────────────────

const TEST_TYPES = [
  { id: 'run2000',  label: "ריצת 2,000מ",  emoji: '🏃', unit: "דק'",   norm: 74 },
  { id: 'pushups',  label: "שכיבות סמיכה", emoji: '💪', unit: "חז'",   norm: 70 },
  { id: 'pullups',  label: "מתח מעקה",     emoji: '🏋️', unit: "חז'",   norm: 72 },
  { id: 'flex',     label: "גמישות",        emoji: '🤸', unit: "ס\"מ", norm: 68 },
] as const;

const BASE_HISTORY: Record<string, readonly number[]> = {
  run2000: [70, 73, 76, 74, 80, 85],
  pushups: [62, 67, 71, 69, 75, 80],
  pullups: [68, 72, 76, 73, 80, 84],
  flex:    [64, 68, 72, 70, 76, 79],
};

const STUDENT_MODIFIERS = [1.02, 0.87, 1.12, 0.76, 0.97, 0.90, 1.18, 0.73, 1.06, 0.93] as const;

function getStudentHistory(testId: string, studentIndex: number): number[] {
  const base = BASE_HISTORY[testId]!;
  const mod  = STUDENT_MODIFIERS[studentIndex % STUDENT_MODIFIERS.length]!;
  return base.map((v) => Math.min(100, Math.max(10, Math.round(v * mod))));
}

function getLatestScore(testId: string, studentIndex: number): number {
  const hist = getStudentHistory(testId, studentIndex);
  return hist[hist.length - 1]!;
}

/**
 * Maps a 0-100 score to the real-world measurement teachers recorded in the field.
 * Each test has its own physical scale derived from ministry norm tables.
 */
function getRawResult(testId: string, score: number): string {
  switch (testId) {
    case 'run2000': {
      // Lower time = faster = higher score. Score 100 → 7:00 | Score 0 → 12:30
      const totalSec = Math.round(750 - (score / 100) * 330);
      const mm = Math.floor(totalSec / 60);
      const ss = totalSec % 60;
      return `${mm}:${ss.toString().padStart(2, '0')}`;
    }
    case 'pushups':
      // More reps = better = higher score. Score 100 → 60 reps | Score 0 → 10 reps
      return String(Math.round(10 + (score / 100) * 50));
    case 'pullups':
      // More reps = better. Score 100 → 27 reps | Score 0 → 2 reps
      return String(Math.round(2 + (score / 100) * 25));
    case 'flex': {
      // cm from baseline (can be negative). Score 100 → +25 cm | Score 0 → -8 cm
      const cm = Math.round(-8 + (score / 100) * 33);
      return cm >= 0 ? `+${cm}` : String(cm);
    }
    default:
      return String(score);
  }
}

const MOCK_ATTENDANCE = [95, 88, 100, 75, 91, 82, 98, 70, 93, 86] as const;
const BASE_ATTENDANCE_TREND = [80, 83, 85, 82, 88, 95] as const;

function getAttendance(idx: number): number {
  return MOCK_ATTENDANCE[idx % MOCK_ATTENDANCE.length]!;
}

function getAttendanceTrend(idx: number): { i: number; v: number }[] {
  const mod = STUDENT_MODIFIERS[idx % STUDENT_MODIFIERS.length]!;
  return BASE_ATTENDANCE_TREND.map((v, i) => ({
    i,
    v: Math.min(100, Math.max(30, Math.round(v * mod))),
  }));
}

// ─── Fitness-level helpers ────────────────────────────────────────────────────

type FitnessLevel = 'excellent' | 'good' | 'pass' | 'fail';

function fitnessLevel(score: number): FitnessLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'pass';
  return 'fail';
}

const LEVEL = {
  excellent: { label: 'מצטיין',       bg: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', color: '#10b981', avatarGrad: 'from-emerald-400 to-teal-500'   },
  good:      { label: 'טוב',          bg: 'bg-blue-500',    badge: 'bg-blue-50    text-blue-700    border-blue-200',    color: '#3b82f6', avatarGrad: 'from-blue-400    to-indigo-500' },
  pass:      { label: 'עובר',         bg: 'bg-amber-500',   badge: 'bg-amber-50   text-amber-700   border-amber-200',   color: '#f59e0b', avatarGrad: 'from-amber-400   to-orange-500' },
  fail:      { label: 'מתחת לנורמה', bg: 'bg-red-500',     badge: 'bg-red-50     text-red-700     border-red-200',     color: '#ef4444', avatarGrad: 'from-slate-400   to-slate-600'  },
} as const;

// ─── Per-test color themes ────────────────────────────────────────────────────

interface NormTheme {
  readonly cardBg:      string;
  readonly cardBorder:  string;
  readonly cardGlow:    string;
  readonly trackColor:  string;
  readonly lowRGB:      readonly [number, number, number];
  readonly highRGB:     readonly [number, number, number];
  readonly accentColor: string;
  readonly areaColor:   string;
}

const NORM_THEMES: Record<string, NormTheme> = {
  run2000: {
    cardBg:      'rgba(236,253,245,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(16,185,129,0.13)',
    lowRGB:      [167, 243, 208],
    highRGB:     [4,   120,  87],
    accentColor: 'rgba(16,185,129,0.85)',
    areaColor:   '#10b981',
  },
  pushups: {
    cardBg:      'rgba(255,247,237,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(251,146,60,0.13)',
    lowRGB:      [254, 215, 170],
    highRGB:     [194,  65,  12],
    accentColor: 'rgba(251,146,60,0.85)',
    areaColor:   '#f97316',
  },
  pullups: {
    cardBg:      'rgba(238,242,255,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(99,102,241,0.13)',
    lowRGB:      [199, 210, 254],
    highRGB:     [55,   48, 163],
    accentColor: 'rgba(99,102,241,0.85)',
    areaColor:   '#6366f1',
  },
  flex: {
    cardBg:      'rgba(245,243,255,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(139,92,246,0.13)',
    lowRGB:      [221, 214, 254],
    highRGB:     [109,  40, 217],
    accentColor: 'rgba(139,92,246,0.85)',
    areaColor:   '#8b5cf6',
  },
};

function interpolateRGB(
  score: number,
  low:   readonly [number, number, number],
  high:  readonly [number, number, number],
): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const r = Math.round(low[0] + (high[0] - low[0]) * t);
  const g = Math.round(low[1] + (high[1] - low[1]) * t);
  const b = Math.round(low[2] + (high[2] - low[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// ─── NormRing SVG ─────────────────────────────────────────────────────────────

interface NormRingProps {
  score:   number;
  norm:    number;
  theme:   NormTheme;
  size?:   number;
  stroke?: number;
}

function NormRing({ score, norm, theme, size = 120, stroke = 9 }: NormRingProps): React.JSX.Element {
  const radius        = (size - stroke) / 2;
  const cx            = size / 2;
  const cy            = size / 2;
  const circumference = 2 * Math.PI * radius;
  const scoreOffset   = circumference - (score / 100) * circumference;
  const strokeColor   = interpolateRGB(score, theme.lowRGB, theme.highRGB);

  // Arc draws from angle=0 (SVG right). CSS rotate-[-90deg] puts it at visual top.
  const normAngle = (norm / 100) * 2 * Math.PI;
  const normDotX  = cx + radius * Math.cos(normAngle);
  const normDotY  = cy + radius * Math.sin(normAngle);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
        {/* Background track */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={theme.trackColor} strokeWidth={stroke} />
        {/* Animated score arc */}
        <motion.circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: scoreOffset }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 1.4, delay: 0.3 }}
        />
        {/* Norm marker dot */}
        <motion.circle
          cx={normDotX} cy={normDotY} r={stroke * 0.72}
          fill="white"
          stroke={strokeColor}
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.75 }}
        />
      </svg>
      {/* Centre label (not rotated — outside the SVG) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
        <div style={{ color: strokeColor }} className="text-2xl font-extrabold leading-none tabular-nums">
          <AnimatedNumber to={score} duration={1.4} />
        </div>
        <span className="text-[9px] font-semibold" style={{ color: theme.accentColor }}>מ-100</span>
      </div>
    </div>
  );
}

// ─── Ultimate Test Card — ring + norm delta + area sparkline in one card ───────

interface UltimateTestCardProps {
  testId:  string;
  label:   string;
  emoji:   string;
  unit:    string;
  score:   number;
  norm:    number;
  history: number[];
}

function UltimateTestCard({ testId, label, emoji, unit, score, norm, history }: UltimateTestCardProps): React.JSX.Element {
  const theme      = NORM_THEMES[testId] ?? NORM_THEMES['run2000']!;
  const level      = fitnessLevel(score);
  const lv         = LEVEL[level];
  const delta      = score - norm;
  const gradeLabel = getHebrewGradeLabel(score);
  const areaData   = history.map((v, i) => ({ i, v }));
  const ringColor  = interpolateRGB(score, theme.lowRGB, theme.highRGB);

  // Primary display: real-world measurement (time / reps / cm)
  const rawResult  = getRawResult(testId, score);
  // Norm in real-world units — gives teachers a concrete benchmark
  const normRaw    = getRawResult(testId, norm);

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -5, transition: { ease: EASE, duration: 0.3 } }}
      className="flex flex-col rounded-2xl p-5 gap-4"
      style={{
        background:           theme.cardBg,
        border:               `1px solid ${theme.cardBorder}`,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:            theme.cardGlow,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">{emoji}</span>
          <span className="text-sm font-bold text-slate-800">{label}</span>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${lv.badge}`}>
          {gradeLabel}
        </span>
      </div>

      {/* ── Primary row: ring (score) + raw result hero ────────────── */}
      <div className="flex items-center gap-4">
        {/* Radial ring shows 0-100 normalised score */}
        <NormRing score={score} norm={norm} theme={theme} size={100} stroke={8} />

        {/* Raw result + comparison */}
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          {/* BIG raw result — what the teacher actually measured */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <motion.span
              className="text-[2rem] font-black tabular-nums leading-none tracking-tight"
              style={{ color: ringColor }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE, duration: 0.6, delay: 0.4 }}
            >
              {rawResult}
            </motion.span>
            <span className="text-sm font-bold" style={{ color: theme.accentColor }}>
              {unit}
            </span>
          </div>

          {/* Delta chip — score points vs ministry norm */}
          <div
            className="inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-bold"
            style={{
              background: delta >= 0 ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)',
              color:      delta >= 0 ? '#059669' : '#dc2626',
            }}
          >
            {delta >= 0
              ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
              : <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            {delta >= 0 ? '+' : ''}{delta} נק' מהנורמה
          </div>

          {/* Norm in raw units */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className="inline-block h-2 w-2 rounded-full border-[1.5px] bg-white flex-shrink-0"
              style={{ borderColor: ringColor }}
            />
            נורמה: <span className="font-semibold text-slate-600">{normRaw} {unit}</span>
          </div>
        </div>
      </div>

      {/* ── Sparkline — personal trend ─────────────────────────────── */}
      <div>
        <div style={{ height: 44 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`spark-${testId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.areaColor} stopOpacity={0.40} />
                  <stop offset="95%" stopColor={theme.areaColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={theme.areaColor}
                strokeWidth={2.5}
                fill={`url(#spark-${testId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">מגמת ציון — {history.length} מדידות</p>
      </div>
    </motion.div>
  );
}

// ─── Avatar colours ───────────────────────────────────────────────────────────

const AVATAR_TINTS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-300' },
  { bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-300'   },
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-300' },
  { bg: 'bg-slate-200',  text: 'text-slate-700',  ring: 'ring-slate-300'  },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   ring: 'ring-cyan-300'   },
] as const;

// ─── Semantic tinted glassmorphic bento card shells ───────────────────────────
// Each bento card gets a distinct colour tint matching its data domain.

const BENTO_IDENTITY_STYLE: React.CSSProperties = {
  background:           'rgba(238,242,255,0.82)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border:               '1px solid rgba(255,255,255,0.90)',
  boxShadow:            '0 8px 32px rgba(15,23,42,0.10)',
};

const BENTO_ATTENDANCE_STYLE: React.CSSProperties = {
  background:           'rgba(240,249,255,0.82)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border:               '1px solid rgba(255,255,255,0.90)',
  boxShadow:            '0 8px 32px rgba(15,23,42,0.10)',
};

const BENTO_FITNESS_STYLE: React.CSSProperties = {
  background:           'rgba(236,253,245,0.82)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border:               '1px solid rgba(255,255,255,0.90)',
  boxShadow:            '0 8px 32px rgba(15,23,42,0.10)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentProfilePage(): React.JSX.Element {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();

  const { data: cls } = useClass(classId);
  const { data: students, isLoading, error } = useStudents(classId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-white/70" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 animate-pulse rounded-2xl bg-white/40 shadow-sm" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-52 animate-pulse rounded-2xl bg-white/40 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !students) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
        לא ניתן לטעון את נתוני התלמידים — נסה לרענן את הדף.
      </div>
    );
  }

  const studentIndex = students.findIndex((s) => s.id === studentId);
  const student      = students[studentIndex];

  if (!student) {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700 max-w-lg">
        התלמיד לא נמצא. ייתכן שהקישור שגוי.
      </div>
    );
  }

  const idx             = studentIndex === -1 ? 0 : studentIndex;
  const attendance      = getAttendance(idx);
  const attendanceTrend = getAttendanceTrend(idx);
  const initials        = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;
  const tint            = AVATAR_TINTS[idx % AVATAR_TINTS.length]!;
  const dob             = new Date(student.dateOfBirth).toLocaleDateString('he-IL');

  const testScores = TEST_TYPES.map((t) => ({
    ...t,
    score:   getLatestScore(t.id, idx),
    history: getStudentHistory(t.id, idx),
  }));

  const overallAvg   = Math.round(testScores.reduce((s, t) => s + t.score, 0) / testScores.length);
  const overallLevel = fitnessLevel(overallAvg);
  const ovLv         = LEVEL[overallLevel];

  const attendanceColor = attendance >= 90 ? '#10b981' : attendance >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      variants={PAGE_ENTER}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <motion.nav variants={ITEM} aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          הכיתות שלי
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <Link href={`/classes/${classId}`} className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          {cls?.name ?? '...'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <span className="font-semibold text-slate-700">{student.firstName} {student.lastName}</span>
      </motion.nav>

      {/* ── 3-card bento header ──────────────────────────────────────── */}
      <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Card 1 — Student identity */}
        <motion.div
          variants={ITEM}
          whileHover={{ y: -4, transition: { ease: EASE, duration: 0.3 } }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={BENTO_IDENTITY_STYLE}
        >
          {/* Decorative gradient blob */}
          <div
            className={`pointer-events-none absolute -end-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${ovLv.avatarGrad} opacity-20 blur-2xl`}
          />
          <div className="relative flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ease: EASE, duration: 0.55, delay: 0.1 }}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold ring-2 ${tint.ring} ${tint.bg} ${tint.text}`}
            >
              {initials}
              {/* Fitness status dot */}
              <span className={`absolute -bottom-1 -end-1 h-4 w-4 rounded-full border-2 border-white ${ovLv.bg}`} />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight truncate">
                {student.firstName} {student.lastName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">תלמיד • {dob}</p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${ovLv.badge}`}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${ovLv.bg} opacity-75`} />
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ovLv.bg}`} />
                </span>
                {ovLv.label}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 2 — Attendance */}
        <motion.div
          variants={ITEM}
          whileHover={{ y: -4, transition: { ease: EASE, duration: 0.3 } }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={BENTO_ATTENDANCE_STYLE}
        >
          <div className="pointer-events-none absolute -start-6 -bottom-6 h-24 w-24 rounded-full bg-sky-300/20 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold text-slate-500 mb-1">נוכחות בשיעורים</p>
            <AnimatedNumber
              to={attendance}
              suffix="%"
              duration={1.6}
              className="text-4xl font-extrabold tabular-nums"
            />
            <div className="mt-3" style={{ height: 42 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceTrend} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={attendanceColor}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">מגמה — 6 שיעורים אחרונים</p>
          </div>
        </motion.div>

        {/* Card 3 — Overall fitness score */}
        <motion.div
          variants={ITEM}
          whileHover={{ y: -4, transition: { ease: EASE, duration: 0.3 } }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={BENTO_FITNESS_STYLE}
        >
          <div
            className="pointer-events-none absolute -end-6 -bottom-6 h-24 w-24 rounded-full opacity-15 blur-2xl"
            style={{ background: ovLv.color }}
          />
          <div className="relative">
            <p className="text-xs font-semibold text-slate-500 mb-1">ממוצע כושר כולל</p>
            <AnimatedNumber
              to={overallAvg}
              duration={1.4}
              className="text-4xl font-extrabold tabular-nums text-slate-900"
            />
            <div className="mt-2 flex flex-col gap-2">
              <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-bold ${ovLv.badge}`}>
                {ovLv.label}
              </span>
              {/* Mini progress bar */}
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <motion.div
                  className="absolute inset-y-0 start-0 rounded-full"
                  style={{ backgroundColor: ovLv.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${overallAvg}%` }}
                  transition={{ ease: EASE, duration: 1.2, delay: 0.4 }}
                />
              </div>
              <p className="text-[10px] text-slate-400">ממוצע מכל {testScores.length} המבחנים</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Ultimate test grid — one card per test, all data in one place ─ */}
      <motion.div variants={ITEM}>
        <h2 className="text-base font-bold text-slate-900 mb-4">ביצועים לפי מבחן — השוואה לנורמת משרד החינוך</h2>
        <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {testScores.map((t) => (
            <UltimateTestCard
              key={t.id}
              testId={t.id}
              label={t.label}
              emoji={t.emoji}
              unit={t.unit}
              score={t.score}
              norm={t.norm}
              history={t.history}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
