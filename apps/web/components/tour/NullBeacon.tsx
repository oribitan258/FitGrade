'use client';

import { forwardRef } from 'react';

/**
 * No-op beacon for react-joyride.
 *
 * Why this exists:
 *   Tour steps are configured with `skipBeacon: true`, but the library still
 *   briefly mounts beacon DOM during step_after → step_before transitions
 *   before its skipBeacon logic runs. Imperative DOM purges (the v2 hack)
 *   are reactive — they can't catch every render frame.
 *
 *   Providing this component as Joyride's `beaconComponent` prop replaces
 *   the default beacon entirely. Because the component returns null, the
 *   beacon DOM is NEVER created — structural elimination, not cleanup.
 *
 *   forwardRef is required by react-joyride's type signature even though
 *   the ref is never used (there's nothing to attach it to).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NullBeacon = forwardRef<HTMLDivElement, any>(function NullBeacon() {
  return null;
});
