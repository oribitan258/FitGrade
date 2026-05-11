'use client';

import type { TooltipRenderProps } from 'react-joyride';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Custom Hebrew RTL tooltip for the onboarding tour.
 *
 * Matches the FitGrade glassmorphism design language.
 * Rendered by react-joyride via the `tooltipComponent` prop on <Joyride />.
 */
export function TourTooltip({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  size,
}: TooltipRenderProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      dir="rtl"
      className="relative w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-3xl"
      style={{
        background: 'rgba(15, 10, 40, 0.90)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(139,92,246,0.30)',
        boxShadow:
          '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {/* Ambient violet radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.22) 0%, transparent 65%)',
        }}
      />

      {/* Skip button (top corner) */}
      <button
        {...skipProps}
        type="button"
        aria-label="דלג על הסיור"
        className="absolute end-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Content */}
      <div className="relative px-6 pb-5 pt-5">
        {/* Step counter */}
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'rgba(167,139,250,0.70)' }}
        >
          שלב {index + 1} מתוך {size}
        </p>

        {/* Title */}
        {step.title !== undefined && step.title !== '' && (
          <h3 className="mb-2 text-base font-extrabold leading-snug text-white tracking-tight">
            {step.title as React.ReactNode}
          </h3>
        )}

        {/* Body */}
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.80)' }}>
          {step.content as React.ReactNode}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-4" aria-hidden="true">
        {Array.from({ length: size }).map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              background:
                i === index
                  ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                  : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center justify-between gap-2 px-6 pb-5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}
      >
        {/* Back button (or empty spacer) */}
        {index > 0 ? (
          <button
            {...backProps}
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.65)',
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            הקודם
          </button>
        ) : (
          <span />
        )}

        {/* Primary action: Next / Finish */}
        {continuous ? (
          <button
            {...primaryProps}
            type="button"
            className="rounded-xl px-5 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{
              background:
                'linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
            }}
          >
            {isLastStep ? 'למסך ההגדרות' : 'הבא'}
          </button>
        ) : (
          <button
            {...closeProps}
            type="button"
            className="rounded-xl px-5 py-2 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
            }}
          >
            סגור
          </button>
        )}
      </div>
    </motion.div>
  );
}
