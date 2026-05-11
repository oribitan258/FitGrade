'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { AlertTriangle, Award, ChevronRight, ClipboardList, TrendingUp } from 'lucide-react';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { FinalGrade, ProgressPoint, StudentTestHistory, TalmidautRecord } from '@fitgrade/types';
import { useClass, useClassDetails } from '@/hooks/use-classes';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useSemester } from '@/contexts/semester-context';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatRawValue } from '@/lib/utils';

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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ministry norm used across all tests for delta calculation. */
const NATIONAL_NORM = 74;

/**
 * Full Israeli school-year month sequence used as the X-axis template.
 * October (index 1) is the "baseline" data point referenced in the design spec.
 */
const SCHOOL_YEAR_MONTHS = [
  "ספט'", "אוק'", "נוב'", "דצמ'", "ינו'", "פבר'", "מרץ", "אפר'", "מאי",
] as const;

/** Index of October (אוק') within SCHOOL_YEAR_MONTHS — used to anchor the default tooltip. */
const OCT_INDEX = 1;

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

// ─── Per-test color themes (cycled by index, no hardcoded IDs) ────────────────

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

const NORM_THEME_CYCLE: NormTheme[] = [
  {
    cardBg:      'rgba(236,253,245,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(16,185,129,0.13)',
    lowRGB:      [167, 243, 208],
    highRGB:     [4,   120,  87],
    accentColor: 'rgba(16,185,129,0.85)',
    areaColor:   '#10b981',
  },
  {
    cardBg:      'rgba(255,247,237,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(251,146,60,0.13)',
    lowRGB:      [254, 215, 170],
    highRGB:     [194,  65,  12],
    accentColor: 'rgba(251,146,60,0.85)',
    areaColor:   '#f97316',
  },
  {
    cardBg:      'rgba(238,242,255,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(99,102,241,0.13)',
    lowRGB:      [199, 210, 254],
    highRGB:     [55,   48, 163],
    accentColor: 'rgba(99,102,241,0.85)',
    areaColor:   '#6366f1',
  },
  {
    cardBg:      'rgba(245,243,255,0.82)',
    cardBorder:  'rgba(255,255,255,0.88)',
    cardGlow:    '0 8px 32px rgba(15,23,42,0.10)',
    trackColor:  'rgba(139,92,246,0.13)',
    lowRGB:      [221, 214, 254],
    highRGB:     [109,  40, 217],
    accentColor: 'rgba(139,92,246,0.85)',
    areaColor:   '#8b5cf6',
  },
];

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

  const normAngle = (norm / 100) * 2 * Math.PI;
  const normDotX  = cx + radius * Math.cos(normAngle);
  const normDotY  = cy + radius * Math.sin(normAngle);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={theme.trackColor} strokeWidth={stroke} />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
        <div style={{ color: strokeColor }} className="text-2xl font-extrabold leading-none tabular-nums">
          <AnimatedNumber to={score} duration={1.4} />
        </div>
        <span className="text-[9px] font-semibold" style={{ color: theme.accentColor }}>מ-100</span>
      </div>
    </div>
  );
}

// ─── Ultimate Test Card ────────────────────────────────────────────────────────

interface UltimateTestCardProps {
  themeIndex:   number;
  label:        string;
  unit:         string | null;
  inputType:    string;
  score:        number;
  rawValue:     number | null;
  history:      number[];
}

function UltimateTestCard({ themeIndex, label, unit, inputType, score, rawValue, history }: UltimateTestCardProps): React.JSX.Element {
  const theme            = NORM_THEME_CYCLE[themeIndex % NORM_THEME_CYCLE.length]!;
  const level            = fitnessLevel(score);
  const lv               = LEVEL[level];
  const delta            = score - NATIONAL_NORM;
  const gradeLabel       = getHebrewGradeLabel(score);
  const areaData         = history.map((v, i) => ({ i, v }));
  const ringColor        = interpolateRGB(score, theme.lowRGB, theme.highRGB);
  const formattedRaw     = rawValue !== null ? formatRawValue(rawValue, inputType) : null;

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
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${lv.badge}`}>
          {gradeLabel}
        </span>
      </div>

      {/* ── Primary row: ring + metrics ─────────────────────────────── */}
      <div className="flex items-center gap-4">
        <NormRing score={score} norm={NATIONAL_NORM} theme={theme} size={100} stroke={8} />

        <div className="flex flex-1 flex-col gap-2 min-w-0">
          {/* Grade label */}
          <motion.span
            className="text-2xl font-black leading-none"
            style={{ color: ringColor }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: EASE, duration: 0.6, delay: 0.4 }}
          >
            {gradeLabel}
          </motion.span>

          {/* Raw measurement + unit */}
          {formattedRaw !== null && (
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold tabular-nums" style={{ color: ringColor }}>
                {formattedRaw}
              </span>
              {unit && (
                <span className="text-xs font-medium text-slate-400">{unit}</span>
              )}
            </div>
          )}

          {/* Delta chip */}
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

          {/* Norm baseline */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span
              className="inline-block h-2 w-2 rounded-full border-[1.5px] bg-white flex-shrink-0"
              style={{ borderColor: ringColor }}
            />
            נורמה ארצית: <span className="font-semibold text-slate-600">{NATIONAL_NORM} נק'</span>
          </div>
        </div>
      </div>

      {/* ── Sparkline — personal trend ──────────────────────────────── */}
      {history.length > 1 && (
        <div>
          <div style={{ height: 44 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${themeIndex}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme.areaColor} stopOpacity={0.40} />
                    <stop offset="95%" stopColor={theme.areaColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={theme.areaColor}
                  strokeWidth={2.5}
                  fill={`url(#spark-${themeIndex})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">מגמה אישית — {history.length} מדידות</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Final Grade Hero Card ─────────────────────────────────────────────────────

interface FinalGradeHeroCardProps {
  finalGrade: FinalGrade;
}

function FinalGradeHeroCard({ finalGrade }: FinalGradeHeroCardProps): React.JSX.Element {
  const { recommendedGrade, fitnessAvg, talmidautAvg, testWeight, talmidautWeight } = finalGrade;
  const gradeLabel = getHebrewGradeLabel(recommendedGrade);
  const level = fitnessLevel(recommendedGrade);
  const lv = LEVEL[level];

  return (
    <motion.div
      variants={ITEM}
      whileHover={{ y: -4, transition: { ease: EASE, duration: 0.3 } }}
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background:           'linear-gradient(135deg, rgba(30,27,75,0.90) 0%, rgba(49,46,129,0.88) 50%, rgba(76,29,149,0.85) 100%)',
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border:               '1px solid rgba(167,139,250,0.25)',
        boxShadow:            '0 12px 48px rgba(76,29,149,0.30), 0 4px 16px rgba(0,0,0,0.20)',
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -end-12 -top-12 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -start-8 -bottom-8 h-32 w-32 rounded-full bg-indigo-400/15 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8" dir="rtl">

        {/* ── Big grade number ────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <div className="flex items-center gap-2 mb-1">
            <Award className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-300/80">
              ציון סופי מומלץ
            </span>
          </div>
          <div className="flex items-end gap-2">
            <AnimatedNumber
              to={recommendedGrade}
              duration={1.6}
              className="text-6xl font-black tabular-nums text-white leading-none"
            />
            <span className="mb-1 text-lg font-semibold text-violet-300/70">/ 100</span>
          </div>
          <span
            className="inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold"
            style={{
              background: `${lv.color}22`,
              borderColor: `${lv.color}55`,
              color: lv.color,
            }}
          >
            {gradeLabel}
          </span>
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div
          className="hidden sm:block h-20 w-px flex-shrink-0"
          style={{ background: 'rgba(167,139,250,0.20)' }}
        />
        <div className="sm:hidden h-px w-full" style={{ background: 'rgba(167,139,250,0.20)' }} />

        {/* ── Breakdown ───────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300/60">
            פירוט החישוב
          </p>

          {/* Fitness tests component */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white/80">מבחני כושר</span>
              <span className="text-violet-200 font-bold tabular-nums">{fitnessAvg}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <motion.div
                  className="absolute inset-y-0 start-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #818cf8, #6366f1)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${fitnessAvg}%` }}
                  transition={{ ease: EASE, duration: 1.2, delay: 0.4 }}
                />
              </div>
              <span className="text-[11px] font-semibold text-violet-300/70 w-10 text-end">
                {testWeight}%
              </span>
            </div>
          </div>

          {/* Talmidaut component */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white/80">תלמידאות</span>
              <span className="text-violet-200 font-bold tabular-nums">{talmidautAvg}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <motion.div
                  className="absolute inset-y-0 start-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${talmidautAvg}%` }}
                  transition={{ ease: EASE, duration: 1.2, delay: 0.55 }}
                />
              </div>
              <span className="text-[11px] font-semibold text-violet-300/70 w-10 text-end">
                {talmidautWeight}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Talmidaut Record Card ────────────────────────────────────────────────────

interface TalmidautRecordCardProps {
  record: TalmidautRecord;
}

function TalmidautRecordCard({ record }: TalmidautRecordCardProps): React.JSX.Element {
  const date = new Date(record.recordedAt).toLocaleDateString('he-IL');
  const level = fitnessLevel(record.compositeScore);
  const lv = LEVEL[level];

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{
        background:           'rgba(238,242,255,0.70)',
        border:               '1px solid rgba(255,255,255,0.90)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            '0 4px 16px rgba(15,23,42,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" dir="rtl">
        <span className="text-xs font-medium text-slate-400">{date}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${lv.badge}`}>
          {record.compositeScore}
        </span>
      </div>

      {/* Three sub-scores */}
      <div className="grid grid-cols-3 gap-2 text-center" dir="rtl">
        {[
          { label: 'השתתפות', value: record.participation },
          { label: 'לבוש', value: record.uniform },
          { label: 'התנהגות', value: record.behavior },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-400">{label}</span>
            <span className="text-sm font-extrabold text-slate-700 tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {record.notes && (
        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2" dir="rtl">
          {record.notes}
        </p>
      )}
    </div>
  );
}

// ─── Talmidaut Dialog ─────────────────────────────────────────────────────────

interface TalmidautDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  classId: string;
  studentId: string;
}

function TalmidautDialog({ open, onClose, onSuccess, classId, studentId }: TalmidautDialogProps): React.JSX.Element {
  const [participation, setParticipation] = useState('');
  const [uniform, setUniform] = useState('');
  const [behavior, setBehavior] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setParticipation('');
    setUniform('');
    setBehavior('');
    setNotes('');
    setFieldError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const validate = (val: string, label: string): number | null => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0 || n > 100) {
      setFieldError(`${label} חייב להיות מספר בין 0 ל-100`);
      return null;
    }
    return n;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFieldError(null);

    const p = validate(participation, 'השתתפות');
    const u = validate(uniform, 'לבוש');
    const b = validate(behavior, 'התנהגות');
    if (p === null || u === null || b === null) return;

    setSubmitting(true);
    try {
      await apiRequest(
        `/classes/${classId}/students/${studentId}/talmidaut`,
        {
          method: 'POST',
          body: JSON.stringify({ participation: p, uniform: u, behavior: b, notes: notes.trim() || undefined }),
        },
      );
      onSuccess('ציון התלמידאות נשמר בהצלחה ✓');
      handleClose();
    } catch {
      setFieldError('שגיאה בשמירת הנתונים — נסה שוב');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-md"
        style={{
          background:           'rgba(255,255,255,0.96)',
          backdropFilter:       'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:               '1px solid rgba(99,102,241,0.15)',
          boxShadow:            '0 24px 64px rgba(76,29,149,0.18)',
        }}
      >
        <DialogHeader dir="rtl">
          <DialogTitle className="text-base font-bold text-slate-900">
            עדכון ציון תלמידאות
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4 mt-2" dir="rtl">
          {/* Three score fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'השתתפות', value: participation, setter: setParticipation },
              { label: 'לבוש', value: uniform, setter: setUniform },
              { label: 'התנהגות', value: behavior, setter: setBehavior },
            ].map(({ label, value, setter }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-slate-600">{label} (0–100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0–100"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  className="text-center tabular-nums font-bold text-slate-800"
                />
              </div>
            ))}
          </div>

          {/* Notes textarea */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600">הערות (אופציונלי)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות על ביצועי התלמיד..."
              rows={3}
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Validation error */}
          {fieldError && (
            <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">
              {fieldError}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-start gap-3 pt-1">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
              className="text-slate-600"
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Class Progress Chart ─────────────────────────────────────────────────────
// Premium animated turquoise-emerald flowing area chart.

interface ClassProgressTooltipProps {
  active?:  boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?:   string;
}

function ClassProgressTooltip({ active, payload, label }: ClassProgressTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length || !label) return null;

  const avgEntry  = payload.find((p) => p.dataKey === 'avg');
  const normEntry = payload.find((p) => p.dataKey === 'norm');

  if (avgEntry?.value == null) return null;

  return (
    <div
      style={{
        background:           'rgba(15,23,42,0.82)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border:               '1px solid rgba(45,212,191,0.25)',
        boxShadow:            '0 8px 32px rgba(45,212,191,0.15)',
        borderRadius:         12,
        padding:              '10px 14px',
        minWidth:             140,
        direction:            'rtl',
      }}
    >
      <p className="text-[11px] font-semibold text-teal-300 mb-1.5">{label}</p>
      {normEntry?.value != null && (
        <p className="text-[11px] text-slate-400 mb-0.5">
          נורמה ארצית:{' '}
          <span className="font-bold text-slate-300">{normEntry.value}</span>
        </p>
      )}
      <p className="text-[11px] text-slate-400">
        ממוצע הכיתה:{' '}
        <span className="font-bold text-teal-300">{avgEntry.value}</span>
      </p>
    </div>
  );
}

interface ClassProgressChartProps {
  progressData: ProgressPoint[];
  testName:     string;
  testUnit:     string | null;
}

function ClassProgressChart({ progressData, testName, testUnit }: ClassProgressChartProps): React.JSX.Element {
  const gradientId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge API points into the full school-year template — gaps stay null (shown as breaks)
  const chartData = SCHOOL_YEAR_MONTHS.map((month) => {
    const point = progressData.find((p) => p.month === month);
    return { month, avg: point?.classAvg ?? null, norm: NATIONAL_NORM };
  });

  // Find the October point for the permanent reference dot
  const octPoint = chartData[OCT_INDEX];
  const octAvg   = octPoint?.avg ?? null;

  return (
    <div className="relative">
      {/* ── Shimmer + pulse keyframes ─────────────────────────────── */}
      <style>{`
        @keyframes chartShimmer {
          0%   { transform: translateX(-120%); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateX(220%); opacity: 0; }
        }
        @keyframes chartPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.90; }
        }
        @keyframes areaLineFlow {
          0%   { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }
        .chart-pulse-wrap { animation: chartPulse 3.2s ease-in-out infinite; }
        .shimmer-bar       { animation: chartShimmer 3.6s ease-in-out infinite; }
        .shimmer-bar-delay { animation: chartShimmer 3.6s ease-in-out 1.8s infinite; }
      `}</style>

      {/* ── Chart container with shimmer overlay ──────────────────── */}
      <div className="chart-pulse-wrap relative overflow-hidden rounded-xl" style={{ height: 220 }} ref={containerRef}>
        {/* Primary shimmer sweep */}
        <div
          className="shimmer-bar pointer-events-none absolute inset-y-0 z-10"
          style={{
            width:      '45%',
            background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.10), rgba(16,185,129,0.06), transparent)',
          }}
        />
        {/* Secondary shimmer sweep (offset) */}
        <div
          className="shimmer-bar-delay pointer-events-none absolute inset-y-0 z-10"
          style={{
            width:      '30%',
            background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.07), transparent)',
          }}
        />

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 20, bottom: 10, left: 35 }}>
            <defs>
              {/* Main turquoise-emerald gradient */}
              <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2dd4bf" stopOpacity={0.55} />
                <stop offset="40%"  stopColor="#14b8a6" stopOpacity={0.30} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
              {/* Inner "flow line" gradient — slightly lighter, for depth */}
              <linearGradient id={`flow-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#99f6e4" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.12)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: 'rgba(100,116,139,0.75)', fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[50, 100]}
              ticks={[50, 60, 70, 80, 90, 100]}
              tick={{ fill: 'rgba(100,116,139,0.65)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              content={<ClassProgressTooltip />}
              cursor={{ stroke: 'rgba(45,212,191,0.25)', strokeWidth: 1.5, strokeDasharray: '4 3' }}
            />

            {/* Norm dashed baseline line */}
            <Line
              type="monotone"
              dataKey="norm"
              stroke="rgba(148,163,184,0.55)"
              strokeWidth={1.5}
              strokeDasharray="7 4"
              dot={false}
              isAnimationActive={false}
            />

            {/* Inner "glow" area — creates depth/shimmer inside the fill */}
            <Area
              type="monotone"
              dataKey="avg"
              stroke="none"
              fill={`url(#flow-${gradientId})`}
              connectNulls={false}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />

            {/* Primary class-average area */}
            <Area
              type="monotone"
              dataKey="avg"
              stroke="#2dd4bf"
              strokeWidth={2.5}
              fill={`url(#grad-${gradientId})`}
              connectNulls={false}
              dot={{ fill: '#2dd4bf', r: 3, strokeWidth: 0 }}
              activeDot={{ fill: 'white', stroke: '#2dd4bf', strokeWidth: 2.5, r: 7 }}
              isAnimationActive={true}
              animationDuration={2200}
              animationEasing="ease-out"
            />

            {/* Permanent highlighted dot on אוק' (Oct) point */}
            {octAvg !== null && (
              <ReferenceDot
                x={"אוק'"}
                y={octAvg}
                r={7}
                fill="white"
                stroke="#2dd4bf"
                strokeWidth={2.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-center gap-5 text-[11px] text-slate-500" dir="rtl">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm" style={{ background: 'linear-gradient(90deg, #2dd4bf, #10b981)' }} />
          <span className="font-medium">הכיתה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-0 w-5"
            style={{ borderTop: '2px dashed rgba(148,163,184,0.7)' }}
          />
          <span className="font-medium">נורמה ארצית ---</span>
        </div>
      </div>
    </div>
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

// ─── Glassmorphic bento card shells ──────────────────────────────────────────

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

const BENTO_CHART_STYLE: React.CSSProperties = {
  background:           'rgba(14,30,54,0.72)',
  backdropFilter:       'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border:               '1px solid rgba(45,212,191,0.18)',
  boxShadow:            '0 8px 40px rgba(45,212,191,0.10)',
};

// ─── Inline success toast ─────────────────────────────────────────────────────

interface ToastProps { message: string; onDismiss: () => void }
function SuccessToast({ message, onDismiss }: ToastProps): React.JSX.Element {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="fixed bottom-6 start-6 z-50 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl"
      dir="rtl"
    >
      {message}
    </motion.div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function StudentProfileSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-5 w-52 animate-pulse rounded-lg bg-white/70" />
      <div className="h-32 animate-pulse rounded-2xl bg-white/40 shadow-sm" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-2xl bg-white/40 shadow-sm" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-52 animate-pulse rounded-2xl bg-white/40 shadow-sm" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-white/30 shadow-sm" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentProfilePage(): React.JSX.Element {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const { activeSemester } = useSemester();

  const { data: cls }                                     = useClass(classId);
  const { data: profile, isLoading, error, mutate }       = useStudentProfile(classId, studentId, activeSemester);
  const { data: classDetails }                            = useClassDetails(classId, activeSemester);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  // Success toast
  const [toast, setToast] = useState<string | null>(null);

  // Which test type's class progress to display in the chart
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  // Initialise the chart tab to the first test type once details load
  useEffect(() => {
    if (classDetails?.testSummaries[0] && !selectedTestId) {
      setSelectedTestId(classDetails.testSummaries[0].testTypeId);
    }
  }, [classDetails, selectedTestId]);

  const handleTalmidautSuccess = useCallback((msg: string) => {
    setToast(msg);
    void mutate();
  }, [mutate]);

  if (isLoading) return <StudentProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
        לא ניתן לטעון את נתוני התלמיד — נסה לרענן את הדף.
      </div>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`;
  const charCode  = profile.firstName.charCodeAt(0) + profile.lastName.charCodeAt(0);
  const tint      = AVATAR_TINTS[charCode % AVATAR_TINTS.length]!;
  const overallLevel = fitnessLevel(profile.overallAvg);
  const ovLv         = LEVEL[overallLevel];

  const attendanceColor =
    profile.attendancePct >= 90 ? '#10b981'
    : profile.attendancePct >= 75 ? '#f59e0b'
    : '#ef4444';

  // Attendance sparkline data
  const attendanceTrendData = profile.attendanceTrend.map((v, i) => ({ i, v }));

  // ── Class progress chart data ──────────────────────────────────────────────
  const selectedSummary = classDetails?.testSummaries.find(
    (s) => s.testTypeId === selectedTestId,
  );

  return (
    <motion.div variants={PAGE_ENTER} initial="hidden" animate="show" className="space-y-6">

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <motion.nav variants={ITEM} aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          הכיתות שלי
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <Link href={`/classes/${classId}`} className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
          {cls?.name ?? '...'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <span className="font-semibold text-slate-700">{profile.firstName} {profile.lastName}</span>
      </motion.nav>

      {/* ── Final Grade Hero Card ────────────────────────────────────── */}
      <FinalGradeHeroCard finalGrade={profile.finalGrade} />

      {/* ── 3-card bento header ──────────────────────────────────────── */}
      <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Card 1 — Student identity */}
        <motion.div
          variants={ITEM}
          whileHover={{ y: -4, transition: { ease: EASE, duration: 0.3 } }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={BENTO_IDENTITY_STYLE}
        >
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
              <span className={`absolute -bottom-1 -end-1 h-4 w-4 rounded-full border-2 border-white ${ovLv.bg}`} />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight truncate">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">תלמיד</p>
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
              to={profile.attendancePct}
              suffix="%"
              duration={1.6}
              className="text-4xl font-extrabold tabular-nums"
            />
            {attendanceTrendData.length > 1 && (
              <div className="mt-3" style={{ height: 42 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id="att-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={attendanceColor} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={attendanceColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={attendanceColor}
                      strokeWidth={2.5}
                      fill="url(#att-gradient)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              מגמה — {profile.attendanceTrend.length} שיעורים אחרונים
            </p>
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
              to={profile.overallAvg}
              duration={1.4}
              className="text-4xl font-extrabold tabular-nums text-slate-900"
            />
            <div className="mt-2 flex flex-col gap-2">
              <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-bold ${ovLv.badge}`}>
                {ovLv.label}
              </span>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <motion.div
                  className="absolute inset-y-0 start-0 rounded-full"
                  style={{ backgroundColor: ovLv.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${profile.overallAvg}%` }}
                  transition={{ ease: EASE, duration: 1.2, delay: 0.4 }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                ממוצע מכל {profile.testHistories.length} המבחנים
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Per-test cards ───────────────────────────────────────────── */}
      {profile.testHistories.length > 0 && (
        <motion.div variants={ITEM}>
          <h2 className="text-base font-bold text-slate-900 mb-4">
            ביצועים לפי מבחן — השוואה לנורמת משרד החינוך
          </h2>
          <motion.div variants={STAGGER} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {profile.testHistories.map((th: StudentTestHistory, i: number) => (
              <UltimateTestCard
                key={th.testTypeId}
                themeIndex={i}
                label={th.nameHe}
                unit={th.unit}
                inputType={th.inputType}
                score={th.latestGrade}
                rawValue={th.latestRawValue}
                history={th.history.map((h) => h.grade)}
              />
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* ── Talmidaut Section ────────────────────────────────────────── */}
      <motion.div variants={ITEM}>
        <div className="flex items-center justify-between mb-4" dir="rtl">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}
            >
              <ClipboardList className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">תלמידאות</h2>
              <p className="text-xs text-slate-400">השתתפות · לבוש · התנהגות</p>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold h-10 px-4"
          >
            + עדכן ציון תלמידאות
          </Button>
        </div>

        {profile.talmidautRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.talmidautRecords.map((record) => (
              <TalmidautRecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center"
            dir="rtl"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <ClipboardList className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">טרם נרשם ציון תלמידאות</p>
              <p className="mt-1 text-sm text-slate-400">לחץ &ldquo;עדכן ציון תלמידאות&rdquo; כדי להוסיף הערכה ראשונה</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Class Progress Chart ─────────────────────────────────────── */}
      {classDetails && classDetails.testSummaries.length > 0 && (
        <motion.div variants={ITEM}>
          <motion.div
            whileHover={{ y: -3, transition: { ease: EASE, duration: 0.3 } }}
            className="rounded-2xl p-6"
            style={BENTO_CHART_STYLE}
          >
            {/* Chart header */}
            <div className="flex flex-col gap-3 mb-5" dir="rtl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">התקדמות הכיתה</h3>
                  {selectedSummary && (
                    <p className="text-xs text-teal-300/80 mt-0.5">
                      {selectedSummary.nameHe}
                      {selectedSummary.unit ? ` — ${selectedSummary.unit}` : ''}
                    </p>
                  )}
                </div>
                {/* Chart icon */}
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.25)' }}
                >
                  <TrendingUp className="h-4 w-4 text-teal-400" aria-hidden="true" />
                </div>
              </div>

              {/* Test-type tab pills */}
              {classDetails.testSummaries.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {classDetails.testSummaries.map((s) => {
                    const isActive = s.testTypeId === selectedTestId;
                    return (
                      <button
                        key={s.testTypeId}
                        type="button"
                        onClick={() => setSelectedTestId(s.testTypeId)}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                        style={{
                          background: isActive ? 'rgba(45,212,191,0.20)' : 'rgba(255,255,255,0.06)',
                          border:     `1px solid ${isActive ? 'rgba(45,212,191,0.40)' : 'rgba(255,255,255,0.10)'}`,
                          color:      isActive ? '#2dd4bf' : 'rgba(148,163,184,0.8)',
                        }}
                      >
                        {s.nameHe}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart */}
            {selectedSummary ? (
              <ClassProgressChart
                progressData={selectedSummary.progressData}
                testName={selectedSummary.nameHe}
                testUnit={selectedSummary.unit}
              />
            ) : (
              <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                אין נתוני התקדמות עדיין
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ── Talmidaut Dialog ──────────────────────────────────────────── */}
      <TalmidautDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleTalmidautSuccess}
        classId={classId}
        studentId={studentId}
      />

      {/* ── Success Toast ──────────────────────────────────────────────── */}
      {toast && (
        <SuccessToast message={toast} onDismiss={() => setToast(null)} />
      )}
    </motion.div>
  );
}
