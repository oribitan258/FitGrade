/**
 * Tier 1.5 — manifest invariants for the tour step list.
 *
 * Why this file exists:
 *   Without these checks, a future contributor could remove disableBeacon,
 *   forget routeKey on a new step, accidentally regress the step-10 route
 *   from /exercise-bank back to /lesson-planner, or revert step 8 from the
 *   class-detail target back to the body of /classes. All of those bugs were
 *   shipped at some point in v2 / v3 development — they would each have been
 *   caught here.
 */

import { TOUR_STEPS, type TourStep } from '../tour-steps';

const VALID_ROUTE_KEYS = new Set([
  'dashboard',
  'classes',
  'class-detail',
  'schedule',
  'exercise-bank',
  'norms',
  'reports',
]);

const VALID_PLACEMENTS = new Set([
  'center', 'top', 'bottom', 'left', 'right',
  'top-start', 'top-end', 'bottom-start', 'bottom-end',
  'left-start', 'left-end', 'right-start', 'right-end',
  'auto',
]);

describe('TOUR_STEPS — array shape', () => {
  it('has exactly 14 steps', () => {
    expect(TOUR_STEPS).toHaveLength(14);
  });
});

describe('TOUR_STEPS — every step is structurally valid', () => {
  it.each(TOUR_STEPS.map((step, i) => [i, step] as const))(
    'step %i has routeKey, target, placement, disableBeacon, skipBeacon, title and content',
    (_i, step: TourStep) => {
      expect(typeof step.routeKey).toBe('string');
      expect(VALID_ROUTE_KEYS.has(step.routeKey)).toBe(true);

      // target/placement come from react-joyride's Step type.
      expect(typeof step.target).toBe('string');
      if (step.placement !== undefined) {
        expect(VALID_PLACEMENTS.has(step.placement as string)).toBe(true);
      }

      // Exported steps are post-.map() — disableBeacon must be uniformly true.
      expect(step.disableBeacon).toBe(true);
      expect(step.skipBeacon).toBe(true);

      // Hebrew title + content must be present.
      expect(typeof step.title).toBe('string');
      expect((step.title as string).length).toBeGreaterThan(0);
      expect(typeof step.content).toBe('string');
      expect((step.content as string).length).toBeGreaterThan(0);
    },
  );
});

describe('TOUR_STEPS — exactly one of route or dynamicRoute', () => {
  it.each(TOUR_STEPS.map((step, i) => [i, step] as const))(
    'step %i has either route or dynamicRoute, never both, never neither',
    (_i, step: TourStep) => {
      const hasRoute   = typeof step.route === 'string';
      const hasDynamic = step.dynamicRoute === true;
      // Exactly one is true.
      expect(hasRoute !== hasDynamic).toBe(true);
    },
  );
});

describe('TOUR_STEPS — specific anti-regression checks', () => {
  it('step 8 stays on class-detail with target [data-tour="test-list"]', () => {
    const step = TOUR_STEPS[8];
    expect(step).toBeDefined();
    expect(step.dynamicRoute).toBe(true);
    expect(step.routeKey).toBe('class-detail');
    expect(step.target).toBe('[data-tour="test-list"]');
    expect(step.placement).toBe('top');
  });

  it('step 7 (class detail intro) is also dynamicRoute → class-detail', () => {
    const step = TOUR_STEPS[7];
    expect(step.dynamicRoute).toBe(true);
    expect(step.routeKey).toBe('class-detail');
  });

  it('step 10 (lesson planner) routes to /exercise-bank, not /lesson-planner', () => {
    const step = TOUR_STEPS[10];
    expect(step.route).toBe('/exercise-bank');
    expect(step.routeKey).toBe('exercise-bank');
  });

  it('step 0 is the dashboard welcome with placement center on body', () => {
    const step = TOUR_STEPS[0];
    expect(step.route).toBe('/dashboard');
    expect(step.routeKey).toBe('dashboard');
    expect(step.target).toBe('body');
    expect(step.placement).toBe('center');
  });

  it('step 13 (final) is the reports export step', () => {
    const step = TOUR_STEPS[13];
    expect(step.route).toBe('/reports');
    expect(step.routeKey).toBe('reports');
    expect(step.target).toBe('[data-tour="export-csv"]');
  });
});

describe('TOUR_STEPS — Hebrew content', () => {
  it('every title and content contains at least one Hebrew character', () => {
    const HEBREW = /[֐-׿]/;
    for (const step of TOUR_STEPS) {
      expect(HEBREW.test(step.title as string)).toBe(true);
      expect(HEBREW.test(step.content as string)).toBe(true);
    }
  });
});
