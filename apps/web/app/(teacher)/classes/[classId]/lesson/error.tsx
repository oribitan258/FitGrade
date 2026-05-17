'use client';

import { ErrorView } from '@/components/ui/error-view';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Lesson-page error boundary — covers attendance marking and injury toggle.
 * Attendance records are persisted per-action so a crash does not lose
 * already-saved marks. (STAB-001)
 */
export default function LessonError({ reset }: ErrorProps): React.JSX.Element {
  return (
    <ErrorView
      reset={reset}
      detail="אירעה שגיאה בדף השיעור. נוכחות שסומנה כבר נשמרה — לחץ 'נסה שוב' כדי להמשיך."
      escape={{ label: 'חזרה לכיתה', href: '../' }}
    />
  );
}
