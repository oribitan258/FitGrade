'use client';

/**
 * SpotlightCard — mouse-following radial spotlight on a dark glass card.
 * Based on easemize/spotlight-card from 21st.dev.
 */

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SpotlightCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  innerClassName?: string;
  /** Radial spotlight color — defaults to indigo */
  spotlightColor?: string;
  /** Spotlight radius in px — defaults to 350 */
  spotlightSize?: number;
}

export function SpotlightCard({
  children,
  className,
  innerClassName,
  spotlightColor = 'rgba(99,102,241,0.18)',
  spotlightSize = 350,
  onMouseMove: externalMouseMove,
  onMouseEnter: externalMouseEnter,
  onMouseLeave: externalMouseLeave,
  ...rest
}: SpotlightCardProps): React.JSX.Element {
  const cardRef                     = useRef<HTMLDivElement>(null);
  const [pos, setPos]               = useState({ x: 0, y: 0 });
  const [hovered, setHovered]       = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    externalMouseMove?.(e);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={(e) => { setHovered(true); externalMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); externalMouseLeave?.(e); }}
      className={cn('relative overflow-hidden rounded-3xl', className)}
      {...rest}
    >
      {/* Spotlight layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          opacity:    hovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
          background: `radial-gradient(${spotlightSize}px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className={cn('relative z-10', innerClassName)}>
        {children}
      </div>
    </div>
  );
}
