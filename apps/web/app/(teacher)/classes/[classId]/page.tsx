'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ClipboardCopy, Plus, UserPlus, Users } from 'lucide-react';
import {
  createStudentSchema,
  type CreateStudentInput,
  type StudentData,
} from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';
import { useClass, useStudents } from '@/hooks/use-classes';
import { apiRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Label maps ──────────────────────────────────────────────────────────────

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
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// ─── Add Student Dialog ──────────────────────────────────────────────────────

interface AddStudentDialogProps {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function AddStudentDialog({
  classId,
  open,
  onOpenChange,
  onSuccess,
}: AddStudentDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CreateStudentInput>({ resolver: zodResolver(createStudentSchema) });

  async function onSubmit(data: CreateStudentInput): Promise<void> {
    try {
      await apiRequest<StudentData>(`/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setError('studentCode', { message: 'קוד תלמיד זה כבר קיים בכיתה' });
      } else {
        setError('root', {
          message: err instanceof ApiError ? err.message : 'שגיאה בהוספת התלמיד',
        });
      }
    }
  }

  function handleClose(next: boolean): void {
    if (!next) reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>הוסף תלמיד לכיתה</DialogTitle>
          <DialogDescription>
            מלא את פרטי התלמיד. כל השדות חובה.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* First name + Last name side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stu-first">שם פרטי</Label>
              <Input
                id="stu-first"
                placeholder="ישראל"
                aria-describedby={errors.firstName ? 'stu-first-err' : undefined}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p id="stu-first-err" className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stu-last">שם משפחה</Label>
              <Input
                id="stu-last"
                placeholder="ישראלי"
                aria-describedby={errors.lastName ? 'stu-last-err' : undefined}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p id="stu-last-err" className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* Date of birth + Gender side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stu-dob">תאריך לידה</Label>
              <Input
                id="stu-dob"
                type="date"
                aria-describedby={errors.dateOfBirth ? 'stu-dob-err' : undefined}
                {...register('dateOfBirth')}
              />
              {errors.dateOfBirth && (
                <p id="stu-dob-err" className="text-sm text-destructive">
                  {errors.dateOfBirth.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stu-gender">מין</Label>
              <select
                id="stu-gender"
                className={cn(SELECT_STYLES)}
                aria-describedby={errors.gender ? 'stu-gender-err' : undefined}
                {...register('gender')}
              >
                <option value="">בחר מין</option>
                <option value="MALE">זכר</option>
                <option value="FEMALE">נקבה</option>
                <option value="OTHER">אחר</option>
              </select>
              {errors.gender && (
                <p id="stu-gender-err" className="text-sm text-destructive">
                  {errors.gender.message}
                </p>
              )}
            </div>
          </div>

          {/* Student code */}
          <div className="space-y-1.5">
            <Label htmlFor="stu-code">קוד תלמיד</Label>
            <Input
              id="stu-code"
              placeholder="301"
              aria-describedby={errors.studentCode ? 'stu-code-err' : undefined}
              {...register('studentCode')}
            />
            {errors.studentCode && (
              <p id="stu-code-err" className="text-sm text-destructive">
                {errors.studentCode.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="stu-pass">סיסמה</Label>
            <Input
              id="stu-pass"
              type="password"
              placeholder="לפחות 8 תווים"
              aria-describedby={errors.password ? 'stu-pass-err' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="stu-pass-err" className="text-sm text-destructive">
                {errors.password.message}
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
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'מוסיף...' : 'הוסף תלמיד'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Student table row ───────────────────────────────────────────────────────

function StudentRow({ student }: { student: StudentData }): React.JSX.Element {
  const dob = new Date(student.dateOfBirth).toLocaleDateString('he-IL');
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium">
        {student.firstName} {student.lastName}
      </td>
      <td className="px-4 py-3 font-mono text-sm">{student.studentCode}</td>
      <td className="px-4 py-3 text-sm">{GENDER_LABELS[student.gender]}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{dob}</td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClassDetailPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: cls, error: classError, isLoading: classLoading } = useClass(classId);
  const { data: students, error: studentsError, isLoading: studentsLoading, mutate: mutateStudents } = useStudents(classId);

  async function copyJoinCode(): Promise<void> {
    if (!cls) return;
    await navigator.clipboard.writeText(cls.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (classLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (classError || !cls) {
    return (
      <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
        לא ניתן לטעון את פרטי הכיתה — נסה לרענן את הדף.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="ניווט עמודים" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/classes" className="hover:text-foreground transition-colors">
          הכיתות שלי
        </Link>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className="text-foreground font-medium">{cls.name}</span>
      </nav>

      {/* Class info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{cls.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {cls.academicYear} &bull; {SEMESTER_LABELS[cls.semester]}
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              <Users className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {cls.studentCount} תלמידים
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">קוד הצטרפות לכיתה:</span>
            <code className="rounded bg-muted px-2.5 py-1 font-mono text-base font-semibold tracking-[0.2em]">
              {cls.joinCode}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void copyJoinCode(); }}
              className="gap-1.5"
              aria-label="העתק קוד הצטרפות"
            >
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? 'הועתק!' : 'העתק'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            תלמידים{students ? ` (${students.length})` : ''}
          </h2>
          <Button onClick={() => setIsAddStudentOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוסף תלמיד
          </Button>
        </div>

        {/* Loading */}
        {studentsLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        )}

        {/* Error */}
        {studentsError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            לא ניתן לטעון את רשימת התלמידים.
          </div>
        )}

        {/* Empty */}
        {!studentsLoading && !studentsError && students?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            <div>
              <p className="font-medium">אין תלמידים רשומים</p>
              <p className="mt-1 text-sm text-muted-foreground">לחץ &ldquo;הוסף תלמיד&rdquo; כדי להוסיף את התלמיד הראשון</p>
            </div>
          </div>
        )}

        {/* Student table */}
        {!studentsLoading && students && students.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">שם</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">קוד תלמיד</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">מין</th>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">תאריך לידה</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <StudentRow key={student.id} student={student} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student dialog */}
      <AddStudentDialog
        classId={classId}
        open={isAddStudentOpen}
        onOpenChange={setIsAddStudentOpen}
        onSuccess={() => { void mutateStudents(); }}
      />
    </div>
  );
}
