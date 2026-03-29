'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Dumbbell,
  Hash,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createStudentSchema,
  type CreateStudentInput,
  type GradeDistribution,
  type StudentData,
  type TestSummary,
} from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { useClass, useClassDetails, useStudents } from '@/hooks/use-classes';
import { useComparisonAvailability } from '@/hooks/use-comparison';
import { useSemester } from '@/contexts/semester-context';
import { useTestTypes, type TestType } from '@/hooks/use-test-types';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatRawValue } from '@/lib/utils';
import { formatClassWithGender } from '@/lib/class-utils';
import { SemesterEmptyBanner } from '@/components/layout/semester-empty-banner';
import { SemesterPanel } from '@/components/ui/semester-panel';
import { TestTypePicker } from '@/components/tests/test-type-picker';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

const GENDER_LABELS: Record<'MALE' | 'FEMALE' | 'OTHER', string> = {
  MALE: 'זכר',
  FEMALE: 'נקבה',
  OTHER: 'אחר',
};

const SELECT_STYLES =
  'flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-slate-200 text-slate-700',
  'bg-cyan-100 text-cyan-700',
] as const;

/** Ministry of Education national fitness norm. */
const NATIONAL_NORM = 74;

// ─── Visual config cycle for test type colors ─────────────────────────────────

const TAB_VISUAL_CONFIGS = [
  { icon: Timer,      chartColor: '#0d9488' },
  { icon: Dumbbell,   chartColor: '#ea580c' },
  { icon: TrendingUp, chartColor: '#7c3aed' },
  { icon: Target,     chartColor: '#059669' },
] as const;

function getTabVisual(index: number): (typeof TAB_VISUAL_CONFIGS)[number] {
  return TAB_VISUAL_CONFIGS[index % TAB_VISUAL_CONFIGS.length]!;
}

// ─── Test type input-type labels ──────────────────────────────────────────────

const INPUT_TYPE_ICONS: Record<string, React.ElementType> = {
  TIME:      Timer,
  REPS:      Dumbbell,
  GENERAL:   Target,
  PASS_FAIL: Activity,
};

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

/** 3D tilt-up entrance for each section */
const ITEM = {
  hidden: { opacity: 0, y: 22, rotateX: 7 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

const ROW_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const ROW_ITEM = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

// ─── Grade helpers ────────────────────────────────────────────────────────────

type FitnessLevel = 'excellent' | 'good' | 'pass' | 'fail';

function gradeLevel(score: number): FitnessLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'pass';
  return 'fail';
}

const LEVEL_STYLE: Record<FitnessLevel, { label: string; bg: string; text: string; border: string; dot: string }> = {
  excellent: { label: 'מצטיין',       bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  good:      { label: 'טוב',          bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  pass:      { label: 'עובר',         bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  fail:      { label: 'מתחת לנורמה', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
};

// ─── Student Search Bar ───────────────────────────────────────────────────────

interface StudentSearchBarProps {
  value:    string;
  onChange: (v: string) => void;
  count:    number;
  total:    number;
}

function StudentSearchBar({ value, onChange, count, total }: StudentSearchBarProps): React.JSX.Element {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const isFiltering           = value.trim().length > 0;

  return (
    <div className="relative w-full" role="search" aria-label="חיפוש תלמידים">
      {/* Ambient violet glow ring */}
      <motion.div
        className="pointer-events-none absolute -inset-[3px] rounded-2xl"
        animate={{
          opacity: focused ? 1 : 0,
          boxShadow: focused
            ? '0 0 0 3px rgba(99,102,241,0.20), 0 0 24px rgba(99,102,241,0.16), 0 0 48px rgba(139,92,246,0.09)'
            : '0 0 0 0px rgba(99,102,241,0)',
        }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        aria-hidden="true"
      />

      {/* Glass pill */}
      <motion.div
        animate={{
          scale:      focused ? 1.010 : 1,
          background: focused ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.55)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative flex items-center gap-3 rounded-2xl border border-white/70 px-4 cursor-text"
        style={{
          backdropFilter:       'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow:            '0 2px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
          height: 46,
        }}
        onClick={() => { inputRef.current?.focus(); }}
      >
        {/* Search icon — RTL start = right side */}
        <motion.div
          animate={{ color: focused ? '#6366f1' : '#94a3b8' }}
          transition={{ duration: 0.18 }}
          className="shrink-0"
          aria-hidden="true"
        >
          <Search className="h-4 w-4" />
        </motion.div>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onFocus={() => { setFocused(true); }}
          onBlur={() => { setFocused(false); }}
          placeholder="חפש תלמיד לפי שם..."
          aria-label="חיפוש תלמיד לפי שם"
          className={cn(
            'flex-1 min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 transition-colors duration-150',
            focused ? 'text-slate-800' : 'text-slate-600',
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Live result counter pill */}
        <AnimatePresence>
          {isFiltering && (
            <motion.span
              key="count"
              initial={{ opacity: 0, scale: 0.65 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.65 }}
              transition={{ type: 'spring', stiffness: 440, damping: 28 }}
              className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                background: count > 0 ? 'rgba(99,102,241,0.10)' : 'rgba(239,68,68,0.10)',
                color:      count > 0 ? '#4f46e5'               : '#dc2626',
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {count}/{total}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Clear ✕ */}
        <AnimatePresence>
          {isFiltering && (
            <motion.button
              key="clear"
              type="button"
              initial={{ opacity: 0, scale: 0.65, rotate: -45 }}
              animate={{ opacity: 1, scale: 1,    rotate: 0   }}
              exit={{ opacity: 0, scale: 0.65,    rotate: 45  }}
              transition={{ type: 'spring', stiffness: 440, damping: 28 }}
              whileHover={{ scale: 1.18, backgroundColor: 'rgba(99,102,241,0.10)' }}
              whileTap={{ scale: 0.88 }}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                inputRef.current?.focus();
              }}
              className="shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
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

// ─── Student Search Empty State ────────────────────────────────────────────────
// Pattern inspired by 21st.dev EmptyState — three fan-spread icon cards

function StudentSearchEmptyState({ query }: { query: string }): React.JSX.Element {
  return (
    <motion.div
      key="student-search-empty"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ ease: EASE, duration: 0.35 }}
      className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-indigo-200/60 bg-white/55 backdrop-blur-xl py-14 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Three fan-spread icon cards */}
      <div className="flex items-end justify-center" style={{ gap: 6 }}>
        {/* Left card — tilted */}
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-slate-200/80 -rotate-6 translate-y-1"
          aria-hidden="true"
        >
          <Users className="h-5 w-5 text-slate-400" />
        </div>
        {/* Center card — upright, lifts on hover */}
        <motion.div
          className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-indigo-200/70 z-10"
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          aria-hidden="true"
        >
          <Search className="h-5 w-5 text-indigo-400" />
        </motion.div>
        {/* Right card — tilted */}
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-slate-200/80 rotate-6 translate-y-1"
          aria-hidden="true"
        >
          <Brain className="h-5 w-5 text-slate-400" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-slate-700">לא נמצא תלמיד בשם זה</p>
        <p className="text-sm text-slate-400 max-w-xs">
          לא נמצאו תלמידים התואמים לחיפוש{' '}
          <span className="font-medium text-indigo-500">&ldquo;{query}&rdquo;</span>
        </p>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ClassDetailSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded-lg bg-white/70" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-36 animate-pulse rounded-3xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />
        ))}
      </div>
      <div className="h-14 animate-pulse rounded-2xl bg-white/60" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
      </div>
      <div className="h-36 animate-pulse rounded-2xl bg-white/60" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
    </div>
  );
}

// ─── Attendance record type (local) ──────────────────────────────────────────

interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  exemptionReason: string | null;
  exemptionExpiresAt: string | null;
}

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Exemption Dialog ─────────────────────────────────────────────────────────

interface ExemptionDialogProps {
  studentId: string;
  studentName: string;
  classId: string;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function ExemptionDialog({
  studentId,
  studentName,
  classId,
  today,
  open,
  onOpenChange,
  onSuccess,
}: ExemptionDialogProps): React.JSX.Element {
  const { activeSemester } = useSemester();
  const [reason, setReason]     = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function handleClose(next: boolean): void {
    if (!next) { setReason(''); setExpiresAt(''); setError(null); }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading || reason.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/classes/${classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          date: today,
          semester: activeSemester,
          records: [{
            studentId,
            status: 'EXCUSED',
            exemptionReason: reason.trim(),
            ...(expiresAt ? { exemptionExpiresAt: expiresAt } : {}),
          }],
        }),
      });
      handleClose(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'שגיאה בשמירת הפטור');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
              <ShieldAlert className="h-5 w-5 text-orange-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-slate-800">סמן פטור</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">{studentName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border',
          activeSemester === 'A'
            ? 'bg-violet-50 text-violet-700 border-violet-200/70'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        )}>
          <span aria-hidden="true">📌</span>
          <span>שימו לב: ההזנה מתבצעת למחצית {activeSemester === 'A' ? 'א׳' : 'ב׳'}</span>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="ex-reason" className="text-slate-700 font-medium">סיבת פטור <span className="text-red-500">*</span></Label>
            <Input
              id="ex-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: פציעה בברך"
              disabled={loading}
              minLength={2}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-orange-400"
              aria-label="סיבת פטור"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-expiry" className="text-slate-700 font-medium">
              תוקף הפטור
              <span className="ms-1 text-xs font-normal text-slate-400">(אופציונלי)</span>
            </Label>
            <Input
              id="ex-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={today}
              disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-orange-400"
              aria-label="תוקף הפטור"
            />
            <p className="text-xs text-slate-400">ריק = ללא הגבלת זמן</p>
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" disabled={loading} onClick={() => handleClose(false)} className="rounded-xl">ביטול</Button>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                disabled={loading || reason.trim().length < 2}
                className={cn(
                  'gap-2 rounded-xl shadow-sm',
                  activeSemester === 'A'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-emerald-600 hover:bg-emerald-700',
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
                {loading ? 'שומר...' : 'אשר פטור'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Absence Dialog ───────────────────────────────────────────────────────────

interface AbsenceDialogProps {
  studentId: string;
  studentName: string;
  classId: string;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function AbsenceDialog({
  studentId,
  studentName,
  classId,
  today,
  open,
  onOpenChange,
  onSuccess,
}: AbsenceDialogProps): React.JSX.Element {
  const { activeSemester } = useSemester();
  const [date, setDate]       = useState(today);
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function handleClose(next: boolean): void {
    if (!next) { setReason(''); setDate(today); setError(null); }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/classes/${classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          semester: activeSemester,
          records: [{
            studentId,
            status: 'ABSENT',
            ...(reason.trim() ? { notes: reason.trim() } : {}),
          }],
        }),
      });
      handleClose(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'שגיאה בשמירת החיסור');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <UserMinus className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-slate-800">רשום חיסור</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">{studentName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border',
          activeSemester === 'A'
            ? 'bg-violet-50 text-violet-700 border-violet-200/70'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        )}>
          <span aria-hidden="true">📌</span>
          <span>שימו לב: ההזנה מתבצעת למחצית {activeSemester === 'A' ? 'א׳' : 'ב׳'}</span>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="abs-date" className="flex items-center gap-1.5 text-slate-700 font-medium">
              <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
              תאריך
            </Label>
            <Input
              id="abs-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-red-400"
              aria-label="תאריך החיסור"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="abs-reason" className="text-slate-700 font-medium">
              סיבה
              <span className="ms-1 text-xs font-normal text-slate-400">(אופציונלי)</span>
            </Label>
            <Input
              id="abs-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="לדוגמה: מחלה"
              disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-red-400"
              aria-label="סיבת החיסור"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" disabled={loading} onClick={() => handleClose(false)} className="rounded-xl">ביטול</Button>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  'gap-2 rounded-xl shadow-sm',
                  activeSemester === 'A'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-emerald-600 hover:bg-emerald-700',
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserMinus className="h-4 w-4" aria-hidden="true" />}
                {loading ? 'שומר...' : 'אשר חיסור'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Student row actions (absent + exempt buttons) ────────────────────────────

interface StudentRowActionsProps {
  studentId: string;
  studentName: string;
  classId: string;
  today: string;
  isAbsent: boolean;
  isExempt: boolean;
  onOpenExemptDialog: (studentId: string) => void;
  onToggleAbsent: (studentId: string) => void;
  absentLoading: boolean;
}

function StudentRowActions({
  studentId,
  studentName,
  isAbsent,
  isExempt,
  onOpenExemptDialog,
  onToggleAbsent,
  absentLoading,
}: StudentRowActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {/* Absent toggle */}
      <motion.button
        type="button"
        onClick={(e) => { e.preventDefault(); onToggleAbsent(studentId); }}
        disabled={absentLoading || isExempt}
        whileHover={absentLoading || isExempt ? {} : { scale: 1.08 }}
        whileTap={absentLoading || isExempt ? {} : { scale: 0.92 }}
        title={isAbsent ? 'בטל חיסור' : 'סמן כחסר'}
        aria-label={`${isAbsent ? 'בטל חיסור' : 'סמן כחסר'} עבור ${studentName}`}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
          isAbsent
            ? 'bg-red-500 text-white shadow-[0_2px_10px_rgba(239,68,68,0.40)]'
            : 'border border-red-200/70 bg-red-50/60 text-red-400 hover:bg-red-100 hover:text-red-600 hover:border-red-300',
          (absentLoading || isExempt) && 'opacity-40 cursor-not-allowed',
        )}
      >
        {absentLoading
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <UserMinus className="h-4 w-4" aria-hidden="true" />
        }
      </motion.button>

      {/* Exempt button */}
      <motion.button
        type="button"
        onClick={(e) => { e.preventDefault(); onOpenExemptDialog(studentId); }}
        disabled={isAbsent}
        whileHover={isAbsent ? {} : { scale: 1.08 }}
        whileTap={isAbsent ? {} : { scale: 0.92 }}
        title={isExempt ? 'פטור פעיל' : 'סמן פטור'}
        aria-label={`${isExempt ? 'פטור פעיל' : 'סמן פטור'} עבור ${studentName}`}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
          isExempt
            ? 'bg-orange-500 text-white shadow-[0_2px_10px_rgba(249,115,22,0.40)]'
            : 'border border-orange-200/70 bg-orange-50/60 text-orange-400 hover:bg-orange-100 hover:text-orange-600 hover:border-orange-300',
          isAbsent && 'opacity-40 cursor-not-allowed',
        )}
      >
        {isExempt
          ? <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          : <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        }
      </motion.button>
    </div>
  );
}

// ─── Add Student Dialog ───────────────────────────────────────────────────────

interface AddStudentDialogProps {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function AddStudentDialog({ classId, open, onOpenChange, onSuccess }: AddStudentDialogProps): React.JSX.Element {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setError } =
    useForm<CreateStudentInput>({ resolver: zodResolver(createStudentSchema) });

  async function onSubmit(data: CreateStudentInput): Promise<void> {
    try {
      await apiRequest<StudentData>(`/classes/${classId}/students`, { method: 'POST', body: JSON.stringify(data) });
      reset(); onOpenChange(false); onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setError('studentCode', { message: 'קוד תלמיד זה כבר קיים בכיתה' });
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'שגיאה בהוספת התלמיד' });
      }
    }
  }

  function handleClose(next: boolean): void { if (!next) reset(); onOpenChange(next); }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-800">הוסף תלמיד לכיתה</DialogTitle>
          <DialogDescription className="text-slate-500">מלא את פרטי התלמיד. כל השדות חובה.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
              <Label htmlFor="sf" className="text-slate-700 font-medium">שם פרטי</Label>
              <Input id="sf" placeholder="ישראל" className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400" {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
            </motion.div>
            <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
              <Label htmlFor="sl" className="text-slate-700 font-medium">שם משפחה</Label>
              <Input id="sl" placeholder="ישראלי" className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400" {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
            </motion.div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
              <Label htmlFor="sd" className="text-slate-700 font-medium">תאריך לידה</Label>
              <Input id="sd" type="date" className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400" {...register('dateOfBirth')} />
              {errors.dateOfBirth && <p className="text-xs text-red-600">{errors.dateOfBirth.message}</p>}
            </motion.div>
            <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
              <Label htmlFor="sg" className="text-slate-700 font-medium">מין</Label>
              <select id="sg" className={cn(SELECT_STYLES)} {...register('gender')}>
                <option value="">בחר מין</option>
                <option value="MALE">זכר</option>
                <option value="FEMALE">נקבה</option>
                <option value="OTHER">אחר</option>
              </select>
              {errors.gender && <p className="text-xs text-red-600">{errors.gender.message}</p>}
            </motion.div>
          </div>
          <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
            <Label htmlFor="sc" className="text-slate-700 font-medium">קוד תלמיד</Label>
            <Input id="sc" placeholder="301" className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400" {...register('studentCode')} />
            {errors.studentCode && <p className="text-xs text-red-600">{errors.studentCode.message}</p>}
          </motion.div>
          <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
            <Label htmlFor="sp" className="text-slate-700 font-medium">סיסמה</Label>
            <Input id="sp" type="password" placeholder="לפחות 8 תווים" className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400" {...register('password')} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </motion.div>
          {errors.root && <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{errors.root.message}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleClose(false)} className="rounded-xl">ביטול</Button>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button type="submit" disabled={isSubmitting} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? 'מוסיף...' : 'הוסף תלמיד'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create session modal ─────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" for the date input default value. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const INPUT_TYPE_LABELS: Record<TestType['inputType'], string> = {
  TIME:      'שעון עצור',
  REPS:      'חזרות',
  PASS_FAIL: 'עובר / נכשל',
  GENERAL:   'ערך כללי',
};

interface CreateSessionModalProps {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradeLevel?: number | null;
}

function CreateSessionModal({ classId, open, onOpenChange, gradeLevel }: CreateSessionModalProps): React.JSX.Element {
  const router = useRouter();
  const { activeSemester } = useSemester();
  const { data: testTypes, isLoading: typesLoading } = useTestTypes();

  const [testTypeId, setTestTypeId]   = useState('');
  const [conductedAt, setConductedAt] = useState(todayIso);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Pre-select the first available test type whenever the list loads or modal opens
  useEffect(() => {
    if (open && testTypes && testTypes.length > 0 && testTypeId === '') {
      setTestTypeId(testTypes[0]!.id);
    }
  }, [open, testTypes, testTypeId]);

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setError(null);
      setIsSubmitting(false);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!testTypeId || isSubmitting) return;

    const selectedType = testTypes?.find((t) => t.id === testTypeId);
    const isStopwatch  = selectedType?.inputType === 'TIME';

    setIsSubmitting(true);
    setError(null);
    try {
      const session = await apiRequest<{ id: string }>(
        `/classes/${classId}/sessions`,
        {
          method: 'POST',
          body: JSON.stringify({ testTypeId, conductedAt, isStopwatch, semester: activeSemester }),
        },
      );

      const isSprint10x4   = isStopwatch && (
        selectedType?.nameHe.includes('10X4') === true ||
        selectedType?.nameHe.includes('10x4') === true ||
        selectedType?.nameHe.includes('4×10') === true ||
        selectedType?.nameHe.includes('4x10') === true ||
        (selectedType?.nameHe.includes('10') === true && selectedType?.nameHe.includes('4') === true && selectedType?.nameHe.includes('שאטל') === true)
      );
      const isSprint60     = selectedType?.nameHe.includes('60') === true || selectedType?.nameHe.includes('ספרינט') === true;
      const isLongDistance = isStopwatch && (
        selectedType?.nameHe.includes('800')  === true ||
        selectedType?.nameHe.includes('1000') === true ||
        selectedType?.nameHe.includes('1500') === true ||
        selectedType?.nameHe.includes('2000') === true ||
        selectedType?.nameHe.includes('מרחק') === true
      );
      const destination =
        selectedType?.nameHe.includes('ביפ') === true
          ? `/classes/${classId}/session/${session.id}/beep`
          : isLongDistance
            ? `/classes/${classId}/session/${session.id}/long-distance`
            : isSprint10x4
              ? `/classes/${classId}/session/${session.id}/sprint-10x4`
              : isSprint60 && isStopwatch
                ? `/classes/${classId}/session/${session.id}/sprint`
                : isStopwatch
                  ? `/classes/${classId}/session/${session.id}/live`
                  : `/classes/${classId}/session/${session.id}/manual`;

      router.push(destination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'שגיאה ביצירת השיעור — נסה שוב');
      setIsSubmitting(false);
    }
  }

  const selectedType = testTypes?.find((t) => t.id === testTypeId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-white/80 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <DialogHeader>
          <DialogTitle className="text-slate-800 text-lg font-extrabold">פתח מבחן כושר חדש</DialogTitle>
          <DialogDescription className="text-slate-500 text-sm">
            בחר את סוג המבחן ותאריך הביצוע. המערכת תנווט אותך אוטומטית למסך המתאים.
          </DialogDescription>
        </DialogHeader>

        {/* Semester safety badge */}
        <div className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border',
          activeSemester === 'A'
            ? 'bg-violet-50 text-violet-700 border-violet-200/70'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        )}>
          <span aria-hidden="true">📌</span>
          <span>שימו לב: ההזנה מתבצעת למחצית {activeSemester === 'A' ? 'א׳' : 'ב׳'}</span>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-5 pt-1">

          {/* Test type selector */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-semibold">סוג מבחן</Label>
            {typesLoading ? (
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <TestTypePicker
                testTypes={testTypes ?? []}
                value={testTypeId}
                onChange={setTestTypeId}
                gradeLevel={gradeLevel}
                disabled={isSubmitting}
              />
            )}

            {/* Input type badge */}
            {selectedType && (
              <motion.p
                key={selectedType.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                className={cn(
                  'text-xs font-semibold inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
                  selectedType.inputType === 'TIME'
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-indigo-50 text-indigo-700',
                )}
              >
                {selectedType.inputType === 'TIME' && (
                  <Timer className="h-3 w-3" aria-hidden="true" />
                )}
                {INPUT_TYPE_LABELS[selectedType.inputType]}
                {selectedType.inputType === 'TIME'
                  ? ' — יפתח מסך שעון עצור'
                  : ' — יפתח מסך הזנה ידנית'}
              </motion.p>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
              תאריך המבחן
            </Label>
            <Input
              type="date"
              value={conductedAt}
              onChange={(e) => setConductedAt(e.target.value)}
              max={todayIso()}
              disabled={isSubmitting}
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
              aria-label="תאריך המבחן"
            />
            <p className="text-xs text-slate-400">ניתן לבחור תאריך עבר להזנת נתונים ישנים</p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              className="rounded-xl"
            >
              ביטול
            </Button>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                disabled={isSubmitting || typesLoading || !testTypeId}
                className={cn(
                  'gap-2 rounded-xl shadow-sm',
                  activeSemester === 'A'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-emerald-600 hover:bg-emerald-700',
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {isSubmitting ? 'יוצר מבחן...' : 'צור מבחן'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Test Type Dropdown ───────────────────────────────────────────────────────

interface TestTypeDropdownProps {
  testSummaries: TestSummary[];
  selectedTestId: string | null;
  onSelect: (id: string) => void;
}

function TestTypeDropdown({ testSummaries, selectedTestId, onSelect }: TestTypeDropdownProps): React.JSX.Element {
  const { data: allTypes, isLoading } = useTestTypes();

  // All 28 test types from catalog; mark which ones have actual session data
  const options = (allTypes ?? []).map((t) => {
    const summary = testSummaries.find((s) => s.testTypeId === t.id);
    return { ...t, hasSessions: !!summary, sessionCount: summary?.studentGrades.length ?? 0 };
  });

  const selectedOpt = options.find((o) => o.id === selectedTestId);
  const TypeIcon = selectedOpt ? (INPUT_TYPE_ICONS[selectedOpt.inputType] ?? Target) : Dumbbell;

  if (isLoading) {
    return <div className="h-14 animate-pulse rounded-2xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />;
  }

  return (
    <div className="rounded-2xl bg-indigo-50/80 backdrop-blur-xl border border-white/80 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.10)]">
      <div className="flex flex-wrap items-center gap-4">
        {/* Icon + label */}
        <div className="flex items-center gap-2.5">
          <motion.div
            key={selectedTestId ?? 'none'}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 shadow-[0_4px_16px_rgba(99,102,241,0.40)]"
          >
            <TypeIcon className="h-5 w-5 text-white" aria-hidden="true" />
          </motion.div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              מבחן מוצג
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={selectedOpt?.nameHe ?? '—'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
                className="text-sm font-extrabold text-slate-900"
              >
                {selectedOpt ? `${selectedOpt.nameHe}${selectedOpt.unit ? ` (${selectedOpt.unit})` : ''}` : 'בחר מבחן'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* shadcn Select */}
        <Select
          value={selectedTestId ?? ''}
          onValueChange={(v) => {
            const opt = options.find((o) => o.id === v);
            if (opt) onSelect(opt.id);
          }}
          dir="rtl"
        >
          <SelectTrigger
            className="h-11 w-[260px] rounded-xl border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm focus:ring-2 focus:ring-indigo-400"
            aria-label="בחר מבחן"
          >
            <SelectValue placeholder="בחר מבחן…" />
          </SelectTrigger>
          <SelectContent
            className="rounded-xl border-white/80 bg-white/95 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            dir="rtl"
          >
            {/* Tests with recorded sessions first */}
            {options.some((o) => o.hasSessions) && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  מבחנים שבוצעו בכיתה
                </div>
                {options.filter((o) => o.hasSessions).map((opt) => {
                  const Icon = INPUT_TYPE_ICONS[opt.inputType] ?? Target;
                  return (
                    <SelectItem
                      key={opt.id}
                      value={opt.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg py-2.5 text-sm font-medium text-slate-800 focus:bg-indigo-50 focus:text-indigo-800"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
                        {opt.nameHe}
                        {opt.unit && <span className="text-xs text-slate-400">({opt.unit})</span>}
                        <span className="ms-1 rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
                          {opt.sessionCount} תוצאות
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
                <div className="my-1 h-px bg-slate-100" />
              </>
            )}
            {/* All other test types */}
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              כל סוגי המבחנים
            </div>
            {options.filter((o) => !o.hasSessions).map((opt) => {
              const Icon = INPUT_TYPE_ICONS[opt.inputType] ?? Target;
              return (
                <SelectItem
                  key={opt.id}
                  value={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg py-2 text-sm font-medium text-slate-500 focus:bg-slate-50 focus:text-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {opt.nameHe}
                    {opt.unit && <span className="text-xs text-slate-300">({opt.unit})</span>}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Session count badge strip for tests with data */}
      {testSummaries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {testSummaries.map((s, i) => {
            const visual = getTabVisual(i);
            const active = s.testTypeId === selectedTestId;
            return (
              <motion.button
                key={s.testTypeId}
                type="button"
                onClick={() => onSelect(s.testTypeId)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  active
                    ? 'bg-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]'
                    : 'bg-white/80 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700',
                )}
                style={active ? {} : {}}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? 'white' : visual.chartColor }}
                />
                {s.nameHe}
                {s.unit && <span className={active ? 'text-white/70' : 'text-slate-400'}>({s.unit})</span>}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Gamified podium ──────────────────────────────────────────────────────────

interface PodiumEntry { student: StudentData; score: number; rank: 1 | 2 | 3; rawValue: number | null; unit: string | null; inputType: string }

const PODIUM_META = {
  1: { label: '1', h: 'h-36', gradFrom: 'from-amber-300', gradTo: 'to-amber-500', glow: '0 0 30px rgba(251,191,36,0.60)', ring: 'ring-amber-400', medal: '🥇', avatarBg: 'bg-amber-100 text-amber-800',  delay: 0.2  },
  2: { label: '2', h: 'h-24', gradFrom: 'from-slate-300', gradTo: 'to-slate-400', glow: '0 0 22px rgba(148,163,184,0.55)', ring: 'ring-slate-300', medal: '🥈', avatarBg: 'bg-slate-100 text-slate-700',  delay: 0.35 },
  3: { label: '3', h: 'h-16', gradFrom: 'from-amber-600', gradTo: 'to-amber-700', glow: '0 0 18px rgba(180,83,9,0.45)',  ring: 'ring-amber-700', medal: '🥉', avatarBg: 'bg-orange-100 text-orange-800', delay: 0.5  },
} as const;

function Podium({ entries }: { entries: PodiumEntry[] }): React.JSX.Element {
  const displayOrder: (1 | 2 | 3)[] = [2, 1, 3];

  return (
    <div className="flex items-end justify-center gap-3 px-4" dir="ltr">
      {displayOrder.map((rank) => {
        const entry = entries.find((e) => e.rank === rank);
        if (!entry) return null;
        const meta        = PODIUM_META[rank];
        const initials    = `${entry.student.firstName[0] ?? ''}${entry.student.lastName[0] ?? ''}`;
        const displayName = `${entry.student.firstName} ${entry.student.lastName[0] ?? ''}.`;

        return (
          <motion.div
            key={rank}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.7, delay: meta.delay }}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <span className="text-2xl">{meta.medal}</span>
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: meta.delay + 0.15 }}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold ring-2 ${meta.ring} ${meta.avatarBg}`}
              style={{ boxShadow: meta.glow }}
            >
              {initials}
            </motion.div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-800 leading-tight max-w-[88px] truncate">{displayName}</p>
              <p className="text-xs font-semibold text-slate-500">{entry.score}</p>
              {entry.rawValue !== null && entry.unit && (() => {
                const fmtRaw = formatRawValue(entry.rawValue, entry.inputType);
                return fmtRaw !== null ? (
                  <p className="text-sm font-black text-slate-700 mt-0.5 tabular-nums">
                    {fmtRaw}
                    <span className="text-[11px] font-bold text-slate-500 ms-0.5">{entry.unit}</span>
                  </p>
                ) : null;
              })()}
            </div>
            <motion.div
              className={`w-full rounded-t-2xl bg-gradient-to-t ${meta.gradFrom} ${meta.gradTo} ${meta.h} flex items-start justify-center pt-2.5`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6, delay: meta.delay + 0.3 }}
              style={{ boxShadow: meta.glow, originY: 1 } as React.CSSProperties}
            >
              <span className="text-lg font-black text-white/80">{meta.label}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Distribution card ────────────────────────────────────────────────────────

interface DistributionCardProps {
  distribution: GradeDistribution;
  total: number;
}

function DistributionCard({ distribution, total }: DistributionCardProps): React.JSX.Element {
  const dist: Array<{ level: FitnessLevel; count: number }> = [
    { level: 'excellent', count: distribution.excellent },
    { level: 'good',      count: distribution.good      },
    { level: 'pass',      count: distribution.pass      },
    { level: 'fail',      count: distribution.fail      },
  ];

  return (
    <motion.div
      className="prismatic-glass rounded-2xl p-5"
      whileHover={{ y: -6, scale: 1.015, boxShadow: '0 20px 52px rgba(15,23,42,0.22)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <motion.div
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"
          whileHover={{ rotate: [-8, 8, 0], scale: 1.2, transition: { type: 'spring', stiffness: 500, damping: 12 } }}
        >
          <Activity className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </motion.div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">התפלגות לעומת הנורמה</h3>
          <p className="text-xs text-slate-500">לפי ציוני משרד החינוך</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {dist.map(({ level, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const s   = LEVEL_STYLE[level];
          return (
            <div key={level}>
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                <span className="text-xs text-slate-500">{count} תלמידים ({pct}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${s.dot}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.9, delay: 0.2 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── AI Dispatch helpers ──────────────────────────────────────────────────────

/** Weeks remaining until a plan end date, minimum 1. */
function weeksUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
}

// ─── AI Control Center — plan types & mock data ───────────────────────────────

const PLAN_TARGETS = [
  'כוח ומהירות',
  'סיבולת לב-ריאה',
  'גמישות וכוח ליבה',
  'כוח פלג גוף עליון',
] as const;

interface ActivePlanDetails {
  endDate:   Date;
  startDate: Date;
  progress:  number; // 0–100
  weekNum:   number; // 1–4
  target:    string;
}

interface DayExercise {
  name:   string;
  detail: string;
}

interface WeekPlan {
  week:      number;
  focus:     string;
  emoji:     string;
  exercises: DayExercise[];
}

/** מסלול הדרגתי — Gradual track */
const MOCK_PLAN_GRADUAL: WeekPlan[] = [
  {
    week: 1, focus: 'בניית בסיס — סיבולת', emoji: '🌱',
    exercises: [
      { name: 'ריצה קלה',     detail: '20 דקות, 65% דופק מרבי' },
      { name: 'שכיבות סמיכה', detail: '3 סטים × 10 חזרות'      },
      { name: 'פלאנק',         detail: '3 × 20 שניות'            },
      { name: 'קפיצות כוח',   detail: '2 סטים × 15'             },
    ],
  },
  {
    week: 2, focus: 'כוח פלג גוף עליון', emoji: '💪',
    exercises: [
      { name: 'שכיבות סמיכה', detail: '4 × 12'          },
      { name: 'מתח מוסגר',    detail: '3 × 6 חזרות'     },
      { name: 'ריצת שאטל',    detail: '5 × 30 מטר'      },
      { name: 'כפיפות בטן',   detail: '3 × 20'           },
    ],
  },
  {
    week: 3, focus: 'כוח פלג גוף תחתון', emoji: '🦵',
    exercises: [
      { name: 'סקוואט',       detail: '4 × 15 חזרות'    },
      { name: "לאנג'ס",       detail: '3 × 12 לכל רגל'  },
      { name: 'קפיצות לגובה', detail: '3 × 8'            },
      { name: 'ריצה מהירה',   detail: '6 × 100 מטר'     },
    ],
  },
  {
    week: 4, focus: 'שיא — עומס מלא', emoji: '🔥',
    exercises: [
      { name: 'אינטרוול ריצה', detail: '8 × 200 מטר'         },
      { name: 'שכיבות סמיכה',  detail: '4 × 15'               },
      { name: 'סקוואט קפיצה',  detail: '4 × 10'               },
      { name: 'תרגיל משולב',   detail: '3 סבבים × 5 תרגילים'  },
    ],
  },
];

/** מסלול אינטנסיבי — Intensive track */
const MOCK_PLAN_INTENSIVE: WeekPlan[] = [
  {
    week: 1, focus: 'הפעלה — עצימות גבוהה', emoji: '⚡',
    exercises: [
      { name: 'ריצת אינטרוול', detail: '6 × 200 מטר, 85% דופק' },
      { name: 'שכיבות סמיכה',  detail: '4 × 15 חזרות'           },
      { name: 'בורפי',          detail: '3 × 12'                 },
      { name: 'קפיצות קרוספיט', detail: '3 × 10'                },
    ],
  },
  {
    week: 2, focus: 'כוח + פליאומטריקה', emoji: '🚀',
    exercises: [
      { name: 'סקוואט קפיצה',  detail: '4 × 12'          },
      { name: 'שכיבות פיצוץ',  detail: '4 × 8'            },
      { name: 'ריצת מדרגות',   detail: '5 × 3 קומות'     },
      { name: 'מתח מוסגר',     detail: '4 × 8 חזרות'     },
    ],
  },
  {
    week: 3, focus: 'סיבולת + כוח משולב', emoji: '🔩',
    exercises: [
      { name: '5 ק"מ טמפו',    detail: '80% מהירות מרבית'    },
      { name: 'לאנגס קפיצה',   detail: '4 × 10 לכל רגל'      },
      { name: 'בורפי + מתח',   detail: '3 × 8 משולב'         },
      { name: 'אינטרוול אחרון', detail: '4 × 100 מטר ספרינט'  },
    ],
  },
  {
    week: 4, focus: 'עומס פיק — מבחן כושר', emoji: '🏆',
    exercises: [
      { name: 'ריצה 2 ק"מ',   detail: 'מהירות מרבית אישית'      },
      { name: 'שכיבות סמיכה', detail: '5 × 20 — כמה שיותר'       },
      { name: 'סקוואט',        detail: '5 × 20'                   },
      { name: 'מסלול מכשולים', detail: '3 סבבים ← מדידת זמן'     },
    ],
  },
];

/** Alias used by default (gradual) */
const MOCK_PLAN = MOCK_PLAN_GRADUAL;

// ─── Exercise alternatives (categorized swap options) ──────────────────────────
// Each key is an exercise name; the value is the full list of alternatives
// (including the exercise itself) that belong to the same muscle/metric category.

const EXERCISE_ALTERNATIVES: Record<string, DayExercise[]> = {
  /* ── קטגוריה: ריצה / סיבולת ───────────────────────────────────────────── */
  'ריצה קלה':       [
    { name: 'ריצה קלה',         detail: '20 דקות, 65% דופק מרבי'  },
    { name: 'הליכה מהירה',      detail: '30 דקות, 60% דופק מרבי'  },
    { name: 'רכיבה על אופניים', detail: '25 דקות, 65% דופק מרבי'  },
    { name: 'שחייה',            detail: '20 דקות סגנון חופשי'      },
  ],
  'ריצה מהירה':     [
    { name: 'ריצה מהירה',  detail: '6 × 100 מטר'     },
    { name: 'ריצת שאטל',   detail: '5 × 30 מטר'       },
    { name: 'ספרינטים',    detail: '8 × 50 מטר'       },
    { name: 'פרטלק',       detail: '15 דקות שינויי קצב' },
  ],
  /* ── קטגוריה: אינטרוול ────────────────────────────────────────────────── */
  'ריצת אינטרוול':  [
    { name: 'ריצת אינטרוול',    detail: '6 × 200 מטר, 85% דופק' },
    { name: 'ריצת שאטל',        detail: '8 × 30 מטר'            },
    { name: 'ספרינט קצר',       detail: '10 × 50 מטר'           },
    { name: 'פרטלק',            detail: '20 דקות שינויי קצב'    },
  ],
  'אינטרוול ריצה':  [
    { name: 'אינטרוול ריצה',    detail: '8 × 200 מטר'         },
    { name: 'ריצת שאטל',        detail: '6 × 40 מטר'          },
    { name: 'ספרינט קצר',       detail: '10 × 60 מטר'         },
    { name: 'אינטרוול אחרון',   detail: '4 × 100 מטר ספרינט'  },
  ],
  'אינטרוול אחרון': [
    { name: 'אינטרוול אחרון',   detail: '4 × 100 מטר ספרינט'  },
    { name: 'ריצת אינטרוול',    detail: '5 × 200 מטר'         },
    { name: 'ספרינטים',         detail: '8 × 50 מטר'          },
    { name: 'פרטלק',            detail: '15 דקות שינויי קצב'  },
  ],
  'ריצת שאטל':      [
    { name: 'ריצת שאטל',        detail: '5 × 30 מטר'      },
    { name: 'ריצת אינטרוול',    detail: '5 × 200 מטר'     },
    { name: 'ספרינטים',         detail: '6 × 60 מטר'      },
    { name: 'ריצה מהירה',       detail: '4 × 100 מטר'     },
  ],
  '5 ק"מ טמפו':     [
    { name: '5 ק"מ טמפו',       detail: '80% מהירות מרבית'  },
    { name: 'ריצה 2 ק"מ',       detail: 'מהירות נוחה'        },
    { name: 'ריצה קלה',         detail: '30 דקות, 65% דופק' },
    { name: 'אופניים',          detail: '25 דקות, 70% דופק' },
  ],
  'ריצה 2 ק"מ':     [
    { name: 'ריצה 2 ק"מ',       detail: 'מהירות מרבית אישית'  },
    { name: '5 ק"מ טמפו',       detail: '75% מהירות מרבית'    },
    { name: 'ריצת אינטרוול',    detail: '6 × 200 מטר'         },
    { name: 'פרטלק',            detail: '20 דקות שינויי קצב'  },
  ],
  'ריצת מדרגות':    [
    { name: 'ריצת מדרגות',      detail: '5 × 3 קומות'    },
    { name: 'ריצת שאטל',        detail: '6 × 30 מטר'      },
    { name: 'ספרינטים',         detail: '8 × 50 מטר'      },
    { name: 'בורפי',            detail: '4 × 10'           },
  ],
  /* ── קטגוריה: פלג גוף עליון ──────────────────────────────────────────── */
  'שכיבות סמיכה':   [
    { name: 'שכיבות סמיכה',          detail: '3 סטים × 10 חזרות' },
    { name: 'שכיבות סמיכה יהלום',    detail: '3 × 8 חזרות'       },
    { name: 'שכיבות סמיכה על ברכיים', detail: '3 × 15 חזרות'     },
    { name: 'החזקת פלאנק',           detail: '3 × 30 שניות'      },
  ],
  'שכיבות פיצוץ':   [
    { name: 'שכיבות פיצוץ',          detail: '4 × 8'        },
    { name: 'שכיבות סמיכה',          detail: '4 × 15'       },
    { name: 'שכיבות סמיכה יהלום',    detail: '4 × 10'       },
    { name: 'מתח מוסגר',             detail: '3 × 6 חזרות'  },
  ],
  'מתח מוסגר':      [
    { name: 'מתח מוסגר',             detail: '3 × 6 חזרות' },
    { name: 'שכיבות סמיכה',          detail: '4 × 12'      },
    { name: 'שכיבות סמיכה יהלום',    detail: '3 × 8'       },
    { name: 'שכיבות פיצוץ',          detail: '3 × 8'       },
  ],
  /* ── קטגוריה: ליבה / Core ────────────────────────────────────────────── */
  'פלאנק':           [
    { name: 'פלאנק',       detail: '3 × 20 שניות'  },
    { name: 'פלאנק צדדי',  detail: '3 × 20 שניות כל צד' },
    { name: 'כפיפות בטן', detail: '3 × 20'         },
    { name: 'הרמת רגליים', detail: '3 × 15'         },
  ],
  'כפיפות בטן':      [
    { name: 'כפיפות בטן', detail: '3 × 20'              },
    { name: 'פלאנק',       detail: '3 × 30 שניות'        },
    { name: 'פלאנק צדדי',  detail: '3 × 20 שניות כל צד'  },
    { name: 'הרמת רגליים', detail: '3 × 15'              },
  ],
  /* ── קטגוריה: פלג גוף תחתון ──────────────────────────────────────────── */
  'סקוואט':          [
    { name: 'סקוואט',       detail: '4 × 15 חזרות'   },
    { name: "לאנג'ס",       detail: '3 × 12 לכל רגל' },
    { name: 'קפיצות לגובה', detail: '3 × 10'          },
    { name: 'כריעות רומניות', detail: '4 × 12'        },
  ],
  'סקוואט קפיצה':    [
    { name: 'סקוואט קפיצה',   detail: '4 × 10'          },
    { name: 'סקוואט',          detail: '4 × 15'          },
    { name: 'קפיצות לגובה',    detail: '3 × 10'          },
    { name: "לאנגס קפיצה",     detail: '4 × 8 לכל רגל'  },
  ],
  "לאנג'ס":          [
    { name: "לאנג'ס",          detail: '3 × 12 לכל רגל' },
    { name: 'סקוואט',          detail: '4 × 15'          },
    { name: 'קפיצות לגובה',    detail: '3 × 10'          },
    { name: 'כריעות רומניות',  detail: '4 × 12'          },
  ],
  'לאנגס קפיצה':     [
    { name: 'לאנגס קפיצה',     detail: '4 × 10 לכל רגל' },
    { name: "לאנג'ס",          detail: '3 × 12 לכל רגל' },
    { name: 'סקוואט קפיצה',    detail: '4 × 10'          },
    { name: 'קפיצות לגובה',    detail: '3 × 12'          },
  ],
  'קפיצות לגובה':    [
    { name: 'קפיצות לגובה',    detail: '3 × 8'           },
    { name: 'סקוואט קפיצה',    detail: '3 × 10'          },
    { name: 'קפיצות כוח',      detail: '3 × 12'          },
    { name: 'לאנגס קפיצה',     detail: '3 × 8 לכל רגל'  },
  ],
  'קפיצות כוח':      [
    { name: 'קפיצות כוח',      detail: '2 סטים × 15'    },
    { name: 'קפיצות לגובה',    detail: '3 × 10'          },
    { name: 'סקוואט קפיצה',    detail: '3 × 10'          },
    { name: 'בורפי',            detail: '3 × 10'          },
  ],
  /* ── קטגוריה: HIIT / CrossFit ────────────────────────────────────────── */
  'בורפי':           [
    { name: 'בורפי',            detail: '3 × 12'        },
    { name: 'קפיצות קרוספיט',  detail: '3 × 10'        },
    { name: 'שכיבות פיצוץ',    detail: '3 × 8'         },
    { name: 'ריצת מדרגות',     detail: '4 × 3 קומות'   },
  ],
  'קפיצות קרוספיט':  [
    { name: 'קפיצות קרוספיט',  detail: '3 × 10'        },
    { name: 'בורפי',            detail: '3 × 10'        },
    { name: 'סקוואט קפיצה',    detail: '3 × 12'        },
    { name: 'שכיבות פיצוץ',    detail: '3 × 8'         },
  ],
  'בורפי + מתח':     [
    { name: 'בורפי + מתח',      detail: '3 × 8 משולב'   },
    { name: 'בורפי',            detail: '4 × 10'         },
    { name: 'מתח מוסגר',        detail: '4 × 6 חזרות'   },
    { name: 'שכיבות פיצוץ',     detail: '4 × 8'         },
  ],
  'תרגיל משולב':     [
    { name: 'תרגיל משולב',      detail: '3 סבבים × 5 תרגילים'  },
    { name: 'בורפי',            detail: '4 × 12'               },
    { name: 'מסלול מכשולים',    detail: '3 סבבים ← מדידת זמן'  },
    { name: 'קפיצות קרוספיט',   detail: '4 × 10'               },
  ],
  'מסלול מכשולים':   [
    { name: 'מסלול מכשולים',    detail: '3 סבבים ← מדידת זמן'  },
    { name: 'תרגיל משולב',      detail: '3 סבבים × 5 תרגילים'  },
    { name: 'בורפי',            detail: '4 × 12'               },
    { name: 'ריצת שאטל',        detail: '6 × 30 מטר'           },
  ],
};

// ─── AI Control Center Modal ───────────────────────────────────────────────────

interface AiControlCenterModalProps {
  open:                 boolean;
  onOpenChange:         (open: boolean) => void;
  students:             StudentData[];
  activePlanDetailsMap: Map<string, ActivePlanDetails>;
  lockedStudents:       StudentData[];
  eligibleStudents:     StudentData[];
  studentGradesMap:     Map<string, number>;
}

type GenerateState = 'idle' | 'generating' | 'preview' | 'sending' | 'sent';

function AiControlCenterModal({
  open,
  onOpenChange,
  students,
  activePlanDetailsMap,
  lockedStudents,
  eligibleStudents,
  studentGradesMap,
}: AiControlCenterModalProps): React.JSX.Element {
  const [activeTab, setActiveTab]             = useState<'active' | 'generate'>('active');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [generateState, setGenerateState]     = useState<GenerateState>('idle');
  const [currentPlan, setCurrentPlan]         = useState<WeekPlan[]>(MOCK_PLAN);
  const [expandedWeek, setExpandedWeek]       = useState<number | null>(null);
  // Tab A: drill-down
  const [selectedPlanStudentId, setSelectedPlanStudentId] = useState<string | null>(null);
  // Tab B: multi-track + manual edit
  const [selectedTrack, setSelectedTrack]     = useState<0 | 1>(0); // 0=gradual, 1=intensive
  const [isEditMode, setIsEditMode]           = useState(false);
  const [editablePlan, setEditablePlan]       = useState<WeekPlan[]>(MOCK_PLAN);
  // Key format: "${weekIdx}-${exIdx}" — which exercise row has its carousel open
  const [carouselKey, setCarouselKey]         = useState<string | null>(null);
  // Inline save feedback: 'idle' | 'saving' | 'saved'
  const [saveState, setSaveState]             = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (open) {
      setActiveTab('active');
      setTargetStudentId('');
      setGenerateState('idle');
      setExpandedWeek(null);
      setSelectedPlanStudentId(null);
      setSelectedTrack(0);
      setIsEditMode(false);
      setEditablePlan(MOCK_PLAN);
      setCarouselKey(null);
      setSaveState('idle');
    }
  }, [open]);

  // Real-time workout progress received from students via localStorage → storage event
  const [liveProgressMap, setLiveProgressMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Seed initial values from localStorage for all students with active plans
    const initial = new Map<string, number>();
    for (const student of lockedStudents) {
      const raw = localStorage.getItem(`fitgrade-progress-${student.id}`);
      if (raw !== null) {
        const pct = Number(raw);
        if (!isNaN(pct)) initial.set(student.id, pct);
      }
    }
    if (initial.size > 0) setLiveProgressMap(initial);

    function handleStorage(e: StorageEvent): void {
      if (!e.key?.startsWith('fitgrade-progress-')) return;
      const studentId = e.key.slice('fitgrade-progress-'.length);
      const pct = e.newValue !== null ? Number(e.newValue) : null;
      if (pct === null || isNaN(pct)) return;
      setLiveProgressMap((prev) => new Map(prev).set(studentId, pct));
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [lockedStudents]);

  const targetStudent       = students.find((s) => s.id === targetStudentId) ?? null;
  const targetHasActivePlan = activePlanDetailsMap.has(targetStudentId);
  const hasPendingChanges   = JSON.stringify(editablePlan) !== JSON.stringify(currentPlan);

  // Overlay: derive once, outside JSX — eliminates the IIFE pattern that confused AnimatePresence
  const overlayStudent = selectedPlanStudentId !== null
    ? (lockedStudents.find((s) => s.id === selectedPlanStudentId) ?? null)
    : null;
  const overlayDetails = selectedPlanStudentId !== null
    ? (activePlanDetailsMap.get(selectedPlanStudentId) ?? null)
    : null;
  const showOverlay = selectedPlanStudentId !== null && overlayStudent !== null && overlayDetails !== null;

  function applyTrack(track: 0 | 1): WeekPlan[] {
    return track === 0 ? MOCK_PLAN_GRADUAL : MOCK_PLAN_INTENSIVE;
  }

  async function handleGenerate(): Promise<void> {
    if (!targetStudentId || targetHasActivePlan) return;
    setGenerateState('generating');
    setIsEditMode(false);
    await new Promise<void>((r) => setTimeout(r, 1600));
    const plan = applyTrack(selectedTrack);
    setCurrentPlan(plan);
    setEditablePlan(plan);
    setExpandedWeek(1);
    setGenerateState('preview');
  }

  async function handleRegenerate(): Promise<void> {
    setGenerateState('generating');
    setIsEditMode(false);
    await new Promise<void>((r) => setTimeout(r, 1200));
    // Switch to the other track on regenerate (mock behaviour)
    const nextTrack: 0 | 1 = selectedTrack === 0 ? 1 : 0;
    setSelectedTrack(nextTrack);
    const plan = applyTrack(nextTrack);
    setCurrentPlan(plan);
    setEditablePlan(plan);
    setExpandedWeek(null);
    setGenerateState('preview');
  }

  function handleTrackSwitch(track: 0 | 1): void {
    if (track === selectedTrack) return;
    setSelectedTrack(track);
    const plan = applyTrack(track);
    setCurrentPlan(plan);
    setEditablePlan(plan);
    setIsEditMode(false);
    setCarouselKey(null);
    setSaveState('idle');
    setExpandedWeek(null);
  }

  function handleSwapExercise(weekIdx: number, exIdx: number, option: DayExercise): void {
    setEditablePlan((prev) =>
      prev.map((w, wi) =>
        wi !== weekIdx
          ? w
          : { ...w, exercises: w.exercises.map((ex, ei) => (ei === exIdx ? option : ex)) },
      ),
    );
    setSaveState('idle');
    // Carousel stays open so teacher can see the selected card highlighted
  }

  async function handleSavePlan(): Promise<void> {
    setSaveState('saving');
    // Mock: persist editablePlan as the current plan
    await new Promise<void>((r) => setTimeout(r, 900));
    setCurrentPlan(editablePlan);
    setSaveState('saved');
    // Broadcast updated plan to the specific student's portal via localStorage
    if (targetStudentId) {
      try {
        const payload = { plan: editablePlan, savedAt: Date.now() };
        localStorage.setItem(`fitgrade-workout-plan-${targetStudentId}`, JSON.stringify(payload));
      } catch { /* storage quota exceeded — non-critical */ }
    }
    setTimeout(() => { setSaveState('idle'); }, 2500);
  }

  async function handleApproveDispatch(): Promise<void> {
    setGenerateState('sending');
    await new Promise<void>((r) => setTimeout(r, 1500));
    setGenerateState('sent');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] z-[9999] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-3xl border-0 bg-white/85 p-0 shadow-2xl shadow-slate-900/25 backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Dark-glass header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-slate-800 via-slate-700 to-indigo-900 px-7 py-6">
          <div className="pointer-events-none absolute -end-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -start-8 -bottom-8 h-28 w-28 rounded-full bg-indigo-500/10" />
          <DialogHeader>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-[0_0_20px_rgba(255,255,255,0.10)]">
                <Settings2 className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold text-white">
                  מרכז בקרה AI
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-white/65">
                  ניהול, מעקב ויצירת תוכניות אימון מותאמות אישית
                </DialogDescription>
              </div>
            </div>

            {/* Tab pills */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                  activeTab === 'active'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Activity className="h-4 w-4" aria-hidden="true" />
                מעקב תוכניות פעילות
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                  activeTab === 'generate'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Brain className="h-4 w-4" aria-hidden="true" />
                יצירה ושילוח
              </button>
            </div>
          </DialogHeader>
        </div>

        {/* ── Scrollable content ────────────────────────────────────── */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* ══ Tab A: Active Protocols ══════════════════════════════ */}
            {activeTab === 'active' ? (
              <motion.div
                key="active-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ ease: EASE, duration: 0.28 }}
                className="space-y-5"
              >
                {/* ── Bento grid of active plans ─────────────────────── */}
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    תוכניות בפעילות ({lockedStudents.length})
                  </p>
                  {lockedStudents.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <CheckCircle2 className="h-6 w-6 text-slate-300" aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium text-slate-400">אין תוכניות פעילות כרגע</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {lockedStudents.map((student, i) => {
                        const details  = activePlanDetailsMap.get(student.id);
                        if (!details) return null;
                        // Live progress from student's workout session overrides the static value
                        const liveProgress = liveProgressMap.get(student.id) ?? details.progress;
                        const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;
                        const tint     = AVATAR_TINTS[i % AVATAR_TINTS.length]!;
                        return (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ease: EASE, duration: 0.4, delay: i * 0.1 }}
                            className="prismatic-glass rounded-2xl p-4"
                          >
                            {/* Student header */}
                            <div className="mb-3 flex items-center gap-3">
                              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold', tint)}>
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="text-xs font-medium text-indigo-600">{details.target}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                שבוע {details.weekNum}/4
                              </span>
                            </div>

                            {/* Glowing progress bar — updates live as student completes exercises */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-500">התקדמות</span>
                                <span className="font-bold text-indigo-700">{liveProgress}%</span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-indigo-100">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                  style={{ boxShadow: '0 0 8px rgba(99,102,241,0.55)' }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${liveProgress}%` }}
                                  transition={{ ease: EASE, duration: 0.5 }}
                                />
                              </div>
                            </div>

                            {/* Dates + weeks remaining */}
                            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                              <span>התחלה: {details.startDate.toLocaleDateString('he-IL')}</span>
                              <span className="flex items-center gap-1">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                עוד {weeksUntil(details.endDate)} שבועות
                              </span>
                            </div>

                            {/* Open plan overlay */}
                            <button
                              type="button"
                              onClick={() => setSelectedPlanStudentId(student.id)}
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white/60 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-50"
                            >
                              <Target className="h-3 w-3" aria-hidden="true" />
                              👁️ צפה בפירוט התוכנית
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Waiting-for-plan section ───────────────────────── */}
                {eligibleStudents.length > 0 && (
                  <div>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                      ממתינים לתוכנית ({eligibleStudents.length})
                    </p>
                    <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/50">
                      {eligibleStudents.map((student, i) => {
                        const score = studentGradesMap.get(student.id) ?? 0;
                        return (
                          <div
                            key={student.id}
                            className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-emerald-100')}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                            <p className="flex-1 text-sm font-semibold text-slate-700">
                              {student.firstName} {student.lastName}
                            </p>
                            <span className="text-sm font-bold tabular-nums text-orange-500">
                              {score > 0 ? score : '—'}
                            </span>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setActiveTab('generate');
                                setTargetStudentId(student.id);
                                setGenerateState('idle');
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-200"
                            >
                              <Brain className="h-3 w-3" aria-hidden="true" />
                              צור תוכנית
                            </motion.button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {eligibleStudents.length === 0 && lockedStudents.length > 0 && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-xs font-medium text-emerald-700">
                    כל התלמידים מתחת לנורמה כבר בתוכנית פעילה 🎉
                  </div>
                )}
              </motion.div>

            ) : (
              /* ══ Tab B: Plan Generation & Dispatch ══════════════════ */
              <motion.div
                key="generate-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ ease: EASE, duration: 0.28 }}
                className="space-y-5"
              >
                {/* Student picker (hidden when sent) */}
                {generateState !== 'sent' && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      בחר תלמיד לבניית תוכנית
                    </p>
                    <select
                      value={targetStudentId}
                      onChange={(e) => {
                        setTargetStudentId(e.target.value);
                        setGenerateState('idle');
                      }}
                      disabled={generateState === 'generating' || generateState === 'sending'}
                      className={cn(SELECT_STYLES)}
                      aria-label="בחר תלמיד לבניית תוכנית"
                    >
                      <option value="">— בחר תלמיד —</option>
                      {eligibleStudents.length > 0 && (
                        <optgroup label="ממתינים לתוכנית">
                          {eligibleStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName} (ציון: {studentGradesMap.get(s.id) ?? '—'})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="כל התלמידים">
                        {students
                          .filter((s) => !eligibleStudents.some((e) => e.id === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                              {activePlanDetailsMap.has(s.id) ? ' ⏳' : ''}
                            </option>
                          ))}
                      </optgroup>
                    </select>

                    {/* Active-plan warning */}
                    {targetHasActivePlan && targetStudentId && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                      >
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          לתלמיד יש תוכנית פעילה — ניתן לבנות תוכנית חדשה בעוד{' '}
                          {weeksUntil(activePlanDetailsMap.get(targetStudentId)!.endDate)} שבועות
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ── Generate button ───────────────────────────────── */}
                {generateState === 'idle' && (
                  <motion.button
                    type="button"
                    onClick={() => { void handleGenerate(); }}
                    disabled={!targetStudentId || targetHasActivePlan}
                    whileHover={
                      targetStudentId && !targetHasActivePlan
                        ? { scale: 1.02, boxShadow: '0 12px 36px rgba(139,92,246,0.45)', transition: { type: 'spring', stiffness: 400, damping: 22 } }
                        : {}
                    }
                    whileTap={targetStudentId && !targetHasActivePlan ? { scale: 0.97 } : {}}
                    className={cn(
                      'relative flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-sm font-extrabold text-white transition-all',
                      targetStudentId && !targetHasActivePlan
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_20px_rgba(139,92,246,0.35)]'
                        : 'cursor-not-allowed bg-slate-200 text-slate-400',
                    )}
                  >
                    {targetStudentId && !targetHasActivePlan && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                      />
                    )}
                    <Brain className="relative z-10 h-4 w-4" aria-hidden="true" />
                    <span className="relative z-10">
                      {targetStudentId && !targetHasActivePlan
                        ? `בנה תוכנית 4 שבועות עבור ${targetStudent?.firstName ?? ''}`
                        : targetStudentId
                        ? 'תלמיד זה בתוכנית פעילה'
                        : 'בחר תלמיד תחילה'}
                    </span>
                  </motion.button>
                )}

                {/* ── Generating spinner ───────────────────────────── */}
                {generateState === 'generating' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3 py-10 text-center"
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
                      <Loader2 className="h-7 w-7 animate-spin text-violet-600" aria-hidden="true" />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-violet-300"
                        animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">ה-AI בונה תוכנית אישית...</p>
                      <p className="mt-0.5 text-xs text-slate-500">מנתח פרופיל כושר, גיל ותוצאות</p>
                    </div>
                  </motion.div>
                )}

                {/* ── Plan preview (Review & Approve) ─────────────── */}
                {generateState === 'preview' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ease: EASE, duration: 0.35 }}
                    className="space-y-4"
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
                        <Brain className="h-4 w-4 text-violet-600" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          תוכנית 4 שבועות עבור {targetStudent?.firstName} {targetStudent?.lastName}
                        </p>
                        <p className="text-xs text-slate-500">בדוק ואשר לפני השליחה לפורטל התלמיד</p>
                      </div>
                    </div>

                    {/* Track selector */}
                    <div className="flex gap-2">
                      {([
                        { idx: 0 as const, label: 'מסלול הדרגתי 🌱', desc: 'עומס נמוך-בינוני' },
                        { idx: 1 as const, label: 'מסלול אינטנסיבי ⚡', desc: 'עצימות גבוהה' },
                      ] satisfies { idx: 0 | 1; label: string; desc: string }[]).map(({ idx, label, desc }) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleTrackSwitch(idx)}
                          className={cn(
                            'flex flex-1 flex-col items-center rounded-xl border px-3 py-2 text-xs font-bold transition-all',
                            selectedTrack === idx
                              ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-300'
                              : 'border-slate-200 bg-white/60 text-slate-500 hover:border-slate-300 hover:bg-white',
                          )}
                        >
                          <span>{label}</span>
                          <span className={cn('mt-0.5 text-[10px] font-medium', selectedTrack === idx ? 'text-violet-500' : 'text-slate-400')}>
                            {desc}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Edit toggle */}
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditMode((v) => !v)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                          isEditMode
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                        )}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        {isEditMode ? '✅ סיים החלפה' : '🔄 החלף תרגילים'}
                      </button>
                    </div>

                    {/* Week accordion */}
                    <div className="space-y-2">
                      {editablePlan.map((week, wi) => (
                        <motion.div
                          key={`${selectedTrack}-${week.week}`}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ease: EASE, duration: 0.3, delay: wi * 0.07 }}
                          className={cn(
                            'overflow-hidden rounded-2xl border shadow-sm',
                            isEditMode
                              ? 'border-amber-200/80 bg-amber-50/40'
                              : 'border-slate-200/80 bg-white/70',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-slate-50/80"
                          >
                            <span className="text-xl">{week.emoji}</span>
                            <div className="flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                שבוע {week.week}
                              </p>
                              <p className="text-sm font-bold text-slate-800">{week.focus}</p>
                            </div>
                            {isEditMode && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                עריכה
                              </span>
                            )}
                            <motion.div
                              animate={{ rotate: expandedWeek === week.week ? 180 : 0 }}
                              transition={{ ease: EASE, duration: 0.22 }}
                            >
                              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            </motion.div>
                          </button>
                          <AnimatePresence>
                            {expandedWeek === week.week && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ ease: EASE, duration: 0.28 }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-1.5 border-t border-slate-100 px-4 py-3">
                                  {week.exercises.map((ex, ei) => {
                                    const key          = `${wi}-${ei}`;
                                    const alternatives = EXERCISE_ALTERNATIVES[ex.name] ?? [ex];
                                    const isOpen       = carouselKey === key;
                                    return (
                                      <div key={key}>
                                        {/* Exercise trigger row */}
                                        <button
                                          type="button"
                                          onClick={() => setCarouselKey(isOpen ? null : key)}
                                          className={cn(
                                            'group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start transition-colors',
                                            isOpen
                                              ? 'bg-violet-50/80'
                                              : 'hover:bg-slate-50/80',
                                          )}
                                          aria-expanded={isOpen}
                                          title="לחץ לבחירת תרגיל חלופי"
                                        >
                                          <span className={cn(
                                            'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                                            isOpen ? 'bg-violet-500' : 'bg-violet-300',
                                          )} />
                                          <span className={cn(
                                            'flex-1 text-sm font-semibold transition-colors',
                                            isOpen ? 'text-violet-700' : 'text-slate-700 group-hover:text-violet-600',
                                          )}>
                                            {ex.name}
                                          </span>
                                          <span className="shrink-0 text-xs text-slate-400">{ex.detail}</span>
                                          <span className={cn(
                                            'shrink-0 text-[10px] transition-opacity',
                                            isOpen ? 'opacity-100 text-violet-400' : 'opacity-0 group-hover:opacity-60 text-slate-300',
                                          )}>
                                            {isOpen ? '▲' : '✏️'}
                                          </span>
                                        </button>

                                        {/* Inline carousel */}
                                        <AnimatePresence>
                                          {isOpen && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ ease: EASE, duration: 0.22 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="flex gap-2 overflow-x-auto pb-2.5 pt-2 ps-2" style={{ scrollbarWidth: 'none' }}>
                                                {alternatives.map((opt) => {
                                                  const isSelected = opt.name === ex.name;
                                                  return (
                                                    <motion.button
                                                      key={opt.name}
                                                      type="button"
                                                      onClick={() => handleSwapExercise(wi, ei, opt)}
                                                      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                                                      whileTap={{ scale: 0.96 }}
                                                      className={cn(
                                                        'shrink-0 rounded-xl border px-3 py-2 text-start backdrop-blur-md transition-all',
                                                        isSelected
                                                          ? 'border-violet-400 bg-violet-50/90 text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] ring-1 ring-violet-300'
                                                          : 'border-violet-100 bg-white/90 text-slate-700 hover:border-violet-300 hover:bg-violet-50/60',
                                                      )}
                                                      aria-pressed={isSelected}
                                                    >
                                                      <p className="text-xs font-bold leading-tight">{opt.name}</p>
                                                      <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">{opt.detail}</p>
                                                      {isSelected && (
                                                        <p className="mt-1 text-[9px] font-extrabold uppercase tracking-wide text-violet-500">✓ נבחר</p>
                                                      )}
                                                    </motion.button>
                                                  );
                                                })}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>

                    {/* Save pending changes button */}
                    <AnimatePresence>
                      {(hasPendingChanges || saveState !== 'idle') && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ ease: EASE, duration: 0.22 }}
                        >
                          <motion.button
                            type="button"
                            onClick={() => { void handleSavePlan(); }}
                            disabled={saveState !== 'idle'}
                            whileHover={saveState === 'idle' ? { scale: 1.02 } : {}}
                            whileTap={saveState === 'idle' ? { scale: 0.97 } : {}}
                            className={cn(
                              'relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-sm font-extrabold transition-all',
                              saveState === 'saved'
                                ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.4)]'
                                : saveState === 'saving'
                                ? 'bg-gradient-to-br from-violet-400 to-indigo-500 text-white opacity-80'
                                : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)]',
                            )}
                          >
                            {saveState !== 'saving' && (
                              <motion.div
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
                              />
                            )}
                            {saveState === 'saving' ? (
                              <Loader2 className="relative z-10 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : saveState === 'saved' ? (
                              <CheckCircle2 className="relative z-10 h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Pencil className="relative z-10 h-4 w-4" aria-hidden="true" />
                            )}
                            <span className="relative z-10">
                              {saveState === 'saving'
                                ? 'שומר שינויים...'
                                : saveState === 'saved'
                                ? '✅ התוכנית עודכנה בהצלחה!'
                                : 'שמור ועדכן תוכנית'}
                            </span>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      {/* Regenerate */}
                      <motion.button
                        type="button"
                        onClick={() => { void handleRegenerate(); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        <RefreshCw className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        רענן תוכנית
                      </motion.button>

                      {/* Approve & Dispatch */}
                      <motion.button
                        type="button"
                        onClick={() => { void handleApproveDispatch(); }}
                        whileHover={{ scale: 1.03, boxShadow: '0 10px 30px rgba(16,185,129,0.45)', transition: { type: 'spring', stiffness: 400, damping: 22 } }}
                        whileTap={{ scale: 0.97 }}
                        className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
                      >
                        <motion.div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                        />
                        <CheckCircle2 className="relative z-10 h-4 w-4" aria-hidden="true" />
                        <span className="relative z-10">✅ אשר ושגר לפורטל התלמיד</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* ── Sending spinner ──────────────────────────────── */}
                {generateState === 'sending' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3 py-10 text-center"
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">שולח לפורטל התלמיד...</p>
                  </motion.div>
                )}

                {/* ── Success state ────────────────────────────────── */}
                {generateState === 'sent' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ease: EASE, duration: 0.4 }}
                    className="flex flex-col items-center gap-4 py-10 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">התוכנית שוגרה! ✅</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {targetStudent?.firstName} יוכל לעקוב אחרי התוכנית בפרופיל האישי שלו
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => { setGenerateState('idle'); setTargetStudentId(''); }}
                    >
                      בנה תוכנית לתלמיד נוסף
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ── Plan detail overlay — portal to document.body to escape parent stacking context ── */}
        {showOverlay && overlayStudent !== null && overlayDetails !== null && createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              padding: '1rem',
            }}
            onClick={() => setSelectedPlanStudentId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedPlanStudentId(null)}
                className="absolute top-4 end-4 z-10 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"
                aria-label="סגור"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 p-5 pb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                  <Brain className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    תוכנית {overlayStudent.firstName} {overlayStudent.lastName}
                  </p>
                  <p className="text-xs font-medium text-indigo-600">{overlayDetails.target}</p>
                </div>
              </div>

              {/* ── Performance progress chart ─────────────────────── */}
              {(() => {
                const CHART_DATA = [
                  { week: 'שבוע 1', score: 65 },
                  { week: 'שבוע 2', score: 72 },
                  { week: 'שבוע 3', score: 85 },
                  { week: 'שבוע 4', score: 92 },
                ];
                return (
                  <div className="mx-5 mb-2 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={CHART_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="week"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#a78bfa', fontWeight: 600 }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(23,15,55,0.75)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(139,92,246,0.30)',
                            borderRadius: '0.75rem',
                            boxShadow: '0 10px 40px -10px rgba(76,29,149,0.35)',
                            padding: '8px 14px',
                          }}
                          labelStyle={{ color: '#c4b5fd', fontSize: 11, fontWeight: 700 }}
                          itemStyle={{ color: '#ede9fe', fontSize: 12, fontWeight: 600 }}
                          formatter={(v: number) => [`${v}`, 'ציון']}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#8b5cf6"
                          strokeWidth={2.5}
                          fill="url(#planGrad)"
                          dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: '#c4b5fd', strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* 4-week breakdown — scrollable */}
              <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                {MOCK_PLAN_GRADUAL.map((week) => (
                  <div key={week.week} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-indigo-700">
                      <span className="text-base">{week.emoji}</span>
                      שבוע {week.week} — {week.focus}
                      {week.week === overlayDetails.weekNum && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white">
                          עכשיו
                        </span>
                      )}
                    </p>
                    <div className="space-y-1.5 ps-4">
                      {week.exercises.map((ex) => (
                        <div key={ex.name} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
                          <span className="text-xs font-semibold text-slate-700">{ex.name}</span>
                          <span className="ms-auto text-[11px] text-slate-400">{ex.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        , document.body)}
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Dispatch Modal ────────────────────────────────────────────────────────

interface AiDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleStudents: StudentData[];
  lockedStudents: StudentData[];
  activePlanMap: Map<string, Date>;
  studentGradesMap: Map<string, number>;
}

function AiDispatchModal({
  open,
  onOpenChange,
  eligibleStudents,
  lockedStudents,
  activePlanMap,
  studentGradesMap,
}: AiDispatchModalProps): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(eligibleStudents.map((s) => s.id)),
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  // Reset whenever the modal opens fresh
  useEffect(() => {
    if (open) {
      setSelected(new Set(eligibleStudents.map((s) => s.id)));
      setSent(false);
      setSending(false);
    }
  }, [open, eligibleStudents]);

  function toggleStudent(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend(): Promise<void> {
    if (selected.size === 0) return;
    setSending(true);
    await new Promise<void>((r) => setTimeout(r, 1800));
    setSending(false);
    setSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-0 bg-white/80 p-0 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl">

        {/* Gradient header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 px-7 py-6">
          <div className="pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full bg-white/8" />
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Brain className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-white">
                  שליחת תוכנית אימון AI
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-white/70">
                  תוכנית כושר מותאמת אישית לתלמידים מתחת לנורמה
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6">
          {/* ── Success state ────────────────────────────────────────── */}
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: EASE, duration: 0.45 }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Sparkles className="h-8 w-8 text-emerald-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-900">התוכנית נשלחה בהצלחה! 🎉</p>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.size} תלמידים יקבלו תוכנית אימון ל-4 שבועות בפרופיל האישי שלהם
                </p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                סגור
              </Button>
            </motion.div>
          ) : (
            <>
              {/* ── Section 1: Eligible ─────────────────────────────── */}
              {eligibleStudents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                    זכאים לתוכנית חדשה ({eligibleStudents.length})
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/60">
                    {eligibleStudents.map((student, i) => {
                      const isSelected = selected.has(student.id);
                      const score      = studentGradesMap.get(student.id) ?? 0;
                      return (
                        <motion.button
                          key={student.id}
                          type="button"
                          onClick={() => toggleStudent(student.id)}
                          whileHover={{ x: -3 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-3 text-start transition-colors',
                            i > 0 && 'border-t border-emerald-100',
                            isSelected ? 'bg-emerald-100/60' : 'hover:bg-emerald-50',
                          )}
                        >
                          {/* Animated checkbox */}
                          <motion.div
                            animate={{ scale: isSelected ? [1, 1.25, 1] : 1 }}
                            transition={{ duration: 0.25 }}
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-slate-300 bg-white',
                            )}
                          >
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </motion.div>

                          <p className="flex-1 text-sm font-semibold text-slate-800">
                            {student.firstName} {student.lastName}
                          </p>
                          <span className={cn(
                            'text-sm font-extrabold tabular-nums',
                            score < 60 ? 'text-rose-500' : 'text-orange-500',
                          )}>
                            {score > 0 ? score : '—'}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Section 2: Locked / In active plan ──────────────── */}
              {lockedStudents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    במהלך תוכנית אימון ⏳ ({lockedStudents.length})
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                    {lockedStudents.map((student, i) => {
                      const planEnd = activePlanMap.get(student.id);
                      const weeks   = planEnd ? weeksUntil(planEnd) : 1;
                      return (
                        <div
                          key={student.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 opacity-55',
                            i > 0 && 'border-t border-slate-100',
                          )}
                        >
                          <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-600">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-xs text-slate-400">
                              מטופל — מסיים תוכנית בעוד {weeks} שבועות
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty eligible */}
              {eligibleStudents.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Lock className="h-8 w-8 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-500">
                    כל התלמידים המתחת לנורמה כבר בתוכנית פעילה
                  </p>
                </div>
              )}

              {/* ── Send button ──────────────────────────────────────── */}
              {eligibleStudents.length > 0 && (
                <motion.button
                  type="button"
                  onClick={() => { void handleSend(); }}
                  disabled={sending || selected.size === 0}
                  whileHover={
                    !sending && selected.size > 0
                      ? { scale: 1.02, boxShadow: '0 12px 40px rgba(139,92,246,0.50)', transition: { type: 'spring', stiffness: 400, damping: 22 } }
                      : {}
                  }
                  whileTap={!sending ? { scale: 0.97 } : {}}
                  className={cn(
                    'relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-extrabold text-white transition-opacity',
                    sending || selected.size === 0
                      ? 'cursor-not-allowed bg-slate-300'
                      : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_4px_24px_rgba(139,92,246,0.40)]',
                  )}
                >
                  {/* Shimmer sweep */}
                  {!sending && selected.size > 0 && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                    />
                  )}
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="relative z-10">
                    {sending
                      ? 'שולח תוכנית...'
                      : selected.size === 0
                      ? 'בחר תלמידים'
                      : `שלח תוכנית ל-${selected.size} תלמידים`}
                  </span>
                </motion.button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassDetailPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [isAddStudentOpen, setIsAddStudentOpen]               = useState(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen]         = useState(false);
  const [isAiDispatchOpen, setIsAiDispatchOpen]               = useState(false);
  const [isAiControlCenterOpen, setIsAiControlCenterOpen]     = useState(false);
  const [selectedTestId, setSelectedTestId]             = useState<string | null>(null);
  const [copied, setCopied]                             = useState(false);

  // Today's attendance state
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [absentLoadingIds, setAbsentLoadingIds] = useState<Set<string>>(new Set());
  const [exemptDialogStudentId, setExemptDialogStudentId]   = useState<string | null>(null);
  const [absenceDialogStudentId, setAbsenceDialogStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const { activeSemester } = useSemester();
  const { data: cls,          error: classError,    isLoading: classLoading    } = useClass(classId);
  const { data: students,     error: studentsError, isLoading: studentsLoading, mutate: mutateStudents } = useStudents(classId);
  const { data: details,      isLoading: detailsLoading } = useClassDetails(classId, activeSemester);
  const { data: availability }                            = useComparisonAvailability(classId);
  const { data: testTypes } = useTestTypes();

  // Fetch today's attendance to drive absent/exempt button states
  const { data: todayAttendance, mutate: mutateAttendance } = useSWR<AttendanceRecord[]>(
    `/classes/${classId}/attendance?date=${today}`,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  const todayAttendanceMap = useMemo(
    () => new Map((todayAttendance ?? []).map((r) => [r.studentId, r])),
    [todayAttendance],
  );

  // Stable derived values — memoised so attendance toggles don't re-run these
  const testSummaries = useMemo(
    () => details?.testSummaries ?? [],
    [details],
  );

  // Initialise selectedTestId to the first test type once details load
  useEffect(() => {
    if (selectedTestId === null && testSummaries[0]) {
      setSelectedTestId(testSummaries[0].testTypeId);
    }
  }, [testSummaries, selectedTestId]);

  const selectedSummary = useMemo(
    () => testSummaries.find((s) => s.testTypeId === selectedTestId),
    [testSummaries, selectedTestId],
  );

  const selectedInputType = useMemo(
    () => testTypes?.find((t) => t.id === selectedSummary?.testTypeId)?.inputType ?? 'GENERAL',
    [testTypes, selectedSummary?.testTypeId],
  );

  const studentGradesMap = useMemo(
    () => new Map<string, number>(
      (selectedSummary?.studentGrades ?? []).map((sg) => [sg.studentId, sg.effectiveGrade]),
    ),
    [selectedSummary],
  );

  const studentRawMap = useMemo(
    () => new Map<string, number | null>(
      (selectedSummary?.studentGrades ?? []).map((sg) => [sg.studentId, sg.rawValue]),
    ),
    [selectedSummary],
  );

  const ranked = useMemo<PodiumEntry[]>(
    () => (students ?? [])
      .map((s) => ({
        student:   s,
        score:     studentGradesMap.get(s.id) ?? 0,
        rawValue:  studentRawMap.get(s.id) ?? null,
        unit:      selectedSummary?.unit ?? null,
        inputType: selectedInputType,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        if (a.rawValue === null && b.rawValue === null) return 0;
        if (a.rawValue === null) return 1;
        if (b.rawValue === null) return -1;
        return selectedInputType === 'TIME'
          ? a.rawValue - b.rawValue
          : b.rawValue - a.rawValue;
      })
      .slice(0, 3)
      .map((entry, pos) => ({ ...entry, rank: (pos + 1) as 1 | 2 | 3 })),
    [students, studentGradesMap, studentRawMap, selectedSummary?.unit, selectedInputType],
  );

  const chartData = useMemo(
    () => (selectedSummary?.progressData ?? []).map((p) => ({
      month: p.month,
      avg:   p.classAvg,
      norm:  NATIONAL_NORM,
    })),
    [selectedSummary],
  );

  const distributionTotal = useMemo(
    () =>
      (selectedSummary?.distribution.excellent ?? 0) +
      (selectedSummary?.distribution.good      ?? 0) +
      (selectedSummary?.distribution.pass      ?? 0) +
      (selectedSummary?.distribution.fail      ?? 0),
    [selectedSummary],
  );

  /** Students filtered by the search bar — case-insensitive, Hebrew-aware. */
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q || !students) return students ?? [];
    return students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  /** All students whose cross-test score is below the norm threshold. */
  const failingStudents = useMemo(
    () => (students ?? []).filter((s) => {
      const score = studentGradesMap.get(s.id) ?? 0;
      return score > 0 && score < 70;
    }),
    [students, studentGradesMap],
  );

  /**
   * Deterministic mock: the first 2 failing students already have an active
   * 4-week plan that started 2 weeks ago and ends in ~2 weeks.
   * In production this would come from the API.
   */
  const activePlanDetailsMap = useMemo<Map<string, ActivePlanDetails>>(() => {
    const map = new Map<string, ActivePlanDetails>();
    failingStudents.slice(0, 2).forEach((s, i) => {
      const endDate   = new Date();
      endDate.setDate(endDate.getDate() + 14);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      map.set(s.id, {
        endDate,
        startDate,
        progress: 50,   // 14 of 28 days elapsed
        weekNum:  2,    // halfway through week 2
        target:   PLAN_TARGETS[i % PLAN_TARGETS.length]!,
      });
    });
    return map;
  }, [failingStudents]);

  const activePlanMap = useMemo<Map<string, Date>>(() => {
    const map = new Map<string, Date>();
    for (const [id, details] of activePlanDetailsMap) {
      map.set(id, details.endDate);
    }
    return map;
  }, [activePlanDetailsMap]);

  const lockedStudents   = useMemo(() => failingStudents.filter((s) =>  activePlanMap.has(s.id)), [failingStudents, activePlanMap]);
  const eligibleStudents = useMemo(() => failingStudents.filter((s) => !activePlanMap.has(s.id)), [failingStudents, activePlanMap]);

  async function copyJoinCode(): Promise<void> {
    if (!cls) return;
    await navigator.clipboard.writeText(cls.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleToggleAbsent(studentId: string): Promise<void> {
    const current  = todayAttendanceMap.get(studentId);
    const isAbsent = current?.status === 'ABSENT';

    // Not absent → open dialog to record absence with optional date + reason
    if (!isAbsent) {
      setAbsenceDialogStudentId(studentId);
      return;
    }

    // Already absent → remove absence directly (no dialog needed)
    if (absentLoadingIds.has(studentId)) return;
    setAbsentLoadingIds((prev) => new Set([...prev, studentId]));
    try {
      await apiRequest(`/classes/${classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify({ date: today, records: [{ studentId, status: 'PRESENT' }] }),
      });
      await mutateAttendance();
    } catch {
      // noop
    } finally {
      setAbsentLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }

  function openExemptDialog(studentId: string): void {
    setExemptDialogStudentId(studentId);
  }

  if (classLoading || detailsLoading) return <ClassDetailSkeleton />;

  if (classError || !cls) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 max-w-lg">
        לא ניתן לטעון את פרטי הכיתה — נסה לרענן את הדף.
      </div>
    );
  }

  const attendancePct = details?.attendancePct ?? 0;

  const selectedTestIndex = testSummaries.findIndex((s) => s.testTypeId === selectedSummary?.testTypeId);
  const selectedVisual    = getTabVisual(selectedTestIndex >= 0 ? selectedTestIndex : 0);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="class-detail"
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        className="space-y-6"
        style={{ perspective: 1200 }}
      >
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <motion.nav variants={ITEM} aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm">
          <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            הכיתות שלי
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
          <span className="font-semibold text-slate-700">{formatClassWithGender(cls.name, cls.genderType)}</span>
        </motion.nav>

        {/* ── Semester mismatch warning ───────────────────────────────── */}
        {cls.semester !== activeSemester && (
          <motion.div
            variants={ITEM}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm text-amber-800">
              <span className="font-bold">שים לב:</span>{' '}
              כיתה זו שייכת ל{SEMESTER_LABELS[cls.semester]}, אך המערכת מוגדרת כעת ל{SEMESTER_LABELS[activeSemester]}.
              {' '}הנתונים נשמרים ל{SEMESTER_LABELS[cls.semester]}.
            </p>
          </motion.div>
        )}

        {/* ── Semester B empty banner ─────────────────────────────────── */}
        <SemesterEmptyBanner
          visible={activeSemester === 'B' && testSummaries.length === 0}
        />

        {/* ── Bento header grid ──────────────────────────────────────── */}
        <motion.div variants={ITEM} className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ perspective: 1200 }}>

          {/* Card 1 — Class identity */}
          <motion.div
            whileHover={{ y: -5, scale: 1.015, boxShadow: '0 20px 52px rgba(99,102,241,0.45)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 shadow-[0_4px_28px_rgba(99,102,241,0.35)] sm:col-span-1"
          >
            <div className="pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full bg-white/8" />
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
              {cls.academicYear} · {SEMESTER_LABELS[cls.semester]}
            </p>
            <h1 className="mb-4 text-2xl font-extrabold leading-tight text-white">{formatClassWithGender(cls.name, cls.genderType)}</h1>
            <button
              type="button"
              onClick={() => { void copyJoinCode(); }}
              className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 hover:bg-white/25 transition-colors"
              aria-label="העתק קוד הצטרפות"
            >
              <Hash className="h-3.5 w-3.5 text-indigo-200" aria-hidden="true" />
              <code className="font-mono text-sm font-bold tracking-widest text-white">{cls.joinCode}</code>
              <ClipboardCopy className="h-3 w-3 text-indigo-300" aria-hidden="true" />
              <AnimatePresence>
                {copied && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                    className="text-xs font-medium text-emerald-300"
                  >
                    הועתק!
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>

          {/* Card 2 — Quick stats (real attendance %) */}
          <motion.div
            whileHover={{ y: -5, scale: 1.015, boxShadow: '0 20px 52px rgba(16,185,129,0.40)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-[0_4px_28px_rgba(16,185,129,0.30)]"
          >
            <div className="pointer-events-none absolute -start-6 -bottom-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="flex items-center gap-2 mb-1">
              <motion.div
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Users className="h-3.5 w-3.5 text-emerald-100" aria-hidden="true" />
              </motion.div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">תלמידים רשומים</p>
            </div>
            <div className="text-4xl font-extrabold text-white mb-3">{cls.studentCount}</div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/80" style={{ width: `${attendancePct}%` }} />
              </div>
              <span className="shrink-0 text-sm font-bold text-white">{attendancePct}% נוכחות</span>
            </div>
          </motion.div>

          {/* Card 3 — CTA */}
          <motion.button
            type="button"
            onClick={() => setIsCreateSessionOpen(true)}
            whileHover={{ y: -5, scale: 1.03, boxShadow: '0 24px 56px rgba(245,158,11,0.50)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
            whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
            className="relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-center shadow-[0_4px_28px_rgba(245,158,11,0.35)]"
          >
            <div className="pointer-events-none absolute -start-6 -top-6 h-20 w-20 rounded-full bg-white/12" />
            <motion.div
              animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Plus className="h-8 w-8 text-white" aria-hidden="true" />
            </motion.div>
            <div className="text-lg font-extrabold text-white">הוסף שיעור / מבחן</div>
            <div className="text-xs font-medium text-white/80">לחץ לפתיחת מבחן כושר חדש</div>
          </motion.button>

        </motion.div>

        {/* ── Smart Team Builder CTA ─────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <Link href={`/classes/${classId}/team-builder`}>
            <motion.div
              whileHover={{ y: -4, boxShadow: '0 20px 52px rgba(139,92,246,0.40)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
              whileTap={{ scale: 0.98 }}
              className="relative flex cursor-pointer items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 px-7 py-5 shadow-[0_4px_28px_rgba(139,92,246,0.35)]"
            >
              <div className="pointer-events-none absolute -end-10 -bottom-10 h-32 w-32 rounded-full bg-white/8" />
              <div className="pointer-events-none absolute -start-6 -top-6 h-20 w-20 rounded-full bg-white/5" />
              <motion.div
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              >
                <Users className="h-6 w-6 text-white" aria-hidden="true" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-extrabold text-white">חלוקת כוחות חכמה</p>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90">AI</span>
                </div>
                <p className="mt-0.5 text-sm text-white/75">
                  צור קבוצות מאוזנות אוטומטית לפי ציוני הכושר · אלגוריתם Snake Draft
                </p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="shrink-0"
              >
                <ChevronRight className="h-6 w-6 text-white/70" aria-hidden="true" />
              </motion.div>
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Semester Comparison CTA ─────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <motion.button
            type="button"
            onClick={() => { router.push(`/classes/${classId}/comparison`); }}
            disabled={!availability?.hasSemesterBData}
            whileHover={
              availability?.hasSemesterBData
                ? { y: -4, boxShadow: '0 20px 52px rgba(20,184,166,0.40)', transition: { type: 'spring', stiffness: 350, damping: 20 } }
                : {}
            }
            whileTap={availability?.hasSemesterBData ? { scale: 0.98 } : {}}
            className={cn(
              'relative flex w-full cursor-pointer items-center gap-5 overflow-hidden rounded-3xl px-7 py-5 text-start shadow-[0_4px_28px_rgba(20,184,166,0.30)] transition-opacity',
              availability?.hasSemesterBData
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 opacity-100'
                : 'cursor-not-allowed bg-gradient-to-br from-slate-400 to-slate-500 opacity-50',
            )}
            aria-disabled={!availability?.hasSemesterBData}
            title={!availability?.hasSemesterBData ? "אין נתוני מחצית ב' עדיין" : undefined}
          >
            <div className="pointer-events-none absolute -end-10 -bottom-10 h-32 w-32 rounded-full bg-white/8" />
            <div className="pointer-events-none absolute -start-6 -top-6 h-20 w-20 rounded-full bg-white/5" />
            <motion.div
              animate={availability?.hasSemesterBData ? { rotate: [0, 6, -6, 0], scale: [1, 1.08, 1] } : {}}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              <BarChart2 className="h-6 w-6 text-white" aria-hidden="true" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold text-white">השוואת מחציות</p>
              <p className="mt-0.5 text-sm text-white/75">
                {availability?.hasSemesterBData
                  ? 'השווה ציונים בין מחצית א׳ למחצית ב׳ עם גרפים ופירוט לפי תלמיד'
                  : "אין נתוני מחצית ב' עדיין — הכפתור יופעל לאחר הזנת ציונים"}
              </p>
            </div>
            {availability?.hasSemesterBData && (
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="shrink-0"
              >
                <ChevronRight className="h-6 w-6 text-white/70" aria-hidden="true" />
              </motion.div>
            )}
          </motion.button>
        </motion.div>

        {/* ── AI Dispatch banner ─────────────────────────────────────── */}
        {failingStudents.length > 0 && (
          <motion.div variants={ITEM}>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50 to-orange-50 px-5 py-4 shadow-sm backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                <ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rose-900">
                  זיהינו <strong>{failingStudents.length} תלמידים</strong> מתחת לנורמה
                  {lockedStudents.length > 0 && (
                    <span className="text-rose-600">
                      {' '}({lockedStudents.length} מתוכם כבר בתוכנית פעילה ⏳)
                    </span>
                  )}.
                </p>
                {eligibleStudents.length > 0 ? (
                  <p className="mt-0.5 text-xs text-rose-600">
                    {eligibleStudents.length} תלמידים זכאים לתוכנית אימון AI חדשה
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">
                    כל התלמידים כבר בתוכנית — ניתן לשלוח שוב בתום 4 שבועות
                  </p>
                )}
              </div>
              <motion.button
                type="button"
                onClick={() => setIsAiDispatchOpen(true)}
                disabled={eligibleStudents.length === 0}
                whileHover={
                  eligibleStudents.length > 0
                    ? { scale: 1.04, boxShadow: '0 8px 28px rgba(139,92,246,0.42)', transition: { type: 'spring', stiffness: 400, damping: 22 } }
                    : {}
                }
                whileTap={eligibleStudents.length > 0 ? { scale: 0.97 } : {}}
                className={cn(
                  'relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors',
                  eligibleStudents.length > 0
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_2px_16px_rgba(139,92,246,0.35)]'
                    : 'cursor-not-allowed bg-slate-300',
                )}
              >
                {eligibleStudents.length > 0 && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                  />
                )}
                <Sparkles className="relative z-10 h-4 w-4" aria-hidden="true" />
                <span className="relative z-10">שלח תוכנית AI</span>
              </motion.button>

              {/* Secondary: open AI Control Center */}
              <motion.button
                type="button"
                onClick={() => setIsAiControlCenterOpen(true)}
                whileHover={{ scale: 1.04, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
                whileTap={{ scale: 0.97 }}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              >
                <Settings2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span>⚙️ ניהול ומעקב</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Test type selector — premium dropdown ──────────────────── */}
        <motion.div variants={ITEM}>
          <TestTypeDropdown
            testSummaries={testSummaries}
            selectedTestId={selectedTestId}
            onSelect={setSelectedTestId}
          />
        </motion.div>

        {/* ── Tab content (animated on test switch) ──────────────────── */}
        {selectedTestId && !selectedSummary && (
          <motion.div
            key={`no-sessions-${selectedTestId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
          >
          <SemesterPanel className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Dumbbell className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">טרם בוצע מבחן זה בכיתה</p>
              <p className="mt-1 text-sm text-slate-400">לחץ &ldquo;הוסף שיעור / מבחן&rdquo; כדי להתחיל מבחן ולרשום תוצאות</p>
            </div>
          </SemesterPanel>
          </motion.div>
        )}

        {selectedSummary && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedSummary.testTypeId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
              className="space-y-5"
            >
              {/* ── Podium + Progress chart ─────────────────────────────── */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                {/* Gamified podium */}
                <motion.div
                  className="rounded-2xl bg-amber-50/75 backdrop-blur-3xl border border-white/75 ring-1 ring-white/20 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                  whileHover={{ y: -6, scale: 1.015, boxShadow: '0 20px 52px rgba(245,158,11,0.22)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
                >
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                      <span className="text-base">🏆</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">מובילי הכיתה</h2>
                      <p className="text-xs text-slate-500">{selectedSummary.nameHe} — תוצאות גבוהות</p>
                    </div>
                  </div>
                  {!studentsLoading && ranked.length >= 2 ? (
                    <Podium entries={ranked} />
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">
                      {studentsLoading ? 'טוען...' : 'נדרשים לפחות 2 תלמידים עם ציונים'}
                    </p>
                  )}
                </motion.div>

                {/* Progress over time chart */}
                <motion.div
                  className="rounded-2xl bg-indigo-50/75 backdrop-blur-3xl border border-white/75 ring-1 ring-white/20 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                  whileHover={{ y: -6, scale: 1.015, boxShadow: '0 20px 52px rgba(99,102,241,0.22)', transition: { type: 'spring', stiffness: 350, damping: 20 } }}
                >
                  <div className="flex items-center gap-2.5 mb-5">
                    <motion.div
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"
                      whileHover={{ scale: 1.2, y: -2, transition: { type: 'spring', stiffness: 400, damping: 12 } }}
                    >
                      <TrendingUp className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    </motion.div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">התקדמות הכיתה</h2>
                      <p className="text-xs text-slate-500">{selectedSummary.nameHe} לאורך השנה</p>
                    </div>
                  </div>
                  {chartData.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                      אין נתוני התקדמות עדיין
                    </div>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gcls" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={selectedVisual.chartColor} stopOpacity={0.30} />
                              <stop offset="95%" stopColor={selectedVisual.chartColor} stopOpacity={0}    />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={26} />
                          <Tooltip
                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 24px rgba(15,23,42,0.10)', fontSize: '12px', padding: '8px 12px' }}
                          />
                          <Area type="monotone" dataKey="norm" name="נורמה ארצית" stroke="#cbd5e1" strokeWidth={2.5} strokeDasharray="6 4" fill="none" dot={false} />
                          <Area type="monotone" dataKey="avg"  name="ממוצע הכיתה" stroke={selectedVisual.chartColor} strokeWidth={4} fill="url(#gcls)" dot={{ r: 4, fill: selectedVisual.chartColor, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-6 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-5 rounded-full inline-block" style={{ backgroundColor: selectedVisual.chartColor }} />
                      <span className="text-slate-700 font-medium">הכיתה</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-px w-5 border-t-2 border-dashed border-slate-300 inline-block" />
                      <span className="text-slate-500">נורמה ארצית</span>
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* ── Distribution card ───────────────────────────────────── */}
              {distributionTotal > 0 && (
                <DistributionCard
                  distribution={selectedSummary.distribution}
                  total={distributionTotal}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Students Table ─────────────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold tracking-tight bg-gradient-to-l from-indigo-700 to-violet-700 bg-clip-text text-transparent">
                רשימת תלמידים
                {students && <span className="ms-2 text-sm font-normal text-slate-400">({students.length})</span>}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">לחץ על תלמיד לפרופיל מפורט</p>
            </div>
            <motion.button
              type="button"
              onClick={() => setIsAddStudentOpen(true)}
              whileHover={{ y: -3, scale: 1.04, boxShadow: '0 8px 28px rgba(99,102,241,0.40)', transition: { type: 'spring', stiffness: 400, damping: 25 } }}
              whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              </motion.span>
              הוסף תלמיד
            </motion.button>
          </div>

          {/* Search bar — only when students are loaded */}
          {!studentsLoading && !studentsError && students && students.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE, duration: 0.35, delay: 0.08 }}
              className="mb-3"
            >
              <StudentSearchBar
                value={studentSearch}
                onChange={setStudentSearch}
                count={filteredStudents.length}
                total={students.length}
              />
            </motion.div>
          )}

          {studentsLoading && (
            <div className="overflow-hidden rounded-2xl bg-white/65 backdrop-blur-xl shadow-[0_2px_16px_rgba(15,23,42,0.07)]">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-4 border-b border-slate-50 px-5 py-3.5">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
                    <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          )}

          {studentsError && (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              לא ניתן לטעון את רשימת התלמידים.
            </div>
          )}

          {!studentsLoading && !studentsError && students?.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            >
              <SemesterPanel className="flex flex-col items-center justify-center gap-3 border-dashed py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                  <Users className="h-6 w-6 text-indigo-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">אין תלמידים רשומים</p>
                  <p className="mt-1 text-sm text-slate-400">לחץ &ldquo;הוסף תלמיד&rdquo; כדי להתחיל</p>
                </div>
              </SemesterPanel>
            </motion.div>
          )}

          {!studentsLoading && students && students.length > 0 && (
            <>
              {/* No-results empty state when search filters everything out */}
              <AnimatePresence mode="popLayout">
                {filteredStudents.length === 0 && (
                  <StudentSearchEmptyState key="search-empty" query={studentSearch} />
                )}
              </AnimatePresence>

              {filteredStudents.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-indigo-50/72 backdrop-blur-3xl border border-white/78 ring-1 ring-white/20 shadow-[0_8px_28px_rgba(15,23,42,0.10)]">
              {/* Header */}
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 grid grid-cols-[2fr_1fr_1fr_1.5fr_auto_0.5fr] gap-4">
                {[
                  'שם תלמיד',
                  selectedSummary ? `ציון — ${selectedSummary.nameHe}` : 'ציון',
                  'מגדר',
                  'רמת כושר',
                  'נוכחות',
                  '',
                ].map((h) => (
                  <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</span>
                ))}
              </div>
              <motion.ul variants={ROW_STAGGER} initial="hidden" animate="show">
                <AnimatePresence mode="popLayout">
                {filteredStudents.map((student, index) => {
                  const score    = studentGradesMap.get(student.id) ?? 0;
                  const level    = score > 0 ? gradeLevel(score) : 'fail';
                  const ls       = LEVEL_STYLE[level];
                  const tint     = AVATAR_TINTS[index % AVATAR_TINTS.length]!;
                  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                  const record   = todayAttendanceMap.get(student.id);
                  const isAbsent = record?.status === 'ABSENT';
                  const isExempt = record?.status === 'EXCUSED';

                  return (
                    <motion.li key={student.id} layout variants={ROW_ITEM}>
                      <div className={cn(
                        'grid grid-cols-[2fr_1fr_1fr_1.5fr_auto_0.5fr] items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 transition-colors group',
                        isExempt ? 'bg-orange-50/40' : 'hover:bg-indigo-50/40',
                      )}>
                        {/* Name + avatar */}
                        <div className="flex items-center gap-3">
                          <motion.div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tint}`}
                            whileHover={{ scale: 1.18, rotate: -6, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                          >
                            {initials}
                          </motion.div>
                          <div>
                            <Link
                              href={`/classes/${classId}/students/${student.id}/report`}
                              className={cn(
                                'text-sm font-medium underline underline-offset-2 transition-colors',
                                isExempt ? 'text-orange-600 hover:text-orange-700' : 'text-blue-600 hover:text-blue-800',
                              )}
                            >
                              {student.firstName} {student.lastName}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-xs text-slate-400">{student.studentCode}</code>
                              {isAbsent && <span className="rounded-full bg-red-100 px-1.5 py-px text-[10px] font-bold text-red-600">חסר/ה</span>}
                              {isExempt && <span className="rounded-full bg-orange-100 px-1.5 py-px text-[10px] font-bold text-orange-600">פטור/ה</span>}
                            </div>
                          </div>
                        </div>
                        {/* Score */}
                        <span className={`text-lg font-extrabold ${
                          score === 0          ? 'text-slate-300'   :
                          level === 'excellent' ? 'text-emerald-600' :
                          level === 'good'      ? 'text-blue-600'    :
                          level === 'pass'      ? 'text-amber-600'   : 'text-red-600'
                        }`}>
                          {score > 0 ? score : '—'}
                        </span>
                        {/* Gender */}
                        <span className="text-xs text-slate-500">{GENDER_LABELS[student.gender]}</span>
                        {/* Level badge */}
                        {score > 0 ? (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ls.bg} ${ls.text} ${ls.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${ls.dot}`} />
                            {ls.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">אין ציון</span>
                        )}
                        {/* Absent + Exempt action buttons */}
                        <StudentRowActions
                          studentId={student.id}
                          studentName={`${student.firstName} ${student.lastName}`}
                          classId={classId}
                          today={today}
                          isAbsent={isAbsent}
                          isExempt={isExempt}
                          onOpenExemptDialog={openExemptDialog}
                          onToggleAbsent={(id) => { void handleToggleAbsent(id); }}
                          absentLoading={absentLoadingIds.has(student.id)}
                        />
                        {/* Arrow */}
                        <motion.div
                          whileHover={{ x: -3, transition: { type: 'spring', stiffness: 500, damping: 20 } }}
                        >
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
                        </motion.div>
                      </div>
                    </motion.li>
                  );
                })}
                </AnimatePresence>
              </motion.ul>
            </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      <AddStudentDialog
        classId={classId}
        open={isAddStudentOpen}
        onOpenChange={setIsAddStudentOpen}
        onSuccess={() => { void mutateStudents(); }}
      />
      <AiDispatchModal
        open={isAiDispatchOpen}
        onOpenChange={setIsAiDispatchOpen}
        eligibleStudents={eligibleStudents}
        lockedStudents={lockedStudents}
        activePlanMap={activePlanMap}
        studentGradesMap={studentGradesMap}
      />
      <AiControlCenterModal
        open={isAiControlCenterOpen}
        onOpenChange={setIsAiControlCenterOpen}
        students={students ?? []}
        activePlanDetailsMap={activePlanDetailsMap}
        lockedStudents={lockedStudents}
        eligibleStudents={eligibleStudents}
        studentGradesMap={studentGradesMap}
      />
      <CreateSessionModal
        classId={classId}
        open={isCreateSessionOpen}
        onOpenChange={setIsCreateSessionOpen}
        gradeLevel={cls?.gradeLevel}
      />
      {exemptDialogStudentId && (() => {
        const s = (students ?? []).find((st) => st.id === exemptDialogStudentId);
        if (!s) return null;
        return (
          <ExemptionDialog
            key={exemptDialogStudentId}
            studentId={s.id}
            studentName={`${s.firstName} ${s.lastName}`}
            classId={classId}
            today={today}
            open={!!exemptDialogStudentId}
            onOpenChange={(open) => { if (!open) setExemptDialogStudentId(null); }}
            onSuccess={() => { void mutateAttendance(); }}
          />
        );
      })()}
      {absenceDialogStudentId && (() => {
        const s = (students ?? []).find((st) => st.id === absenceDialogStudentId);
        if (!s) return null;
        return (
          <AbsenceDialog
            key={absenceDialogStudentId}
            studentId={s.id}
            studentName={`${s.firstName} ${s.lastName}`}
            classId={classId}
            today={today}
            open={!!absenceDialogStudentId}
            onOpenChange={(open) => { if (!open) setAbsenceDialogStudentId(null); }}
            onSuccess={() => { void mutateAttendance(); }}
          />
        );
      })()}
    </AnimatePresence>
  );
}
