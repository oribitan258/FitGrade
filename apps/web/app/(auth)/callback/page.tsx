/**
 * OAuth callback landing page.
 *
 * The backend redirects here after Google OAuth:
 *   GET /auth/callback?token=<accessToken>
 *
 * CallbackHandler (client component) reads the token from the URL,
 * saves it to localStorage, then redirects to /dashboard.
 * It must be wrapped in <Suspense> because useSearchParams() requires it.
 */
import { Suspense } from 'react';
import { CallbackHandler } from './callback-handler';

export default function CallbackPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={<p className="text-muted-foreground">מתחבר...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
