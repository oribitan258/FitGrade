/**
 * Tier 1.6 — useSignalPageReady hook contract.
 *
 * Stubbing strategy:
 *   The real TourProvider pulls in SWR, next/navigation, and react-joyride —
 *   all heavy and unrelated to this hook's contract. We jest.mock the entire
 *   module and re-implement just the `useTour` hook so the test can swap in
 *   a controllable `signalPageReady` spy per test.
 */

import { render, act } from '@testing-library/react';
import React from 'react';

// Per-test capture of the spy installed via jest.mock.
const signalPageReadySpy = jest.fn();

jest.mock('../TourProvider', () => ({
  useTour: () => ({
    signalPageReady:       signalPageReadySpy,
    startTour:             jest.fn(),
    skipTour:              jest.fn(),
    isTourActive:          false,
    notifySettingsMounted: jest.fn(),
  }),
}));

// Import AFTER the mock is registered.
import { useSignalPageReady } from '../use-signal-page-ready';

function Probe({ routeKey, dataReady }: { routeKey: string; dataReady: boolean }) {
  useSignalPageReady(routeKey, dataReady);
  return null;
}

beforeEach(() => {
  signalPageReadySpy.mockClear();
});

describe('useSignalPageReady', () => {
  it('does not fire when dataReady=false', () => {
    render(<Probe routeKey="dashboard" dataReady={false} />);
    expect(signalPageReadySpy).not.toHaveBeenCalled();
  });

  it('fires exactly once on mount when dataReady=true', () => {
    render(<Probe routeKey="dashboard" dataReady={true} />);
    expect(signalPageReadySpy).toHaveBeenCalledTimes(1);
    expect(signalPageReadySpy).toHaveBeenCalledWith('dashboard');
  });

  it('fires once on the false→true transition', () => {
    const { rerender } = render(<Probe routeKey="classes" dataReady={false} />);
    expect(signalPageReadySpy).not.toHaveBeenCalled();
    act(() => {
      rerender(<Probe routeKey="classes" dataReady={true} />);
    });
    expect(signalPageReadySpy).toHaveBeenCalledTimes(1);
    expect(signalPageReadySpy).toHaveBeenCalledWith('classes');
  });

  it('fires twice across a true → false → true cycle', () => {
    const { rerender } = render(<Probe routeKey="schedule" dataReady={true} />);
    expect(signalPageReadySpy).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<Probe routeKey="schedule" dataReady={false} />);
    });
    expect(signalPageReadySpy).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<Probe routeKey="schedule" dataReady={true} />);
    });
    expect(signalPageReadySpy).toHaveBeenCalledTimes(2);
  });

  it('fires with the new key when routeKey changes while dataReady=true', () => {
    const { rerender } = render(<Probe routeKey="norms" dataReady={true} />);
    expect(signalPageReadySpy).toHaveBeenLastCalledWith('norms');

    act(() => {
      rerender(<Probe routeKey="reports" dataReady={true} />);
    });
    expect(signalPageReadySpy).toHaveBeenCalledTimes(2);
    expect(signalPageReadySpy).toHaveBeenLastCalledWith('reports');
  });
});
