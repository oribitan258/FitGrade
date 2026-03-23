'use client';

import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

/**
 * Magic UI — Border Beam
 * A rotating animated beam of light along the border of a card.
 * The parent element must have `position: relative` and `overflow: hidden`.
 */
export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#7B2FFF',
  colorTo = '#00D4FF',
  delay = 0,
}: BorderBeamProps): React.JSX.Element {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': duration,
          '--anchor': anchor,
          '--border-width': borderWidth,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',
        '[background:linear-gradient(transparent,transparent),linear-gradient(var(--color-from),var(--color-to))]',
        '[background-clip:padding-box,border-box] [background-origin:padding-box,border-box]',
        '[mask:linear-gradient(transparent,transparent),conic-gradient(transparent_calc(var(--anchor)*1%),black_calc(var(--anchor)*1%+calc(var(--size)*1px)),transparent_calc(var(--anchor)*1%+calc(var(--size)*1px)))]',
        '[mask-clip:padding-box,border-box] [mask-composite:intersect]',
        'animate-[border-beam_var(--duration)s_linear_var(--delay)_infinite]',
        className,
      )}
    />
  );
}
