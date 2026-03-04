'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, ChevronLeft, Plus, Users } from 'lucide-react';
import { createClassSchema, type CreateClassInput, type ClassData } from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Label maps ─────────────────────────────────────────────────────────────

const SEMESTER_LABELS: Record<'A' | 'B', string> = {
  A: "סמסטר א'",
  B: "סמסטר ב'",
};

/** Tailwind classes for native <select> elements — matches Input styling. */
const SELECT_STYLES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>הוסף כיתה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cls-name">שם הכיתה</Label>
            <Input
              id="cls-name"
              placeholder="כיתה י' 1"
              aria-describedby={errors.name ? 'cls-name-err' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="cls-name-err" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Academic Year */}
          <div className="space-y-1.5">
            <Label htmlFor="cls-year">שנת לימודים</Label>
            <Input
              id="cls-year"
              placeholder="2024-2025"
              aria-describedby={errors.academicYear ? 'cls-year-err' : undefined}
              {...register('academicYear')}
            />
            {errors.academicYear && (
              <p id="cls-year-err" className="text-sm text-destructive">
                {errors.academicYear.message}
              </p>
            )}
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
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
              <p id="cls-semester-err" className="text-sm text-destructive">
                {errors.semester.message}
              </p>
            )}
          </div>

          {/* API-level error */}
          {errors.root && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleClose(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'יוצר...' : 'צור כיתה'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Class Card ──────────────────────────────────────────────────────────────

function ClassCard({ cls }: { cls: ClassData }): React.JSX.Element {
  return (
    <Link
      href={`/classes/${cls.id}`}
      className="group block rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-snug">{cls.name}</CardTitle>
            <Badge variant="secondary" className="shrink-0">
              {SEMESTER_LABELS[cls.semester]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{cls.academicYear}</p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Join code */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">קוד הצטרפות:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tracking-widest">
              {cls.joinCode}
            </code>
          </div>

          {/* Student count */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>{cls.studentCount} תלמידים</span>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-1 text-sm font-medium text-primary">
            <span>פרטי כיתה</span>
            {/* ChevronLeft: in RTL this arrow points toward start (right), indicating navigation */}
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClassesPage(): React.JSX.Element {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: classes, error, isLoading, mutate } = useClasses();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">הכיתות שלי</h1>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוסף כיתה
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          לא ניתן לטעון את הכיתות — נסה לרענן את הדף.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && classes?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          <div>
            <p className="font-medium">אין כיתות עדיין</p>
            <p className="mt-1 text-sm text-muted-foreground">
              לחץ על &ldquo;הוסף כיתה&rdquo; כדי להתחיל
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוסף כיתה ראשונה
          </Button>
        </div>
      )}

      {/* Classes grid */}
      {!isLoading && classes && classes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}

      {/* Create Class dialog */}
      <CreateClassDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => { void mutate(); }}
      />
    </div>
  );
}
