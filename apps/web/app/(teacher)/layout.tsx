'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Award, BarChart2, BookOpen, CalendarDays, Dumbbell,
  Flame, Heart, LayoutDashboard, Layers, LogOut, Medal, Shield,
  Star, Swords, Target, Timer, TrendingUp, Trophy, Users, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { getToken, logout } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';
import { CopilotTriggerButton } from '@/components/copilot/copilot-trigger-button';
import { CopilotPanel }         from '@/components/copilot/copilot-panel';
import { BeepTestProvider, useBeepTestContext } from '@/contexts/beep-test-context';

// ─── Neon glow filters (used in Mode B / Arena only) ──────────────────────────

const GLOW_VIOLET = 'drop-shadow(0 0 10px rgba(139,92,246,0.65))';
const GLOW_FUCHSIA = 'drop-shadow(0 0 10px rgba(217,70,239,0.55))';
const GLOW_INDIGO  = 'drop-shadow(0 0 10px rgba(99,102,241,0.60))';

// ─── Floating background icons (Mode B — Live Arena only) ─────────────────────

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
  const { isTestActive } = useBeepTestContext();

  function isActive(href: string): boolean {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  const navBg = isTestActive ? '#4c1d95' : '#6D28D9';

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-around border-t border-white/20 px-2"
      style={{
        background: navBg,
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

function TeacherShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const { isTestActive } = useBeepTestContext();

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
        style={{ background: '#F2F4F8' }}
      >
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-violet-200/60">
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

      {/* ── Canvas background — MODE A (light) or MODE B (dark arena) ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-colors duration-700"
        style={{
          background: isTestActive
            ? 'linear-gradient(145deg, #060410 0%, #0d0825 45%, #080a1c 100%)'
            : '#F8FAFC',
        }}
        aria-hidden="true"
      >
        {isTestActive ? (
          /* ── MODE B: Live Arena — deep dark orbs + floating sport icons ── */
          <>
            <motion.div
              className="absolute rounded-full"
              style={{ width: 620, height: 620, top: '-15%', left: '-10%', background: 'radial-gradient(circle, rgba(109,40,217,0.45) 0%, transparent 65%)' }}
              animate={{ scale: [1, 1.12, 1], x: [0, 20, 0], y: [0, -14, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 480, height: 480, top: '30%', left: '58%', background: 'radial-gradient(circle, rgba(99,102,241,0.30) 0%, transparent 65%)' }}
              animate={{ scale: [1, 1.08, 1], x: [0, -24, 0], y: [0, 18, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 520, height: 520, top: '60%', left: '5%', background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)' }}
              animate={{ scale: [1, 1.14, 1], x: [0, 16, 0], y: [0, -20, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 360, height: 360, top: '8%', left: '72%', background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 65%)' }}
              animate={{ scale: [1, 1.10, 1], x: [0, -12, 0], y: [0, 22, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 280, height: 280, top: '78%', left: '60%', background: 'radial-gradient(circle, rgba(132,204,22,0.12) 0%, transparent 65%)' }}
              animate={{ scale: [1, 1.06, 1], x: [0, 22, 0], y: [0, -12, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />

            {/* Glowing floating fitness icons (Mode B only) */}
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
          </>
        ) : (
          /* ── MODE A: Command Center — 7 prismatic orbs + liquid wave ── */
          <>
            {/* Violet — top-end (PRIMARY — largest, strongest) */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 1000, height: 1000,
                top: '-28%', insetInlineEnd: '-18%',
                background: 'radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.10, 1], y: [0, 28, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Cyan — top-start */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 750, height: 750,
                top: '-12%', insetInlineStart: '-14%',
                background: 'radial-gradient(circle, rgba(0,212,255,0.17) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.08, 1], x: [0, 22, 0] }}
              transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />
            {/* Emerald — bottom-start */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 620, height: 620,
                bottom: '-10%', insetInlineStart: '16%',
                background: 'radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.12, 1], y: [0, -20, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
            />
            {/* Deep violet — center */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 520, height: 520,
                top: '28%', insetInlineStart: '36%',
                background: 'radial-gradient(circle, rgba(123,47,255,0.11) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.07, 1], x: [0, -16, 0] }}
              transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 9 }}
            />
            {/* Cyan — bottom-end */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 440, height: 440,
                bottom: '12%', insetInlineEnd: '6%',
                background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.09, 1], y: [0, 18, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 12 }}
            />
            {/* Hot pink — mid-start */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 500, height: 500,
                top: '42%', insetInlineStart: '-8%',
                background: 'radial-gradient(circle, rgba(236,72,153,0.09) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.11, 1], y: [0, 14, 0] }}
              transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
            />
            {/* Amber — bottom-center */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 380, height: 380,
                bottom: '5%', insetInlineStart: '44%',
                background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 60%)',
              }}
              animate={{ scale: [1, 1.08, 1], x: [0, 12, 0] }}
              transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 15 }}
            />

            {/* ── Liquid color wave — ultra-slow rotating chromatic wash ── */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 1600, height: 1600,
                top: '50%', left: '50%',
                marginTop: -800, marginLeft: -800,
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(109,40,217,0.04) 60deg, transparent 120deg, rgba(0,212,255,0.03) 180deg, transparent 240deg, rgba(236,72,153,0.03) 300deg, transparent 360deg)',
                filter: 'blur(50px)',
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            />

            {/* ── Floating fitness icon watermarks — Mode A ── */}
            {[
              { Icon: Dumbbell,   top: '8%',  insetInlineEnd:   '6%',  size: 56, delay: 0,    dur: 14, rotate: 12,  op: 0.05 },
              { Icon: Timer,      top: '52%', insetInlineStart: '3%',  size: 48, delay: 4,    dur: 18, rotate: -8,  op: 0.04 },
              { Icon: Flame,      top: '75%', insetInlineEnd:   '16%', size: 52, delay: 8,    dur: 16, rotate: 6,   op: 0.05 },
              { Icon: Trophy,     top: '24%', insetInlineStart: '15%', size: 42, delay: 2,    dur: 21, rotate: -12, op: 0.04 },
              { Icon: Activity,   top: '62%', insetInlineStart: '35%', size: 38, delay: 11,   dur: 19, rotate: 10,  op: 0.04 },
              { Icon: Timer,      top: '6%',  insetInlineStart: '50%', size: 32, delay: 6,    dur: 15, rotate: -6,  op: 0.04 },
              { Icon: Medal,      top: '38%', insetInlineEnd:   '22%', size: 44, delay: 3,    dur: 22, rotate: 8,   op: 0.04 },
              { Icon: Dumbbell,   top: '86%', insetInlineStart: '8%',  size: 36, delay: 9,    dur: 17, rotate: -10, op: 0.03 },
              { Icon: Target,     top: '18%', insetInlineEnd:   '38%', size: 30, delay: 5,    dur: 20, rotate: 14,  op: 0.03 },
              { Icon: Heart,      top: '70%', insetInlineEnd:   '42%', size: 28, delay: 13,   dur: 24, rotate: -4,  op: 0.03 },
              { Icon: Zap,        top: '44%', insetInlineStart: '58%', size: 26, delay: 7,    dur: 13, rotate: 18,  op: 0.03 },
              { Icon: Activity,   top: '90%', insetInlineEnd:   '28%', size: 34, delay: 1.5,  dur: 16, rotate: -8,  op: 0.04 },
            ].map(({ Icon, top, insetInlineEnd, insetInlineStart, size, delay, dur, rotate, op }, i) => (
              <motion.div
                key={`modeA-icon-${i}`}
                className="absolute pointer-events-none text-violet-500"
                style={{ top, insetInlineEnd, insetInlineStart, opacity: op, rotate: `${rotate}deg` }}
                animate={{ y: [0, -18, 0], rotate: [`${rotate}deg`, `${rotate + 6}deg`, `${rotate}deg`] }}
                transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay }}
              >
                <Icon style={{ width: size, height: size }} aria-hidden="true" />
              </motion.div>
            ))}

            {/* ── Layer 3: Page-level ghost athlete watermarks ── */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/models_photo/hero-female-2.png"
              alt=""
              className="pointer-events-none select-none absolute bottom-0 end-16 hidden lg:block"
              style={{
                height: 560,
                width: 'auto',
                objectFit: 'contain',
                objectPosition: 'bottom',
                filter: 'grayscale(100%) sepia(10%)',
                opacity: 0.055,
                zIndex: 1,
              }}
              aria-hidden="true"
            />
          </>
        )}
      </div>

      {/* Sidebar — desktop only */}
      <div className="relative z-10 flex-shrink-0 hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content — shifts on desktop when copilot panel is open */}
      <main
        className={cn(
          'relative z-10 flex-1 overflow-y-auto p-3 pb-24 md:p-4 md:pb-6 lg:px-8 lg:pt-2 lg:pb-8',
          'transition-[padding] duration-300',
          copilotOpen && 'md:pe-[420px]',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            className="mx-auto w-full max-w-7xl"
            initial={{ opacity: 0, scale: 1.02, filter: 'blur(3px)' }}
            animate={{
              opacity: 1, scale: 1, filter: 'blur(0px)',
              transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{
              opacity: 0, scale: 0.97, filter: 'blur(3px)',
              transition: { duration: 0.20, ease: 'easeIn' },
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />

      {/* ── AI Copilot — hidden during active beep test (Zen Mode) ── */}
      {!isTestActive && (
        <>
          <CopilotTriggerButton
            isOpen={copilotOpen}
            onToggle={() => { setCopilotOpen((v) => !v); }}
          />
          <CopilotPanel
            isOpen={copilotOpen}
            onClose={() => { setCopilotOpen(false); }}
          />
        </>
      )}
    </div>
  );
}

// ─── Root layout export — wraps shell with BeepTestProvider ────────────────────

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <BeepTestProvider>
      <TeacherShell>{children}</TeacherShell>
    </BeepTestProvider>
  );
}
