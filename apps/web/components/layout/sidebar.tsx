'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  Crown,
  FileDown,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldAlert,
  Swords,
  Target,
  Dumbbell,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-client';
import { useSemester, type SemesterView } from '@/contexts/semester-context';
import { useReportSettings } from '@/hooks/use-report-settings';

// ─── Token types ──────────────────────────────────────────────────────────────

interface ViewTokens {
  navGradient:   string;
  navBorder:     string;
  navShadow:     string;
  navIconClass:  string;
  pillBg:        string;
  pillBorder:    string;
  pillShadow:    string;
  pillTextColor: string;
  dotColor:      string;
  label:         string;
  /** Base background gradient for the sidebar <aside> shell */
  asideBg:       string;
  /** Colour of the 1px inset inner border-end glow on the aside */
  asideGlow:     string;
}

// ─── Semester color tokens ────────────────────────────────────────────────────

const VIEW_TOKENS: Record<SemesterView, ViewTokens> = {
  A: {
    navGradient:   'linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(109,40,217,0.38) 100%)',
    navBorder:     '1px solid rgba(196,157,255,0.60)',
    navShadow:     [
      '0 0 24px rgba(168,85,247,0.45)',
      '0 0 48px rgba(168,85,247,0.18)',
      'inset 0 1px 0 rgba(255,255,255,0.20)',
      'inset 0 0 20px rgba(139,92,246,0.15)',
      '0 4px 12px rgba(0,0,0,0.25)',
    ].join(', '),
    navIconClass:  'text-violet-200',
    pillBg:        'rgba(139,92,246,0.40)',
    pillBorder:    'rgba(196,157,255,0.60)',
    pillShadow:    '0 0 16px rgba(168,85,247,0.40), inset 0 1px 0 rgba(255,255,255,0.15)',
    pillTextColor: 'rgba(237,233,254,1)',
    dotColor:      'rgba(167,139,250,0.9)',
    label:         "מחצית א'",
    asideBg:       'linear-gradient(160deg, rgba(45,28,95,0.88) 0%, rgba(28,16,68,0.92) 40%, rgba(18,10,48,0.95) 100%)',
    asideGlow:     'rgba(168,85,247,0.08)',
  },
  B: {
    navGradient:   'linear-gradient(135deg, rgba(34,197,94,0.45) 0%, rgba(22,163,74,0.38) 100%)',
    navBorder:     '1px solid rgba(134,239,172,0.60)',
    navShadow:     [
      '0 0 24px rgba(34,197,94,0.45)',
      '0 0 48px rgba(34,197,94,0.18)',
      'inset 0 1px 0 rgba(255,255,255,0.20)',
      'inset 0 0 20px rgba(34,197,94,0.15)',
      '0 4px 12px rgba(0,0,0,0.25)',
    ].join(', '),
    navIconClass:  'text-green-200',
    pillBg:        'rgba(34,197,94,0.40)',
    pillBorder:    'rgba(134,239,172,0.60)',
    pillShadow:    '0 0 16px rgba(34,197,94,0.40), inset 0 1px 0 rgba(255,255,255,0.15)',
    pillTextColor: 'rgba(220,252,231,1)',
    dotColor:      'rgba(74,222,128,0.9)',
    label:         "מחצית ב'",
    asideBg:       'linear-gradient(160deg, rgba(8,32,18,0.90) 0%, rgba(5,22,12,0.93) 40%, rgba(3,14,8,0.96) 100%)',
    asideGlow:     'rgba(34,197,94,0.08)',
  },
  FULL: {
    navGradient:   'linear-gradient(135deg, rgba(99,102,241,0.42) 0%, rgba(79,70,229,0.35) 100%)',
    navBorder:     '1px solid rgba(165,180,252,0.55)',
    navShadow:     [
      '0 0 24px rgba(99,102,241,0.40)',
      '0 0 48px rgba(99,102,241,0.16)',
      'inset 0 1px 0 rgba(255,255,255,0.18)',
      'inset 0 0 20px rgba(99,102,241,0.12)',
      '0 4px 12px rgba(0,0,0,0.25)',
    ].join(', '),
    navIconClass:  'text-indigo-200',
    pillBg:        'rgba(99,102,241,0.38)',
    pillBorder:    'rgba(165,180,252,0.58)',
    pillShadow:    '0 0 16px rgba(99,102,241,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
    pillTextColor: 'rgba(224,231,255,1)',
    dotColor:      'rgba(129,140,248,0.9)',
    label:         'שנה שלמה',
    asideBg:       'linear-gradient(160deg, rgba(20,20,55,0.90) 0%, rgba(14,14,40,0.93) 40%, rgba(8,8,28,0.96) 100%)',
    asideGlow:     'rgba(99,102,241,0.08)',
  },
};

// ─── Pill option descriptors (sidebar shows A/B only — Full Year is on the report page) ───

const PILL_OPTIONS: { view: SemesterView; label: string }[] = [
  { view: 'A', label: "מחצית א'" },
  { view: 'B', label: "מחצית ב'" },
];

// ─── Animated subtitle with slow ripple wave ──────────────────────────────────

function SubtitleRipple(): React.JSX.Element {
  return (
    <div className="relative mt-0.5 overflow-hidden py-0.5">
      <span className="relative z-10 block text-[11px] font-semibold leading-none tracking-wide text-white/80">
        מדדים, לא ניחושים
      </span>
      <motion.div
        className="pointer-events-none absolute inset-y-0 w-12"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
          filter: 'blur(4px)',
        }}
        initial={{ x: '-48px' }}
        animate={{ x: '260px' }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          repeatDelay: 2.5,
          ease: 'easeInOut',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Navigation structure ─────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: '/dashboard', label: 'ראשי',         icon: LayoutDashboard },
  { href: '/classes',   label: 'הכיתות שלי',   icon: BookOpen        },
  { href: '/schedule',  label: 'מערכת שעות',   icon: CalendarDays    },
] as const;

const TOOLS_NAV = [
  { href: '/norms',    label: 'טבלאות הישגים', icon: Target   },
  { href: '/reports',  label: 'הפקת דוחות',    icon: FileDown },
] as const;

const PE_NAV = [
  { href: '/exemptions',           label: 'פטורים',            icon: ShieldAlert },
  { href: '/outstanding-students', label: 'תלמידים מצטיינים',  icon: Crown       },
  { href: '/events',               label: 'אירועים וטורנירים', icon: Swords      },
  { href: '/exercise-bank',        label: 'מתכנן שיעור',       icon: Dumbbell    },
] as const;

type NavEntry = { href: string; label: string; icon: typeof LayoutDashboard };

// ─── Domino animation variants ────────────────────────────────────────────────

const NAV_LIST = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
};

const NAV_ITEM_ANIM = {
  hidden: { opacity: 0, y: -10 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

export function Sidebar(): React.JSX.Element {
  const pathname                     = usePathname();
  const router                       = useRouter();
  const { viewMode, setSemesterView } = useSemester();
  const tok                          = VIEW_TOKENS[viewMode];
  const { data: reportSettings }     = useReportSettings();
  const schoolName                   = reportSettings?.schoolName ?? null;

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  function isActive(href: string): boolean {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  }

  function NavItem({ href, label, icon: Icon }: NavEntry): React.JSX.Element {
    const active = isActive(href);
    const activeStyle = useMemo(
      () => active
        ? { background: tok.navGradient, border: tok.navBorder, boxShadow: tok.navShadow, backdropFilter: 'blur(12px)', transition: 'box-shadow 0.45s ease' }
        : { border: '1px solid transparent' },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [active, viewMode],
    );
    return (
      <motion.div className="px-2" variants={NAV_ITEM_ANIM}>
        <Link
          href={href}
          prefetch
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
            active ? 'text-white' : 'text-white/60 hover:text-white',
          )}
          style={activeStyle}
          onMouseEnter={(e) => {
            if (!active) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
            }
          }}
          onMouseLeave={(e) => {
            if (!active) {
              e.currentTarget.style.background = '';
              e.currentTarget.style.border = '1px solid transparent';
            }
          }}
        >
          <span className="truncate">{label}</span>
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-colors duration-300',
              active ? tok.navIconClass : 'text-white/35 group-hover:text-white/65',
            )}
            aria-hidden="true"
          />
        </Link>
      </motion.div>
    );
  }

  // Opacity values for ambient glows based on current view
  const glowOpacityA = viewMode === 'A' ? 1 : 0;
  const glowOpacityB = viewMode === 'B' ? 1 : 0;

  return (
    <motion.aside
      className="relative flex h-full w-64 shrink-0 flex-col overflow-hidden"
      animate={{
        background: tok.asideBg,
        boxShadow: `inset -1px 0 0 ${tok.asideGlow}, 4px 0 32px rgba(0,0,0,0.30)`,
      }}
      transition={{ duration: 0.55 }}
      style={{
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      {/* ── Ambient glows ─────────────────────────────────────────────────── */}

      {/* Top glow — violet (A) */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        animate={{ opacity: glowOpacityA }}
        transition={{ duration: 0.55 }}
        style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.40) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      {/* Top glow — green (B) */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        animate={{ opacity: glowOpacityB }}
        transition={{ duration: 0.55 }}
        style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(34,197,94,0.38) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Bottom glow — violet (A) */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        animate={{ opacity: glowOpacityA }}
        transition={{ duration: 0.55 }}
        style={{ background: 'radial-gradient(ellipse at 40% 100%, rgba(168,85,247,0.24) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      {/* Bottom glow — green (B) */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        animate={{ opacity: glowOpacityB }}
        transition={{ duration: 0.55 }}
        style={{ background: 'radial-gradient(ellipse at 40% 100%, rgba(34,197,94,0.20) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* ── Semester-tinted side border ─────────────────────────────────── */}
      <motion.div
        className="pointer-events-none absolute end-0 inset-y-0 z-20 w-[1px]"
        animate={{
          background: viewMode === 'A'
            ? 'linear-gradient(to bottom, rgba(196,157,255,0) 0%, rgba(196,157,255,0.55) 25%, rgba(196,157,255,0.75) 50%, rgba(196,157,255,0.55) 75%, rgba(196,157,255,0) 100%)'
            : 'linear-gradient(to bottom, rgba(134,239,172,0) 0%, rgba(134,239,172,0.55) 25%, rgba(134,239,172,0.75) 50%, rgba(134,239,172,0.55) 75%, rgba(134,239,172,0) 100%)',
        }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
        aria-hidden="true"
      />

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex h-[68px] items-center justify-between px-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="min-w-0">
          <span
            className="block text-[15px] font-black tracking-tight"
            style={{
              background: 'linear-gradient(to left, #f9a8d4, #e879f9, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            FitGrade
          </span>
          <SubtitleRipple />
        </div>

        {schoolName !== null ? (
          <span
            className="text-[12px] font-semibold tracking-wide truncate ms-3 max-w-[100px] text-end"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            title={schoolName}
          >
            {schoolName}
          </span>
        ) : (
          <Dumbbell className={cn('h-[18px] w-[18px] shrink-0', tok.navIconClass)} aria-hidden="true" />
        )}
      </div>

      {/* ── Semester / View Switcher ────────────────────────────────────────── */}
      <div
        className="relative z-10 px-3 pt-3 pb-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Label row */}
        <div className="mb-2 flex items-center justify-end gap-1.5 pe-1">
          <motion.span
            animate={{ color: tok.dotColor }}
            transition={{ duration: 0.45 }}
            className="text-[9px] leading-none"
            aria-hidden="true"
          >
            ●
          </motion.span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
            סמסטר פעיל
          </span>
        </div>

        {/* Segmented pill — three options: מחצית א' | מחצית ב' | שנה שלמה */}
        <div
          className="flex"
          style={{
            background: 'rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: 3,
          }}
          role="radiogroup"
          aria-label="בחירת תצוגה"
        >
          {PILL_OPTIONS.map(({ view, label }) => {
            const isActiveView = viewMode === view;
            const optTok       = VIEW_TOKENS[view];
            return (
              <button
                key={view}
                type="button"
                role="radio"
                aria-checked={isActiveView}
                onClick={() => { setSemesterView(view); }}
                className="relative flex-1 rounded-[11px] py-[7px] text-[11px] font-bold transition-colors duration-300"
                style={{
                  color: isActiveView ? optTok.pillTextColor : 'rgba(255,255,255,0.32)',
                }}
              >
                {isActiveView && (
                  <motion.div
                    layoutId="semester-pill-sidebar"
                    className="absolute inset-0 rounded-[11px]"
                    animate={{
                      backgroundColor: optTok.pillBg,
                      boxShadow:       optTok.pillShadow,
                      borderColor:     optTok.pillBorder,
                    }}
                    style={{ border: '1px solid' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    initial={false}
                  />
                )}
                <span className="relative z-10 block leading-none">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex flex-1 flex-col overflow-y-auto py-3" aria-label="ניווט ראשי">
        <motion.div className="flex-1" variants={NAV_LIST} initial="hidden" animate="show">
          <motion.div className="space-y-0.5" variants={NAV_LIST}>
            {MAIN_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </motion.div>

          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          <div className="mb-2 px-5">
            <p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              כלים
            </p>
          </div>

          <motion.div className="space-y-0.5" variants={NAV_LIST}>
            {TOOLS_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </motion.div>

          <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          <div className="mb-2 px-5">
            <p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
              חינוך גופני
            </p>
          </div>

          <motion.div className="space-y-0.5" variants={NAV_LIST}>
            {PE_NAV.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </motion.div>
        </motion.div>

        {/* Settings — pinned to bottom of nav */}
        <motion.div
          className="mt-auto pt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.65 } }}
        >
          <NavItem href="/settings" label="הגדרות" icon={Settings2} />
        </motion.div>
      </nav>

      {/* ── Logout ─────────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 p-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          type="button"
          onClick={() => { void handleLogout(); }}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(252,165,165,1)';
            e.currentTarget.style.background = 'rgba(239,68,68,0.10)';
            e.currentTarget.style.border = '1px solid rgba(239,68,68,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            e.currentTarget.style.background = '';
            e.currentTarget.style.border = '';
          }}
          aria-label="התנתק מהמערכת"
        >
          <span>התנתק</span>
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.aside>
  );
}
