'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useParams } from 'next/navigation';
import type { CopilotPageContext } from '@fitgrade/types';

/**
 * Tracks the teacher's current page context so the Copilot always sends
 * live, non-stale data when the teacher navigates while the panel is open.
 *
 * Returns:
 *  - `context`    — reactive value for rendering the context indicator strip.
 *  - `contextRef` — a stable ref whose `.current` is always up-to-date;
 *                   read this at send-time to avoid stale closures.
 */
export function useCopilotContext(): {
  context: CopilotPageContext;
  contextRef: React.MutableRefObject<CopilotPageContext>;
} {
  const pathname = usePathname();
  const params   = useParams<{ classId?: string; studentId?: string }>();

  const classId   = params['classId']   ?? null;
  const studentId = params['studentId'] ?? null;

  const today = new Date().toISOString().split('T')[0]!;

  const context: CopilotPageContext = {
    currentRoute: pathname,
    classId,
    studentId,
    selectedDate: today,
  };

  const contextRef = useRef<CopilotPageContext>(context);

  // Keep the ref in sync on every navigation — this runs before the next
  // sendMessage call so the ref is always fresh.
  useEffect(() => {
    contextRef.current = {
      currentRoute: pathname,
      classId,
      studentId,
      selectedDate: new Date().toISOString().split('T')[0]!,
    };
  }, [pathname, classId, studentId]);

  return { context, contextRef };
}
