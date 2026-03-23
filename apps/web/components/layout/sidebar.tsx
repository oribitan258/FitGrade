'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  Crown,
  Dumbbell,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Swords,
  Target,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-client';

// ─── Animated subtitle with slow ripple wave ──────────────────────────────────

function SubtitleRipple(): React.JSX.Element {
  return (
    <div className="relative mt-0.5 overflow-hidden py-0.5">
      {/* Static text */}
      <span className="relative z-10 block text-[11px] font-semibold leading-none tracking-wide text-white/80">
        מדדים, לא ניחושים
      </span>

      {/* Ripple wave — slow shimmer sweep */}
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
  { href: '/norms',   label: 'טבלאות הישגים', icon: Target   },
  { href: '/reports', label: 'הפקת דוחות',    icon: FileDown },
] as const;

const PE_NAV = [
  { href: '/exemptions',           label: 'פטורים',            icon: ShieldAlert },
  { href: '/outstanding-students', label: 'תלמידים מצטיינים',  icon: Crown       },
  { href: '/events',               label: 'אירועים וטורנירים', icon: Swords      },
  { href: '/exercise-bank',        label: 'מתכנן שיעור',       icon: Dumbbell    },
] as const;

type NavEntry = { href: string; label: string; icon: typeof LayoutDashboard };

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  function isActive(href: string): boolean {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  }

  function NavItem({ href, label, icon: Icon }: NavEntry): React.JSX.Element {
    const active = isActive(href);
    return (
      <div className="px-2">
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
            active ? 'text-white' : 'text-white/60 hover:text-white',
          )}
          style={
            active
              ? {
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.45) 0%, rgba(109,40,217,0.38) 100%)',
                  border: '1px solid rgba(196,157,255,0.60)',
                  boxShadow: [
                    '0 0 24px rgba(168,85,247,0.45)',
                    '0 0 48px rgba(168,85,247,0.18)',
                    'inset 0 1px 0 rgba(255,255,255,0.20)',
                    'inset 0 0 20px rgba(139,92,246,0.15)',
                    '0 4px 12px rgba(0,0,0,0.25)',
                  ].join(', '),
                  backdropFilter: 'blur(12px)',
                }
              : {
                  border: '1px solid transparent',
                }
          }
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
              'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
              active ? 'text-violet-200' : 'text-white/35 group-hover:text-white/65',
            )}
            aria-hidden="true"
          />
        </Link>
      </div>
    );
  }

  return (
    <aside
      className="relative flex h-full w-64 shrink-0 flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(45,28,95,0.88) 0%, rgba(28,16,68,0.92) 40%, rgba(18,10,48,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        borderInlineEnd: '1px solid rgba(196,157,255,0.12)',
        boxShadow: [
          'inset -1px 0 0 rgba(168,85,247,0.08)',
          '4px 0 32px rgba(0,0,0,0.30)',
        ].join(', '),
      }}
    >
      {/* ── Ambient top glow (decorative) ───────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.22) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* ── Ambient bottom glow (decorative) ────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        style={{
          background: 'radial-gradient(ellipse at 40% 100%, rgba(168,85,247,0.12) 0%, transparent 70%)',
        }}
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

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.50) 0%, rgba(109,40,217,0.42) 100%)',
            border: '1px solid rgba(196,157,255,0.50)',
            boxShadow: [
              '0 0 20px rgba(168,85,247,0.40)',
              'inset 0 1px 0 rgba(255,255,255,0.20)',
            ].join(', '),
            backdropFilter: 'blur(8px)',
          }}
        >
          <GraduationCap className="h-[18px] w-[18px] text-violet-100" aria-hidden="true" />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-3" aria-label="ניווט ראשי">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

        {/* Section: כלים */}
        <div className="mb-2 px-5">
          <p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
            כלים
          </p>
        </div>

        <div className="space-y-0.5">
          {TOOLS_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

        {/* Section: חינוך גופני */}
        <div className="mb-2 px-5">
          <p className="text-end text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
            חינוך גופני
          </p>
        </div>

        <div className="space-y-0.5">
          {PE_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
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
    </aside>
  );
}
