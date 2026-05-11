'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

// Active session sub-routes — FAB is hidden on these for distraction-free mode
const HIDDEN_SEGMENTS = ['live', 'long-distance', 'sprint', 'beep', 'manual', 'prep'];

export function FAB(): React.JSX.Element | null {
  const pathname = usePathname();
  const router   = useRouter();

  if (HIDDEN_SEGMENTS.some((seg) => pathname.includes(`/${seg}`))) return null;

  const classMatch = pathname.match(/\/classes\/([^/]+)/);
  const classId    = classMatch?.[1] ?? null;

  function handlePress(): void {
    if (classId !== null) {
      router.push(`/classes/${classId}/lesson`);
    } else {
      router.push('/classes');
    }
  }

  return (
    <button
      type="button"
      onClick={handlePress}
      aria-label="התחל שיעור"
      className="md:hidden fixed z-40 flex items-center gap-2 print:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
        insetInlineEnd: '16px',
        height: 52,
        paddingInlineStart: 18,
        paddingInlineEnd: 18,
        borderRadius: 26,
        background: 'linear-gradient(135deg, #2dd4bf 0%, #10b981 100%)',
        boxShadow: '0 4px 20px rgba(16,185,129,0.40), 0 2px 8px rgba(0,0,0,0.10)',
      }}
    >
      <Play className="h-4 w-4 shrink-0 fill-white text-white" aria-hidden="true" />
      <span className="text-[13px] font-bold leading-none text-white">התחל שיעור</span>
    </button>
  );
}
