'use client';

import { cn } from '@/lib/utils';

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: React.ReactNode;
}

/**
 * Magic UI — Shine Border
 * Renders a card with an animated conic-gradient shine rotating around the border.
 */
export function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = ['#7B2FFF', '#00D4FF', '#39FF14'],
  className,
  children,
}: ShineBorderProps): React.JSX.Element {
  const colorString = Array.isArray(color) ? color.join(',') : color;

  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
          '--border-width': `${borderWidth}px`,
          '--duration': `${duration}s`,
          '--shine-colors': colorString,
          '--background': 'rgba(255,255,255,0.82)',
          backgroundImage: `radial-gradient(circle, var(--shine-colors))`,
          animationDuration: `${duration}s`,
        } as React.CSSProperties
      }
      className={cn(
        'relative grid place-items-stretch overflow-hidden rounded-[--border-radius] p-[--border-width]',
        className,
      )}
    >
      {/* Animated conic-gradient border layer */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `conic-gradient(from 0deg, ${colorString})`,
          animation: `shine-spin ${duration}s linear infinite`,
        }}
      />
      {/* Content sits on top */}
      <div
        className="relative z-10 h-full w-full rounded-[calc(var(--border-radius)-var(--border-width))]"
        style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)' }}
      >
        {children}
      </div>
    </div>
  );
}
