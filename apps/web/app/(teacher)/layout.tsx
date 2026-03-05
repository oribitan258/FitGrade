'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Award, BookOpen, CalendarDays, Dumbbell, LayoutDashboard, LogOut, Target, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getToken, logout } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

// ─── Individual floating icons ────────────────────────────────────────────────
// 18 icons spread across three horizontal bands.
// Each icon independently: spins 360° (linear), drifts large x/y (easeInOut).
// Two color families — indigo/violet + emerald/teal — mirror the bg gradient.

type IconComponent = typeof Dumbbell;

interface FloatingIcon {
  readonly Icon: IconComponent;
  readonly style: React.CSSProperties;
  /** y-float peak distance in px */
  readonly yAmp: number;
  /** x-drift peak distance in px */
  readonly xAmp: number;
  /** base duration for y-float; spin = ×3, x-drift = ×1.3 */
  readonly duration: number;
}

const FLOATING_ICONS: FloatingIcon[] = [
  // ── Top band (top 2–18%) ─────────────────────────────────────────────────
  { Icon: Dumbbell, style: { top: '4%',  insetInlineStart: '4%',  width: 44, color: '#6366f1', opacity: 0.28 }, yAmp: 52, xAmp: 32, duration: 9  },
  { Icon: Timer,    style: { top: '3%',  insetInlineEnd:  '6%',   width: 36, color: '#10b981', opacity: 0.26 }, yAmp: 44, xAmp: 38, duration: 11 },
  { Icon: Award,    style: { top: '10%', insetInlineStart: '22%', width: 28, color: '#8b5cf6', opacity: 0.24 }, yAmp: 40, xAmp: 28, duration: 14 },
  { Icon: Target,   style: { top: '8%',  insetInlineEnd:  '24%',  width: 34, color: '#34d399', opacity: 0.22 }, yAmp: 48, xAmp: 30, duration: 10 },
  { Icon: Activity, style: { top: '16%', insetInlineStart: '50%', width: 26, color: '#6366f1', opacity: 0.20 }, yAmp: 36, xAmp: 22, duration: 16 },
  // ── Upper-mid band (top 28–42%) ──────────────────────────────────────────
  { Icon: Timer,    style: { top: '30%', insetInlineStart: '2%',  width: 48, color: '#34d399', opacity: 0.25 }, yAmp: 58, xAmp: 26, duration: 12 },
  { Icon: Dumbbell, style: { top: '28%', insetInlineEnd:  '3%',   width: 32, color: '#8b5cf6', opacity: 0.22 }, yAmp: 50, xAmp: 34, duration: 8  },
  { Icon: Award,    style: { top: '38%', insetInlineStart: '35%', width: 24, color: '#10b981', opacity: 0.18 }, yAmp: 34, xAmp: 20, duration: 18 },
  { Icon: Target,   style: { top: '36%', insetInlineEnd:  '30%',  width: 40, color: '#6366f1', opacity: 0.20 }, yAmp: 46, xAmp: 30, duration: 13 },
  // ── Lower-mid band (top 50–65%) ──────────────────────────────────────────
  { Icon: Activity, style: { top: '52%', insetInlineStart: '8%',  width: 38, color: '#6366f1', opacity: 0.24 }, yAmp: 50, xAmp: 28, duration: 10 },
  { Icon: Dumbbell, style: { top: '56%', insetInlineEnd:  '9%',   width: 30, color: '#34d399', opacity: 0.22 }, yAmp: 42, xAmp: 36, duration: 15 },
  { Icon: Timer,    style: { top: '62%', insetInlineStart: '46%', width: 22, color: '#8b5cf6', opacity: 0.18 }, yAmp: 32, xAmp: 18, duration: 20 },
  { Icon: Award,    style: { top: '60%', insetInlineEnd:  '44%',  width: 34, color: '#10b981', opacity: 0.20 }, yAmp: 44, xAmp: 26, duration: 11 },
  // ── Bottom band (top 72–90%) ─────────────────────────────────────────────
  { Icon: Target,   style: { top: '74%', insetInlineStart: '5%',  width: 46, color: '#8b5cf6', opacity: 0.26 }, yAmp: 54, xAmp: 24, duration: 9  },
  { Icon: Activity, style: { top: '76%', insetInlineEnd:  '7%',   width: 36, color: '#6366f1', opacity: 0.24 }, yAmp: 48, xAmp: 32, duration: 12 },
  { Icon: Dumbbell, style: { top: '84%', insetInlineStart: '30%', width: 28, color: '#34d399', opacity: 0.20 }, yAmp: 38, xAmp: 22, duration: 16 },
  { Icon: Timer,    style: { top: '82%', insetInlineEnd:  '28%',  width: 42, color: '#10b981', opacity: 0.22 }, yAmp: 50, xAmp: 28, duration: 10 },
  { Icon: Award,    style: { top: '88%', insetInlineStart: '62%', width: 24, color: '#8b5cf6', opacity: 0.18 }, yAmp: 36, xAmp: 20, duration: 19 },
];

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
      className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-around px-2 safe-pb"
      style={{
        background:           'rgba(255,255,255,0.22)',
        backdropFilter:       'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop:            '1px solid rgba(255,255,255,0.30)',
        boxShadow:            '0 -4px 32px rgba(99,102,241,0.14)',
        paddingBottom:        'max(env(safe-area-inset-bottom), 8px)',
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
                active
                  ? 'bg-indigo-600 shadow-[0_4px_16px_rgba(99,102,241,0.45)]'
                  : 'bg-transparent',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors duration-200',
                  active ? 'text-white' : 'text-slate-500',
                )}
                aria-hidden="true"
              />
            </motion.div>
            <span className={cn(
              'text-[10px] font-semibold pb-1 transition-colors duration-200',
              active ? 'text-indigo-600' : 'text-slate-400',
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
          className="flex h-9 w-9 items-center justify-center rounded-2xl bg-transparent transition-all duration-200"
        >
          <LogOut className="h-5 w-5 text-slate-500" aria-hidden="true" />
        </motion.div>
        <span className="text-[10px] font-semibold pb-1 text-slate-400">יציאה</span>
      </button>
    </nav>
  );
}

/**
 * Teacher shell layout.
 *
 * Architecture:
 *   - A FIXED full-screen background (z-0) holds the purplish-emerald mesh
 *     gradient + individually animated floating icon field.
 *   - Each icon independently spins (360°, linear) while drifting across
 *     large x/y distances (easeInOut, different periods → organic desync).
 *   - Sidebar (z-10, glassmorphic) sits above and reveals the gradient through
 *     its translucent panel.
 *   - Main content (z-10) is transparent between cards, letting the rich
 *     background bleed through gaps for depth.
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full rounded-full bg-indigo-400"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden overflow-x-hidden">
      {/* ── Fixed full-screen background ─────────────────────────────── */}
      <div className="fixed inset-0 z-0 overflow-hidden">

        {/* Base gradient — purplish-emerald mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#C7D2FE] via-[#E9D5FF] to-[#A7F3D0]" />

        {/* Vivid floating colour blobs — indigo + emerald + violet */}
        <motion.div
          className="absolute -top-48 -start-48 h-[40rem] w-[40rem] rounded-full bg-indigo-500/40 blur-3xl"
          animate={{ x: [0, 50, -25, 0], y: [0, -35, 18, 0], scale: [1, 1.10, 0.94, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-52 -end-52 h-[44rem] w-[44rem] rounded-full bg-emerald-400/40 blur-3xl"
          animate={{ x: [0, -38, 26, 0], y: [0, 28, -32, 0], scale: [1, 1.13, 0.92, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 end-1/4 h-96 w-96 rounded-full bg-violet-500/32 blur-3xl"
          animate={{ x: [0, 32, -42, 0], y: [0, -26, 36, 0], scale: [1, 0.90, 1.16, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/4 start-1/3 h-72 w-72 rounded-full bg-teal-400/30 blur-3xl"
          animate={{ x: [0, -20, 34, 0], y: [0, 28, -18, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Extra rose hint for warmth balance */}
        <motion.div
          className="absolute bottom-1/3 start-1/4 h-56 w-56 rounded-full bg-purple-400/22 blur-3xl"
          animate={{ x: [0, 24, -16, 0], y: [0, -20, 28, 0], scale: [1, 1.06, 0.93, 1] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* 18 individually animated floating icons */}
        {FLOATING_ICONS.map(({ Icon, style, yAmp, xAmp, duration }, index) => (
          <motion.div
            key={index}
            className="pointer-events-none absolute"
            style={style}
            animate={{
              rotate: [0, 360],
              y: [0, yAmp, -yAmp * 0.7, yAmp * 0.4, 0],
              x: [0, -xAmp, xAmp * 0.8, -xAmp * 0.3, 0],
            }}
            transition={{
              rotate: { duration: duration * 3, repeat: Infinity, ease: 'linear' },
              y:      { duration, repeat: Infinity, ease: 'easeInOut' },
              x:      { duration: duration * 1.3, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <Icon style={{ width: style.width, height: style.width }} />
          </motion.div>
        ))}
      </div>

      {/* ── Sidebar — desktop only (md+) ──────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 hidden md:flex">
        <Sidebar />
      </div>

      {/* ── Content — transparent to expose background in gaps ─────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      {/* ── Mobile bottom navigation (below md) ───────────────────────── */}
      <MobileBottomNav />
    </div>
  );
}
