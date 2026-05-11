/**
 * Tier 1.7 — NullBeacon render contract.
 *
 * The library mounts the configured beaconComponent. If this ever returns a
 * non-null DOM node, ghost beacons will reappear on the user's screen. The
 * test pins the no-render contract and the forwardRef compatibility that
 * react-joyride's typings require.
 */

import { createRef } from 'react';
import { render } from '@testing-library/react';
import { NullBeacon } from '../NullBeacon';

describe('NullBeacon', () => {
  it('renders no DOM nodes', () => {
    const { container } = render(<NullBeacon />);
    expect(container.firstChild).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('accepts a forwardRef without throwing (ref remains null because nothing is rendered)', () => {
    const ref = createRef<HTMLDivElement>();
    expect(() => render(<NullBeacon ref={ref} />)).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it('accepts arbitrary props (lib passes title, onClick, etc.) without rendering them', () => {
    const props = { title: 'beacon-title', onClick: () => undefined };
    const { container } = render(<NullBeacon {...props} />);
    expect(container.firstChild).toBeNull();
  });
});
