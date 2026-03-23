'use client';

/**
 * useBeepStudents — Layer 2 state management for the Beep Test Console.
 *
 * Responsibilities:
 *   - Maintain the roster of students with their ACTIVE / WARNING / ELIMINATED status.
 *   - Implement the "Second Chance" rule: ACTIVE → WARNING → ELIMINATED vs ACTIVE → ELIMINATED.
 *   - Keep a chronological history stack for UNDO.
 *   - Debounce-persist state to localStorage for crash recovery.
 *   - Expose a typed dispatch function and derived helpers.
 *
 * Architecture contract:
 *   - This hook lives entirely in React state (useReducer).  It does NOT touch
 *     the beep engine or any DOM refs — those are Layer 1 (use-beep-engine.ts).
 *   - ZERO side effects inside the reducer — all localStorage writes happen in
 *     a useEffect that watches state.
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StudentStatus = 'ACTIVE' | 'WARNING' | 'ELIMINATED';

export interface BeepStudentState {
  id: string;
  firstName: string;
  lastName: string;
  status: StudentStatus;
  /** Set when the student is first marked WARNING (second-chance mode only). */
  warningAt: { level: number; shuttle: number } | null;
  /** Set when the student is finally eliminated. */
  eliminatedAt: { level: number; shuttle: number } | null;
}

// ── Roster state ─────────────────────────────────────────────────────────────

interface BeepStudentsState {
  /** Current student roster with their statuses. */
  students: BeepStudentState[];
  /**
   * History stack for UNDO.  Each entry records the student's full state
   * *before* the tap so we can revert it exactly.
   */
  history: BeepStudentState[];
}

const INITIAL_STATE: BeepStudentsState = {
  students: [],
  history: [],
};

// ── Actions ──────────────────────────────────────────────────────────────────

interface InitStudentsAction {
  type: 'INIT_STUDENTS';
  /** Full student objects from the class roster. */
  students: Array<Pick<BeepStudentState, 'id' | 'firstName' | 'lastName'>>;
}

interface TapStudentAction {
  type: 'TAP_STUDENT';
  studentId: string;
  /** Beep-engine level at the moment of the tap (read from currentLevelRef). */
  currentLevel: number;
  /** Beep-engine shuttle at the moment of the tap (read from currentShuttleRef). */
  currentShuttle: number;
  /** Whether the teacher has enabled the "Second Chance" rule for this session. */
  secondChanceEnabled: boolean;
}

interface UndoAction {
  type: 'UNDO';
}

interface RestoreSessionAction {
  type: 'RESTORE_SESSION';
  /** Previously persisted state loaded from localStorage. */
  savedState: PersistedBeepState;
}

export type BeepStudentAction =
  | InitStudentsAction
  | TapStudentAction
  | UndoAction
  | RestoreSessionAction;

// ── Persisted shape ───────────────────────────────────────────────────────────

export interface PersistedBeepState {
  sessionId: string;
  students: BeepStudentState[];
  /** History is not restored — undo is not available after a crash recovery. */
  secondChanceEnabled: boolean;
  savedAt: number; // Date.now()
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of undo steps kept in memory. */
const MAX_HISTORY = 50;

function beepStudentsReducer(
  state: BeepStudentsState,
  action: BeepStudentAction,
): BeepStudentsState {
  switch (action.type) {
    // ── INIT_STUDENTS ──────────────────────────────────────────────────────
    case 'INIT_STUDENTS': {
      const students: BeepStudentState[] = action.students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        status: 'ACTIVE',
        warningAt: null,
        eliminatedAt: null,
      }));
      return { students, history: [] };
    }

    // ── TAP_STUDENT ───────────────────────────────────────────────────────
    case 'TAP_STUDENT': {
      const idx = state.students.findIndex((s) => s.id === action.studentId);
      if (idx === -1) return state; // Unknown student — no-op.

      const student = state.students[idx];

      // Debounce: ignore taps on already-eliminated students.
      if (student.status === 'ELIMINATED') return state;

      const position = { level: action.currentLevel, shuttle: action.currentShuttle };

      let updatedStudent: BeepStudentState;

      if (action.secondChanceEnabled && student.status === 'ACTIVE') {
        // First tap → WARNING
        updatedStudent = { ...student, status: 'WARNING', warningAt: position };
      } else {
        // Second tap with second chance, OR first tap without second chance → ELIMINATED
        updatedStudent = { ...student, status: 'ELIMINATED', eliminatedAt: position };
      }

      const updatedStudents = state.students.map((s, i) =>
        i === idx ? updatedStudent : s,
      );

      // Push the *previous* state of this student onto the history stack.
      const newHistory = [...state.history, student].slice(-MAX_HISTORY);

      return { students: updatedStudents, history: newHistory };
    }

    // ── UNDO ──────────────────────────────────────────────────────────────
    case 'UNDO': {
      if (state.history.length === 0) return state; // Nothing to undo.

      const previous = state.history[state.history.length - 1];
      const newHistory = state.history.slice(0, -1);

      const updatedStudents = state.students.map((s) =>
        s.id === previous.id ? previous : s,
      );

      return { students: updatedStudents, history: newHistory };
    }

    // ── RESTORE_SESSION ───────────────────────────────────────────────────
    case 'RESTORE_SESSION': {
      // History is dropped on restore — undo is not available after recovery.
      return { students: action.savedState.students, history: [] };
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook options & return type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseBeepStudentsOptions {
  /** Session ID used as the localStorage persistence key. */
  sessionId: string;
  /** Whether second-chance rule is on (forwarded to every TAP_STUDENT dispatch). */
  secondChanceEnabled: boolean;
}

export interface UseBeepStudentsReturn {
  /** Full roster with current statuses. */
  students: BeepStudentState[];
  /** Students still running. */
  activeStudents: BeepStudentState[];
  /** Students who received exactly one tap in second-chance mode. */
  warningStudents: BeepStudentState[];
  /** Students who have been fully eliminated. */
  eliminatedStudents: BeepStudentState[];
  /** True when the undo stack is non-empty. */
  canUndo: boolean;
  /** Tap a student (records WARNING or ELIMINATION based on secondChanceEnabled). */
  tapStudent: (studentId: string, currentLevel: number, currentShuttle: number) => void;
  /** Revert the last tap. */
  undo: () => void;
  /** Load the full class roster and reset all states. */
  initStudents: (
    roster: Array<Pick<BeepStudentState, 'id' | 'firstName' | 'lastName'>>,
  ) => void;
  /** Restore from a crash-recovery snapshot. */
  restoreSession: (saved: PersistedBeepState) => void;
  /** Read a saved session from localStorage (returns null if none or expired). */
  readSavedSession: () => PersistedBeepState | null;
  /** Delete the crash-recovery snapshot (call on COMPLETE or explicit stop). */
  clearSavedSession: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce delay before writing state to localStorage (ms). */
const PERSIST_DEBOUNCE_MS = 1_000;

/** Sessions older than this are ignored for crash recovery. */
const MAX_RECOVERY_AGE_MS = 2 * 60 * 60 * 1_000; // 2 hours

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useBeepStudents({
  sessionId,
  secondChanceEnabled,
}: UseBeepStudentsOptions): UseBeepStudentsReturn {
  const [state, dispatch] = useReducer(beepStudentsReducer, INITIAL_STATE);

  const storageKey = `fitgrade-beep-${sessionId}`;

  // ── Derived slices (memoised to prevent unnecessary child re-renders) ────
  const activeStudents = useMemo(
    () => state.students.filter((s) => s.status === 'ACTIVE'),
    [state.students],
  );

  const warningStudents = useMemo(
    () => state.students.filter((s) => s.status === 'WARNING'),
    [state.students],
  );

  const eliminatedStudents = useMemo(
    () => state.students.filter((s) => s.status === 'ELIMINATED'),
    [state.students],
  );

  const canUndo = state.history.length > 0;

  // ── Public dispatch wrappers ─────────────────────────────────────────────

  const initStudents = useCallback(
    (roster: Array<Pick<BeepStudentState, 'id' | 'firstName' | 'lastName'>>): void => {
      dispatch({ type: 'INIT_STUDENTS', students: roster });
    },
    [],
  );

  const tapStudent = useCallback(
    (studentId: string, currentLevel: number, currentShuttle: number): void => {
      dispatch({
        type: 'TAP_STUDENT',
        studentId,
        currentLevel,
        currentShuttle,
        secondChanceEnabled,
      });
    },
    [secondChanceEnabled],
  );

  const undo = useCallback((): void => {
    dispatch({ type: 'UNDO' });
  }, []);

  const restoreSession = useCallback((saved: PersistedBeepState): void => {
    dispatch({ type: 'RESTORE_SESSION', savedState: saved });
  }, []);

  // ── localStorage helpers ─────────────────────────────────────────────────

  const readSavedSession = useCallback((): PersistedBeepState | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return null;

      const parsed = JSON.parse(raw) as PersistedBeepState;
      if (Date.now() - parsed.savedAt > MAX_RECOVERY_AGE_MS) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearSavedSession = useCallback((): void => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  // ── Debounced crash-recovery persist ─────────────────────────────────────
  //
  // Fires 1 second after any state change.  We skip the write when the
  // roster is empty (nothing meaningful to persist yet).
  useEffect(() => {
    if (state.students.length === 0) return;

    const handle = window.setTimeout(() => {
      const payload: PersistedBeepState = {
        sessionId,
        students: state.students,
        secondChanceEnabled,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // localStorage quota exceeded — silently skip; crash recovery is best-effort.
      }
    }, PERSIST_DEBOUNCE_MS);

    return (): void => {
      window.clearTimeout(handle);
    };
  }, [state.students, sessionId, secondChanceEnabled, storageKey]);

  return {
    students: state.students,
    activeStudents,
    warningStudents,
    eliminatedStudents,
    canUndo,
    tapStudent,
    undo,
    initStudents,
    restoreSession,
    readSavedSession,
    clearSavedSession,
  };
}
