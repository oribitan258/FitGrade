'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BookOpen,
  CalendarDays,
  Dumbbell,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Target,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-client';

// ─── Navigation structure ─────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: '/dashboard', label: 'לוח בקרה',    icon: LayoutDashboard },
  { href: '/classes',   label: 'הכיתות שלי',   icon: BookOpen        },
  { href: '/schedule',  label: 'מערכת שעות',   icon: CalendarDays    },
] as const;

const TOOLS_NAV = [
  { href: '/norms',   label: 'טבלאות הישגים', icon: Target   },
  { href: '/exports', label: 'הפקת דוחות',    icon: FileDown },
] as const;

const PE_NAV = [
  { href: '/injuries',    label: 'מעקב פציעות', icon: ShieldAlert, soon: false },
  { href: '/badges',      label: 'אות הכושר',   icon: Award,       soon: true  },
  { href: '/drills',      label: 'בנק תרגילים', icon: Dumbbell,    soon: true  },
  { href: '/tournaments', label: 'טורנירים',     icon: Trophy,      soon: true  },
] as const;

type NavEntry = { href: string; label: string; icon: typeof LayoutDashboard; soon?: boolean };

/**
 * Glassmorphic sidebar — sits above the animated background so the
 * gradient and icon grid bleed through the translucent panel.
 *
 * RTL: the sidebar renders on the right (first flex child).
 * border-e = border on the visual "start" edge (logical property, RTL-safe).
 */
export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  function isActive(href: string): boolean {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  }

  function NavItem({ href, label, icon: Icon, soon }: NavEntry): React.JSX.Element {
    const active = isActive(href);
    return (
      <motion.div
        whileHover={active || soon ? {} : { x: -2 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
      >
        <Link
          href={soon ? '#' : href}
          aria-current={active ? 'page' : undefined}
          aria-disabled={soon}
          tabIndex={soon ? -1 : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
            active
              ? 'bg-indigo-600 text-white shadow-[0_2px_16px_rgba(99,102,241,0.40)]'
              : soon
                ? 'cursor-default text-slate-300'
                : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
          )}
        >
          {/* Icon capsule — glowing when active, breathing animation */}
          <motion.div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
              active
                ? 'bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.30)]'
                : 'bg-transparent',
            )}
            animate={active ? { scale: [1, 1.09, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                active ? 'text-white' : soon ? 'text-slate-300' : 'text-slate-500',
              )}
              aria-hidden="true"
            />
          </motion.div>

          <span className="flex-1 truncate">{label}</span>

          {soon && (
            <span className="shrink-0 rounded-full bg-slate-100/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              בקרוב
            </span>
          )}
        </Link>
      </motion.div>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-indigo-50/80 backdrop-blur-2xl border-e border-white/60 shadow-[4px_0_40px_rgba(67,56,202,0.18)]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/50 px-5">
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 shadow-[0_0_16px_rgba(99,102,241,0.35)]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
        >
          <GraduationCap className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        </motion.div>
        <div>
          <span className="text-base font-bold tracking-tight text-slate-800">FitGrade</span>
          <p className="text-[10px] text-slate-400 leading-none mt-0.5">מערכת חינוך גופני</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="ניווט ראשי">
        {MAIN_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="my-3 px-1">
          <div className="h-px bg-slate-200/50" />
          <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            כלים
          </p>
        </div>

        {TOOLS_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="my-3 px-1">
          <div className="h-px bg-slate-200/50" />
          <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            חינוך גופני
          </p>
        </div>

        {PE_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-200/50 p-3">
        <motion.button
          type="button"
          onClick={() => { void handleLogout(); }}
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label="התנתק מהמערכת"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </div>
          התנתק
        </motion.button>
      </div>
    </aside>
  );
}
