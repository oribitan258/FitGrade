'use client';

import { ErrorView } from '@/components/ui/error-view';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary — catches any unhandled throw that reaches the app
 * root without a closer error.tsx. All text in Hebrew. (STAB-001)
 */
export default function RootError({ reset }: ErrorProps): React.JSX.Element {
  return (
    <ErrorView
      reset={reset}
      escape={{ label: 'עמוד הכניסה', href: '/login' }}
    />
  );
}
