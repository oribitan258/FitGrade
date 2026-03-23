'use client';

/**
 * GradeBadge — the atomic unit of grade display in FitGrade.
 *
 * RULES:
 *   - Always receives a numeric score (0–100 integer from the DB / API).
 *   - Renders the Hebrew label AND a tier-specific premium gradient.
 *   - NEVER renders the raw number to the user — the label IS the grade.
 *   - Mounts with a Framer Motion spring so grade reveals feel tactile.
 *
 * Usage:
 *   <GradeBadge score={87} />          → "טוב מאוד" (teal gradient, md size)
 *   <GradeBadge score={94} size="lg" /> → "מצטיין"   (emerald gradient, large)
 *   <GradeBadge score={42} size="sm" /> → "נכשל"     (red gradient, compact)
 */

import { motion } from 'framer-motion';
import { getHebrewGradeLabel } from '@fitgrade/types';

// ─────────────────────────────────────────────────────────────────────────────
// Grade Tier Definitions
// Each tier maps a score range to a gradient, text color, and ambient glow.
// Thresholds mirror those in packages/types/src/grade-labels.ts exactly.
// ─────────────────────────────────────────────────────────────────────────────

interface GradeTierStyle {
  gradient: string;
  textColor: string;
  glowColor: string;
}

/** Score thresholds — must stay in sync with grade-labels.ts */
const SCORE_EXCELLENT = 90;
const SCORE_VERY_GOOD = 75;
const SCORE_GOOD      = 60;
const SCORE_PASS      = 55;

function getGradeTierStyle(score: number): GradeTierStyle {
  if (score >= SCORE_EXCELLENT) {
    return {
      gradient:  'linear-gradient(135deg, #14532d 0%, #16a34a 50%, #22c55e 100%)',
      textColor: '#bbf7d0',
      glowColor: 'rgba(22, 163, 74, 0.40)',
    };
  }
  if (score >= SCORE_VERY_GOOD) {
    return {
      gradient:  'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #06b6d4 100%)',
      textColor: '#a5f3fc',
      glowColor: 'rgba(6, 182, 212, 0.35)',
    };
  }
  if (score >= SCORE_GOOD) {
    return {
      gradient:  'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #8b5cf6 100%)',
      textColor: '#ede9fe',
      glowColor: 'rgba(139, 92, 246, 0.40)',
    };
  }
  if (score >= SCORE_PASS) {
    return {
      gradient:  'linear-gradient(135deg, #78350f 0%, #b45309 50%, #f59e0b 100%)',
      textColor: '#fef3c7',
      glowColor: 'rgba(245, 158, 11, 0.40)',
    };
  }
  return {
    gradient:  'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #ef4444 100%)',
    textColor: '#fee2e2',
    glowColor: 'rgba(239, 68, 68, 0.40)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Size Variants
// ─────────────────────────────────────────────────────────────────────────────

/** Three display sizes for different contexts across the app. */
type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<BadgeSize, string> = {
  /** sm — compact lists, table cells, secondary info  */
  sm: 'px-2 py-0.5 text-[10px] font-bold rounded-full',
  /** md — default: card stats, student rows (default) */
  md: 'px-3 py-1 text-xs font-bold rounded-full',
  /** lg — hero contexts: student profile header, test summary */
  lg: 'px-4 py-1.5 text-sm font-black rounded-full',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface GradeBadgeProps {
  /** Numeric grade 0–100 as returned by the API / GradingService. */
  score: number;
  /** Display size. Defaults to 'md'. */
  size?: BadgeSize;
  /** Pass true to disable the mount spring animation (e.g. in lists). */
  noAnimation?: boolean;
  /** Optional additional class names for layout purposes only. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GradeBadge({
  score,
  size = 'md',
  noAnimation = false,
  className = '',
}: GradeBadgeProps): React.JSX.Element {
  const label = getHebrewGradeLabel(score);
  const tier  = getGradeTierStyle(score);

  return (
    <motion.span
      initial={noAnimation ? false : { opacity: 0, scale: 0.55, rotate: -6 }}
      animate={noAnimation ? false : { opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      className={[SIZE_CLASSES[size], 'inline-flex items-center justify-center select-none', className].join(' ')}
      style={{
        background: tier.gradient,
        color:      tier.textColor,
        boxShadow:  `0 0 12px ${tier.glowColor}`,
      }}
      aria-label={`ציון: ${label}`}
    >
      {label}
    </motion.span>
  );
}
