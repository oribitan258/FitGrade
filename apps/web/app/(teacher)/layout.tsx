'use client';

import { memo, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Award, BookOpen, CalendarDays, Dumbbell,
  Flame, LayoutDashboard, LogOut, Medal,
  Target, Timer, Trophy, Users, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { getToken, logout } from '@/lib/api-client';
import { Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';
import { CopilotTriggerButton } from '@/components/copilot/copilot-trigger-button';
import { CopilotPanel }         from '@/components/copilot/copilot-panel';
import { BeepTestProvider, useBeepTestContext } from '@/contexts/beep-test-context';
import { SemesterProvider, useSemester } from '@/contexts/semester-context';
import { SemesterStripMobile } from '@/components/layout/semester-strip-mobile';
import type { Semester } from '@fitgrade/types';

// ─── Neon glow filters (Mode B / Arena only) ──────────────────────────────────

const GLOW_VIOLET  = 'drop-shadow(0 0 10px rgba(139,92,246,0.65))';
const GLOW_FUCHSIA = 'drop-shadow(0 0 10px rgba(217,70,239,0.55))';
const GLOW_INDIGO  = 'drop-shadow(0 0 10px rgba(99,102,241,0.60))';

// ─── Floating icons (Mode B — Live Arena — reduced 33→8) ─────────────────────

const FLOATING_ICONS_B = [
  { icon: Dumbbell, top: '5%',  left: '4%',  size: 32, delay: 0,   dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Target,   top: '12%', left: '83%', size: 24, delay: 1.2, dur: 10, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Activity, top: '42%', left: '89%', size: 28, delay: 0.8, dur: 11, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Award,    top: '56%', left: '4%',  size: 24, delay: 3.0, dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Trophy,   top: '68%', left: '78%', size: 30, delay: 1.6, dur: 12, op: 0.40, glow: GLOW_FUCHSIA },
  { icon: Users,    top: '82%', left: '18%', size: 26, delay: 2.0, dur: 9,  op: 0.42, glow: GLOW_INDIGO  },
  { icon: Flame,    top: '8%',  left: '43%', size: 22, delay: 1.8, dur: 10, op: 0.45, glow: GLOW_FUCHSIA },
  { icon: Zap,      top: '88%', left: '43%', size: 26, delay: 0.2, dur: 12, op: 0.42, glow: GLOW_INDIGO  },
] as const;

// ─── Floating icons (Mode A — Command Center watermarks — reduced 12→8) ──────

const MODE_A_ICONS: Array<{
  Icon: LucideIcon;
  top: string;
  insetInlineEnd?: string;
  insetInlineStart?: string;
  size: number;
  delay: number;
  dur: number;
  rotate: number;
  op: number;
}> = [
  { Icon: Dumbbell, top: '8%',  insetInlineEnd:   '6%',  size: 56, delay: 0,   dur: 14, rotate: 12,  op: 0.05 },
  { Icon: Timer,    top: '52%', insetInlineStart: '3%',  size: 48, delay: 4,   dur: 18, rotate: -8,  op: 0.04 },
  { Icon: Flame,    top: '75%', insetInlineEnd:   '16%', size: 52, delay: 8,   dur: 16, rotate: 6,   op: 0.05 },
  { Icon: Trophy,   top: '24%', insetInlineStart: '15%', size: 42, delay: 2,   dur: 21, rotate: -12, op: 0.04 },
  { Icon: Activity, top: '62%', insetInlineStart: '35%', size: 38, delay: 11,  dur: 19, rotate: 10,  op: 0.04 },
  { Icon: Medal,    top: '38%', insetInlineEnd:   '22%', size: 44, delay: 3,   dur: 22, rotate: 8,   op: 0.04 },
  { Icon: Target,   top: '18%', insetInlineEnd:   '38%', size: 30, delay: 5,   dur: 20, rotate: 14,  op: 0.03 },
  { Icon: Zap,      top: '44%', insetInlineStart: '58%', size: 26, delay: 7,   dur: 13, rotate: 18,  op: 0.03 },
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
  const { isTestActive }  = useBeepTestContext();
  const { activeSemester } = useSemester();

  function isActive(href: string): boolean {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  const navBg          = isTestActive ? '#4c1d95' : activeSemester === 'A' ? '#6D28D9' : '#15803d';
  const activeIconBg   = activeSemester === 'A'
    ? 'bg-white/20 shadow-[0_2px_10px_rgba(167,139,250,0.40)]'
    : 'bg-white/20 shadow-[0_2px_10px_rgba(34,197,94,0.35)]';
  const activeColor    = activeSemester === 'A' ? 'text-[#e9d5ff]'    : 'text-emerald-100';
  const inactiveColor  = activeSemester === 'A' ? 'text-[#c4b5fd]/60' : 'text-emerald-200/60';

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-around border-t border-white/20 px-2"
      style={{
        background: navBg,
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        transition: 'background-color 0.5s ease',
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
                active ? activeIconBg : 'bg-transparent',
              )}
            >
              <Icon
                className={cn('h-5 w-5 transition-colors duration-200', active ? activeColor : inactiveColor)}
                aria-hidden="true"
              />
            </motion.div>
            <span className={cn('text-[10px] font-semibold pb-1 transition-colors duration-200', active ? activeColor : inactiveColor)}>
              {label}
            </span>
          </Link>
        );
      })}

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
          <LogOut className={cn('h-5 w-5', inactiveColor)} aria-hidden="true" />
        </motion.div>
        <span className={cn('text-[10px] font-semibold pb-1', inactiveColor)}>יציאה</span>
      </button>
    </nav>
  );
}

// ─── Background Canvas (memoized — skips reconciliation on copilot/other state changes) ──
// Only re-renders when isTestActive or activeSemester actually changes.

const BackgroundCanvas = memo(function BackgroundCanvas({
  isTestActive,
  activeSemester,
}: {
  isTestActive: boolean;
  activeSemester: Semester;
}): React.JSX.Element {
  return (
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
        /* ── MODE B: Live Arena — dark orbs + floating sport icons (CSS animated) ── */
        <>
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 620, height: 620, top: '-15%', left: '-10%', background: 'radial-gradient(circle, rgba(109,40,217,0.45) 0%, transparent 65%)', '--orb-y': '-14px', '--orb-s': '1.12', '--orb-dur': '14s' } as React.CSSProperties}
          />
          <div
            className="absolute rounded-full bg-orb-x"
            style={{ width: 480, height: 480, top: '30%', left: '58%', background: 'radial-gradient(circle, rgba(99,102,241,0.30) 0%, transparent 65%)', '--orb-x': '-24px', '--orb-s': '1.08', '--orb-dur': '18s', '--orb-delay': '2s' } as React.CSSProperties}
          />
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 520, height: 520, top: '60%', left: '5%', background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)', '--orb-y': '-20px', '--orb-s': '1.14', '--orb-dur': '16s', '--orb-delay': '4s' } as React.CSSProperties}
          />
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 360, height: 360, top: '8%', left: '72%', background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 65%)', '--orb-y': '22px', '--orb-s': '1.10', '--orb-dur': '20s', '--orb-delay': '6s' } as React.CSSProperties}
          />
          <div
            className="absolute rounded-full bg-orb-x"
            style={{ width: 280, height: 280, top: '78%', left: '60%', background: 'radial-gradient(circle, rgba(132,204,22,0.12) 0%, transparent 65%)', '--orb-x': '22px', '--orb-s': '1.06', '--orb-dur': '22s', '--orb-delay': '3s' } as React.CSSProperties}
          />

          {/* Floating fitness icons — CSS animation (8 icons, down from 33) */}
          {FLOATING_ICONS_B.map(({ icon: Icon, top, left, size, delay, dur, op, glow }, i) => (
            <div
              key={i}
              className="absolute text-violet-500 bg-icon-float"
              style={{ top, left, opacity: op, filter: glow, '--fi-dur': `${dur}s`, '--fi-delay': `${delay}s`, '--fi-r0': '0deg', '--fi-r1': '8deg' } as React.CSSProperties}
            >
              <Icon style={{ width: size, height: size }} aria-hidden="true" />
            </div>
          ))}
        </>
      ) : (
        /* ── MODE A: Command Center — prismatic orbs + liquid wave (CSS animated) ── */
        <>
          {/* Semester ambient top glows — Framer Motion for opacity cross-fade only */}
          <motion.div
            className="absolute top-0 inset-x-0 pointer-events-none"
            style={{ height: 240, background: 'linear-gradient(to bottom, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.10) 45%, transparent 100%)' }}
            animate={{ opacity: activeSemester === 'A' ? 1 : 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute top-0 inset-x-0 pointer-events-none"
            style={{ height: 240, background: 'linear-gradient(to bottom, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.10) 45%, transparent 100%)' }}
            animate={{ opacity: activeSemester === 'B' ? 1 : 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            aria-hidden="true"
          />

          {/* Violet top-end (PRIMARY) — CSS float */}
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 1000, height: 1000, top: '-28%', insetInlineEnd: '-18%', background: 'radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 60%)', '--orb-y': '28px', '--orb-s': '1.10', '--orb-dur': '20s' } as React.CSSProperties}
          />
          {/* Green tint overlay — Framer Motion opacity only (no continuous loop) */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: 1000, height: 1000, top: '-28%', insetInlineEnd: '-18%', background: 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 60%)' }}
            animate={{ opacity: activeSemester === 'B' ? 1 : 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />

          {/* Cyan top-start — CSS float */}
          <div
            className="absolute rounded-full bg-orb-x"
            style={{ width: 750, height: 750, top: '-12%', insetInlineStart: '-14%', background: 'radial-gradient(circle, rgba(0,212,255,0.17) 0%, transparent 60%)', '--orb-x': '22px', '--orb-s': '1.08', '--orb-dur': '24s', '--orb-delay': '3s' } as React.CSSProperties}
          />
          {/* Emerald bottom-start — CSS float */}
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 620, height: 620, bottom: '-10%', insetInlineStart: '16%', background: 'radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 60%)', '--orb-y': '-20px', '--orb-s': '1.12', '--orb-dur': '18s', '--orb-delay': '6s' } as React.CSSProperties}
          />
          {/* Deep violet center — CSS float */}
          <div
            className="absolute rounded-full bg-orb-x"
            style={{ width: 520, height: 520, top: '28%', insetInlineStart: '36%', background: 'radial-gradient(circle, rgba(123,47,255,0.11) 0%, transparent 60%)', '--orb-x': '-16px', '--orb-s': '1.07', '--orb-dur': '26s', '--orb-delay': '9s' } as React.CSSProperties}
          />
          {/* Cyan bottom-end — CSS float */}
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 440, height: 440, bottom: '12%', insetInlineEnd: '6%', background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 60%)', '--orb-y': '18px', '--orb-s': '1.09', '--orb-dur': '22s', '--orb-delay': '12s' } as React.CSSProperties}
          />
          {/* Hot pink mid-start — CSS float */}
          <div
            className="absolute rounded-full bg-orb-y"
            style={{ width: 500, height: 500, top: '42%', insetInlineStart: '-8%', background: 'radial-gradient(circle, rgba(236,72,153,0.09) 0%, transparent 60%)', '--orb-y': '14px', '--orb-s': '1.11', '--orb-dur': '28s', '--orb-delay': '5s' } as React.CSSProperties}
          />
          {/* Amber bottom-center — CSS float */}
          <div
            className="absolute rounded-full bg-orb-x"
            style={{ width: 380, height: 380, bottom: '5%', insetInlineStart: '44%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 60%)', '--orb-x': '12px', '--orb-s': '1.08', '--orb-dur': '32s', '--orb-delay': '15s' } as React.CSSProperties}
          />
          {/* Green bottom-start (Semester B reinforcement) — Framer Motion opacity only */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ width: 560, height: 560, bottom: '-8%', insetInlineStart: '8%', background: 'radial-gradient(circle, rgba(34,197,94,0.13) 0%, transparent 60%)' }}
            animate={{ opacity: activeSemester === 'B' ? 1 : 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />

          {/* Liquid color wave — CSS rotation (120s, zero JS) */}
          <div
            className="absolute rounded-full pointer-events-none bg-liquid-wave"
            style={{
              width: 1600, height: 1600,
              top: '50%', left: '50%',
              marginTop: -800, marginLeft: -800,
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(109,40,217,0.04) 60deg, transparent 120deg, rgba(0,212,255,0.03) 180deg, transparent 240deg, rgba(236,72,153,0.03) 300deg, transparent 360deg)',
              filter: 'blur(50px)',
            }}
          />

          {/* Mode A floating icon watermarks — CSS animation (8 icons, down from 12) */}
          {MODE_A_ICONS.map(({ Icon, top, insetInlineEnd, insetInlineStart, size, delay, dur, rotate, op }, i) => (
            <div
              key={`icon-a-${i}`}
              className="absolute pointer-events-none text-violet-500 bg-icon-float"
              style={{
                top,
                ...(insetInlineEnd   !== undefined ? { insetInlineEnd }   : {}),
                ...(insetInlineStart !== undefined ? { insetInlineStart } : {}),
                opacity: op,
                '--fi-dur':   `${dur}s`,
                '--fi-delay': `${delay}s`,
                '--fi-r0':    `${rotate}deg`,
                '--fi-r1':    `${rotate + 6}deg`,
              } as React.CSSProperties}
            >
              <Icon style={{ width: size, height: size }} aria-hidden="true" />
            </div>
          ))}

          {/* Ghost athlete watermark */}
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
  );
});

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
  const { activeSemester } = useSemester();

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
    <div
      className="relative flex h-screen overflow-hidden overflow-x-hidden"
      data-semester={activeSemester}
    >
      {/* ── Background canvas — memoized, only re-renders on isTestActive/semester change ── */}
      <BackgroundCanvas isTestActive={isTestActive} activeSemester={activeSemester} />

      {/* Sidebar — desktop only */}
      <div className="relative z-10 flex-shrink-0 hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        className={cn(
          'relative z-10 flex-1 overflow-y-auto',
          'transition-[padding] duration-300',
          copilotOpen && 'md:pe-[420px]',
        )}
      >
        {/* ── Semester accent line — 3px sticky gradient at top of content ── */}
        <motion.div
          className="sticky top-0 z-10 h-[3px] w-full shrink-0"
          animate={{
            background: activeSemester === 'A'
              ? 'linear-gradient(to left, rgba(109,40,217,0) 0%, rgba(139,92,246,1) 25%, rgba(167,139,250,1) 50%, rgba(139,92,246,1) 75%, rgba(109,40,217,0) 100%)'
              : 'linear-gradient(to left, rgba(22,163,74,0) 0%, rgba(34,197,94,1) 25%, rgba(74,222,128,1) 50%, rgba(34,197,94,1) 75%, rgba(22,163,74,0) 100%)',
            boxShadow: activeSemester === 'A'
              ? '0 0 12px 2px rgba(139,92,246,0.55)'
              : '0 0 12px 2px rgba(34,197,94,0.55)',
          }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          aria-hidden="true"
        />

        <SemesterStripMobile />
        <div className="p-3 pb-24 md:p-4 md:pb-6 lg:px-8 lg:pt-2 lg:pb-8">
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
        </div>
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

// ─── Root layout export ────────────────────────────────────────────────────────
// SemesterProvider (outer) → BeepTestProvider (inner) so semester is available
// everywhere. BeepTestProvider sits inside — semester changes never re-render
// the beep engine because BeepTestConsole does not subscribe to SemesterContext.

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SemesterProvider>
      <BeepTestProvider>
        <TeacherShell>{children}</TeacherShell>
      </BeepTestProvider>
    </SemesterProvider>
  );
}
