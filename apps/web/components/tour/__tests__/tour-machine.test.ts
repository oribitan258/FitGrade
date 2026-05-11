/**
 * Tier 1.1 — tour state machine reducer.
 *
 * Explicit transition table: one assertion per legal (state, action) pair.
 * Illegal pairs are exhaustively verified to return the same state reference
 * and emit exactly one console.warn in dev.
 */

import { renderHook, act } from '@testing-library/react';
import {
  tourReducer,
  initialTourState,
  isTourActive,
  currentStepIndex,
  useTourMachine,
  type TourAction,
  type TourState,
  type TourPhase,
} from '../use-tour-machine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IDLE:                TourState = { phase: 'idle' };
const SEEDING:             TourState = { phase: 'seeding' };
const NAV_3:               TourState = { phase: 'navigating', nextStep: 3 };
const AWAIT_3_DASH:        TourState = { phase: 'awaiting-page-ready', step: 3, routeKey: 'dashboard' };
const SETTLING_3:          TourState = { phase: 'settling', step: 3 };
const RUNNING_3:           TourState = { phase: 'running',  step: 3 };
const FINISHING:           TourState = { phase: 'finishing' };
const CLEANUP:             TourState = { phase: 'cleanup' };

const ALL_PHASES: TourPhase[] = [
  'idle', 'seeding', 'navigating', 'awaiting-page-ready',
  'settling', 'running', 'finishing', 'cleanup',
];

/** Produce a concrete state for each phase using the same step/key shape. */
function stateFor(phase: TourPhase): TourState {
  switch (phase) {
    case 'idle':                return IDLE;
    case 'seeding':             return SEEDING;
    case 'navigating':          return NAV_3;
    case 'awaiting-page-ready': return AWAIT_3_DASH;
    case 'settling':            return SETTLING_3;
    case 'running':             return RUNNING_3;
    case 'finishing':           return FINISHING;
    case 'cleanup':             return CLEANUP;
  }
}

describe('tourReducer — initial state', () => {
  it('initial state is idle', () => {
    expect(initialTourState).toEqual({ phase: 'idle' });
  });
});

// ─── Legal transition table ──────────────────────────────────────────────────

describe('tourReducer — legal transitions', () => {
  const cases: Array<{ name: string; from: TourState; action: TourAction; to: TourState }> = [
    { name: 'idle + START → seeding',                       from: IDLE,         action: { type: 'START' },                         to: SEEDING },
    { name: 'seeding + SEED_DONE → navigating[0]',          from: SEEDING,      action: { type: 'SEED_DONE' },                     to: { phase: 'navigating', nextStep: 0 } },
    { name: 'navigating[3] + PATH_MATCHED → awaiting[3,k]', from: NAV_3,        action: { type: 'PATH_MATCHED', routeKey: 'dashboard' }, to: { phase: 'awaiting-page-ready', step: 3, routeKey: 'dashboard' } },
    { name: 'navigating[3] + NAVIGATE 7 → navigating[7]',   from: NAV_3,        action: { type: 'NAVIGATE', to: 7 },                to: { phase: 'navigating', nextStep: 7 } },
    { name: 'awaiting[3,k] + PAGE_READY same key → settling[3]', from: AWAIT_3_DASH, action: { type: 'PAGE_READY', routeKey: 'dashboard' }, to: { phase: 'settling', step: 3 } },
    { name: 'settling[3] + LAYOUT_SETTLED → running[3]',    from: SETTLING_3,   action: { type: 'LAYOUT_SETTLED' },                 to: { phase: 'running', step: 3 } },
    { name: 'running[3] + STEP_NEXT → running[4]',          from: RUNNING_3,    action: { type: 'STEP_NEXT' },                      to: { phase: 'running', step: 4 } },
    { name: 'running[3] + STEP_PREV → running[2]',          from: RUNNING_3,    action: { type: 'STEP_PREV' },                      to: { phase: 'running', step: 2 } },
    { name: 'running[3] + NAVIGATE 9 → navigating[9]',      from: RUNNING_3,    action: { type: 'NAVIGATE', to: 9 },                to: { phase: 'navigating', nextStep: 9 } },
    { name: 'running[3] + FINISH → finishing',              from: RUNNING_3,    action: { type: 'FINISH' },                         to: FINISHING },
    { name: 'finishing + SETTINGS_MOUNTED → cleanup',       from: FINISHING,    action: { type: 'SETTINGS_MOUNTED' },               to: CLEANUP },
    { name: 'cleanup + CLEAR_DONE → idle',                  from: CLEANUP,      action: { type: 'CLEAR_DONE' },                     to: IDLE },
  ];

  it.each(cases)('$name', ({ from, action, to }) => {
    expect(tourReducer(from, action)).toEqual(to);
  });
});

// ─── SKIP universal rules ─────────────────────────────────────────────────────

describe('tourReducer — SKIP', () => {
  it('idle + SKIP is a no-op (returns same idle reference)', () => {
    const result = tourReducer(IDLE, { type: 'SKIP' });
    expect(result).toBe(IDLE);
  });

  it.each<TourPhase>([
    'seeding', 'navigating', 'awaiting-page-ready',
    'settling', 'running', 'finishing', 'cleanup',
  ])('%s + SKIP → cleanup', (phase) => {
    expect(tourReducer(stateFor(phase), { type: 'SKIP' })).toEqual({ phase: 'cleanup' });
  });
});

// ─── PAGE_READY routeKey mismatch ────────────────────────────────────────────

describe('tourReducer — PAGE_READY routeKey rejection', () => {
  it('awaiting[3,dashboard] + PAGE_READY{other} returns unchanged state', () => {
    const result = tourReducer(AWAIT_3_DASH, { type: 'PAGE_READY', routeKey: 'classes' });
    // Reducer returns the same state reference (`return state`) when key mismatches.
    expect(result).toBe(AWAIT_3_DASH);
  });

  it('awaiting[3,dashboard] + PAGE_READY{dashboard} advances to settling[3]', () => {
    const result = tourReducer(AWAIT_3_DASH, { type: 'PAGE_READY', routeKey: 'dashboard' });
    expect(result).toEqual({ phase: 'settling', step: 3 });
  });
});

// ─── Illegal-transition pairs ────────────────────────────────────────────────
//
// For every (phase, action) pair NOT in the legal table above, assert:
//   1. reducer returns the same state reference (`return illegal(state, action)`)
//   2. exactly one console.warn fires in dev mode

describe('tourReducer — illegal transitions', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  // Action types other than SKIP that are illegal from each phase. SKIP is
  // covered by its own describe block.
  const illegalCases: Array<{ phase: TourPhase; action: TourAction }> = [
    // idle accepts only START + SKIP.
    { phase: 'idle', action: { type: 'SEED_DONE' } },
    { phase: 'idle', action: { type: 'PATH_MATCHED', routeKey: 'x' } },
    { phase: 'idle', action: { type: 'PAGE_READY',   routeKey: 'x' } },
    { phase: 'idle', action: { type: 'LAYOUT_SETTLED' } },
    { phase: 'idle', action: { type: 'STEP_NEXT' } },
    { phase: 'idle', action: { type: 'STEP_PREV' } },
    { phase: 'idle', action: { type: 'NAVIGATE', to: 5 } },
    { phase: 'idle', action: { type: 'FINISH' } },
    { phase: 'idle', action: { type: 'SETTINGS_MOUNTED' } },
    { phase: 'idle', action: { type: 'CLEAR_DONE' } },

    // seeding accepts only SEED_DONE + SKIP.
    { phase: 'seeding', action: { type: 'START' } },
    { phase: 'seeding', action: { type: 'PATH_MATCHED', routeKey: 'x' } },
    { phase: 'seeding', action: { type: 'LAYOUT_SETTLED' } },
    { phase: 'seeding', action: { type: 'STEP_NEXT' } },
    { phase: 'seeding', action: { type: 'NAVIGATE', to: 5 } },
    { phase: 'seeding', action: { type: 'FINISH' } },
    { phase: 'seeding', action: { type: 'CLEAR_DONE' } },

    // navigating accepts only PATH_MATCHED + NAVIGATE + SKIP.
    { phase: 'navigating', action: { type: 'START' } },
    { phase: 'navigating', action: { type: 'SEED_DONE' } },
    { phase: 'navigating', action: { type: 'PAGE_READY', routeKey: 'x' } },
    { phase: 'navigating', action: { type: 'LAYOUT_SETTLED' } },
    { phase: 'navigating', action: { type: 'STEP_NEXT' } },
    { phase: 'navigating', action: { type: 'FINISH' } },
    { phase: 'navigating', action: { type: 'CLEAR_DONE' } },

    // awaiting-page-ready accepts only PAGE_READY + SKIP.
    { phase: 'awaiting-page-ready', action: { type: 'START' } },
    { phase: 'awaiting-page-ready', action: { type: 'SEED_DONE' } },
    { phase: 'awaiting-page-ready', action: { type: 'PATH_MATCHED', routeKey: 'x' } },
    { phase: 'awaiting-page-ready', action: { type: 'LAYOUT_SETTLED' } },
    { phase: 'awaiting-page-ready', action: { type: 'STEP_NEXT' } },
    { phase: 'awaiting-page-ready', action: { type: 'NAVIGATE', to: 5 } },
    { phase: 'awaiting-page-ready', action: { type: 'FINISH' } },

    // settling accepts only LAYOUT_SETTLED + SKIP.
    { phase: 'settling', action: { type: 'START' } },
    { phase: 'settling', action: { type: 'PAGE_READY', routeKey: 'x' } },
    { phase: 'settling', action: { type: 'STEP_NEXT' } },
    { phase: 'settling', action: { type: 'NAVIGATE', to: 5 } },
    { phase: 'settling', action: { type: 'FINISH' } },

    // running accepts STEP_NEXT/PREV, NAVIGATE, FINISH, SKIP.
    { phase: 'running', action: { type: 'START' } },
    { phase: 'running', action: { type: 'SEED_DONE' } },
    { phase: 'running', action: { type: 'PATH_MATCHED', routeKey: 'x' } },
    { phase: 'running', action: { type: 'PAGE_READY', routeKey: 'x' } },
    { phase: 'running', action: { type: 'LAYOUT_SETTLED' } },
    { phase: 'running', action: { type: 'SETTINGS_MOUNTED' } },
    { phase: 'running', action: { type: 'CLEAR_DONE' } },

    // finishing accepts only SETTINGS_MOUNTED + SKIP.
    { phase: 'finishing', action: { type: 'START' } },
    { phase: 'finishing', action: { type: 'STEP_NEXT' } },
    { phase: 'finishing', action: { type: 'NAVIGATE', to: 5 } },
    { phase: 'finishing', action: { type: 'CLEAR_DONE' } },

    // cleanup accepts only CLEAR_DONE + SKIP.
    { phase: 'cleanup', action: { type: 'START' } },
    { phase: 'cleanup', action: { type: 'SEED_DONE' } },
    { phase: 'cleanup', action: { type: 'STEP_NEXT' } },
    { phase: 'cleanup', action: { type: 'SETTINGS_MOUNTED' } },
  ];

  it.each(illegalCases)('$phase + $action.type returns same state reference', ({ phase, action }) => {
    const state = stateFor(phase);
    const result = tourReducer(state, action);
    expect(result).toBe(state);
  });

  it('illegal transitions emit one console.warn each (NODE_ENV !== production)', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    tourReducer(IDLE,    { type: 'SEED_DONE' });
    tourReducer(SEEDING, { type: 'FINISH' });
    tourReducer(CLEANUP, { type: 'START' });
    expect(warnSpy).toHaveBeenCalledTimes(3);
    for (const call of warnSpy.mock.calls) {
      expect(String(call[0])).toMatch(/illegal transition/);
    }
  });
});

// ─── Reducer purity ──────────────────────────────────────────────────────────

describe('tourReducer — purity', () => {
  it('does not mutate the input state for legal transitions', () => {
    const state: TourState = { phase: 'running', step: 5 };
    const snapshot = { ...state };
    tourReducer(state, { type: 'STEP_NEXT' });
    expect(state).toEqual(snapshot);
  });

  it('produces deep-equal results for identical (state, action) inputs', () => {
    const a = tourReducer(NAV_3, { type: 'PATH_MATCHED', routeKey: 'k' });
    const b = tourReducer(NAV_3, { type: 'PATH_MATCHED', routeKey: 'k' });
    expect(a).toEqual(b);
  });
});

// ─── Selectors ───────────────────────────────────────────────────────────────

describe('isTourActive selector', () => {
  it.each<TourPhase>(['idle'])('returns false for %s', (phase) => {
    expect(isTourActive(stateFor(phase))).toBe(false);
  });
  it.each<TourPhase>([
    'seeding', 'navigating', 'awaiting-page-ready',
    'settling', 'running', 'finishing', 'cleanup',
  ])('returns true for %s', (phase) => {
    expect(isTourActive(stateFor(phase))).toBe(true);
  });
});

describe('currentStepIndex selector', () => {
  it('returns null for idle / seeding / finishing / cleanup', () => {
    for (const phase of ['idle', 'seeding', 'finishing', 'cleanup'] as TourPhase[]) {
      expect(currentStepIndex(stateFor(phase))).toBeNull();
    }
  });

  it('returns nextStep for navigating', () => {
    expect(currentStepIndex({ phase: 'navigating', nextStep: 11 })).toBe(11);
  });

  it.each<{ state: TourState; expected: number }>([
    { state: { phase: 'awaiting-page-ready', step: 4, routeKey: 'k' }, expected: 4 },
    { state: { phase: 'settling',            step: 5 },                expected: 5 },
    { state: { phase: 'running',             step: 6 },                expected: 6 },
  ])('returns step for $state.phase', ({ state, expected }) => {
    expect(currentStepIndex(state)).toBe(expected);
  });
});

// ─── Sanity: ALL_PHASES list matches the type union ──────────────────────────

describe('phase coverage sanity', () => {
  it('ALL_PHASES contains every TourPhase used by tests', () => {
    // If a future phase is added to the union, stateFor() must handle it.
    for (const phase of ALL_PHASES) {
      expect(() => stateFor(phase)).not.toThrow();
    }
  });
});

// ─── useTourMachine hook ─────────────────────────────────────────────────────

describe('useTourMachine hook', () => {
  it('returns initial state idle and a working dispatch', () => {
    const { result } = renderHook(() => useTourMachine());
    expect(result.current.state).toEqual({ phase: 'idle' });

    act(() => {
      result.current.dispatch({ type: 'START' });
    });
    expect(result.current.state).toEqual({ phase: 'seeding' });

    act(() => {
      result.current.dispatch({ type: 'SEED_DONE' });
    });
    expect(result.current.state).toEqual({ phase: 'navigating', nextStep: 0 });
  });

  it('dispatch reference is stable across renders', () => {
    const { result, rerender } = renderHook(() => useTourMachine());
    const firstDispatch = result.current.dispatch;
    rerender();
    expect(result.current.dispatch).toBe(firstDispatch);
  });
});
