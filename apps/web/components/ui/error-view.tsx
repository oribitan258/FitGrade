'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ErrorViewProps {
  reset: () => void;
  /** Extra context message — shown below the main heading. */
  detail?: string;
  /** Link label + href for a secondary "go somewhere safe" action. */
  escape?: { label: string; href: string };
}

/**
 * Shared visual shell for all error.tsx boundaries.
 * RTL-safe (logical Tailwind only). All text in Hebrew.
 */
export function ErrorView({ reset, detail, escape }: ErrorViewProps): React.JSX.Element {
  return (
    <div
      dir="rtl"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-slate-800">משהו השתבש</h1>
        <p className="max-w-sm text-sm text-slate-500">
          {detail ?? 'אירעה שגיאה בלתי צפויה. ניתן לנסות שוב או לחזור לדף הבית.'}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          onClick={reset}
          className="min-w-32"
          aria-label="נסה לטעון את הדף מחדש"
        >
          נסה שוב
        </Button>

        {escape && (
          <Button variant="outline" asChild className="min-w-32">
            <Link href={escape.href}>{escape.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
