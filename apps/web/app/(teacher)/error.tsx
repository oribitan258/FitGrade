'use client';

import { ErrorView } from '@/components/ui/error-view';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Teacher-shell error boundary — catches unhandled throws in all teacher
 * routes that don't have a closer error.tsx. Offers a "back to dashboard"
 * escape hatch so teachers are never fully stranded. (STAB-001)
 */
export default function TeacherError({ reset }: ErrorProps): React.JSX.Element {
  return (
    <ErrorView
      reset={reset}
      escape={{ label: 'חזרה לדשבורד', href: '/dashboard' }}
    />
  );
}
