/**
 * Tour state machine — v3.
 *
 * v2 had 6 phases (idle / seeding / navigating / awaiting-target / running /
 * finishing / cleanup). The DOM-polling 'awaiting-target' phase produced
 * race conditions because it couldn't tell the difference between "page
 * isn't fully rendered" and "target element doesn't exist on this page."
 *
 * v3 replaces 'awaiting-target' with two phases that fuse the three
 * coordinate systems (route, page-data, layout) into ordered conditions:
 *
 *   awaiting-page-ready  — pathname matches; waiting for the page's own
 *                          useEffect to fire signalPageReady(routeKey)
 *                          AFTER its data hooks have populated.
 *   settling             — page is ready; waiting two requestAnimationFrame
 *                          ticks so layout settles before Joyride positions.
 *
 * Page-Ready is per-PAGE (one signal covers all targets on that page),
 * not per-step. Once a page emits ready, intra-page step transitions
 * skip awaiting-page-ready and go straight to settling.
 */
'use client';

import { useReducer } from 'react';

// ─── State ───────────────────────────────────────────────────────────────────

export type TourPhase =
  | 'idle'
  | 'seeding'
  | 'navigating'
  | 'awaiting-page-ready'
  | 'settling'
  | 'running'
  | 'finishing'
  | 'cleanup';

export type TourState =
  | { phase: 'idle' }
  | { phase: 'seeding' }
  | { phase: 'navigating';          nextStep: number }
  | { phase: 'awaiting-page-ready'; step: number; routeKey: string }
  | { phase: 'settling';            step: number }
  | { phase: 'running';             step: number }
  | { phase: 'finishing' }
  | { phase: 'cleanup' };

export const initialTourState: TourState = { phase: 'idle' };

// ─── Actions ─────────────────────────────────────────────────────────────────

export type TourAction =
  | { type: 'START' }
  | { type: 'SEED_DONE' }
  /** Pathname has matched the next step's resolved route. */
  | { type: 'PATH_MATCHED';   routeKey: string }
  /** A page has emitted signalPageReady. */
  | { type: 'PAGE_READY';     routeKey: string }
  /** 2 × requestAnimationFrame elapsed since entering 'settling'. */
  | { type: 'LAYOUT_SETTLED' }
  | { type: 'STEP_NEXT' }
  | { type: 'STEP_PREV' }
  | { type: 'NAVIGATE';       to: number }
  | { type: 'FINISH' }
  | { type: 'SETTINGS_MOUNTED' }
  | { type: 'CLEAR_DONE' }
  | { type: 'SKIP' };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function illegal(state: TourState, action: TourAction): TourState {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[tour] illegal transition: ${state.phase} + ${action.type}`);
  }
  return state;
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  // SKIP is universally valid from any non-idle state — tears down to cleanup.
  if (action.type === 'SKIP') {
    return state.phase === 'idle' ? state : { phase: 'cleanup' };
  }

  switch (state.phase) {
    case 'idle':
      if (action.type === 'START') return { phase: 'seeding' };
      return illegal(state, action);

    case 'seeding':
      if (action.type === 'SEED_DONE') return { phase: 'navigating', nextStep: 0 };
      return illegal(state, action);

    case 'navigating':
      if (action.type === 'PATH_MATCHED') {
        return { phase: 'awaiting-page-ready', step: state.nextStep, routeKey: action.routeKey };
      }
      if (action.type === 'NAVIGATE') {
        return { phase: 'navigating', nextStep: action.to };
      }
      return illegal(state, action);

    case 'awaiting-page-ready':
      if (action.type === 'PAGE_READY') {
        // Reject signals from a page we aren't waiting for. This guards
        // against late signals from a page the user just navigated away from.
        if (action.routeKey !== state.routeKey) return state;
        return { phase: 'settling', step: state.step };
      }
      return illegal(state, action);

    case 'settling':
      if (action.type === 'LAYOUT_SETTLED') return { phase: 'running', step: state.step };
      return illegal(state, action);

    case 'running':
      // Same-page step transitions go straight back into 'running' with the
      // new step. The previous design routed them through 'settling' (2 rAF
      // wait) on the theory that layout might still be settling, but the
      // page is already ready and the target for the new step is already in
      // the DOM — there is nothing to wait for. Skipping settling eliminates
      // the only remaining artificial delay on same-page Next/Prev clicks.
      if (action.type === 'STEP_NEXT') return { phase: 'running', step: state.step + 1 };
      if (action.type === 'STEP_PREV') return { phase: 'running', step: state.step - 1 };
      // Cross-page transitions still go through the full pipeline so the
      // newly-mounted page has a chance to call signalPageReady before we
      // ask Joyride to position on a target that might not yet be in the DOM.
      if (action.type === 'NAVIGATE')  return { phase: 'navigating', nextStep: action.to };
      if (action.type === 'FINISH')    return { phase: 'finishing' };
      return illegal(state, action);

    case 'finishing':
      if (action.type === 'SETTINGS_MOUNTED') return { phase: 'cleanup' };
      return illegal(state, action);

    case 'cleanup':
      if (action.type === 'CLEAR_DONE') return { phase: 'idle' };
      return illegal(state, action);

    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTourMachine(): {
  state:    TourState;
  dispatch: React.Dispatch<TourAction>;
} {
  const [state, dispatch] = useReducer(tourReducer, initialTourState);
  return { state, dispatch };
}

// ─── Derived selectors ───────────────────────────────────────────────────────

export function isTourActive(state: TourState): boolean {
  return state.phase !== 'idle';
}

export function currentStepIndex(state: TourState): number | null {
  switch (state.phase) {
    case 'navigating':           return state.nextStep;
    case 'awaiting-page-ready':
    case 'settling':
    case 'running':              return state.step;
    default:                     return null;
  }
}
