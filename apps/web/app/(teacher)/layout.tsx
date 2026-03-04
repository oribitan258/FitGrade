'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/sidebar';

/**
 * Teacher shell layout.
 *
 * Guards all /teacher routes: redirects to /login if no access token is
 * found in localStorage. Shows a loading state while checking to avoid
 * a flash of the protected UI.
 *
 * Layout (RTL): sidebar renders on the right (first flex child in dir="rtl"),
 * main content occupies the remaining width on the left.
 */
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
