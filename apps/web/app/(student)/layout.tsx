'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { getToken, logout, silentRefresh } from '@/lib/api-client';
import { SplashScreen } from '@/components/ui/splash-screen';

/**
 * Student shell layout — glassmorphic top-nav, animated gradient background.
 *
 * Guards all /student routes: redirects to /student-login if no access
 * token is found in localStorage. Shows a loading state while checking
 * to prevent a flash of the protected UI.
 *
 * RTL: uses logical Tailwind properties (ps-/pe-/border-b/text-start/text-end).
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getToken()) {
      setReady(true);
      return;
    }
    void silentRefresh().then((ok) => {
      if (!ok) {
        router.replace('/student-login');
      } else {
        setReady(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.replace('/student-login');
  };

  return (
    <>
      <SplashScreen isLoading={!ready} />

      <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ── Animated gradient background ───────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E0E7FF] via-[#F5F0FF] to-[#D1FAE5]" />
        <motion.div
          className="absolute h-[500px] w-[500px] rounded-full bg-indigo-300/25 blur-[120px]"
          style={{ insetInlineStart: '-100px', top: '-80px' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.85, 0.6] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute h-[400px] w-[400px] rounded-full bg-violet-300/20 blur-[100px]"
          style={{ insetInlineEnd: '60px', top: '120px' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute h-[350px] w-[350px] rounded-full bg-emerald-300/20 blur-[90px]"
          style={{ insetInlineStart: '40%', bottom: '60px' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      {/* ── Top navigation ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-2xl shadow-[0_2px_20px_rgba(99,102,241,0.10)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logout — start side (right in RTL) */}
          <button
            type="button"
            onClick={() => { void handleLogout(); }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="יציאה מהמערכת"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            יציאה
          </button>

          {/* Brand — end side (left in RTL) */}
          <div className="flex items-center gap-2.5">
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_20px_rgba(99,102,241,0.45)]"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
            >
              <GraduationCap className="h-4 w-4 text-white" aria-hidden="true" />
            </motion.div>
            <div className="text-end">
              <span className="text-sm font-bold tracking-tight bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent">FitGrade</span>
              <p className="text-[10px] text-slate-400 leading-none">פורטל תלמיד</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="relative z-10 w-full flex-1">
        {children}
      </main>
    </div>
    </>
  );
}
