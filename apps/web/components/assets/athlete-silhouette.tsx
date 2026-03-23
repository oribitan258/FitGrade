'use client';

/**
 * AthleteSilhouette — anatomical body diagram for the Student Profile page.
 *
 * Architecture:
 *   - Two gender variants (male / female) sharing the same muscle-group prop API.
 *   - Muscle groups are individually named SVG <path> elements so a designer can
 *     replace the placeholder paths with production assets without touching props.
 *   - `highlightedMuscles` drives fill color: highlighted = tier color, rest = base.
 *   - Accepts a `scoreMap` to drive highlight intensity per muscle group.
 *
 * Placeholder geometry:
 *   The SVG paths below are simplified anatomical approximations on a 120×280
 *   viewBox (roughly human proportions). Replace individual paths with designer
 *   assets by updating the MUSCLE_PATHS_MALE / MUSCLE_PATHS_FEMALE constants —
 *   no component logic changes needed.
 *
 * Usage:
 *   <AthleteSilhouette gender="male" highlightedMuscles={['legs', 'core']} />
 *   <AthleteSilhouette gender="female" scoreMap={{ legs: 88, arms: 62 }} />
 */

import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Muscle Group Keys
// ─────────────────────────────────────────────────────────────────────────────

/** All muscle groups that can be independently highlighted on the silhouette. */
export type MuscleGroup =
  | 'head'
  | 'shoulders'
  | 'chest'
  | 'arms'
  | 'core'
  | 'legs'
  | 'calves';

/** Maps a score (0–100) to a highlight color on the continuous green→amber→red scale. */
function scoreToColor(score: number): string {
  if (score >= 75) return '#16a34a'; // green-600 — strong performance
  if (score >= 55) return '#f59e0b'; // amber-500 — moderate performance
  return '#ef4444';                   // red-500   — needs improvement
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Path Data — Placeholder Anatomy
//
// ViewBox: 0 0 120 280
// Coordinate system: top = head, bottom = feet.
// Each constant is a valid SVG path `d` attribute string.
// Replace these with designer SVG exports — keep the constant names the same.
// ─────────────────────────────────────────────────────────────────────────────

/** Placeholder paths for the male silhouette variant. */
const MALE_PATHS: Record<MuscleGroup, string> = {
  head:      'M60 8 a18 18 0 1 1 0.001 0 Z',
  shoulders: 'M20 36 Q30 28 60 28 Q90 28 100 36 L96 52 Q80 44 60 44 Q40 44 24 52 Z',
  chest:     'M24 52 Q40 44 60 44 Q80 44 96 52 L92 90 Q76 96 60 96 Q44 96 28 90 Z',
  arms:      'M20 36 L10 100 Q14 106 20 104 L30 50 Z M100 36 L110 100 Q106 106 100 104 L90 50 Z',
  core:      'M28 90 Q44 96 60 96 Q76 96 92 90 L88 148 Q74 156 60 156 Q46 156 32 148 Z',
  legs:      'M32 148 Q46 156 60 156 Q74 156 88 148 L84 220 Q74 228 60 228 Q46 228 36 220 Z',
  calves:    'M36 220 Q46 228 60 228 Q74 228 84 220 L80 272 Q74 276 60 276 Q46 276 40 272 Z',
};

/** Placeholder paths for the female silhouette variant.
 *  Slightly adjusted proportions (narrower shoulders, wider hips). */
const FEMALE_PATHS: Record<MuscleGroup, string> = {
  head:      'M60 8 a16 16 0 1 1 0.001 0 Z',
  shoulders: 'M28 36 Q38 28 60 28 Q82 28 92 36 L88 52 Q76 44 60 44 Q44 44 32 52 Z',
  chest:     'M32 52 Q44 44 60 44 Q76 44 88 52 L86 90 Q74 98 60 98 Q46 98 34 90 Z',
  arms:      'M28 36 L16 100 Q20 106 26 104 L36 50 Z M92 36 L104 100 Q100 106 94 104 L84 50 Z',
  core:      'M34 90 Q46 98 60 98 Q74 98 86 90 L88 148 Q76 158 60 158 Q44 158 32 148 Z',
  legs:      'M32 148 Q44 158 60 158 Q76 158 88 148 L82 220 Q72 228 60 228 Q48 228 38 220 Z',
  calves:    'M38 220 Q48 228 60 228 Q72 228 82 220 L78 272 Q72 276 60 276 Q48 276 42 272 Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// Floating Badge — score label anchored to a muscle region
// ─────────────────────────────────────────────────────────────────────────────

/** Approximate anchor point (cx, cy) to place a score badge near each muscle group. */
const BADGE_ANCHORS: Record<MuscleGroup, { cx: number; cy: number }> = {
  head:      { cx: 88,  cy: 12  },
  shoulders: { cx: 100, cy: 40  },
  chest:     { cx: 100, cy: 70  },
  arms:      { cx: 8,   cy: 70  },
  core:      { cx: 100, cy: 120 },
  legs:      { cx: 100, cy: 185 },
  calves:    { cx: 100, cy: 248 },
};

interface FloatingBadgeProps {
  muscleGroup: MuscleGroup;
  score: number;
}

function FloatingBadge({ muscleGroup: _, score }: FloatingBadgeProps): React.JSX.Element {
  const color = scoreToColor(score);
  return (
    <g>
      <rect
        x={BADGE_ANCHORS[_].cx - 14}
        y={BADGE_ANCHORS[_].cy - 8}
        width={28}
        height={16}
        rx={8}
        fill="rgba(0,0,0,0.80)"
      />
      <text
        x={BADGE_ANCHORS[_].cx}
        y={BADGE_ANCHORS[_].cy + 4.5}
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill={color}
      >
        {score}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface AthleteSilhouetteProps {
  /** Determines which path set is rendered. Defaults to 'male'. */
  gender?: 'male' | 'female';
  /**
   * Array of muscle groups to highlight.
   * If `scoreMap` is provided, only the groups listed there are highlighted.
   * This prop takes precedence when both are provided.
   */
  highlightedMuscles?: ReadonlyArray<MuscleGroup>;
  /**
   * Maps muscle group keys to scores (0–100).
   * Groups with a score entry are highlighted; color encodes performance.
   * Used on the Student Profile to show per-category test performance.
   */
  scoreMap?: Partial<Record<MuscleGroup, number>>;
  /** Width of the rendered SVG in pixels. Height is calculated from viewBox ratio. */
  width?: number;
  /** Optional additional class names for positioning / layout. */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/** Ordered list of all muscle groups for consistent rendering order (back → front). */
const MUSCLE_GROUPS: ReadonlyArray<MuscleGroup> = [
  'head',
  'shoulders',
  'chest',
  'arms',
  'core',
  'legs',
  'calves',
];

/** Base fill for non-highlighted muscle regions. */
const BASE_FILL    = 'rgba(255, 255, 255, 0.08)';
const BASE_STROKE  = 'rgba(255, 255, 255, 0.20)';

export function AthleteSilhouette({
  gender = 'male',
  highlightedMuscles,
  scoreMap,
  width = 120,
  className = '',
}: AthleteSilhouetteProps): React.JSX.Element {
  const paths = gender === 'female' ? FEMALE_PATHS : MALE_PATHS;

  // Resolve which groups are highlighted and what color to use.
  // Priority: explicit highlightedMuscles > scoreMap keys > none.
  const highlighted: Partial<Record<MuscleGroup, string>> = {};
  if (highlightedMuscles) {
    for (const group of highlightedMuscles) {
      const score = scoreMap?.[group];
      highlighted[group] = score !== undefined ? scoreToColor(score) : '#8b5cf6';
    }
  } else if (scoreMap) {
    for (const [key, score] of Object.entries(scoreMap) as [MuscleGroup, number][]) {
      highlighted[key] = scoreToColor(score);
    }
  }

  // Determine which groups should show a floating score badge.
  const badgeGroups: MuscleGroup[] =
    scoreMap
      ? (Object.keys(scoreMap) as MuscleGroup[]).filter(
          (k) => highlightedMuscles === undefined || highlightedMuscles.includes(k),
        )
      : [];

  const height = Math.round(width * (280 / 120));

  return (
    <motion.svg
      viewBox="0 0 120 280"
      width={width}
      height={height}
      className={['overflow-visible', className].join(' ')}
      aria-label={`תרשים גוף — ${gender === 'female' ? 'נקבה' : 'זכר'}`}
      role="img"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* ── Muscle region paths ─────────────────────────────────────────── */}
      {MUSCLE_GROUPS.map((group) => {
        const isHighlighted = group in highlighted;
        const fillColor     = isHighlighted ? highlighted[group] : BASE_FILL;
        const strokeColor   = isHighlighted
          ? (highlighted[group] ?? BASE_STROKE)
          : BASE_STROKE;

        return (
          <motion.path
            key={group}
            d={paths[group]}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={isHighlighted ? 1.5 : 1}
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: MUSCLE_GROUPS.indexOf(group) * 0.04 }}
            style={
              isHighlighted
                ? { filter: `drop-shadow(0 0 6px ${highlighted[group]}88)` }
                : undefined
            }
            aria-label={group}
          />
        );
      })}

      {/* ── Floating score badges ────────────────────────────────────────── */}
      {badgeGroups.map((group) => (
        <FloatingBadge
          key={`badge-${group}`}
          muscleGroup={group}
          score={scoreMap![group]!}
        />
      ))}
    </motion.svg>
  );
}
