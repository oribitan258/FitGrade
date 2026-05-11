'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIMARY_TABS = [
  { href: '/dashboard', label: 'ראשי',  icon: LayoutDashboard },
  { href: '/classes',   label: 'כיתות', icon: BookOpen        },
  { href: '/schedule',  label: 'מערכת', icon: CalendarDays    },
] as const;

export function MobileBottomNav({
  onOpenMore,
}: {
  onOpenMore: () => void;
}): React.JSX.Element {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);
  }

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 print:hidden"
      aria-label="ניווט תחתון"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="flex h-[60px] items-stretch border-t border-slate-200/70"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
              aria-current={active ? 'page' : undefined}
            >
              {/* Material 3-style active pill at top edge */}
              <span
                className={cn(
                  'absolute top-0 h-[3px] w-10 rounded-b-full transition-all duration-300',
                  active ? 'bg-teal-500 opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors duration-200',
                  active ? 'text-teal-600' : 'text-slate-400',
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-[10px] font-semibold leading-none transition-colors duration-200',
                  active ? 'text-teal-600' : 'text-slate-400',
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* More — opens the full nav drawer */}
        <button
          type="button"
          onClick={onOpenMore}
          className="relative flex flex-1 flex-col items-center justify-center gap-[3px]"
          aria-label="עוד אפשרויות ניווט"
        >
          <span className="absolute top-0 h-[3px] w-10 rounded-b-full opacity-0" aria-hidden="true" />
          <MoreHorizontal className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <span className="text-[10px] font-semibold leading-none text-slate-400">עוד</span>
        </button>
      </div>
    </nav>
  );
}
