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

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE, duration: 0.55 },
  },
};

const staggerGrid = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// ─── Label maps ──────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

const SELECT_STYLES =
  'flex h-11 w-full rounded-xl border border-input bg-slate-50/80 px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Cycling accents — cool professional family only (no rainbow) */
const CLASS_ACCENTS = [
  {
    icon: 'bg-indigo-50', iconText: 'text-indigo-600',
    stripe: 'from-indigo-600 to-indigo-700',
    code: 'bg-indigo-50 text-indigo-700',
    tag: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: 'bg-blue-50',   iconText: 'text-blue-600',
    stripe: 'from-blue-600 to-blue-700',
    code: 'bg-blue-50 text-blue-700',
    tag: 'bg-blue-50 text-blue-600',
  },
  {
    icon: 'bg-violet-50', iconText: 'text-violet-600',
    stripe: 'from-violet-600 to-violet-700',
    code: 'bg-violet-50 text-violet-700',
    tag: 'bg-violet-50 text-violet-600',
  },
  {
    icon: 'bg-slate-100', iconText: 'text-slate-600',
    stripe: 'from-slate-600 to-slate-700',
    code: 'bg-slate-100 text-slate-700',
    tag: 'bg-slate-100 text-slate-600',
  },
  {
    icon: 'bg-cyan-50',   iconText: 'text-cyan-700',
    stripe: 'from-cyan-700 to-cyan-800',
    code: 'bg-cyan-50 text-cyan-800',
    tag: 'bg-cyan-50 text-cyan-700',
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
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>הוסף כיתה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <motion.div className="space-y-1.5" whileHover={{ y: -1, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}>
            <Label htmlFor="cls-name">שם הכיתה</Label>
            <Input
              id="cls-name"
              placeholder="כיתה י' 1"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80"
              aria-describedby={errors.name ? 'cls-name-err' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="cls-name-err" className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </motion.div>

          <motion.div className="space-y-1.5" whileHover={{ y: -1, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}>
            <Label htmlFor="cls-year">שנת לימודים</Label>
            <Input
              id="cls-year"
              placeholder="2024-2025"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/80"
              aria-describedby={errors.academicYear ? 'cls-year-err' : undefined}
              {...register('academicYear')}
            />
            {errors.academicYear && (
              <p id="cls-year-err" className="text-sm text-destructive">{errors.academicYear.message}</p>
            )}
          </motion.div>

          <motion.div className="space-y-1.5" whileHover={{ y: -1, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}>
            <Label htmlFor="cls-semester">סמסטר</Label>
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
          </motion.div>

          {errors.root && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
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
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm"
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
  const accent = CLASS_ACCENTS[index % CLASS_ACCENTS.length];

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.35 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={`/classes/${cls.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-3xl"
      >
        <div className="group relative overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.07)] hover:shadow-[0_8px_32px_rgba(15,23,42,0.12)] transition-shadow duration-300 cursor-pointer">
          {/* Coloured top stripe */}
          <div className={`h-1.5 w-full bg-gradient-to-r ${accent.stripe}`} />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${accent.icon}`}>
                <BookOpen className={`w-4 h-4 ${accent.iconText}`} aria-hidden="true" />
              </div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${accent.tag}`}>
                {SEMESTER_LABELS[cls.semester]}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-bold text-slate-800 text-base mb-0.5">{cls.name}</h3>
            <p className="text-xs text-slate-400 mb-4">{cls.academicYear}</p>

            {/* Join code capsule */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1 rounded-md bg-slate-100">
                <Hash className="w-3 h-3 text-slate-400" aria-hidden="true" />
              </div>
              <code className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold tracking-widest ${accent.code}`}>
                {cls.joinCode}
              </code>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-slate-100">
                  <Users className="w-3 h-3 text-slate-400" aria-hidden="true" />
                </div>
                <span className="text-xs text-slate-500 font-medium">{cls.studentCount} תלמידים</span>
              </div>
              <ChevronLeft
                className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors"
                aria-hidden="true"
              />
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08, ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
          >
            <h1 className="text-3xl font-bold text-slate-800">הכיתות שלי</h1>
            <p className="text-slate-500 mt-1 text-sm">נהל את כיתותיך ועקוב אחר התלמידים</p>
          </motion.div>

          <motion.button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
            whileHover={{ y: -2, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
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
              <div key={n} className="h-52 animate-pulse rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-3xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            לא ניתן לטעון את הכיתות — נסה לרענן את הדף.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && classes?.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
            className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/60 py-20 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 shadow-sm">
              <BookOpen className="h-8 w-8 text-violet-400" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">אין כיתות עדיין</p>
              <p className="mt-1 text-sm text-slate-400">לחץ על &ldquo;הוסף כיתה&rdquo; כדי להתחיל</p>
            </div>
            <motion.button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              whileHover={{ y: -2, transition: { ease: [0.22, 1, 0.36, 1], duration: 0.3 } }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
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
