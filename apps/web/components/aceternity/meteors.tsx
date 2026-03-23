'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface MeteorData {
  id: number;
  top: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function generateMeteors(count: number): MeteorData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    top: Math.random() * 40,
    left: Math.floor(Math.random() * (400 - -400) + -400),
    delay: Math.random() * 0.6 + 0.2,
    duration: Math.floor(Math.random() * 8 + 5),
    size: Math.random() * 1 + 0.5,
  }));
}

interface MeteorsProps {
  number?: number;
  className?: string;
}

/**
 * Aceternity UI — Meteors
 * Diagonal shooting-star streaks across a container.
 * Parent must have `overflow: hidden` and `position: relative`.
 */
export function Meteors({ number = 20, className }: MeteorsProps): React.JSX.Element {
  const [meteors, setMeteors] = useState<MeteorData[]>([]);

  useEffect(() => {
    setMeteors(generateMeteors(number));
  }, [number]);

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {meteors.map((meteor) => (
        <span
          key={meteor.id}
          className="absolute rotate-[215deg] animate-[meteor_var(--duration)s_var(--delay)s_linear_infinite]"
          style={
            {
              top: `${meteor.top}%`,
              left: `${meteor.left}px`,
              '--duration': meteor.duration,
              '--delay': meteor.delay,
              width: `${meteor.size * 100}px`,
              height: `${meteor.size}px`,
              background: `linear-gradient(90deg, rgba(139,92,246,0.8), rgba(0,212,255,0.6), transparent)`,
              borderRadius: '9999px',
              filter: `drop-shadow(0 0 4px rgba(139,92,246,0.5))`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
