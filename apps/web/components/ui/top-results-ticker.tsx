'use client';

/**
 * TopResultsTicker — shared sports-broadcast ticker strip.
 *
 * Visual design: purple "תוצאות מובילות" badge pinned to the RTL-start side,
 * seamless Framer Motion horizontal scroll showing real top achievements.
 *
 * Sorting contract (enforced by the backend):
 *   Results are ordered by calculatedGrade DESC (0–100 int). Because the
 *   grading system normalises all test types to this scale, lower sprint
 *   times already map to higher scores, and higher rep/distance counts
 *   also map to higher scores — so "highest score" always equals "best result".
 */

import { motion } from 'framer-motion';
import {
  Activity,
  Dumbbell,
  MoveHorizontal,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import type { TopAchievementItem } from '@fitgrade/types';
import { getHebrewGradeLabel } from '@fitgrade/types';

// ─── Icon + colour mapping keyed on examName patterns ────────────────────────

function resolveIcon(examName: string): React.ElementType {
  if (/ריצ|מרחק|מטר/.test(examName)) return Timer;
  if (/שכיבות/.test(examName))         return Activity;
  if (/מתח/.test(examName))            return Dumbbell;
  if (/קפיצה/.test(examName))          return MoveHorizontal;
  if (/כפיפות/.test(examName))         return Activity;
  if (/ביפ/.test(examName))            return Zap;
  return Trophy;
}

const COLOR_MAP: Array<[RegExp, string]> = [
  [/ריצ|מרחק/,  '#6d28d9'], // violet  — distance runs / sprints
  [/שכיבות/,    '#0e7490'], // cyan    — push-ups
  [/מתח/,       '#b45309'], // amber   — pull-ups
  [/קפיצה/,     '#1d4ed8'], // blue    — long jump
  [/כפיפות/,    '#be185d'], // pink    — sit-ups
  [/ביפ/,       '#059669'], // emerald — beep test
];

function resolveColor(examName: string): string {
  for (const [re, color] of COLOR_MAP) {
    if (re.test(examName)) return color;
  }
  return '#6d28d9';
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TopResultsTickerProps {
  items: TopAchievementItem[];
}

export function TopResultsTicker({ items }: TopResultsTickerProps): React.JSX.Element {
  if (items.length === 0) return <></>;

  // Scroll duration scales with content length so very short lists don't
  // fly past and very long ones don't crawl.
  const scrollDuration = Math.max(18, items.length * 6);

  return (
    <div
      className="relative flex items-center rounded-2xl border border-white/30 bg-white/40 backdrop-blur-md cursor-default overflow-hidden"
      style={{ boxShadow: '0 2px 18px rgba(15,23,42,0.07)', height: 44 }}
      aria-label="טיקר תוצאות מובילות"
    >
      {/* ── Static anchor badge — pinned to RTL start (right) ──────────── */}
      <div
        className="absolute start-0 top-0 bottom-0 z-10 flex items-center gap-1.5 px-4 shrink-0 rounded-s-2xl"
        style={{
          background:           'rgba(109,40,217,0.13)',
          backdropFilter:       'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderInlineEnd:      '1px solid rgba(109,40,217,0.20)',
        }}
      >
        <Trophy className="w-3.5 h-3.5 text-violet-600 shrink-0" aria-hidden="true" />
        <span className="text-[11.5px] font-black tracking-tight text-violet-700 whitespace-nowrap select-none">
          תוצאות מובילות
        </span>
      </div>

      {/* ── Scrolling track — clears the badge width ───────────────────── */}
      <div
        className="absolute top-0 bottom-0 overflow-hidden"
        style={{ insetInlineStart: 152, insetInlineEnd: 0 }}
      >
        {/*
         * Two-group seamless marquee:
         * The motion.div is 200% wide (two min-w-full children).
         * x: ['0%', '-50%'] moves it by exactly one group width → seamless loop.
         */}
        <motion.div
          className="flex h-full"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            duration:   scrollDuration,
            ease:       'linear',
            repeat:     Infinity,
            repeatType: 'loop',
          }}
        >
          {(['a', 'b'] as const).map((groupKey) => (
            <div
              key={groupKey}
              dir="ltr"
              className="flex items-center justify-around min-w-full shrink-0 h-full"
              aria-hidden={groupKey === 'b' ? true : undefined}
            >
              {items.map(({ studentName, examName, score }, i) => {
                const Icon  = resolveIcon(examName);
                const color = resolveColor(examName);
                return (
                  <span
                    key={`${groupKey}-${i}`}
                    style={{
                      display:    'inline-flex',
                      alignItems: 'center',
                      gap:        8,
                      paddingLeft:  16,
                      paddingRight: 16,
                      flexShrink: 0,
                    }}
                  >
                    {/* Sport icon */}
                    <Icon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color }}
                      aria-hidden="true"
                    />

                    {/* Student name — coloured glow */}
                    <span
                      className="text-[13px] font-bold text-slate-900 whitespace-nowrap"
                      style={{ textShadow: `0 0 12px ${color}55` }}
                    >
                      {studentName}
                    </span>

                    <span className="text-slate-300 text-[11px]" aria-hidden="true">•</span>

                    {/* Test name */}
                    <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                      {examName}
                    </span>

                    <span className="text-slate-300 text-[11px]" aria-hidden="true">•</span>

                    {/* Hebrew grade label */}
                    <span
                      className="text-[12px] font-semibold whitespace-nowrap"
                      style={{ color }}
                    >
                      {getHebrewGradeLabel(score)}
                    </span>

                    {/* Divider */}
                    <span
                      className="text-slate-200 text-[15px] font-thin"
                      style={{ marginLeft: 12 }}
                      aria-hidden="true"
                    >
                      |
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
