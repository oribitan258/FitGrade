'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getToken, logout } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

/**
 * Student shell layout.
 *
 * Guards all /student routes: redirects to /student-login if no access
 * token is found in localStorage. Shows a loading state while checking
 * to prevent a flash of the protected UI.
 *
 * RTL: uses logical Tailwind properties (ps-/pe-, border-b, text-start).
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/student-login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.replace('/student-login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-indigo-50/10 to-white">
      {/* Student header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => void handleLogout()}
            aria-label="יציאה מהמערכת"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            יציאה
          </Button>

          <div className="flex items-center gap-2 text-start">
            <span className="text-sm font-medium text-muted-foreground">תלמיד</span>
            <span className="text-lg font-bold">FitGrade</span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
