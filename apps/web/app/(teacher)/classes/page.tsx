'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, ChevronLeft, Hash, Plus, Users } from 'lucide-react';
import { createClassSchema, type CreateClassInput, type ClassData } from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Animation presets ───────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const KINETIC_CARD = {
  hidden: { opacity: 0, y: 32, rotateX: 9, scale: 0.97 },
  show: {
    opacity: 1, y: 0, rotateX: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 280, damping: 26 },
  },
};

const staggerGrid = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ─── Label maps ──────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

const SELECT_STYLES =
  'flex h-11 w-full rounded-xl border border-input bg-white/50 backdrop-blur-sm px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Cycling glassmorphic accent configs for class cards */
const CLASS_ACCENTS = [
  {
    stripe:  'from-indigo-400 to-violet-500',
    cardBg:  'bg-indigo-50/80',
    glow:    '0 0 40px rgba(99,102,241,0.18), 0 8px 28px rgba(15,23,42,0.10)',
    icon:    'bg-indigo-500/15 text-indigo-600',
    tag:     'bg-indigo-100/80 text-indigo-700 border border-indigo-200/50',
    code:    'bg-white/50 text-indigo-800 border border-indigo-200/30',
    title:   'text-indigo-950',
    sub:     'text-indigo-600/70',
    arrow:   'text-indigo-300 group-hover:text-indigo-600',
  },
  {
    stripe:  'from-teal-400 to-cyan-500',
    cardBg:  'bg-teal-50/80',
    glow:    '0 0 40px rgba(20,184,166,0.18), 0 8px 28px rgba(15,23,42,0.10)',
    icon:    'bg-teal-500/15 text-teal-600',
    tag:     'bg-teal-100/80 text-teal-700 border border-teal-200/50',
    code:    'bg-white/50 text-teal-800 border border-teal-200/30',
    title:   'text-teal-950',
    sub:     'text-teal-600/70',
    arrow:   'text-teal-300 group-hover:text-teal-600',
  },
  {
    stripe:  'from-violet-400 to-purple-500',
    cardBg:  'bg-violet-50/80',
    glow:    '0 0 40px rgba(139,92,246,0.18), 0 8px 28px rgba(15,23,42,0.10)',
    icon:    'bg-violet-500/15 text-violet-600',
    tag:     'bg-violet-100/80 text-violet-700 border border-violet-200/50',
    code:    'bg-white/50 text-violet-800 border border-violet-200/30',
    title:   'text-violet-950',
    sub:     'text-violet-600/70',
    arrow:   'text-violet-300 group-hover:text-violet-600',
  },
  {
    stripe:  'from-emerald-400 to-teal-500',
    cardBg:  'bg-emerald-50/80',
    glow:    '0 0 40px rgba(52,211,153,0.18), 0 8px 28px rgba(15,23,42,0.10)',
    icon:    'bg-emerald-500/15 text-emerald-600',
    tag:     'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50',
    code:    'bg-white/50 text-emerald-800 border border-emerald-200/30',
    title:   'text-emerald-950',
    sub:     'text-emerald-600/70',
    arrow:   'text-emerald-300 group-hover:text-emerald-600',
  },
  {
    stripe:  'from-sky-400 to-blue-500',
    cardBg:  'bg-sky-50/80',
    glow:    '0 0 40px rgba(56,189,248,0.18), 0 8px 28px rgba(15,23,42,0.10)',
    icon:    'bg-sky-500/15 text-sky-600',
    tag:     'bg-sky-100/80 text-sky-700 border border-sky-200/50',
    code:    'bg-white/50 text-sky-800 border border-sky-200/30',
    title:   'text-sky-950',
    sub:     'text-sky-600/70',
    arrow:   'text-sky-300 group-hover:text-sky-600',
  },
] as const;

// ─── Create Class Dialog ─────────────────────────────────────────────────────

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function CreateClassDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateClassDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CreateClassInput>({ resolver: zodResolver(createClassSchema) });

  async function onSubmit(data: CreateClassInput): Promise<void> {
    try {
      await apiRequest<ClassData>('/classes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'שגיאה ביצירת הכיתה',
      });
    }
  }

  function handleClose(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.20)]">
        <DialogHeader>
          <DialogTitle className="text-indigo-950">הוסף כיתה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cls-name" className="text-slate-700 font-medium">שם הכיתה</Label>
            <Input
              id="cls-name"
              placeholder="כיתה י' 1"
              className="h-11 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm"
              aria-describedby={errors.name ? 'cls-name-err' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="cls-name-err" className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cls-year" className="text-slate-700 font-medium">שנת לימודים</Label>
            <Input
              id="cls-year"
              placeholder="2024-2025"
              className="h-11 rounded-xl border-slate-200 bg-white/60 backdrop-blur-sm"
              aria-describedby={errors.academicYear ? 'cls-year-err' : undefined}
              {...register('academicYear')}
            />
            {errors.academicYear && (
              <p id="cls-year-err" className="text-sm text-destructive">{errors.academicYear.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cls-semester" className="text-slate-700 font-medium">סמסטר</Label>
            <select
              id="cls-semester"
              className={cn(SELECT_STYLES)}
              aria-describedby={errors.semester ? 'cls-semester-err' : undefined}
              {...register('semester')}
            >
              <option value="">בחר סמסטר</option>
              <option value="A">סמסטר א'</option>
              <option value="B">סמסטר ב'</option>
            </select>
            {errors.semester && (
              <p id="cls-semester-err" className="text-sm text-destructive">{errors.semester.message}</p>
            )}
          </div>

          {errors.root && (
            <p className="rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200/50 px-3 py-2 text-sm text-red-700">
              {errors.root.message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleClose(false)}
              className="rounded-xl"
            >
              ביטול
            </Button>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-indigo-600/90 backdrop-blur-sm hover:bg-indigo-600 shadow-[0_4px_18px_rgba(99,102,241,0.45)]"
              >
                {isSubmitting ? 'יוצר...' : 'צור כיתה'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Class Card ───────────────────────────────────────────────────────────────

function ClassCard({ cls, index }: { cls: ClassData; index: number }): React.JSX.Element {
  const accent = CLASS_ACCENTS[index % CLASS_ACCENTS.length]!;

  return (
    <motion.div
      variants={KINETIC_CARD}
      style={{ perspective: 1200 }}
      whileHover={{
        y: -5,
        scale: 1.015,
        boxShadow: accent.glow,
        transition: { type: 'spring', stiffness: 300, damping: 22 },
      }}
      whileTap={{ scale: 0.98, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
    >
      <Link
        href={`/classes/${cls.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-2xl"
      >
        <div
          className={`group relative overflow-hidden rounded-2xl backdrop-blur-3xl border border-white/80 ring-1 ring-white/25 cursor-pointer transition-shadow duration-300 ${accent.cardBg}`}
          style={{ boxShadow: '0 8px 28px rgba(15,23,42,0.10)' }}
        >
          {/* Accent top stripe */}
          <div className={`h-1 w-full bg-gradient-to-r ${accent.stripe}`} />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <motion.div
                className={`p-2.5 rounded-xl ${accent.icon}`}
                whileHover={{ rotate: 8, scale: 1.1 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
              </motion.div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${accent.tag}`}>
                {SEMESTER_LABELS[cls.semester]}
              </span>
            </div>

            {/* Title */}
            <h3 className={`font-bold text-base mb-0.5 ${accent.title}`}>{cls.name}</h3>
            <p className={`text-xs mb-4 ${accent.sub}`}>{cls.academicYear}</p>

            {/* Join code capsule */}
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-3 h-3 text-slate-400" aria-hidden="true" />
              <code className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold tracking-widest ${accent.code}`}>
                {cls.joinCode}
              </code>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-600">{cls.studentCount} תלמידים</span>
              </div>
              <ChevronLeft className={`w-4 h-4 transition-colors ${accent.arrow}`} aria-hidden="true" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassesPage(): React.JSX.Element {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: classes, error, isLoading, mutate } = useClasses();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="classes"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.5 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06, ease: EASE, duration: 0.5 }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-l from-indigo-700 to-violet-700 bg-clip-text text-transparent">
              הכיתות שלי
            </h1>
            <p className="text-indigo-700/60 mt-1 text-sm">נהל את כיתותיך ועקוב אחר התלמידים</p>
          </motion.div>

          <motion.button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, ease: EASE, duration: 0.45 }}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.40)', transition: { type: 'spring', stiffness: 400, damping: 25 } }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600/90 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(99,102,241,0.45)] hover:bg-indigo-600 transition-colors"
            aria-label="הוסף כיתה חדשה"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוסף כיתה
          </motion.button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-52 animate-pulse rounded-2xl bg-white/60 shadow-[0_2px_16px_rgba(15,23,42,0.06)]" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl bg-red-50/80 backdrop-blur-sm border border-red-200/50 px-4 py-3 text-sm text-red-600">
            לא ניתן לטעון את הכיתות — נסה לרענן את הדף.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && classes?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ease: EASE, duration: 0.5 }}
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/60 bg-white/60 backdrop-blur-2xl py-20 text-center shadow-[0_8px_28px_rgba(15,23,42,0.10)] ring-1 ring-white/20"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100/80"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BookOpen className="h-8 w-8 text-indigo-400" aria-hidden="true" />
            </motion.div>
            <div>
              <p className="font-semibold text-slate-700">אין כיתות עדיין</p>
              <p className="mt-1 text-sm text-slate-400">לחץ על &ldquo;הוסף כיתה&rdquo; כדי להתחיל</p>
            </div>
            <motion.button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.40)', transition: { type: 'spring', stiffness: 400, damping: 25 } }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600/90 backdrop-blur-sm px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_18px_rgba(99,102,241,0.45)] hover:bg-indigo-600 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              הוסף כיתה ראשונה
            </motion.button>
          </motion.div>
        )}

        {/* Classes grid */}
        {!isLoading && classes && classes.length > 0 && (
          <motion.div
            variants={staggerGrid}
            initial="hidden"
            animate="show"
            style={{ perspective: 1200 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {classes.map((cls, i) => (
              <ClassCard key={cls.id} cls={cls} index={i} />
            ))}
          </motion.div>
        )}

        {/* Create Class dialog */}
        <CreateClassDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => { void mutate(); }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
