'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GraduationCap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest, setToken } from '@/lib/api-client';
import { ApiError } from '@fitgrade/types';

// ─── Validation schema ────────────────────────────────────────────────────────

const studentLoginSchema = z.object({
  classCode: z.string().min(1, 'קוד הכיתה חובה'),
  studentCode: z.string().min(1, 'קוד התלמיד חובה'),
  password: z.string().min(1, 'סיסמה חובה'),
});

type StudentLoginInput = z.infer<typeof studentLoginSchema>;

interface AuthResponse {
  accessToken: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentLoginPage(): React.JSX.Element {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentLoginInput>({
    resolver: zodResolver(studentLoginSchema),
  });

  const onSubmit = async (data: StudentLoginInput): Promise<void> => {
    setServerError(null);
    try {
      const response = await apiRequest<AuthResponse>('/auth/student', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setToken(response.accessToken);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setServerError('קוד הכיתה, קוד התלמיד או הסיסמה שגויים');
      } else {
        setServerError('שגיאת שרת. נסה שוב.');
      }
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">FitGrade</CardTitle>
          <CardDescription>כניסה לתלמידים</CardDescription>
        </CardHeader>

        <CardContent>
          {serverError !== null && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="classCode">קוד הכיתה</Label>
              <Input
                id="classCode"
                type="text"
                autoComplete="off"
                placeholder="הזן את קוד הכיתה"
                aria-describedby={errors.classCode ? 'classCode-error' : undefined}
                {...register('classCode')}
              />
              {errors.classCode && (
                <p id="classCode-error" className="text-sm text-destructive">
                  {errors.classCode.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="studentCode">קוד תלמיד</Label>
              <Input
                id="studentCode"
                type="text"
                autoComplete="username"
                placeholder="הזן את קוד התלמיד"
                aria-describedby={errors.studentCode ? 'studentCode-error' : undefined}
                {...register('studentCode')}
              />
              {errors.studentCode && (
                <p id="studentCode-error" className="text-sm text-destructive">
                  {errors.studentCode.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="הזן סיסמה"
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-12 w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'נכנס...' : 'כניסה'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <a href="/login" className="underline underline-offset-4 hover:text-primary">
              כניסה למורים
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
