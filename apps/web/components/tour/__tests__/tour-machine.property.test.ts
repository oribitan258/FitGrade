/**
 * Tier 1.2 — property-based tests for the tour state machine.
 *
 * Three invariants verified across random action sequences:
 *   1. Reducer is pure: same (state, action) ⇒ deep-equal output, no input mutation.
 *   2. Step-index monotonicity in running: STEP_NEXT/PREV move by ±1 each.
 *   3. From any reachable non-idle state, SKIP returns to idle within ≤2 steps
 *      (SKIP → cleanup, then CLEAR_DONE → idle).
 */

import fc from 'fast-check';
import {
  tourReducer,
  initialTourState,
  type TourAction,
  type TourState,
} from '../use-tour-machine';

// ─── Action arbitraries ──────────────────────────────────────────────────────

const routeKeys = fc.constantFrom(
  'dashboard', 'classes', 'class-detail', 'schedule',
  'exercise-bank', 'norms', 'reports',
);

const arbAction: fc.Arbitrary<TourAction> = fc.oneof(
  fc.constant<TourAction>({ type: 'START' }),
  fc.constant<TourAction>({ type: 'SEED_DONE' }),
  routeKeys.map<TourAction>((routeKey) => ({ type: 'PATH_MATCHED', routeKey })),
  routeKeys.map<TourAction>((routeKey) => ({ type: 'PAGE_READY',   routeKey })),
  fc.constant<TourAction>({ type: 'LAYOUT_SETTLED' }),
  fc.constant<TourAction>({ type: 'STEP_NEXT' }),
  fc.constant<TourAction>({ type: 'STEP_PREV' }),
  fc.integer({ min: 0, max: 13 }).map<TourAction>((to) => ({ type: 'NAVIGATE', to })),
  fc.constant<TourAction>({ type: 'FINISH' }),
  fc.constant<TourAction>({ type: 'SETTINGS_MOUNTED' }),
  fc.constant<TourAction>({ type: 'CLEAR_DONE' }),
  fc.constant<TourAction>({ type: 'SKIP' }),
);

const arbActionSeq = fc.array(arbAction, { minLength: 0, maxLength: 25 });

function applySeq(initial: TourState, actions: TourAction[]): TourState {
  let s = initial;
  // Silence illegal-transition warnings during property runs.
  const orig = console.warn;
  console.warn = () => undefined;
  try {
    for (const a of actions) s = tourReducer(s, a);
  } finally {
    console.warn = orig;
  }
  return s;
}

// ─── Property 1: purity ──────────────────────────────────────────────────────

describe('property: reducer purity', () => {
  it('same (state, action) yields deep-equal results', () => {
    fc.assert(
      fc.property(arbActionSeq, arbAction, (seq, action) => {
        const state = applySeq(initialTourState, seq);
        const snapshot = JSON.parse(JSON.stringify(state)) as TourState;
        const a = tourReducer(state, action);
        const b = tourReducer(state, action);
        expect(a).toEqual(b);
        // input was not mutated
        expect(state).toEqual(snapshot);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 2: step-index monotonicity within running ──────────────────────

describe('property: STEP_NEXT/PREV move step by exactly ±1 when in running', () => {
  const arbStepActions = fc.array(
    fc.constantFrom<TourAction>({ type: 'STEP_NEXT' }, { type: 'STEP_PREV' }),
    { minLength: 1, maxLength: 30 },
  );

  it('cumulative delta equals (count NEXT) − (count PREV)', () => {
    fc.assert(
      fc.property(arbStepActions, (actions) => {
        const start: TourState = { phase: 'running', step: 5 };
        let state = start;
        for (const a of actions) state = tourReducer(state, a);
        expect(state.phase).toBe('running');
        const expectedDelta =
          actions.filter((a) => a.type === 'STEP_NEXT').length -
          actions.filter((a) => a.type === 'STEP_PREV').length;
        if (state.phase === 'running') {
          expect(state.step).toBe(5 + expectedDelta);
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 3: SKIP reaches idle within ≤2 steps from any non-idle state ──

describe('property: every non-idle state can reach idle via SKIP + CLEAR_DONE', () => {
  it('SKIP from non-idle goes to cleanup, then CLEAR_DONE → idle', () => {
    fc.assert(
      fc.property(arbActionSeq, (seq) => {
        const state = applySeq(initialTourState, seq);
        if (state.phase === 'idle') return; // SKIP is a no-op from idle
        const afterSkip = tourReducer(state, { type: 'SKIP' });
        expect(afterSkip).toEqual({ phase: 'cleanup' });
        const finalState = tourReducer(afterSkip, { type: 'CLEAR_DONE' });
        expect(finalState).toEqual({ phase: 'idle' });
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 4: phase is always a known string ──────────────────────────────

describe('property: phase always belongs to the declared union', () => {
  const validPhases = new Set([
    'idle', 'seeding', 'navigating', 'awaiting-page-ready',
    'settling', 'running', 'finishing', 'cleanup',
  ]);

  it('never produces an unknown phase', () => {
    fc.assert(
      fc.property(arbActionSeq, (seq) => {
        const state = applySeq(initialTourState, seq);
        expect(validPhases.has(state.phase)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
