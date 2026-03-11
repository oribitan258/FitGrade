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

// ─── Navigation structure ─────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: '/dashboard', label: 'לוח בקרה',    icon: LayoutDashboard },
  { href: '/classes',   label: 'הכיתות שלי',   icon: BookOpen        },
  { href: '/schedule',  label: 'מערכת שעות',   icon: CalendarDays    },
] as const;

const TOOLS_NAV = [
  { href: '/norms',   label: 'טבלאות הישגים', icon: Target   },
  { href: '/reports', label: 'הפקת דוחות',    icon: FileDown },
] as const;

const PE_NAV = [
  { href: '/exemptions',           label: 'פטורים',           icon: ShieldAlert },
  { href: '/outstanding-students', label: 'תלמידים מצטיינים', icon: Crown       },
  { href: '/events',               label: 'אירועים וטורנירים', icon: Swords      },
  { href: '/exercise-bank',        label: 'מתכנן שיעור',      icon: Dumbbell    },
] as const;

type NavEntry = { href: string; label: string; icon: typeof LayoutDashboard };

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

  function NavItem({ href, label, icon: Icon }: NavEntry): React.JSX.Element {
    const active = isActive(href);
    return (
      <motion.div
        whileHover={active ? {} : { x: -2, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
      >
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
            active
              ? 'bg-indigo-600 text-white shadow-[0_2px_16px_rgba(99,102,241,0.40)]'
              : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
          )}
        >
          {/* Icon capsule — glowing when active, breathing animation */}
          <motion.div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
              active ? 'bg-white/20 shadow-[0_0_14px_rgba(255,255,255,0.30)]' : 'bg-transparent',
            )}
            animate={active ? { scale: [1, 1.09, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            <Icon
              className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-500')}
              aria-hidden="true"
            />
          </motion.div>
          <span className="flex-1 truncate">{label}</span>
        </Link>
      </motion.div>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-indigo-50/80 backdrop-blur-2xl border-e border-white/60 shadow-[4px_0_40px_rgba(67,56,202,0.18)]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/50 px-5">
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_24px_rgba(99,102,241,0.50)]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
        >
          <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <span className="text-base font-bold tracking-tight bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent">FitGrade</span>
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
          whileHover={{ x: -2, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
          whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
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
