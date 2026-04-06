'use client';

/**
 * HoverGlowButton — button with a radial glow that follows the cursor.
 * Based on easemize/hover-glow-button from 21st.dev.
 */

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface HoverGlowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Radial glow color — defaults to violet */
  glowColor?: string;
}

export function HoverGlowButton({
  children,
  className,
  glowColor = 'rgba(139,92,246,0.65)',
  disabled,
  ...props
}: HoverGlowButtonProps): React.JSX.Element {
  const ref                       = useRef<HTMLButtonElement>(null);
  const [pos, setPos]             = useState({ x: 0, y: 0 });
  const [hovered, setHovered]     = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { if (!disabled) setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
      disabled={disabled}
      className={cn('relative overflow-hidden', className)}
      type="button"
      {...props}
    >
      {/* Mouse-tracking glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left:       pos.x,
          top:        pos.y,
          opacity:    hovered ? 1 : 0,
          background: `radial-gradient(circle, ${glowColor}, transparent 65%)`,
          transition: 'opacity 0.35s ease-out',
        }}
      />
      {/* Content above glow */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
