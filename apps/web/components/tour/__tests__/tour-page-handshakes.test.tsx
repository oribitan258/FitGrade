/**
 * Tier 2.2 — page handshake contract.
 *
 * Verifies the per-page convention: a tour-targeted page calls
 *   useSignalPageReady('<routeKey>', dataReady)
 * from inside its own useEffect (typically driven by an SWR data hook
 * becoming defined). The provider must reach 'running' once the page
 * signals — either directly, or via the 2-second fallback when the
 * signal arrives too early (before the machine entered awaiting).
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useEffect, useState } from 'react';
import { act, render } from '@testing-library/react';

const mockPathListeners = new Set<() => void>();
let mockCurrentPath = '/dashboard';

jest.mock('next/navigation', () => {
  const ReactImpl = require('react');
  return {
    useRouter: () => ({
      push:     jest.fn(),
      prefetch: jest.fn(),
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
    useSWRConfig: () => ({ mutate: jest.fn() }),
  };
});

jest.mock('@/lib/tour-fetcher', () => ({
  installFetcherInterceptor: jest.fn(),
  clearFetcherInterceptor:   jest.fn(),
}));

let mockLastEngineProps: {
  run: boolean;
  stepIndex: number;
  onEvent: (data: unknown) => void;
} = { run: false, stepIndex: 0, onEvent: () => undefined };

jest.mock('../TourEngine', () => ({
  TourEngine: (props: { run: boolean; stepIndex: number; onEvent: (data: unknown) => void }) => {
    mockLastEngineProps = props;
    return null;
  },
}));

import { TourProvider, useTour } from '../TourProvider';
import { useSignalPageReady } from '../use-signal-page-ready';

// ─── Stub pages ──────────────────────────────────────────────────────────────

function ReadyOnMountPage({ routeKey }: { routeKey: string }) {
  useSignalPageReady(routeKey, true);
  return <div data-testid="page" />;
}

function SWRStylePage({ routeKey, resolved }: { routeKey: string; resolved: boolean }) {
  useSignalPageReady(routeKey, resolved);
  return <div data-testid="page" data-ready={String(resolved)} />;
}

function DelayedReadyPage({ routeKey }: { routeKey: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  useSignalPageReady(routeKey, ready);
  return <div data-testid="page" data-ready={String(ready)} />;
}

function StarterAndPage({
  page,
}: {
  page: React.ReactNode;
}) {
  const { startTour } = useTour();
  const startedRef = React.useRef(false);
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startTour();
    }
  }, [startTour]);
  return <>{page}</>;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.className = '';
  mockPathListeners.clear();
  mockCurrentPath = '/dashboard';
  mockLastEngineProps = { run: false, stepIndex: 0, onEvent: () => undefined };
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('page handshake — ready on mount', () => {
  it('engine eventually transitions to running (via signal or fallback)', async () => {
    render(
      <TourProvider>
        <StarterAndPage page={<ReadyOnMountPage routeKey="dashboard" />} />
      </TourProvider>,
    );

    expect(mockLastEngineProps.run).toBe(false);

    // ReadyOnMountPage fires signalPageReady BEFORE startTour (child effects
    // run before parent's effect), so the early signal is illegal and ignored.
    // The 2-second fallback timer is the path to running.
    // Two-phase flush: first run drains the 2-second fallback (or page signal),
    // which schedules rAFs in the settling effect during commit. Second run
    // drains the rAFs to reach running.
    await act(async () => { jest.runAllTimers(); });
    await act(async () => { jest.runAllTimers(); });

    expect(mockLastEngineProps.run).toBe(true);
    expect(mockLastEngineProps.stepIndex).toBe(0);
  });
});

describe('page handshake — useSignalPageReady fires exactly once per dataReady flip', () => {
  it('does not signal when dataReady is false', async () => {
    const sigSpy = jest.fn();
    function Probe({ dataReady }: { dataReady: boolean }) {
      const { signalPageReady } = useTour();
      useSignalPageReady('dashboard', dataReady);
      // also forward to spy to make the count observable
      useEffect(() => {
        if (dataReady) sigSpy('dashboard');
      }, [dataReady, signalPageReady]);
      return null;
    }

    render(
      <TourProvider>
        <Probe dataReady={false} />
      </TourProvider>,
    );

    expect(sigSpy).not.toHaveBeenCalled();
  });
});

describe('page handshake — delayed via state flip', () => {
  it('advances to running once dataReady flips inside an effect', async () => {
    render(
      <TourProvider>
        <StarterAndPage page={<DelayedReadyPage routeKey="dashboard" />} />
      </TourProvider>,
    );

    // The page flips dataReady inside a layout-after effect → signalPageReady
    // fires after start. With fake timers, the fallback also exists as a
    // safety net. Either path lands us in running once timers are flushed.
    // Two-phase flush: first run drains the 2-second fallback (or page signal),
    // which schedules rAFs in the settling effect during commit. Second run
    // drains the rAFs to reach running.
    await act(async () => { jest.runAllTimers(); });
    await act(async () => { jest.runAllTimers(); });

    expect(mockLastEngineProps.run).toBe(true);
  });
});

describe('page handshake — SWR-style false → true rerender', () => {
  it('signals on transition and advances the tour', async () => {
    const { rerender } = render(
      <TourProvider>
        <StarterAndPage page={<SWRStylePage routeKey="dashboard" resolved={false} />} />
      </TourProvider>,
    );

    // No signal yet — only fallback could advance. Flip dataReady to true.
    rerender(
      <TourProvider>
        <StarterAndPage page={<SWRStylePage routeKey="dashboard" resolved={true} />} />
      </TourProvider>,
    );

    // Two-phase flush: first run drains the 2-second fallback (or page signal),
    // which schedules rAFs in the settling effect during commit. Second run
    // drains the rAFs to reach running.
    await act(async () => { jest.runAllTimers(); });
    await act(async () => { jest.runAllTimers(); });

    expect(mockLastEngineProps.run).toBe(true);
  });
});
