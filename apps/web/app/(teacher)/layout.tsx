'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Award, BarChart2, BookOpen, CalendarDays, Dumbbell,
  Flame, Heart, LayoutDashboard, Layers, LogOut, Medal, Shield,
  Star, Swords, Target, Timer, TrendingUp, Trophy, Users, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getToken, logout } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

// ─── Neon glow filters ─────────────────────────────────────────────────────────

const GLOW_VIOLET = 'drop-shadow(0 0 10px rgba(139,92,246,0.65))';
const GLOW_FUCHSIA = 'drop-shadow(0 0 10px rgba(217,70,239,0.55))';
const GLOW_INDIGO  = 'drop-shadow(0 0 10px rgba(99,102,241,0.60))';

// ─── Floating background icons (33 entries) ─────────────────────────────────

const FLOATING_ICONS = [
  { icon: Dumbbell,   top: '5%',  left: '4%',  size: 32, delay: 0,   dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Target,     top: '12%', left: '83%', size: 24, delay: 1.2, dur: 10, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Timer,      top: '26%', left: '10%', size: 22, delay: 2.4, dur: 9,  op: 0.42, glow: GLOW_VIOLET  },
  { icon: Activity,   top: '42%', left: '89%', size: 28, delay: 0.8, dur: 11, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Award,      top: '56%', left: '4%',  size: 24, delay: 3.0, dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Trophy,     top: '68%', left: '78%', size: 30, delay: 1.6, dur: 12, op: 0.40, glow: GLOW_FUCHSIA },
  { icon: Users,      top: '82%', left: '18%', size: 26, delay: 2.0, dur: 9,  op: 0.42, glow: GLOW_INDIGO  },
  { icon: Zap,        top: '20%', left: '53%', size: 20, delay: 0.4, dur: 10, op: 0.42, glow: GLOW_VIOLET  },
  { icon: BookOpen,   top: '48%', left: '42%', size: 24, delay: 2.8, dur: 13, op: 0.38, glow: GLOW_FUCHSIA },
  { icon: Dumbbell,   top: '74%', left: '52%', size: 22, delay: 1.0, dur: 11, op: 0.42, glow: GLOW_VIOLET  },
  { icon: Target,     top: '34%', left: '72%', size: 20, delay: 3.5, dur: 8,  op: 0.40, glow: GLOW_INDIGO  },
  { icon: Activity,   top: '90%', left: '67%', size: 28, delay: 0.6, dur: 9,  op: 0.40, glow: GLOW_VIOLET  },
  { icon: Flame,      top: '8%',  left: '43%', size: 22, delay: 1.8, dur: 10, op: 0.45, glow: GLOW_FUCHSIA },
  { icon: Heart,      top: '38%', left: '26%', size: 18, delay: 0.9, dur: 11, op: 0.38, glow: GLOW_INDIGO  },
  { icon: Star,       top: '62%', left: '34%', size: 20, delay: 2.2, dur: 9,  op: 0.40, glow: GLOW_VIOLET  },
  { icon: Medal,      top: '16%', left: '64%', size: 24, delay: 3.2, dur: 10, op: 0.42, glow: GLOW_FUCHSIA },
  { icon: Trophy,     top: '78%', left: '8%',  size: 18, delay: 1.4, dur: 8,  op: 0.38, glow: GLOW_VIOLET  },
  { icon: Zap,        top: '88%', left: '43%', size: 26, delay: 0.2, dur: 12, op: 0.42, glow: GLOW_INDIGO  },
  { icon: Flame,      top: '52%', left: '60%', size: 16, delay: 2.6, dur: 10, op: 0.36, glow: GLOW_FUCHSIA },
  { icon: Star,       top: '30%', left: '37%', size: 14, delay: 1.5, dur: 11, op: 0.36, glow: GLOW_VIOLET  },
  { icon: TrendingUp, top: '7%',  left: '25%', size: 20, delay: 0.7, dur: 9,  op: 0.40, glow: GLOW_INDIGO  },
  { icon: BarChart2,  top: '45%', left: '15%', size: 22, delay: 3.8, dur: 11, op: 0.38, glow: GLOW_VIOLET  },
  { icon: Shield,     top: '72%', left: '35%', size: 26, delay: 1.3, dur: 10, op: 0.40, glow: GLOW_FUCHSIA },
  { icon: Layers,     top: '18%', left: '75%', size: 18, delay: 2.9, dur: 8,  op: 0.36, glow: GLOW_INDIGO  },
  { icon: Swords,     top: '85%', left: '55%', size: 24, delay: 0.5, dur: 13, op: 0.40, glow: GLOW_VIOLET  },
  { icon: Users,      top: '40%', left: '95%', size: 20, delay: 2.1, dur: 9,  op: 0.38, glow: GLOW_FUCHSIA },
  { icon: Award,      top: '95%', left: '28%', size: 22, delay: 1.7, dur: 11, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Heart,      top: '58%', left: '82%', size: 16, delay: 3.3, dur: 10, op: 0.36, glow: GLOW_VIOLET  },
  { icon: Medal,      top: '25%', left: '48%', size: 20, delay: 0.3, dur: 8,  op: 0.38, glow: GLOW_FUCHSIA },
  { icon: BookOpen,   top: '65%', left: '72%', size: 18, delay: 2.5, dur: 12, op: 0.36, glow: GLOW_INDIGO  },
  { icon: Timer,      top: '3%',  left: '62%', size: 24, delay: 4.0, dur: 9,  op: 0.40, glow: GLOW_VIOLET  },
  { icon: TrendingUp, top: '92%', left: '88%', size: 18, delay: 1.1, dur: 11, op: 0.36, glow: GLOW_FUCHSIA },
  { icon: Layers,     top: '55%', left: '28%', size: 14, delay: 3.6, dur: 10, op: 0.34, glow: GLOW_VIOLET  },
] as const;

// ─── Mobile Bottom Navigation ─────────────────────────────────────────────────

const BOTTOM_NAV = [
  { href: '/dashboard', label: 'ראשי',  icon: LayoutDashboard },
  { href: '/classes',   label: 'כיתות', icon: BookOpen        },
  { href: '/schedule',  label: 'מערכת', icon: CalendarDays    },
] as const;

function MobileBottomNav(): React.JSX.Element {
  const pathname = usePathname();
  const router   = useRouter();

  function isActive(href: string): boolean {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-around border-t border-white/20 px-2"
      style={{
        background: '#4c1d95',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
      }}
      aria-label="ניווט תחתון"
      dir="rtl"
    >
      {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2.5 px-1"
            aria-current={active ? 'page' : undefined}
          >
            <motion.div
              whileTap={{ scale: 0.85 }}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200',
                active ? 'bg-white/20 shadow-[0_2px_10px_rgba(167,139,250,0.40)]' : 'bg-transparent',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors duration-200',
                  active ? 'text-[#e9d5ff]' : 'text-[#c4b5fd]/60',
                )}
                aria-hidden="true"
              />
            </motion.div>
            <span className={cn(
              'text-[10px] font-semibold pb-1 transition-colors duration-200',
              active ? 'text-[#e9d5ff]' : 'text-[#c4b5fd]/60',
            )}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Logout */}
      <button
        type="button"
        onClick={() => { void handleLogout(); }}
        className="flex flex-1 flex-col items-center gap-0.5 pt-2.5 px-1"
        aria-label="התנתק מהמערכת"
      >
        <motion.div
          whileTap={{ scale: 0.85 }}
          className="flex h-9 w-9 items-center justify-center rounded-2xl bg-transparent"
        >
          <LogOut className="h-5 w-5 text-[#c4b5fd]/60" aria-hidden="true" />
        </motion.div>
        <span className="text-[10px] font-semibold pb-1 text-[#c4b5fd]/60">יציאה</span>
      </button>
    </nav>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────────

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
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0e9ff 50%, #e4d4ff 100%)' }}
      >
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-violet-300/40">
          <motion.div
            className="h-full rounded-full bg-violet-500"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden overflow-x-hidden">
      {/* ── Light lavender gradient background ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0e9ff 50%, #e4d4ff 100%)' }}
        aria-hidden="true"
      >
        {/* Animated color blobs — softer on the light bg */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 560, height: 560, top: '-10%', left: '-8%', background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.12, 1], x: [0, 18, 0], y: [0, -12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: 420, height: 420, top: '30%', left: '60%', background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.08, 1], x: [0, -22, 0], y: [0, 16, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: 480, height: 480, top: '60%', left: '10%', background: 'radial-gradient(circle, rgba(196,181,253,0.40) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], x: [0, 14, 0], y: [0, -18, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: 320, height: 320, top: '10%', left: '75%', background: 'radial-gradient(circle, rgba(221,214,254,0.50) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.10, 1], x: [0, -10, 0], y: [0, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ width: 400, height: 400, top: '75%', left: '55%', background: 'radial-gradient(circle, rgba(167,139,250,0.30) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.06, 1], x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        {/* Glowing floating fitness icons */}
        {FLOATING_ICONS.map(({ icon: Icon, top, left, size, delay, dur, op, glow }, i) => (
          <motion.div
            key={i}
            className="absolute text-violet-500"
            style={{ top, left, opacity: op, filter: glow }}
            animate={{ y: [0, -16, 0], rotate: [0, 8, 0] }}
            transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay }}
          >
            <Icon style={{ width: size, height: size }} aria-hidden="true" />
          </motion.div>
        ))}
      </div>

      {/* Sidebar — desktop only */}
      <div className="relative z-10 flex-shrink-0 hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
