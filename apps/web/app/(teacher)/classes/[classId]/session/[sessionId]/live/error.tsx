'use client';

import { ErrorView } from '@/components/ui/error-view';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Live-session error boundary — specialized message reassuring the teacher
 * that already-recorded taps are safely persisted on the server even though
 * the UI crashed. "נסה שוב" re-mounts the live page which will reload all
 * existing results from the API. (STAB-001)
 */
export default function LiveSessionError({ reset }: ErrorProps): React.JSX.Element {
  return (
    <ErrorView
      reset={reset}
      detail="אירעה שגיאה במסך המפגש החי. התוצאות שכבר נרשמו שמורות בשרת — לחץ 'נסה שוב' כדי לחזור למפגש."
      escape={{ label: 'רשימת כיתות', href: '/classes' }}
    />
  );
}
