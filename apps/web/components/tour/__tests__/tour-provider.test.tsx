/**
 * Tier 2.1 — TourProvider integration.
 *
 * Verifies the wiring between the reducer (unit-tested in Tier 1) and the
 * world: next/navigation router, SWR mutate, the fetcher interceptor, the
 * schedule localStorage seed/clear, body-class lockdown, and the joyride
 * event bridge.
 *
 * Reactive pathname mock:
 *   next/navigation.usePathname is wired into useSyncExternalStore so
 *   router.push (and test-only mockSetPath) trigger React re-renders.
 *   Without this, the navigating-phase effect would never re-evaluate
 *   after a push and the machine would stall in navigating forever.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { act, render } from '@testing-library/react';

// ─── Module-level mock state (prefixed with `mock` so jest.mock allows it) ──

const mockPathListeners = new Set<() => void>();
let mockCurrentPath = '/dashboard';
function mockSetPath(p: string): void {
  mockCurrentPath = p;
  mockPathListeners.forEach((l) => l());
}

const mockPushSpy        = jest.fn((p: string) => mockSetPath(p));
const mockPrefetchSpy    = jest.fn();
const mockMutateSpy      = jest.fn();
const mockInstallSpy     = jest.fn();
const mockClearFetcherSpy = jest.fn();
const mockSeedScheduleSpy   = jest.fn();
const mockClearScheduleSpy  = jest.fn();

let mockLastEngineProps: {
  run: boolean;
  stepIndex: number;
  onEvent: (data: unknown) => void;
} = { run: false, stepIndex: 0, onEvent: () => undefined };

// ─── jest.mock declarations (hoisted) ────────────────────────────────────────

jest.mock('next/navigation', () => {
  const ReactImpl = require('react');
  return {
    useRouter: () => ({
      push:     mockPushSpy,
      prefetch: mockPrefetchSpy,
      replace:  jest.fn(),
      back:     jest.fn(),
      forward:  jest.fn(),
      refresh:  jest.fn(),
    }),
    usePathname: () => ReactImpl.useSyncExternalStore(
      (cb: () => void) => {
        mockPathListeners.add(cb);
        return () => { mockPathListeners.delete(cb); };
      },
      () => mockCurrentPath,
      () => mockCurrentPath,
    ),
  };
});

jest.mock('swr', () => {
  const ReactImpl = require('react');
  return {
    SWRConfig:    ({ children }: React.PropsWithChildren) => ReactImpl.createElement(ReactImpl.Fragment, null, children),
    useSWRConfig: () => ({ mutate: mockMutateSpy }),
  };
});

jest.mock('@/lib/tour-fetcher', () => ({
  installFetcherInterceptor: (...args: unknown[]) => mockInstallSpy(...args),
  clearFetcherInterceptor:   (...args: unknown[]) => mockClearFetcherSpy(...args),
}));

jest.mock('@/lib/tour-mock-data', () => {
  const actual = jest.requireActual('@/lib/tour-mock-data');
  return {
    ...actual,
    seedTourSchedule:  (...args: unknown[]) => mockSeedScheduleSpy(...args),
    clearTourSchedule: (...args: unknown[]) => mockClearScheduleSpy(...args),
  };
});

jest.mock('../TourEngine', () => ({
  TourEngine: (props: { run: boolean; stepIndex: number; onEvent: (data: unknown) => void }) => {
    mockLastEngineProps = props;
    return null;
  },
}));

// Imports must come AFTER the jest.mock calls above.
import { TourProvider, useTour } from '../TourProvider';
import { TOUR_MOCK_HANDLERS } from '@/lib/tour-mock-handlers';
import { TOUR_STEPS } from '@/lib/tour-steps';
import { ACTIONS, EVENTS, LIFECYCLE, STATUS } from 'react-joyride';

type TourContextValue = ReturnType<typeof useTour>;

// ─── Harness ─────────────────────────────────────────────────────────────────

interface Harness {
  ctxRef: { current: TourContextValue | null };
}

function ContextProbe({ ctxRef }: { ctxRef: Harness['ctxRef'] }) {
  ctxRef.current = useTour();
  return null;
}

function setUp(initialPath: string = '/dashboard'): Harness {
  mockCurrentPath = initialPath;
  const ctxRef: Harness['ctxRef'] = { current: null };
  render(
    <TourProvider>
      <ContextProbe ctxRef={ctxRef} />
    </TourProvider>,
  );
  return { ctxRef };
}

/** Drive the provider from idle to running[0] on /dashboard. */
async function startAndReachRunningZero(h: Harness): Promise<void> {
  await act(async () => h.ctxRef.current!.startTour());
  await act(async () => h.ctxRef.current!.signalPageReady('dashboard'));
  await act(async () => { jest.runAllTimers(); });
}

beforeEach(() => {
  document.body.className = '';
  mockPathListeners.clear();
  mockCurrentPath = '/dashboard';
  mockPushSpy.mockClear();
  mockPrefetchSpy.mockClear();
  mockMutateSpy.mockClear();
  mockInstallSpy.mockClear();
  mockClearFetcherSpy.mockClear();
  mockSeedScheduleSpy.mockClear();
  mockClearScheduleSpy.mockClear();
  // Reset engine props.
  mockLastEngineProps = { run: false, stepIndex: 0, onEvent: () => undefined };
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── 1: Startup pipeline ─────────────────────────────────────────────────────

describe('startTour() seeding pipeline', () => {
  it('installs interceptor with canonical handler list and seeds schedule', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());

    expect(mockInstallSpy).toHaveBeenCalledTimes(1);
    expect(mockInstallSpy).toHaveBeenCalledWith(TOUR_MOCK_HANDLERS);
    expect(mockSeedScheduleSpy).toHaveBeenCalledTimes(1);
    expect(mockMutateSpy).toHaveBeenCalledTimes(1);
    const [predicate] = mockMutateSpy.mock.calls[0];
    expect(typeof predicate).toBe('function');
    expect((predicate as (k: string) => boolean)('any-key')).toBe(true);
  });

  it('prefetches every unique step route during seeding', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());

    const expected = new Set<string>();
    for (const step of TOUR_STEPS) {
      const route = step.dynamicRoute === true
        ? '/classes/tour-demo-class'
        : step.route;
      if (route !== undefined) expected.add(route);
    }
    for (const r of expected) {
      expect(mockPrefetchSpy).toHaveBeenCalledWith(r);
    }
  });
});

// ─── 2: PATH_MATCHED vs router.push branches ─────────────────────────────────

describe('navigating phase', () => {
  it('when pathname matches step 0 route, advances without router.push', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());
    expect(mockPushSpy).not.toHaveBeenCalled();
    expect(mockLastEngineProps.run).toBe(false); // still awaiting-page-ready
    expect(mockLastEngineProps.stepIndex).toBe(0);
  });

  it('when pathname does not match step 0, calls router.push exactly once', async () => {
    const h = setUp('/classes');
    await act(async () => h.ctxRef.current!.startTour());
    // After push, pathname auto-updates and navigating effect re-runs.
    const dashboardPushes = mockPushSpy.mock.calls.filter((c) => c[0] === '/dashboard');
    expect(dashboardPushes).toHaveLength(1);
  });
});

// ─── 3: signalPageReady drives advance ───────────────────────────────────────

describe('signalPageReady contract', () => {
  it('correct routeKey advances awaiting-page-ready → settling → running', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());
    expect(mockLastEngineProps.run).toBe(false);

    await act(async () => h.ctxRef.current!.signalPageReady('dashboard'));
    await act(async () => { jest.runAllTimers(); });

    expect(mockLastEngineProps.run).toBe(true);
    expect(mockLastEngineProps.stepIndex).toBe(0);
  });

  it('mismatched routeKey is ignored — state stays in awaiting-page-ready', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());
    expect(mockLastEngineProps.run).toBe(false);

    await act(async () => h.ctxRef.current!.signalPageReady('classes'));
    expect(mockLastEngineProps.run).toBe(false);
  });
});

// ─── 4: 2-second fallback timer ──────────────────────────────────────────────

describe('PAGE_READY fallback timer', () => {
  it('forces advance after 2000 ms if no signalPageReady arrives', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());
    expect(mockLastEngineProps.run).toBe(false);

    await act(async () => { jest.advanceTimersByTime(2000); });
    await act(async () => { jest.runAllTimers(); });

    expect(mockLastEngineProps.run).toBe(true);
  });
});

// ─── 5: Body-class lockdown lifecycle ────────────────────────────────────────

describe('body.tour-active lockdown', () => {
  it('adds tour-active on START, removes on idle (after cleanup)', async () => {
    const h = setUp('/dashboard');
    expect(document.body.classList.contains('tour-active')).toBe(false);

    await act(async () => h.ctxRef.current!.startTour());
    expect(document.body.classList.contains('tour-active')).toBe(true);

    await act(async () => h.ctxRef.current!.skipTour());
    expect(document.body.classList.contains('tour-active')).toBe(false);
  });

  it('class persists through navigating phase', async () => {
    const h = setUp('/classes'); // wrong path; provider will push to /dashboard
    await act(async () => h.ctxRef.current!.startTour());
    expect(document.body.classList.contains('tour-active')).toBe(true);
  });
});

// ─── 6: Cleanup teardown via FINISH → SETTINGS_MOUNTED ───────────────────────

describe('cleanup teardown', () => {
  it('FINISH → notifySettingsMounted clears interceptor, schedule, and revalidates SWR', async () => {
    const h = setUp('/dashboard');
    await startAndReachRunningZero(h);
    expect(mockLastEngineProps.run).toBe(true);

    mockMutateSpy.mockClear();

    await act(async () => {
      mockLastEngineProps.onEvent({
        type:      EVENTS.TOUR_END,
        action:    ACTIONS.UPDATE,
        index:     0,
        lifecycle: LIFECYCLE.COMPLETE,
        status:    STATUS.FINISHED,
        size:      TOUR_STEPS.length,
        controlled: false,
        step:       TOUR_STEPS[0] as unknown,
      } as never);
    });

    await act(async () => h.ctxRef.current!.notifySettingsMounted());

    expect(mockClearFetcherSpy).toHaveBeenCalledTimes(1);
    expect(mockClearScheduleSpy).toHaveBeenCalledTimes(1);
    expect(mockMutateSpy).toHaveBeenCalledTimes(1);
    const args = mockMutateSpy.mock.calls[0];
    expect(typeof args[0]).toBe('function');
    expect(args[1]).toBeUndefined();
    expect(args[2]).toEqual({ revalidate: true });
    expect(document.body.classList.contains('tour-active')).toBe(false);
  });
});

// ─── 7: Joyride event bridge — pathMatchesStep branch decision ───────────────

describe('handleEvent — NEXT routing decision', () => {
  it('same-page NEXT (pathname matches next step) does NOT call router.push', async () => {
    // Get to running[0] on /dashboard, then move pathname to a class-detail
    // URL so step 8 (dynamicRoute) is the "next step under test".
    const h = setUp('/dashboard');
    await startAndReachRunningZero(h);
    expect(mockLastEngineProps.run).toBe(true);

    // Simulate the test condition: standing on /classes/tour-demo-class with
    // joyride finishing step 7. handleEvent inspects current pathname and
    // step 8's resolved route — both '/classes/tour-demo-class' — so it
    // dispatches STEP_NEXT, not NAVIGATE. No router.push expected.
    await act(async () => { mockSetPath('/classes/tour-demo-class'); });
    mockPushSpy.mockClear();

    await act(async () => {
      mockLastEngineProps.onEvent({
        type:      EVENTS.STEP_AFTER,
        action:    ACTIONS.NEXT,
        index:     7,
        lifecycle: LIFECYCLE.COMPLETE,
        status:    STATUS.RUNNING,
        size:      TOUR_STEPS.length,
        controlled: true,
        step:       TOUR_STEPS[7] as unknown,
      } as never);
    });

    expect(mockPushSpy).not.toHaveBeenCalled();
  });

  it('cross-page NEXT (pathname does not match next step) calls router.push with next step route', async () => {
    const h = setUp('/dashboard');
    await startAndReachRunningZero(h);
    expect(mockLastEngineProps.run).toBe(true);

    // Simulate joyride finishing step 6 (real route /classes) — next step is
    // step 7 with dynamic route /classes/tour-demo-class. Pathname is /classes.
    // pathMatchesStep returns false → NAVIGATE → router.push fires.
    await act(async () => { mockSetPath('/classes'); });
    mockPushSpy.mockClear();

    await act(async () => {
      mockLastEngineProps.onEvent({
        type:      EVENTS.STEP_AFTER,
        action:    ACTIONS.NEXT,
        index:     6,
        lifecycle: LIFECYCLE.COMPLETE,
        status:    STATUS.RUNNING,
        size:      TOUR_STEPS.length,
        controlled: true,
        step:       TOUR_STEPS[6] as unknown,
      } as never);
    });

    expect(mockPushSpy).toHaveBeenCalledWith('/classes/tour-demo-class');
  });

  it('NEXT past the last step dispatches FINISH', async () => {
    const h = setUp('/dashboard');
    await startAndReachRunningZero(h);

    mockClearFetcherSpy.mockClear();
    mockClearScheduleSpy.mockClear();

    await act(async () => {
      mockLastEngineProps.onEvent({
        type:      EVENTS.STEP_AFTER,
        action:    ACTIONS.NEXT,
        index:     TOUR_STEPS.length - 1,
        lifecycle: LIFECYCLE.COMPLETE,
        status:    STATUS.RUNNING,
        size:      TOUR_STEPS.length,
        controlled: true,
        step:       TOUR_STEPS[TOUR_STEPS.length - 1] as unknown,
      } as never);
    });

    // FINISH → finishing → router.push('/settings').
    expect(mockPushSpy).toHaveBeenCalledWith('/settings');
  });
});

// ─── 8: STATUS.SKIPPED → SKIP ────────────────────────────────────────────────

describe('handleEvent — skip', () => {
  it('STATUS.SKIPPED tears down to idle and removes body class', async () => {
    const h = setUp('/dashboard');
    await act(async () => h.ctxRef.current!.startTour());
    expect(document.body.classList.contains('tour-active')).toBe(true);

    await act(async () => {
      mockLastEngineProps.onEvent({
        type:      EVENTS.TOUR_END,
        action:    ACTIONS.SKIP,
        index:     0,
        lifecycle: LIFECYCLE.COMPLETE,
        status:    STATUS.SKIPPED,
        size:      TOUR_STEPS.length,
        controlled: false,
        step:       TOUR_STEPS[0] as unknown,
      } as never);
    });

    expect(document.body.classList.contains('tour-active')).toBe(false);
    expect(mockClearFetcherSpy).toHaveBeenCalled();
    expect(mockClearScheduleSpy).toHaveBeenCalled();
  });
});

// ─── 9: skipTour() public API ────────────────────────────────────────────────

describe('skipTour() public API', () => {
  it('clears interceptor and schedule, removes body class', async () => {
    const h = setUp('/dashboard');
    await startAndReachRunningZero(h);

    await act(async () => h.ctxRef.current!.skipTour());

    expect(mockClearFetcherSpy).toHaveBeenCalled();
    expect(mockClearScheduleSpy).toHaveBeenCalled();
    expect(document.body.classList.contains('tour-active')).toBe(false);
  });
});

// ─── 10: isTourActive context value ──────────────────────────────────────────

describe('isTourActive context value', () => {
  it('is false initially, true while tour runs, false after cleanup', async () => {
    const h = setUp('/dashboard');
    expect(h.ctxRef.current!.isTourActive).toBe(false);

    await act(async () => h.ctxRef.current!.startTour());
    expect(h.ctxRef.current!.isTourActive).toBe(true);

    await act(async () => h.ctxRef.current!.skipTour());
    expect(h.ctxRef.current!.isTourActive).toBe(false);
  });
});
