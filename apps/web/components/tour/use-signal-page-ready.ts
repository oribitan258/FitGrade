'use client';

import { useEffect } from 'react';
import { useTour } from './TourProvider';

/**
 * Convenience hook for tour-targeted pages.
 *
 * Calls `signalPageReady(routeKey)` once `dataReady` becomes true. The tour
 * state machine consumes the signal in the 'awaiting-page-ready' phase to
 * advance into 'settling' (and from there to 'running').
 *
 * Why a hook and not a one-liner per page:
 *   Every tour-targeted page expresses the same intent — "tell the tour I'm
 *   done loading." Centralising avoids drift in the dependency array and
 *   keeps the call site honest about which data hook is the gate.
 *
 * Typical usage:
 *   const { data: stats } = useDashboardStats(...);
 *   useSignalPageReady('dashboard', stats !== undefined);
 *
 * Pages with no API hooks (e.g. exercise-bank) call this with a constant
 * `true` to fire on mount — the tour starts running immediately because no
 * data needs to load first.
 */
export function useSignalPageReady(routeKey: string, dataReady: boolean): void {
  const { signalPageReady } = useTour();
  useEffect(() => {
    if (dataReady) signalPageReady(routeKey);
  }, [dataReady, routeKey, signalPageReady]);
}
