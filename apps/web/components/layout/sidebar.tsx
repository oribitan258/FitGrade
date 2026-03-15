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
  { href: '/dashboard', label: 'ראשי',         icon: LayoutDashboard },
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
 * Solid deep-violet sidebar — contrasts sharply against the light glass page background.
 * RTL: sidebar renders on the right (first flex child).
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
              ? 'bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]'
              : 'text-[#c4b5fd]/75 hover:bg-white/10 hover:text-white',
          )}
        >
          {/* Icon capsule */}
          <motion.div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300',
              active ? 'bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'bg-transparent',
            )}
            animate={active ? { scale: [1, 1.09, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          >
            <Icon
              className={cn('h-4 w-4', active ? 'text-white' : 'text-[#c4b5fd]/60')}
              aria-hidden="true"
            />
          </motion.div>
          <span className="flex-1 truncate">{label}</span>
        </Link>
      </motion.div>
    );
  }

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-e border-white/10 shadow-[4px_0_40px_rgba(76,29,149,0.50)]"
      style={{ background: '#4c1d95' }}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-[0_0_20px_rgba(255,255,255,0.12)]"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <span className="text-base font-bold tracking-tight text-white">FitGrade</span>
          <p className="text-[10px] text-[#c4b5fd]/60 leading-none mt-0.5">מערכת חינוך גופני</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="ניווט ראשי">
        {MAIN_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="my-3 px-1">
          <div className="h-px bg-white/10" />
          <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[#c4b5fd]/50">
            כלים
          </p>
        </div>

        {TOOLS_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        <div className="my-3 px-1">
          <div className="h-px bg-white/10" />
          <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[#c4b5fd]/50">
            חינוך גופני
          </p>
        </div>

        {PE_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <motion.button
          type="button"
          onClick={() => { void handleLogout(); }}
          whileHover={{ x: -2, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
          whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#c4b5fd]/60 transition-colors hover:bg-red-400/20 hover:text-red-300"
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
