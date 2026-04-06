'use client';

/**
 * HoverBorderGradient — dark card with an animated gradient border that
 * sweeps through all 4 sides when idle and highlights on hover.
 * Based on Shatlyk1011/hover-border-gradient from 21st.dev.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Direction cycle ──────────────────────────────────────────────────────────

const DIRECTIONS = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT'] as const;
type Direction = (typeof DIRECTIONS)[number];

/** Radial gradient pinned to each edge — creates the sweeping "ring" illusion */
const MOVING_MAP: Record<Direction, string> = {
  TOP:    'radial-gradient(22% 60% at 50% 0%,   rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
  LEFT:   'radial-gradient(22% 60% at 0%  50%,  rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
  BOTTOM: 'radial-gradient(22% 60% at 50% 100%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
  RIGHT:  'radial-gradient(22% 60% at 100% 50%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
};

/** Full hover highlight — indigo burst from center */
const HOVER_HIGHLIGHT =
  'radial-gradient(75% 181% at 50% 50%, rgba(99,102,241,0.85) 0%, rgba(255,255,255,0) 100%)';

// ─── Component ────────────────────────────────────────────────────────────────

export interface HoverBorderGradientProps {
  children: React.ReactNode;
  /** Extra classes on the outer wrapper (sets border-radius, size, etc.) */
  className?: string;
  /** Extra classes on the inner content div */
  innerClassName?: string;
  /** Direction-rotation interval in ms — defaults to 1 400 */
  duration?: number;
  /** Override the idle gradient color (CSS gradient string) */
  idleColor?: string;
  /** Override the hover gradient color (CSS gradient string) */
  hoverColor?: string;
}

export function HoverBorderGradient({
  children,
  className,
  innerClassName,
  duration = 1400,
  idleColor,
  hoverColor = HOVER_HIGHLIGHT,
}: HoverBorderGradientProps): React.JSX.Element {
  const [hovered, setHovered]     = useState(false);
  const [direction, setDirection] = useState<Direction>('TOP');

  // Rotate direction when idle
  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => {
      setDirection((prev) => {
        const idx = DIRECTIONS.indexOf(prev);
        return DIRECTIONS[(idx + 1) % DIRECTIONS.length];
      });
    }, duration);
    return () => { clearInterval(id); };
  }, [hovered, duration]);

  const borderGradient = hovered ? hoverColor : (idleColor ?? MOVING_MAP[direction]);

  return (
    // 1 px outer shell — the gradient sits here, giving the border illusion
    <div
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
      className={cn('relative overflow-hidden rounded-3xl p-px', className)}
    >
      {/* Animated gradient border */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        animate={{ background: borderGradient }}
        transition={{ ease: 'linear', duration: 0.5 }}
      />

      {/* Inner glass card — sits 1 px inset so the border shows */}
      <div
        className={cn(
          'relative rounded-[calc(1.5rem-1px)]',
          innerClassName,
        )}
        style={{
          background:           'rgba(15,23,42,0.82)',
          backdropFilter:       'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
