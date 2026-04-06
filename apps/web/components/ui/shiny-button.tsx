'use client';

/**
 * ShinyButton — animated shimmer-sweep CTA button.
 * Based on Shatlyk1011/shiny-button from 21st.dev.
 * Adapted to indigo/violet palette to match FitGrade's design system.
 */

import { cn } from '@/lib/utils';

export interface ShinyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function ShinyButton({
  children,
  className,
  ...props
}: ShinyButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        // Gradient background — 280% wide so hover shifts it
        'bg-[linear-gradient(325deg,#3730a3_0%,#6d28d9_40%,#4f46e5_70%,#3730a3_100%)]',
        'bg-[length:280%_auto]',
        // Layered shadow: outer glow + inner bevel
        'shadow-[0px_0px_24px_rgba(99,102,241,0.55),0px_6px_6px_-1px_rgba(79,70,229,0.30),inset_4px_4px_10px_rgba(167,139,250,0.45),inset_-4px_-4px_10px_rgba(49,46,129,0.40)]',
        // Shimmer: background-position slides to top-right on hover
        'transition-[background-position] duration-700 hover:[background-position:top_right]',
        // Base styles
        'relative overflow-hidden rounded-2xl font-bold text-white',
        // Focus ring
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
