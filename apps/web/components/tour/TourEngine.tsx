'use client';

import dynamic from 'next/dynamic';
import type { EventData } from 'react-joyride';
import { TOUR_STEPS } from '@/lib/tour-steps';
import type { TourStep } from '@/lib/tour-steps';
import { TourTooltip } from './TourTooltip';
import { NullBeacon } from './NullBeacon';

// Lazy-load Joyride so it never runs on the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Joyride = dynamic<any>(
  () => import('react-joyride').then((m) => ({ default: m.Joyride })),
  { ssr: false },
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface TourEngineProps {
  /** True only when machine phase === 'running'. */
  run:       boolean;
  /** The index of the step currently displayed. */
  stepIndex: number;
  /** Forwarded to Joyride's onEvent. */
  onEvent:   (data: EventData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// Pure render — no state, no side effects. All decisions live in the machine.
//
// Hardening applied in Phase E:
//
//   key={stepIndex}
//     Forces React to fully unmount and remount Joyride on every step
//     transition. No DOM elements survive between steps — atomic transitions.
//     Eliminates the v2 ghost-beacon, ghost-overlay, and stuck-spotlight
//     classes of bugs by construction (rather than by reactive cleanup).
//     Trade-off: tooltip enter animation plays on every step. Acceptable —
//     and arguably desirable — because it gives a clean visual reset.
//
//   beaconComponent={NullBeacon}
//     react-joyride briefly renders a beacon during step_after → step_before
//     transitions even when steps have skipBeacon: true. Replacing the
//     default beacon with a component that returns null means the beacon
//     DOM is never created. Structural elimination, not cleanup.
//
// Positioning notes:
//
//   scrollOffset={120}
//     Scrolls the target 120 px below the top edge of the scroll container.
//     Keeps both the spotlight and the tooltip visible together on a
//     standard mobile viewport (≥ 667 px) for elements up to ~200 px tall.
//
//   floaterProps.offset = 20
//     20 px gap between the spotlight rectangle's edge and the tooltip card.
//
//   floaterProps.options.preventOverflow / flip
//     Popper.js (v1 format, used by react-floater) modifiers:
//     • preventOverflow: keeps the tooltip inside the viewport.
//     • flip: when the preferred side has no room, tries the fallback list
//       before giving up. Combined with per-step placement this eliminates
//       clipping on small screens.

export function TourEngine({ run, stepIndex, onEvent }: TourEngineProps): React.JSX.Element {
  const currentStep     = TOUR_STEPS[stepIndex] as TourStep | undefined;
  const overlayDisabled = currentStep?.disableOverlay ?? false;

  return (
    <Joyride
      key={stepIndex}
      run={run}
      stepIndex={stepIndex}
      steps={TOUR_STEPS}
      continuous
      scrollToFirstStep
      scrollOffset={120}
      disableOverlayClose
      disableOverlay={overlayDisabled}
      tooltipComponent={TourTooltip}
      beaconComponent={NullBeacon}
      onEvent={onEvent}
      floaterProps={{
        offset: 20,
        options: {
          preventOverflow: { boundariesElement: 'viewport' },
          flip:            { behavior: ['top', 'bottom', 'right', 'left'] },
        },
      }}
      styles={{
        options: {
          overlayColor: 'rgba(0,0,0,0.65)',
          zIndex:       10000,
        },
      }}
      locale={{
        back:  'הקודם',
        close: 'סגור',
        last:  'למסך ההגדרות',
        next:  'הבא',
        skip:  'דלג',
      }}
    />
  );
}
