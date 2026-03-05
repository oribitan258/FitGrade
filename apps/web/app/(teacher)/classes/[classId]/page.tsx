'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  ChevronRight,
  ClipboardCopy,
  Hash,
  Plus,
  Timer,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Dumbbell,
} from 'lucide-react';
import {
  createStudentSchema,
  type CreateStudentInput,
  type StudentData,
} from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { getHebrewGradeLabel } from '@fitgrade/types';
import { useClass, useStudents } from '@/hooks/use-classes';
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
import { cn } from '@/lib/utils';

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

// ─── Test types & mock data ───────────────────────────────────────────────────

const TEST_TYPES = [
  { id: 'run2000',  label: "ריצת 2,000מ",  icon: Timer,     unit: "דק'",   tabBg: 'bg-teal-600',    tabShadow: 'rgba(13,148,136,0.50)',  chartColor: '#0d9488' },
  { id: 'pushups',  label: "שכיבות סמיכה", icon: Dumbbell,  unit: "חז'",   tabBg: 'bg-orange-600',  tabShadow: 'rgba(234,88,12,0.50)',   chartColor: '#ea580c' },
  { id: 'pullups',  label: "מתח מעקה",     icon: TrendingUp, unit: "חז'",  tabBg: 'bg-violet-600',  tabShadow: 'rgba(124,58,237,0.50)',  chartColor: '#7c3aed' },
  { id: 'flex',     label: "גמישות",        icon: Target,    unit: "ס\"מ", tabBg: 'bg-emerald-600', tabShadow: 'rgba(5,150,105,0.50)',   chartColor: '#059669' },
] as const;

type TestId = typeof TEST_TYPES[number]['id'];

/** 0-100 grade scores per test, per student index (cycles) */
const TEST_SCORES: Record<TestId, readonly number[]> = {
  run2000: [85, 78, 92, 64, 81, 73, 95, 68, 84, 79],
  pushups:  [72, 88, 76, 91, 64, 83, 77, 95, 68, 80],
  pullups:  [88, 65, 92, 74, 79, 88, 61, 94, 71, 83],
  flex:     [76, 83, 68, 89, 72, 91, 79, 65, 88, 77],
};

/** Monthly class-average progress per test */
const PROGRESS_BY_TEST: Record<TestId, Array<{ month: string; avg: number; norm: number }>> = {
  run2000: [
    { month: "ספט'", avg: 68, norm: 74 }, { month: "אוק'", avg: 72, norm: 74 },
    { month: "נוב'", avg: 75, norm: 74 }, { month: "דצמ'", avg: 74, norm: 74 },
    { month: "ינו'", avg: 78, norm: 74 }, { month: "פבר'", avg: 83, norm: 74 },
  ],
  pushups: [
    { month: "ספט'", avg: 63, norm: 70 }, { month: "אוק'", avg: 67, norm: 70 },
    { month: "נוב'", avg: 71, norm: 70 }, { month: "דצמ'", avg: 70, norm: 70 },
    { month: "ינו'", avg: 74, norm: 70 }, { month: "פבר'", avg: 79, norm: 70 },
  ],
  pullups: [
    { month: "ספט'", avg: 70, norm: 72 }, { month: "אוק'", avg: 73, norm: 72 },
    { month: "נוב'", avg: 76, norm: 72 }, { month: "דצמ'", avg: 74, norm: 72 },
    { month: "ינו'", avg: 79, norm: 72 }, { month: "פבר'", avg: 85, norm: 72 },
  ],
  flex: [
    { month: "ספט'", avg: 66, norm: 68 }, { month: "אוק'", avg: 69, norm: 68 },
    { month: "נוב'", avg: 72, norm: 68 }, { month: "דצמ'", avg: 71, norm: 68 },
    { month: "ינו'", avg: 75, norm: 68 }, { month: "פבר'", avg: 80, norm: 68 },
  ],
};

type FitnessLevel = 'excellent' | 'good' | 'pass' | 'fail';

function gradeLevel(score: number): FitnessLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'pass';
  return 'fail';
}

const LEVEL_STYLE: Record<FitnessLevel, { label: string; bg: string; text: string; border: string; dot: string }> = {
  excellent: { label: 'מצטיין',        bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  good:      { label: 'טוב',           bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  pass:      { label: 'עובר',          bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  fail:      { label: 'מתחת לנורמה',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
};

function getScore(testId: TestId, studentIndex: number): number {
  return TEST_SCORES[testId][studentIndex % TEST_SCORES[testId].length]!;
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

// ─── Gamified podium ──────────────────────────────────────────────────────────

interface PodiumEntry { student: StudentData; score: number; rank: 1 | 2 | 3 }

const PODIUM_META = {
  1: { label: '1',  h: 'h-36', gradFrom: 'from-amber-300', gradTo: 'to-amber-500', glow: '0_0_30px_rgba(251,191,36,0.60)', ring: 'ring-amber-400', medal: '🥇', avatarBg: 'bg-amber-100 text-amber-800', delay: 0.2  },
  2: { label: '2',  h: 'h-24', gradFrom: 'from-slate-300', gradTo: 'to-slate-400', glow: '0_0_22px_rgba(148,163,184,0.55)', ring: 'ring-slate-300', medal: '🥈', avatarBg: 'bg-slate-100 text-slate-700', delay: 0.35 },
  3: { label: '3',  h: 'h-16', gradFrom: 'from-amber-600', gradTo: 'to-amber-700', glow: '0_0_18px_rgba(180,83,9,0.45)',  ring: 'ring-amber-700', medal: '🥉', avatarBg: 'bg-orange-100 text-orange-800', delay: 0.5  },
} as const;

function Podium({ entries }: { entries: PodiumEntry[] }): React.JSX.Element {
  // Visual order: 2nd, 1st, 3rd
  const displayOrder: (1 | 2 | 3)[] = [2, 1, 3];

  return (
    <div className="flex items-end justify-center gap-3 px-4" dir="ltr">
      {displayOrder.map((rank) => {
        const entry = entries.find((e) => e.rank === rank);
        if (!entry) return null;
        const meta = PODIUM_META[rank];
        const initials = `${entry.student.firstName[0] ?? ''}${entry.student.lastName[0] ?? ''}`;

        return (
          <motion.div
            key={rank}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.7, delay: meta.delay }}
            className="flex flex-1 flex-col items-center gap-2"
          >
            {/* Medal */}
            <span className="text-2xl">{meta.medal}</span>

            {/* Avatar */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: meta.delay + 0.15 }}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold ring-2 ${meta.ring} ${meta.avatarBg}`}
              style={{ boxShadow: `${meta.glow}` }}
            >
              {initials}
            </motion.div>

            {/* Name + Score */}
            <div className="text-center">
              <p className="text-xs font-bold text-slate-800 leading-tight max-w-[72px] truncate">
                {entry.student.firstName}
              </p>
              <p className="text-xs font-semibold text-slate-500">{entry.score}</p>
            </div>

            {/* Podium bar */}
            <motion.div
              className={`w-full rounded-t-2xl bg-gradient-to-t ${meta.gradFrom} ${meta.gradTo} ${meta.h} flex items-start justify-center pt-2.5`}
              style={{ boxShadow: `${meta.glow}` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 1 } as React.CSSProperties}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6, delay: meta.delay + 0.3 }}
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

interface DistEntry { level: FitnessLevel; count: number }

function DistributionCard({ scores }: { scores: number[] }): React.JSX.Element {
  const buckets: Record<FitnessLevel, number> = { excellent: 0, good: 0, pass: 0, fail: 0 };
  for (const s of scores) buckets[gradeLevel(s)]++;

  const dist: DistEntry[] = [
    { level: 'excellent', count: buckets.excellent },
    { level: 'good',      count: buckets.good      },
    { level: 'pass',      count: buckets.pass      },
    { level: 'fail',      count: buckets.fail      },
  ];

  const total = scores.length;

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
          const s = LEVEL_STYLE[level];
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
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [selectedTestId, setSelectedTestId]     = useState<TestId>('run2000');
  const [copied, setCopied]                     = useState(false);

  const { data: cls, error: classError, isLoading: classLoading } = useClass(classId);
  const { data: students, error: studentsError, isLoading: studentsLoading, mutate: mutateStudents } =
    useStudents(classId);

  async function copyJoinCode(): Promise<void> {
    if (!cls) return;
    await navigator.clipboard.writeText(cls.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (classLoading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-white/70" />
        <div className="h-40 animate-pulse rounded-3xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((n) => <div key={n} className="h-56 animate-pulse rounded-2xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />)}
        </div>
      </div>
    );
  }

  if (classError || !cls) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 max-w-lg">
        לא ניתן לטעון את פרטי הכיתה — נסה לרענן את הדף.
      </div>
    );
  }

  // Compute scores for selected test across all students
  const studentScores: number[] = (students ?? []).map((_, i) => getScore(selectedTestId, i));

  // Top 3 students for the selected test
  const ranked: PodiumEntry[] = (students ?? [])
    .map((s, i) => ({ student: s, score: getScore(selectedTestId, i), idx: i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry, pos) => ({ ...entry, rank: (pos + 1) as 1 | 2 | 3 }));

  const selectedTest = TEST_TYPES.find((t) => t.id === selectedTestId)!;
  const progressData = PROGRESS_BY_TEST[selectedTestId];

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

          {/* Card 2 — Quick stats */}
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
                <div className="h-full rounded-full bg-white/80" style={{ width: '89%' }} />
              </div>
              <span className="shrink-0 text-sm font-bold text-white">89% נוכחות</span>
            </div>
          </motion.div>

          {/* Card 3 — CTA */}
          <motion.button
            type="button"
            whileHover={{ y: -3, scale: 1.02, boxShadow: '0 10px_36px_rgba(245,158,11,0.50)', transition: { ease: EASE, duration: 0.35 } }}
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

        {/* ── Test type selector tabs ─────────────────────────────────── */}
        <motion.div variants={ITEM}>
          <div className="flex items-center gap-2 rounded-2xl bg-indigo-50/78 backdrop-blur-xl border border-white/80 p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.10)]" role="tablist" aria-label="בחר סוג מבחן">
            {TEST_TYPES.map((test) => {
              const active = test.id === selectedTestId;
              const Icon = test.icon;
              return (
                <motion.button
                  key={test.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedTestId(test.id)}
                  whileTap={{ scale: 0.95 }}
                  className="relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  {active && (
                    <motion.div
                      layoutId="activeTestTab"
                      className={`absolute inset-0 rounded-xl ${test.tabBg}`}
                      style={{ boxShadow: `0 4px 20px ${test.tabShadow}` }}
                      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
                    />
                  )}
                  <motion.div
                    animate={active ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative z-10"
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-500')} aria-hidden="true" />
                  </motion.div>
                  <span className={cn('relative z-10 hidden sm:block', active ? 'text-white' : 'text-slate-700')}>
                    {test.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tab content (animated) ─────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedTestId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
            className="space-y-5"
          >
            {/* ── Podium + Progress chart row ─────────────────────────── */}
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
                    <p className="text-xs text-slate-500">{selectedTest.label} — תוצאות גבוהות</p>
                  </div>
                </div>
                {!studentsLoading && students && students.length >= 2 ? (
                  <Podium entries={ranked} />
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">
                    {studentsLoading ? 'טוען...' : 'נדרשים לפחות 2 תלמידים'}
                  </p>
                )}
              </motion.div>

              {/* Progress over time */}
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
                    <p className="text-xs text-slate-500">{selectedTest.label} לאורך השנה</p>
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gcls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={selectedTest.chartColor} stopOpacity={0.30} />
                          <stop offset="95%" stopColor={selectedTest.chartColor} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={26} />
                      <Tooltip
                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 24px rgba(15,23,42,0.10)', fontSize: '12px', padding: '8px 12px' }}
                      />
                      <Area type="monotone" dataKey="norm"  name="נורמה ארצית" stroke="#cbd5e1" strokeWidth={2.5} strokeDasharray="6 4" fill="none" dot={false} />
                      <Area type="monotone" dataKey="avg"   name="ממוצע הכיתה" stroke={selectedTest.chartColor} strokeWidth={4} fill="url(#gcls)" dot={{ r: 4, fill: selectedTest.chartColor, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center gap-6 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full inline-block" style={{ backgroundColor: selectedTest.chartColor }} />
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
            {studentScores.length > 0 && (
              <DistributionCard scores={studentScores} />
            )}
          </motion.div>
        </AnimatePresence>

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
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 grid grid-cols-[2fr_1fr_1fr_1.5fr_0.5fr] gap-4">
                {['שם תלמיד', `ציון — ${selectedTest.label}`, 'מגדר', 'רמת כושר', ''].map((h) => (
                  <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{h}</span>
                ))}
              </div>
              <motion.ul variants={ROW_STAGGER} initial="hidden" animate="show">
                {students.map((student, index) => {
                  const score    = getScore(selectedTestId, index);
                  const level    = gradeLevel(score);
                  const ls       = LEVEL_STYLE[level];
                  const tint     = AVATAR_TINTS[index % AVATAR_TINTS.length]!;
                  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

                  return (
                    <motion.li key={student.id} variants={ROW_ITEM}>
                      <Link
                        href={`/classes/${classId}/student/${student.id}`}
                        className="grid grid-cols-[2fr_1fr_1fr_1.5fr_0.5fr] items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 hover:bg-indigo-50/40 transition-colors group"
                      >
                        {/* Name */}
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tint}`}>{initials}</div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                              {student.firstName} {student.lastName}
                            </div>
                            <code className="font-mono text-xs text-slate-400">{student.studentCode}</code>
                          </div>
                        </div>
                        {/* Score */}
                        <span className={`text-lg font-extrabold ${
                          level === 'excellent' ? 'text-emerald-600' :
                          level === 'good'      ? 'text-blue-600' :
                          level === 'pass'      ? 'text-amber-600' : 'text-red-600'
                        }`}>{score}</span>
                        {/* Gender */}
                        <span className="text-xs text-slate-500">{GENDER_LABELS[student.gender]}</span>
                        {/* Badge */}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ls.bg} ${ls.text} ${ls.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ls.dot}`} />
                          {ls.label}
                        </span>
                        {/* Arrow */}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
                      </Link>
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
    </AnimatePresence>
  );
}
