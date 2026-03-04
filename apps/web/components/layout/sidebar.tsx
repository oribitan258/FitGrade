'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-client';

const NAV_ITEMS = [
  { href: '/classes', label: 'הכיתות שלי', icon: BookOpen },
] as const;

/**
 * RTL-aware sidebar for the teacher shell.
 *
 * In dir="rtl" with flex-row, the sidebar is the first child so the browser
 * renders it on the right. border-e places the divider on its inline-end
 * (left) side — the line separating it from the main content area.
 */
export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e bg-card">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
        <span className="text-lg font-semibold tracking-tight">FitGrade</span>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 p-3" aria-label="ניווט ראשי">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => { void handleLogout(); }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="התנתק מהמערכת"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          התנתק
        </button>
      </div>
    </aside>
  );
}
