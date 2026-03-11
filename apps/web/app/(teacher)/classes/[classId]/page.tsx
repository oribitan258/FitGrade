'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Dumbbell,
  Hash,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
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

const ROW_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const ROW_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.4 } },
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
                className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 shadow-sm"
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
                className="gap-2 rounded-xl bg-red-500 hover:bg-red-600 shadow-sm"
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
}

function CreateSessionModal({ classId, open, onOpenChange }: CreateSessionModalProps): React.JSX.Element {
  const router = useRouter();
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
          body: JSON.stringify({ testTypeId, conductedAt, isStopwatch }),
        },
      );

      const destination = isStopwatch
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

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-5 pt-1">

          {/* Test type selector */}
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-semibold">סוג מבחן</Label>
            {typesLoading ? (
              <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <select
                value={testTypeId}
                onChange={(e) => setTestTypeId(e.target.value)}
                disabled={isSubmitting}
                className={cn(SELECT_STYLES)}
                aria-label="בחר סוג מבחן"
              >
                {(testTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameHe}
                    {t.unit ? ` (${t.unit})` : ''}
                  </option>
                ))}
              </select>
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
                className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 shadow-sm"
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
      className="rounded-2xl bg-sky-50/75 backdrop-blur-xl border border-white/75 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
      whileHover={{ y: -4, boxShadow: '0 20px 52px rgba(15,23,42,0.18)' }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
          <Activity className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassDetailPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const [isAddStudentOpen, setIsAddStudentOpen]         = useState(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen]   = useState(false);
  const [selectedTestId, setSelectedTestId]             = useState<string | null>(null);
  const [copied, setCopied]                             = useState(false);

  // Today's attendance state
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [absentLoadingIds, setAbsentLoadingIds] = useState<Set<string>>(new Set());
  const [exemptDialogStudentId, setExemptDialogStudentId]   = useState<string | null>(null);
  const [absenceDialogStudentId, setAbsenceDialogStudentId] = useState<string | null>(null);

  const { data: cls,      error: classError,    isLoading: classLoading    } = useClass(classId);
  const { data: students, error: studentsError, isLoading: studentsLoading, mutate: mutateStudents } = useStudents(classId);
  const { data: details,  isLoading: detailsLoading } = useClassDetails(classId);
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
      >
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <motion.nav variants={ITEM} aria-label="ניווט עמודים" className="flex items-center gap-1.5 text-sm">
          <Link href="/classes" className="font-medium text-slate-400 hover:text-indigo-600 transition-colors">
            הכיתות שלי
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
          <span className="font-semibold text-slate-700">{cls.name}</span>
        </motion.nav>

        {/* ── Bento header grid ──────────────────────────────────────── */}
        <motion.div variants={ITEM} className="grid grid-cols-1 gap-3 sm:grid-cols-3">

          {/* Card 1 — Class identity */}
          <motion.div
            whileHover={{ y: -3, transition: { ease: EASE, duration: 0.35 } }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 shadow-[0_4px_28px_rgba(99,102,241,0.35)] sm:col-span-1"
          >
            <div className="pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full bg-white/8" />
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200">
              {cls.academicYear} · {SEMESTER_LABELS[cls.semester]}
            </p>
            <h1 className="mb-4 text-2xl font-extrabold leading-tight text-white">{cls.name}</h1>
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
            whileHover={{ y: -3, transition: { ease: EASE, duration: 0.35 } }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-[0_4px_28px_rgba(16,185,129,0.30)]"
          >
            <div className="pointer-events-none absolute -start-6 -bottom-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-emerald-100" aria-hidden="true" />
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
            whileHover={{ y: -3, scale: 1.02, transition: { ease: EASE, duration: 0.35 } }}
            whileTap={{ scale: 0.97 }}
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
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <Dumbbell className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">טרם בוצע מבחן זה בכיתה</p>
              <p className="mt-1 text-sm text-slate-400">לחץ &ldquo;הוסף שיעור / מבחן&rdquo; כדי להתחיל מבחן ולרשום תוצאות</p>
            </div>
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
                  className="rounded-2xl bg-amber-50/75 backdrop-blur-xl border border-white/75 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                  whileHover={{ y: -4, boxShadow: '0 20px 52px rgba(15,23,42,0.18)' }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
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
                  className="rounded-2xl bg-indigo-50/75 backdrop-blur-xl border border-white/75 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
                  whileHover={{ y: -4, boxShadow: '0 20px 52px rgba(15,23,42,0.18)' }}
                  transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
                >
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
                      <TrendingUp className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    </div>
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
              <h2 className="text-base font-bold text-slate-800">
                רשימת תלמידים
                {students && <span className="ms-2 text-sm font-normal text-slate-400">({students.length})</span>}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">לחץ על תלמיד לפרופיל מפורט</p>
            </div>
            <motion.button
              type="button"
              onClick={() => setIsAddStudentOpen(true)}
              whileHover={{ y: -2, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              הוסף תלמיד
            </motion.button>
          </div>

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
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                <Users className="h-6 w-6 text-indigo-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">אין תלמידים רשומים</p>
                <p className="mt-1 text-sm text-slate-400">לחץ &ldquo;הוסף תלמיד&rdquo; כדי להתחיל</p>
              </div>
            </motion.div>
          )}

          {!studentsLoading && students && students.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-indigo-50/72 backdrop-blur-xl border border-white/78 shadow-[0_8px_28px_rgba(15,23,42,0.10)]">
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
                {students.map((student, index) => {
                  const score    = studentGradesMap.get(student.id) ?? 0;
                  const level    = score > 0 ? gradeLevel(score) : 'fail';
                  const ls       = LEVEL_STYLE[level];
                  const tint     = AVATAR_TINTS[index % AVATAR_TINTS.length]!;
                  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                  const record   = todayAttendanceMap.get(student.id);
                  const isAbsent = record?.status === 'ABSENT';
                  const isExempt = record?.status === 'EXCUSED';

                  return (
                    <motion.li key={student.id} variants={ROW_ITEM}>
                      <div className={cn(
                        'grid grid-cols-[2fr_1fr_1fr_1.5fr_auto_0.5fr] items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 transition-colors group',
                        isExempt ? 'bg-orange-50/40' : 'hover:bg-indigo-50/40',
                      )}>
                        {/* Name + avatar + score + gender + level — all wrapped in a link */}
                        <Link href={`/classes/${classId}/student/${student.id}`} className="contents">
                          {/* Name + avatar */}
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tint}`}>{initials}</div>
                            <div>
                              <div className={cn(
                                'text-sm font-semibold transition-colors',
                                isExempt  ? 'text-orange-600' :
                                'text-slate-800 group-hover:text-indigo-700',
                              )}>
                                {student.firstName} {student.lastName}
                              </div>
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
                        </Link>
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
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </div>
          )}
        </motion.div>
      </motion.div>

      <AddStudentDialog
        classId={classId}
        open={isAddStudentOpen}
        onOpenChange={setIsAddStudentOpen}
        onSuccess={() => { void mutateStudents(); }}
      />
      <CreateSessionModal
        classId={classId}
        open={isCreateSessionOpen}
        onOpenChange={setIsCreateSessionOpen}
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
