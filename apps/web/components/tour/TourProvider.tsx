'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { EventData } from 'react-joyride';
import { ACTIONS, EVENTS, LIFECYCLE, STATUS } from 'react-joyride';
import { SWRConfig, useSWRConfig } from 'swr';
import type { TourStep } from '@/lib/tour-steps';
import { TOUR_STEPS } from '@/lib/tour-steps';
import { TOUR_DEMO_CLASS_ID, seedTourSchedule, clearTourSchedule } from '@/lib/tour-mock-data';
import { TOUR_MOCK_HANDLERS } from '@/lib/tour-mock-handlers';
import { installFetcherInterceptor, clearFetcherInterceptor } from '@/lib/tour-fetcher';
import { TourEngine } from './TourEngine';
import {
  useTourMachine,
  isTourActive as deriveIsTourActive,
  currentStepIndex,
} from './use-tour-machine';

// ─── Tunable timings ──────────────────────────────────────────────────────────
//
// PAGE_READY_FALLBACK_MS:
//   Maximum time to wait for a page to call signalPageReady before we
//   force-advance. In Phase D, every tour-targeted page emits the signal
//   from its own useEffect — the fallback should never fire. It exists as
//   a safety net so an un-instrumented page (Phase E pages, future
//   additions) never permanently blocks the tour.

const PAGE_READY_FALLBACK_MS = 2000;

// ─── Context ──────────────────────────────────────────────────────────────────

interface TourContextValue {
  startTour:             () => void;
  skipTour:              () => void;
  isTourActive:          boolean;
  /**
   * Called by tour-targeted pages from a useEffect that runs AFTER their
   * data hooks have populated. Drives the awaiting-page-ready → settling
   * transition.
   */
  signalPageReady:       (routeKey: string) => void;
  /** Called by the settings page on mount to drive finishing → cleanup. */
  notifySettingsMounted: () => void;
}

const TourContext = createContext<TourContextValue>({
  startTour:             () => undefined,
  skipTour:              () => undefined,
  isTourActive:          false,
  signalPageReady:       () => undefined,
  notifySettingsMounted: () => undefined,
});

export function useTour(): TourContextValue {
  return useContext(TourContext);
}

// ─── Route resolution helpers ─────────────────────────────────────────────────

function resolveStepRoute(step: TourStep): string | undefined {
  if (step.dynamicRoute === true) return `/classes/${TOUR_DEMO_CLASS_ID}`;
  return step.route;
}

/** Exact match for fixed routes; prefix match for dynamic class routes. */
function pathMatchesStep(step: TourStep, pathname: string): boolean {
  const route = resolveStepRoute(step);
  if (route === undefined) return true;
  if (step.dynamicRoute === true) return pathname.startsWith(route);
  return pathname === route;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TourProvider({ children }: PropsWithChildren): React.JSX.Element {
  const router   = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const { state, dispatch } = useTourMachine();
  const isActive            = deriveIsTourActive(state);
  const stepIndex           = currentStepIndex(state) ?? 0;

  // pushInFlightRef guards against double router.push if the navigating
  // effect re-runs before the pathname change lands.
  const pushInFlightRef = useRef<string | null>(null);

  // Ref to the wrapper around children — set to inert during the tour so the
  // entire app shell becomes unfocusable, unclickable, and hidden from the
  // accessibility tree. The Joyride portal lives outside this wrapper (at
  // document.body), so its tooltips and overlay remain fully interactive.
  const inertRootRef = useRef<HTMLDivElement>(null);

  // ── Phase: seeding — install interceptor + prefetch routes + refresh cache ─
  //
  // Three operations, all synchronous from React's perspective:
  //   1. installFetcherInterceptor — every subsequent apiRequest is now mocked.
  //   2. router.prefetch(route) for every unique step route — Next.js loads
  //      the page chunks in parallel so cross-route transitions later in the
  //      tour are instant rather than 3-4 s on first navigation.
  //   3. mutate(() => true) — invalidate every SWR key. Pages already mounted
  //      before the tour started (typically /dashboard) will refetch through
  //      the interceptor and replace their real data with mock. Without this,
  //      the dashboard would keep showing the teacher's real (often empty)
  //      stats during the first three tour steps.
  useEffect(() => {
    if (state.phase !== 'seeding') return;

    installFetcherInterceptor(TOUR_MOCK_HANDLERS);
    seedTourSchedule();

    // Prefetch every unique step route so router.push lands instantly.
    const uniqueRoutes = new Set<string>();
    for (const step of TOUR_STEPS) {
      const route = resolveStepRoute(step);
      if (route !== undefined) uniqueRoutes.add(route);
    }
    for (const r of uniqueRoutes) router.prefetch(r);

    // Force already-mounted hooks (e.g. dashboard) to refetch through the
    // interceptor. New mounts after this point will fetch on first render
    // (SWR's default revalidateOnMount: true behaviour) and also pick up mocks.
    void mutate(() => true);

    dispatch({ type: 'SEED_DONE' });
  }, [state.phase, mutate, router, dispatch]);

  // ── Phase: navigating — push route or report path already matches ────────
  useEffect(() => {
    if (state.phase !== 'navigating') {
      pushInFlightRef.current = null;
      return;
    }

    const step = TOUR_STEPS[state.nextStep];
    if (!step) {
      // Stepped past the last step — finish.
      dispatch({ type: 'FINISH' });
      return;
    }

    if (pathMatchesStep(step, pathname)) {
      dispatch({ type: 'PATH_MATCHED', routeKey: step.routeKey });
      return;
    }

    const route = resolveStepRoute(step);
    if (route !== undefined && pushInFlightRef.current !== route) {
      pushInFlightRef.current = route;
      router.push(route);
    }
  }, [state, pathname, router, dispatch]);

  // ── Phase: awaiting-page-ready — fallback timer if signal never arrives ──
  useEffect(() => {
    if (state.phase !== 'awaiting-page-ready') return;
    const expectedKey = state.routeKey;
    const t = setTimeout(() => {
      // Pages instrumented in Phase D emit signalPageReady earlier; the
      // fallback is a safety net for un-instrumented pages.
      dispatch({ type: 'PAGE_READY', routeKey: expectedKey });
    }, PAGE_READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [state, dispatch]);

  // ── Phase: settling — wait 2 × rAF for layout, then run ───────────────────
  useEffect(() => {
    if (state.phase !== 'settling') return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        dispatch({ type: 'LAYOUT_SETTLED' });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== 0) cancelAnimationFrame(raf2);
    };
  }, [state, dispatch]);

  // ── Phase: running — re-prefetch sibling step routes (idempotent) ─────────
  //
  // Seeding already prefetched every unique route, but Next.js dedupes the
  // call so re-prefetching siblings on every step is essentially free. This
  // is defence in depth: if the user's network was slow during seeding and
  // the chunk for step N+1 hadn't finished loading, this gives it another
  // window to complete before the user clicks Next.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const idx = state.step;
    for (const offset of [1, -1]) {
      const sibling = TOUR_STEPS[idx + offset];
      if (!sibling) continue;
      const route = resolveStepRoute(sibling);
      if (route !== undefined) router.prefetch(route);
    }
  }, [state, router]);

  // ── Phase: finishing — push to /settings, then advance immediately ──────
  //
  // The /settings push is UX-only: the page may mount slowly, fail to mount,
  // or the user may bounce off it before its useEffect fires. Cleanup MUST
  // run regardless, or the fetcher interceptor stays active and every
  // post-tour page (dashboard, classes, etc.) keeps serving mock data
  // instead of the new teacher's real (often empty) state.
  useEffect(() => {
    if (state.phase !== 'finishing') return;
    router.push('/settings');
    dispatch({ type: 'SETTINGS_MOUNTED' });
  }, [state.phase, router, dispatch]);

  // ── Total app lockdown — three-layer defense ─────────────────────────────
  //
  // Layer 1 (passive): body.tour-active triggers CSS pointer-events:none on
  //   everything except the Joyride portal. Blocks normal user clicks.
  //
  // Layer 2 (structural): the [data-tour-inert-root] wrapper around children
  //   gets the `inert` HTML attribute. Inert disables keyboard focus, hides
  //   descendants from the accessibility tree, and blocks pointer events on
  //   the wrapped subtree. Pointer-events:none alone does NOT block keyboard
  //   activation — inert closes that bypass.
  //
  // Layer 3 (active): capture-phase listener on window for click / keydown /
  //   touchstart that calls stopImmediatePropagation + preventDefault on any
  //   event NOT originating inside the Joyride portal. This catches:
  //     • Programmatic .click() from DevTools (pointer-events ignores it).
  //     • Keyboard activation that somehow gets through inert (defense in
  //       depth — inert should already block it).
  //     • Touch events on mobile where pointer-events semantics differ.
  //
  // Self-healing: a MutationObserver watches both document.body.class and
  //   the inert wrapper's attributes. If a user with DevTools strips either,
  //   the observer re-applies it inside the same microtask. Combined with
  //   the capture listener, the only way to bypass the lockdown becomes
  //   modifying the JS itself (out of scope — the attacker has total control
  //   of the runtime anyway).
  //
  // Gating on `phase !== 'idle'` rather than `phase === 'running'` closes
  // the cross-page transition gap: while the machine briefly passes through
  // navigating → awaiting-page-ready → settling, every layer stays on.
  useEffect(() => {
    if (state.phase === 'idle') return;

    const inertEl = inertRootRef.current;

    // Layer 1: body class.
    document.body.classList.add('tour-active');

    // Layer 2: inert on the app-shell wrapper.
    if (inertEl !== null) {
      inertEl.setAttribute('inert', '');
    }

    // Self-healing: re-apply both protections if they're stripped externally.
    const ensureLockdown = (): void => {
      if (!document.body.classList.contains('tour-active')) {
        document.body.classList.add('tour-active');
      }
      if (inertEl !== null && !inertEl.hasAttribute('inert')) {
        inertEl.setAttribute('inert', '');
      }
    };
    const bodyObserver = new MutationObserver(ensureLockdown);
    bodyObserver.observe(document.body, {
      attributes:      true,
      attributeFilter: ['class'],
    });
    const inertObserver = inertEl !== null ? new MutationObserver(ensureLockdown) : null;
    if (inertEl !== null && inertObserver !== null) {
      inertObserver.observe(inertEl, {
        attributes:      true,
        attributeFilter: ['inert'],
      });
    }

    // Layer 3: capture-phase event blocker.
    const captureBlocker = (e: Event): void => {
      const target = e.target;
      if (target instanceof Element && target.closest('[id^="react-joyride"]') !== null) {
        return; // event originates inside the Joyride portal — allow it
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    const captureOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener('click',      captureBlocker, captureOpts);
    window.addEventListener('keydown',    captureBlocker, captureOpts);
    window.addEventListener('touchstart', captureBlocker, captureOpts);

    return () => {
      document.body.classList.remove('tour-active');
      if (inertEl !== null) inertEl.removeAttribute('inert');
      bodyObserver.disconnect();
      inertObserver?.disconnect();
      window.removeEventListener('click',      captureBlocker, captureOpts);
      window.removeEventListener('keydown',    captureBlocker, captureOpts);
      window.removeEventListener('touchstart', captureBlocker, captureOpts);
    };
  }, [state.phase]);

  // ── Phase: cleanup — clear interceptor, schedule, revalidate SWR ─────────
  useEffect(() => {
    if (state.phase !== 'cleanup') return;
    clearFetcherInterceptor();
    clearTourSchedule();
    // Revalidate any SWR keys that were served from the interceptor so real
    // data replaces the mocks once the tour ends.
    void mutate(() => true, undefined, { revalidate: true });
    dispatch({ type: 'CLEAR_DONE' });
  }, [state.phase, mutate, dispatch]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const startTour = useCallback((): void => {
    dispatch({ type: 'START' });
  }, [dispatch]);

  const skipTour = useCallback((): void => {
    dispatch({ type: 'SKIP' });
  }, [dispatch]);

  const signalPageReady = useCallback((routeKey: string): void => {
    dispatch({ type: 'PAGE_READY', routeKey });
  }, [dispatch]);

  const notifySettingsMounted = useCallback((): void => {
    dispatch({ type: 'SETTINGS_MOUNTED' });
  }, [dispatch]);

  // ── Joyride event → state machine actions ──────────────────────────────────
  const handleEvent = useCallback((data: EventData): void => {
    const { action, index, lifecycle, status, type } = data;

    if (status === STATUS.SKIPPED) {
      dispatch({ type: 'SKIP' });
      return;
    }
    if (status === STATUS.FINISHED) {
      dispatch({ type: 'FINISH' });
      return;
    }
    if (type !== EVENTS.STEP_AFTER || lifecycle !== LIFECYCLE.COMPLETE) return;

    if (action === ACTIONS.NEXT) {
      const nextIdx  = index + 1;
      const nextStep = TOUR_STEPS[nextIdx];
      if (!nextStep) {
        dispatch({ type: 'FINISH' });
        return;
      }
      if (pathMatchesStep(nextStep, pathname)) {
        dispatch({ type: 'STEP_NEXT' });
      } else {
        dispatch({ type: 'NAVIGATE', to: nextIdx });
      }
    }

    if (action === ACTIONS.PREV) {
      const prevIdx  = index - 1;
      const prevStep = TOUR_STEPS[prevIdx];
      if (!prevStep) return;
      if (pathMatchesStep(prevStep, pathname)) {
        dispatch({ type: 'STEP_PREV' });
      } else {
        dispatch({ type: 'NAVIGATE', to: prevIdx });
      }
    }
  }, [dispatch, pathname]);

  // ── SWR overrides while tour is active ────────────────────────────────────
  //
  // CRITICAL: do NOT set revalidateOnMount: false here. The fetcher interceptor
  // returns mock data through the normal apiRequest path — but only if SWR
  // actually fires the fetcher. With revalidateOnMount: false, SWR refuses
  // to fetch on mount when there's no cached entry, so newly-mounted hooks
  // (e.g. useClass on the class detail page) return { data: undefined } and
  // the page falls into its error branch. The interceptor never gets called.
  //
  // We DO disable focus/reconnect revalidation to avoid spurious refetches
  // mid-tour (those would produce identical mock responses, just wasted work).
  const swrOverride = isActive
    ? {
        revalidateOnFocus:     false,
        revalidateOnReconnect: false,
      } as const
    : {} as const;

  return (
    <TourContext.Provider value={{ startTour, skipTour, isTourActive: isActive, signalPageReady, notifySettingsMounted }}>
      <SWRConfig value={swrOverride}>
        {/* display: contents makes this wrapper invisible to layout — it does
            not render its own box, so children behave as if direct descendants
            of the SWRConfig. The wrapper exists purely to anchor the `inert`
            attribute when the tour is active. */}
        <div ref={inertRootRef} data-tour-inert-root style={{ display: 'contents' }}>
          {children}
        </div>
      </SWRConfig>

      <TourEngine
        run={state.phase === 'running'}
        stepIndex={stepIndex}
        onEvent={handleEvent}
      />
    </TourContext.Provider>
  );
}
