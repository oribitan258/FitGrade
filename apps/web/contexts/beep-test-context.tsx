'use client';

/**
 * BeepTestContext — "Zen Mode" flag.
 *
 * When isTestActive is true the teacher layout should suppress all global
 * toasts, copilot prompts, and notification overlays so nothing interrupts
 * the live beep-test session.
 *
 * Usage:
 *   1. Wrap (teacher)/layout.tsx children with <BeepTestProvider>.
 *   2. Read isTestActive in any component that renders notifications.
 *   3. Call setTestActive(true) when the beep test enters RUNNING phase.
 *   4. Call setTestActive(false) on COMPLETE or early exit.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

interface BeepTestContextValue {
  /** True while a beep test session is actively running (RUNNING or PAUSED). */
  isTestActive: boolean;
  /** Set to true on phase RUNNING; set to false on COMPLETE or early stop. */
  setTestActive: (active: boolean) => void;
}

const BeepTestContext = createContext<BeepTestContextValue>({
  isTestActive: false,
  setTestActive: () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function BeepTestProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isTestActive, setIsTestActive] = useState(false);

  const setTestActive = useCallback((active: boolean): void => {
    setIsTestActive(active);
  }, []);

  const value = useMemo<BeepTestContextValue>(
    () => ({ isTestActive, setTestActive }),
    [isTestActive, setTestActive],
  );

  return (
    <BeepTestContext.Provider value={value}>
      {children}
    </BeepTestContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

export function useBeepTestContext(): BeepTestContextValue {
  return useContext(BeepTestContext);
}
