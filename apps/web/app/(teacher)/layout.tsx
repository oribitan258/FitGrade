'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, Award, BookOpen, CalendarDays, Crown, Dumbbell,
  FileDown, Flame, GraduationCap, Heart, LayoutDashboard, LogOut, Medal,
  Menu, Settings2, ShieldAlert, Star, Swords,
  Target, Timer, Trophy, Users, Wind, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { SWRConfig } from 'swr';
import { getToken, logout, silentRefresh } from '@/lib/api-client';
import { SplashScreen } from '@/components/ui/splash-screen';
import { Sidebar } from '@/components/layout/sidebar';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BeepTestProvider, useBeepTestContext } from '@/contexts/beep-test-context';
import { SemesterProvider, useSemester } from '@/contexts/semester-context';
import { useReportSettings } from '@/hooks/use-report-settings';
import { useCurrentTeacher } from '@/hooks/use-current-teacher';
import { TourProvider, useTour } from '@/components/tour/TourProvider';
import type { Semester } from '@fitgrade/types';

// ─── Neon glow filters (Mode B / Arena only) ──────────────────────────────────

const GLOW_VIOLET  = 'drop-shadow(0 0 10px rgba(139,92,246,0.65))';
const GLOW_FUCHSIA = 'drop-shadow(0 0 10px rgba(217,70,239,0.55))';
const GLOW_INDIGO  = 'drop-shadow(0 0 10px rgba(99,102,241,0.60))';

// ─── Floating icons (Mode B — Live Arena) ────────────────────────────────────

const FLOATING_ICONS_B = [
  { icon: Dumbbell, top: '5%',  left: '4%',  size: 32, delay: 0,   dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Target,   top: '12%', left: '83%', size: 24, delay: 1.2, dur: 10, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Activity, top: '42%', left: '89%', size: 28, delay: 0.8, dur: 11, op: 0.40, glow: GLOW_INDIGO  },
  { icon: Award,    top: '56%', left: '4%',  size: 24, delay: 3.0, dur: 8,  op: 0.45, glow: GLOW_VIOLET  },
  { icon: Trophy,   top: '68%', left: '78%', size: 30, delay: 1.6, dur: 12, op: 0.40, glow: GLOW_FUCHSIA },
  { icon: Users,    top: '82%', left: '18%', size: 26, delay: 2.0, dur: 9,  op: 0.42, glow: GLOW_INDIGO  },
  { icon: Flame,    top: '8%',  left: '43%', size: 22, delay: 1.8, dur: 10, op: 0.45, glow: GLOW_FUCHSIA },
  { icon: Zap,      top: '88%', left: '43%', size: 26, delay: 0.2, dur: 12, op: 0.42, glow: GLOW_INDIGO  },
  { icon: Heart,    top: '32%', left: '2%',  size: 20, delay: 2.5, dur: 9,  op: 0.38, glow: GLOW_FUCHSIA },
  { icon: Swords,   top: '22%', left: '62%', size: 22, delay: 4.0, dur: 11, op: 0.38, glow: GLOW_VIOLET  },
  { icon: Wind,     top: '74%', left: '52%', size: 20, delay: 3.5, dur: 13, op: 0.35, glow: GLOW_INDIGO  },
  { icon: Star,     top: '48%', left: '27%', size: 18, delay: 1.0, dur: 10, op: 0.38, glow: GLOW_FUCHSIA },
] as const;

// ─── Floating icons (Mode A — Command Center watermarks) ─────────────────────

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
  { Icon: Dumbbell,    top: '6%',  insetInlineEnd:   '5%',  size: 58, delay: 0,   dur: 14, rotate: 12,  op: 0.055 },
  { Icon: Timer,       top: '50%', insetInlineStart: '2%',  size: 50, delay: 4,   dur: 18, rotate: -8,  op: 0.045 },
  { Icon: Flame,       top: '76%', insetInlineEnd:   '14%', size: 54, delay: 8,   dur: 16, rotate: 6,   op: 0.050 },
  { Icon: Trophy,      top: '22%', insetInlineStart: '14%', size: 44, delay: 2,   dur: 21, rotate: -12, op: 0.045 },
  { Icon: Activity,    top: '63%', insetInlineStart: '34%', size: 40, delay: 11,  dur: 19, rotate: 10,  op: 0.040 },
  { Icon: Medal,       top: '37%', insetInlineEnd:   '21%', size: 46, delay: 3,   dur: 22, rotate: 8,   op: 0.040 },
  { Icon: Target,      top: '16%', insetInlineEnd:   '37%', size: 32, delay: 5,   dur: 20, rotate: 14,  op: 0.035 },
  { Icon: Zap,         top: '43%', insetInlineStart: '57%', size: 28, delay: 7,   dur: 13, rotate: 18,  op: 0.035 },
  { Icon: Heart,       top: '86%', insetInlineStart: '8%',  size: 36, delay: 9,   dur: 17, rotate: -6,  op: 0.040 },
  { Icon: Swords,      top: '28%', insetInlineEnd:   '8%',  size: 42, delay: 6,   dur: 23, rotate: 20,  op: 0.040 },
  { Icon: Wind,        top: '55%', insetInlineEnd:   '44%', size: 34, delay: 13,  dur: 15, rotate: -14, op: 0.035 },
  { Icon: Star,        top: '10%', insetInlineStart: '42%', size: 26, delay: 10,  dur: 24, rotate: 22,  op: 0.030 },
  { Icon: Users,       top: '70%', insetInlineStart: '62%', size: 38, delay: 15,  dur: 20, rotate: -10, op: 0.035 },
  { Icon: Award,       top: '92%', insetInlineEnd:   '38%', size: 32, delay: 12,  dur: 18, rotate: 16,  op: 0.030 },
];

// ─── Mobile Navigation (floating button + drawer) ─────────────────────────────

const ALL_NAV_LINKS = [
  { href: '/dashboard',            label: 'ראשי',              icon: LayoutDashboard },
  { href: '/classes',              label: 'הכיתות שלי',        icon: BookOpen        },
  { href: '/schedule',             label: 'מערכת שעות',        icon: CalendarDays    },
  { href: '/norms',                label: 'טבלאות הישגים',     icon: Target          },
  { href: '/reports',              label: 'הפקת דוחות',        icon: FileDown        },
  { href: '/exemptions',           label: 'פטורים',             icon: ShieldAlert     },
  { href: '/outstanding-students', label: 'תלמידים מצטיינים',   icon: Crown           },
  { href: '/events',               label: 'אירועים וטורנירים',  icon: Swords          },
  { href: '/exercise-bank',        label: 'מתכנן שיעור',        icon: Dumbbell        },
  { href: '/settings',             label: 'הגדרות',             icon: Settings2       },
] as const;

// NavList receives activeSemester directly — no CSS variable indirection through
// a Portal (SheetContent uses Radix Portal; CSS var inheritance is unreliable
// across portal boundaries in Safari/Firefox). The component is still memo'd
// but now re-renders only when pathname, semester, or the close callback change.
const NavList = memo(function NavList({
  pathname,
  onLinkClick,
  activeSemester,
}: {
  pathname: string;
  onLinkClick: () => void;
  activeSemester: Semester;
}): React.JSX.Element {
  function isActive(href: string): boolean {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);
  }

  const isA = activeSemester === 'A';

  const activeItemStyle: React.CSSProperties = {
    background: isA
      ? 'linear-gradient(135deg, rgba(139,92,246,0.28) 0%, rgba(109,40,217,0.18) 100%)'
      : 'linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(5,150,105,0.18) 100%)',
    border: `1px solid ${isA ? 'rgba(196,157,255,0.38)' : 'rgba(52,211,153,0.38)'}`,
    boxShadow: isA
      ? '0 0 18px rgba(139,92,246,0.18), inset 0 1px 0 rgba(255,255,255,0.07)'
      : '0 0 18px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.07)',
    color: '#fff',
  };

  const iconGlow = isA
    ? 'drop-shadow(0 0 8px rgba(167,139,250,0.90))'
    : 'drop-shadow(0 0 8px rgba(16,185,129,0.90))';

  return (
    <ul className="flex flex-col gap-1 px-3">
      {ALL_NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <li key={href}>
            <Link
              href={href}
              prefetch
              onClick={onLinkClick}
              aria-current={active ? 'page' : undefined}
              className="flex min-h-[48px] items-center gap-3 rounded-2xl px-3 text-sm font-semibold"
              style={active ? activeItemStyle : {
                border: '1px solid transparent',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              <Icon
                className={cn('h-5 w-5 shrink-0', active && 'scale-110')}
                aria-hidden="true"
                style={{ filter: active ? iconGlow : undefined }}
              />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
});

function FloatingMenuButton(): React.JSX.Element {
  const pathname = usePathname();
  const router   = useRouter();
  const { activeSemester, setActiveSemester } = useSemester();
  const { data: reportSettings } = useReportSettings();
  const schoolName = reportSettings?.schoolName ?? null;
  const [open, setOpen] = useState(false);

  const handleNavClick = useCallback(() => { setOpen(false); }, []);

  async function handleLogout(): Promise<void> {
    setOpen(false);
    await logout();
    router.replace('/login');
  }

  return (
    <>
      {/* Floating glassmorphism hamburger — fixed top-start, mobile only */}
      <button
        type="button"
        onClick={() => { setOpen(true); }}
        aria-label="פתח תפריט ניווט"
        className="md:hidden fixed z-40 flex items-center justify-center rounded-2xl print:hidden"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          insetInlineStart: '16px',
          width: 44,
          height: 44,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <Menu className="h-5 w-5 text-slate-700" aria-hidden="true" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          dir="rtl"
          className="w-[280px] p-0 sm:max-w-[280px] border-e-0 border-s flex flex-col text-white overflow-hidden"
          style={{
            // Pure-black base — carries zero hue. All theming comes from the
            // opacity-transitioning gradient layers inside (see "Deep void layers").
            // CSS cannot interpolate arbitrary gradient strings so we NEVER switch
            // the background property directly; we cross-fade opaque overlay divs.
            background: '#06060e',
            borderColor: activeSemester === 'A'
              ? 'rgba(139,92,246,0.22)'
              : 'rgba(16,185,129,0.22)',
            transition: 'border-color 0.7s ease-in-out',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          } as React.CSSProperties}
        >
          {/* Visually-hidden title + description — required by Radix Dialog for
              screen-reader accessibility. Wrapping in `sr-only` keeps them out
              of the visual layout. Without these, Radix emits a console
              warning ("DialogContent requires a DialogTitle"). */}
          <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
          <SheetDescription className="sr-only">
            ניווט בין עמודי המורה: ראשי, כיתות, מערכת שעות, דוחות והגדרות
          </SheetDescription>

          {/* ── Layered theming system ── */}
          {/* Layer 0: Deep void backgrounds — full-bleed, cross-fade on toggle.   */}
          {/* CSS can't interpolate gradient strings so we keep BOTH layers mounted */}
          {/* and transition only their opacity. One is always 0, one is always 1.  */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Semester A — deep violet void */}
            <div
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'linear-gradient(to bottom, #120a1e 0%, #1a1236 50%, #120a1e 100%)',
                opacity: activeSemester === 'A' ? 1 : 0,
              }}
            />
            {/* Semester B — deep emerald/teal void (zero purple) */}
            <div
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'linear-gradient(to bottom, #0a1e14 0%, #0f2922 50%, #0a1e14 100%)',
                opacity: activeSemester === 'B' ? 1 : 0,
              }}
            />

            {/* Layer 1: Ambient radial glows — sit on top of the void backgrounds */}
            <div
              className="absolute inset-x-0 top-0 h-72 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'radial-gradient(ellipse at 55% 0%, rgba(139,92,246,0.48) 0%, transparent 68%)',
                opacity: activeSemester === 'A' ? 1 : 0,
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-72 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'radial-gradient(ellipse at 55% 0%, rgba(16,185,129,0.46) 0%, transparent 68%)',
                opacity: activeSemester === 'B' ? 1 : 0,
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-48 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'radial-gradient(ellipse at 40% 100%, rgba(99,102,241,0.20) 0%, transparent 70%)',
                opacity: activeSemester === 'A' ? 1 : 0,
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-48 transition-opacity duration-700 ease-in-out"
              style={{
                background: 'radial-gradient(ellipse at 40% 100%, rgba(5,150,105,0.22) 0%, transparent 70%)',
                opacity: activeSemester === 'B' ? 1 : 0,
              }}
            />

            {/* Layer 2: Floating watermark icons — tint transitions with semester */}
            <Dumbbell
              className="absolute"
              style={{
                top: '12%', insetInlineEnd: '8%', width: 38, height: 38,
                color: activeSemester === 'A' ? 'rgba(167,139,250,0.14)' : 'rgba(52,211,153,0.13)',
                filter: activeSemester === 'A'
                  ? 'drop-shadow(0 0 6px rgba(139,92,246,0.28))'
                  : 'drop-shadow(0 0 6px rgba(16,185,129,0.28))',
                transition: 'color 0.7s ease-in-out, filter 0.7s ease-in-out',
              }}
              aria-hidden="true"
            />
            <Flame
              className="absolute"
              style={{
                top: '38%', insetInlineStart: '6%', width: 26, height: 26,
                color: activeSemester === 'A' ? 'rgba(251,146,60,0.12)' : 'rgba(52,211,153,0.10)',
                filter: activeSemester === 'A'
                  ? 'drop-shadow(0 0 5px rgba(251,146,60,0.20))'
                  : 'drop-shadow(0 0 5px rgba(16,185,129,0.18))',
                transition: 'color 0.7s ease-in-out, filter 0.7s ease-in-out',
              }}
              aria-hidden="true"
            />
            <Target
              className="absolute"
              style={{
                top: '62%', insetInlineEnd: '12%', width: 30, height: 30,
                color: activeSemester === 'A' ? 'rgba(167,139,250,0.11)' : 'rgba(52,211,153,0.12)',
                filter: activeSemester === 'A'
                  ? 'drop-shadow(0 0 5px rgba(139,92,246,0.22))'
                  : 'drop-shadow(0 0 5px rgba(16,185,129,0.24))',
                transition: 'color 0.7s ease-in-out, filter 0.7s ease-in-out',
              }}
              aria-hidden="true"
            />
            <Zap
              className="absolute"
              style={{
                top: '80%', insetInlineStart: '14%', width: 20, height: 20,
                color: activeSemester === 'A' ? 'rgba(129,140,248,0.10)' : 'rgba(52,211,153,0.10)',
                filter: activeSemester === 'A'
                  ? 'drop-shadow(0 0 4px rgba(99,102,241,0.20))'
                  : 'drop-shadow(0 0 4px rgba(16,185,129,0.20))',
                transition: 'color 0.7s ease-in-out, filter 0.7s ease-in-out',
              }}
              aria-hidden="true"
            />
          </div>

          {/* ── Brand header — NO z-10 so shadcn X button stays on top ── */}
          <div
            className="relative flex items-center justify-between px-5 pb-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 22px)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div>
              {/* ── Animated logo mark ── */}
              <div className="relative inline-block">
                {/* Slow shimmer wave: ping-pong keyframe (0%/100% share same position)
                    eliminates the loop boundary jump. bg-[length:200%_auto] makes the
                    gradient twice the element width so the light peak travels fully
                    across the text on each half-cycle. */}
                <span
                  className={cn(
                    'block font-black text-2xl tracking-tight',
                    'bg-clip-text text-transparent',
                    'bg-[length:200%_auto] animate-logo-shimmer',
                    activeSemester === 'A'
                      ? 'bg-gradient-to-r from-violet-400 via-fuchsia-100 to-violet-400'
                      : 'bg-gradient-to-r from-emerald-400 via-teal-100 to-emerald-400',
                  )}
                >
                  FitGrade
                </span>

                {/* Mortarboard accent — rests on the 'G'.
                    In RTL context insetInlineEnd maps to physical-left, so counting
                    from the left edge of "FitGrade": 'Fit' ≈ 32 px, cap half-width 6 px
                    → insetInlineEnd ≈ 26 px lands the cap centred over the 'G'. */}
                <GraduationCap
                  className="absolute"
                  style={{
                    width: 13,
                    height: 13,
                    top: '-4px',
                    insetInlineEnd: '26px',
                    transform: 'rotate(-15deg)',
                    color: activeSemester === 'A'
                      ? 'rgba(196,157,255,0.92)'
                      : 'rgba(52,211,153,0.92)',
                    filter: activeSemester === 'A'
                      ? 'drop-shadow(0 0 6px rgba(139,92,246,0.85))'
                      : 'drop-shadow(0 0 6px rgba(16,185,129,0.85))',
                    transition: 'color 0.7s ease-in-out, filter 0.7s ease-in-out',
                  }}
                  aria-hidden="true"
                />
              </div>

              {schoolName !== null && (
                <span
                  className="block text-[11px] font-semibold truncate max-w-[140px]"
                  style={{ color: 'rgba(255,255,255,0.50)', marginTop: 2 }}
                >
                  {schoolName}
                </span>
              )}
            </div>
          </div>

          {/* ── Semester A / B toggle ── */}
          <div
            className="relative px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="flex rounded-[14px] p-[3px]"
              style={{ background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.07)' }}
              role="radiogroup"
              aria-label="בחירת מחצית"
            >
              {(['A', 'B'] as const).map((sem) => {
                const isActiveSem = activeSemester === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    role="radio"
                    aria-checked={isActiveSem}
                    onClick={() => { setActiveSemester(sem); }}
                    className="relative flex-1 rounded-[11px] py-[7px] text-[11px] font-bold transition-colors duration-300"
                    style={{ color: isActiveSem ? '#fff' : 'rgba(255,255,255,0.32)' }}
                  >
                    <AnimatePresence initial={false}>
                      {isActiveSem && (
                        <motion.div
                          key={`pill-${sem}`}
                          layoutId="mobile-semester-pill"
                          className="absolute inset-0 rounded-[11px]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          style={{
                            background: sem === 'A'
                              ? 'linear-gradient(135deg, rgba(139,92,246,0.70), rgba(109,40,217,0.55))'
                              : 'linear-gradient(135deg, rgba(16,185,129,0.70), rgba(5,150,105,0.55))',
                            boxShadow: sem === 'A'
                              ? '0 0 14px rgba(139,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.14)'
                              : '0 0 14px rgba(16,185,129,0.40), inset 0 1px 0 rgba(255,255,255,0.12)',
                            border: sem === 'A' ? '1px solid rgba(196,157,255,0.42)' : '1px solid rgba(52,211,153,0.42)',
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                    </AnimatePresence>
                    <span className="relative z-10 block leading-none">
                      {sem === 'A' ? "מחצית א'" : "מחצית ב'"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Nav links — keyed by semester so React fully remounts the list on   ── */}
          {/* ── toggle, eliminating any ghost DOM nodes from the previous theme.   ── */}
          {/* ── AnimatePresence mode="wait" ensures the exit animation completes   ── */}
          {/* ── before the entering semester's list mounts (no overlap/flicker).   ── */}
          <nav className="relative flex flex-1 flex-col overflow-y-auto py-3" aria-label="ניווט ראשי">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSemester}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
              >
                <NavList pathname={pathname} onLinkClick={handleNavClick} activeSemester={activeSemester} />
              </motion.div>
            </AnimatePresence>

            <div className="mt-auto px-3 pt-3">
              <button
                type="button"
                onClick={() => { void handleLogout(); }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-all duration-200 active:opacity-80"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.28)',
                  color: 'rgba(252,165,165,0.90)',
                }}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>התנתק</span>
              </button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
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
          <Image
            src="/models_photo/hero-female-2.png"
            alt=""
            width={320}
            height={560}
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
            priority={false}
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
  // True once we have a valid in-memory access token (either already present
  // or restored via a silent refresh from the httpOnly refresh-token cookie).
  const [tokenReady, setTokenReady] = useState(() => getToken() !== null);
  const { isTestActive } = useBeepTestContext();
  const { activeSemester } = useSemester();

  // Fetch profile only after the access token is confirmed — prevents a
  // spurious 401 on page load when the token isn't in memory yet.
  const { teacher, isLoading: profileLoading, error: profileError } = useCurrentTeacher(tokenReady);
  const { isTourActive } = useTour();

  // Two related-but-distinct concepts:
  //   isOnboarding — used by the redirect guards below. /settings is included
  //     because the guided tour lands there for the final step; a teacher
  //     mid-tour must not be bounced back to /onboarding/welcome.
  //   hideChrome — used to hide the sidebar + floating hamburger. We hide chrome
  //     during the *initial* onboarding flow only — i.e. on /onboarding/* or
  //     while the tour is actively running. A returning teacher visiting
  //     /settings normally must see the full nav chrome.
  const isOnboardingPath = pathname.startsWith('/onboarding');
  const isSettingsPath   = pathname.startsWith('/settings');
  const isOnboarding     = isOnboardingPath || isSettingsPath;
  const hideChrome       = isOnboardingPath || (isSettingsPath && isTourActive);

  // On mount: if no in-memory token, attempt a silent refresh from the
  // httpOnly refresh cookie. Redirect to login only if that also fails.
  useEffect(() => {
    if (tokenReady) return;
    void silentRefresh().then((ok) => {
      if (!ok) {
        router.replace('/login');
      } else {
        setTokenReady(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 1. Token not yet confirmed — wait for silent refresh
    if (!tokenReady) return;
    // 2. Still waiting for profile fetch
    if (profileLoading) return;
    // 3. Profile fetch failed — bad/expired token, force re-login
    if (profileError || !teacher) {
      router.replace('/login');
      return;
    }

    // 4. Teacher has not accepted the current Terms of Service.
    //    We use a versioned localStorage key so bumping the version forces
    //    all existing teachers to re-consent after a ToS update.
    //    The onboarding page IS the consent gate — exempt it to avoid a loop.
    const hasConsented = localStorage.getItem('fitgrade-consent-v1') !== null;
    if (!hasConsented && !isOnboarding) {
      router.replace('/onboarding/welcome');
      return;
    }

    // 5. First-time teacher: lock into onboarding — but NOT while the tour is
    //    actively running (it navigates to /dashboard etc. before setup completes).
    if (!teacher.isOnboardingComplete && !isOnboarding && !isTourActive) {
      router.replace('/onboarding/welcome');
      return;
    }

    setReady(true);
  }, [tokenReady, router, pathname, teacher, profileLoading, profileError, isOnboarding, isTourActive]);

  return (
    <>
      {/* SplashScreen sits above everything (z-9999) and fades out once both
          the auth check resolves AND the 3.5 s minimum brand window expires. */}
      <SplashScreen isLoading={!ready} />

      <div
        className="relative flex h-screen w-full overflow-hidden overflow-x-hidden print:block print:h-auto print:overflow-visible"
        data-semester={activeSemester}
      >
      {/* ── Background canvas — memoized, only re-renders on isTestActive/semester change ── */}
      <BackgroundCanvas isTestActive={isTestActive} activeSemester={activeSemester} />

      {/* Sidebar + hamburger — hidden during onboarding so the full-screen
          welcome/setup pages aren't interrupted by navigation chrome. /settings
          shows chrome unless the guided tour is actively running. */}
      {!hideChrome && (
        <>
          <div className="relative z-10 flex-shrink-0 hidden md:flex print:hidden">
            <Sidebar />
          </div>
          <FloatingMenuButton />
        </>
      )}

      {/* Main content */}
      <main
        data-tour-scroll-pane
        className={cn(
          'relative z-10 flex-1 overflow-y-auto print:block print:overflow-visible print:h-auto',
          'pt-0',
          'transition-[padding] duration-300',
        )}
        style={{
          paddingTop:    'env(safe-area-inset-top, 0px)',
          // Reserve space at the bottom for the iOS home indicator + Android
          // gesture pill so the last interactive row is never hidden under
          // system chrome. No-op on desktop (env() resolves to 0).
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        } as React.CSSProperties}
      >
        {/* ── Semester accent line — hidden on onboarding pages ── */}
        {!hideChrome && (
          <motion.div
            className="hidden md:block sticky top-0 z-10 h-[3px] w-full shrink-0 print:hidden"
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
        )}

        <div className={hideChrome ? '' : 'pb-6 md:p-4 md:pb-6 lg:px-8 lg:pt-2 lg:pb-8 print:p-0'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              className={hideChrome ? 'w-full h-full' : 'w-full md:max-w-7xl md:mx-auto'}
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
              {/* Children render ONLY after auth is established (ready=true).
                  Previously they mounted under the splash overlay and fired
                  SWR hooks while the access token was still missing — every
                  query came back 401, and the dashboard cached the error,
                  producing a red "load failed" panel as soon as the splash
                  faded. Gating the mount eliminates the race. */}
              {ready ? children : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

    </div>
    </>
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
    <SWRConfig
      value={{
        // Teachers stay on a tab for an entire lesson — refocus-revalidate
        // creates surprise refetches mid-lesson. Disable globally.
        revalidateOnFocus:    false,
        // Dedupe requests fired within 10 s — switching between two classes
        // or re-mounting a hook on route change won't double-fetch.
        dedupingInterval:     10_000,
        // Show stale data while next fetch resolves — eliminates the white
        // flash when navigating between class detail pages.
        keepPreviousData:     true,
        // One retry on transient errors; do not hammer the API on real outages.
        errorRetryCount:      1,
      }}
    >
      <SemesterProvider>
        <BeepTestProvider>
          <TourProvider>
            <TeacherShell>{children}</TeacherShell>
          </TourProvider>
        </BeepTestProvider>
      </SemesterProvider>
    </SWRConfig>
  );
}
