'use client';

/**
 * SemesterContext — global active semester state.
 *
 * Persists to localStorage so the teacher's semester selection survives page
 * refreshes and navigation. Defaults to 'A' on first visit.
 *
 * View modes:
 *   'A'    — Semester A only (data entry + display)
 *   'B'    — Semester B only (data entry + display)
 *   'FULL' — All semesters combined (display only; data entry always uses activeSemester)
 *
 * Key properties:
 *   activeSemester  — always 'A' or 'B'; safe to pass to session creation / attendance APIs
 *   semesterFilter  — undefined when Full Year view, else activeSemester;
 *                     pass to all READ-ONLY SWR hooks (report, profile, details, etc.)
 *   isFullYearView  — true when the teacher selected "שנה שלמה" in the sidebar
 *   setSemesterView — unified setter; accepts 'A', 'B', or 'FULL'
 *   setActiveSemester — backward-compat alias for setSemesterView (only accepts 'A' | 'B')
 *
 * Hydration safety: the initial render (SSR + first client render) always uses
 * 'A' so the server and client HTML match. A useEffect syncs with localStorage
 * immediately after mount.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Semester } from '@fitgrade/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fitgrade-active-semester-v1';

export type SemesterView = Semester | 'FULL';

const DEFAULT_VIEW: SemesterView = 'A';

function parseStoredView(value: unknown): SemesterView {
  if (value === 'A' || value === 'B' || value === 'FULL') return value;
  return DEFAULT_VIEW;
}

/** The last concrete semester (A or B) from any given view mode. */
function viewToActiveSemester(view: SemesterView): Semester {
  return view === 'FULL' ? 'A' : view;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────

interface SemesterContextValue {
  /**
   * The semester used for DATA ENTRY (session creation, attendance, lesson).
   * Always 'A' or 'B' — safe for all write operations.
   */
  activeSemester: Semester;

  /**
   * For READ-ONLY SWR hooks and report pages.
   * undefined when Full Year view is active (API returns data for all semesters).
   * Otherwise equals activeSemester.
   */
  semesterFilter: Semester | undefined;

  /** True when the teacher selected "שנה שלמה" in the sidebar. */
  isFullYearView: boolean;

  /** The current view mode shown in the sidebar: 'A', 'B', or 'FULL'. */
  viewMode: SemesterView;

  /**
   * Switch the view. Pass 'A', 'B', or 'FULL'.
   * Updating to 'A' or 'B' also updates activeSemester.
   * Updating to 'FULL' does NOT change activeSemester (data entry stays on last A/B).
   */
  setSemesterView: (view: SemesterView) => void;

  /**
   * Backward-compatible alias — switches to the given semester and clears Full Year view.
   * Prefer setSemesterView for new code.
   */
  setActiveSemester: (semester: Semester) => void;

  /**
   * True after the initial localStorage sync on mount.
   * Use this to avoid rendering semester-sensitive content before the stored
   * semester is known.
   */
  isHydrated: boolean;
}

const SemesterContext = createContext<SemesterContextValue>({
  activeSemester:   'A',
  semesterFilter:   'A',
  isFullYearView:   false,
  viewMode:         'A',
  setSemesterView:  () => {},
  setActiveSemester: () => {},
  isHydrated:       false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function SemesterProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [viewMode, setViewModeState] = useState<SemesterView>(DEFAULT_VIEW);
  const [isHydrated, setIsHydrated] = useState(false);

  // Derive activeSemester and semesterFilter from viewMode
  const activeSemester: Semester = viewToActiveSemester(viewMode);
  const semesterFilter: Semester | undefined = viewMode === 'FULL' ? undefined : viewMode;
  const isFullYearView = viewMode === 'FULL';

  // After mount, read localStorage and override the default if a valid value is stored.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = parseStoredView(stored);
      if (parsed !== DEFAULT_VIEW) {
        setViewModeState(parsed);
      }
    } catch {
      // localStorage may be unavailable in private browsing on some browsers.
    }
    setIsHydrated(true);
  }, []);

  const setSemesterView = useCallback((view: SemesterView): void => {
    setViewModeState(view);
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Best-effort persistence — state update already applied above.
    }
  }, []);

  // Backward-compat alias: setActiveSemester('A'|'B') = setSemesterView('A'|'B')
  const setActiveSemester = useCallback((semester: Semester): void => {
    setSemesterView(semester);
  }, [setSemesterView]);

  const value = useMemo<SemesterContextValue>(
    () => ({
      activeSemester,
      semesterFilter,
      isFullYearView,
      viewMode,
      setSemesterView,
      setActiveSemester,
      isHydrated,
    }),
    [activeSemester, semesterFilter, isFullYearView, viewMode, setSemesterView, setActiveSemester, isHydrated],
  );

  return (
    <SemesterContext.Provider value={value}>
      {children}
    </SemesterContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

export function useSemester(): SemesterContextValue {
  return useContext(SemesterContext);
}
