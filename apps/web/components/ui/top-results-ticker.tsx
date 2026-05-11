'use client';

/**
 * TopResultsTicker — shared sports-broadcast ticker strip.
 *
 * Visual design: purple/emerald "תוצאות מובילות" badge pinned to the RTL-start
 * side, seamless Framer Motion horizontal scroll showing real top achievements.
 *
 * Item format (per design spec):
 *   [Icon] [Student Name] • [ClassName + Gender] • [Test Name] • [Physical Result]
 *   e.g.  ▶ דניאל לוי • ז' 2 בנים • ריצת 2000 • 7:04 דקות
 *
 * Sorting contract (enforced by the backend):
 *   Results are ordered by calculatedGrade DESC (0–100 int).
 *
 * Fallback behaviour:
 *   When items is empty and fallbackText is provided, the fallback text
 *   scrolls inside the same marquee (repeated 3× with star separators).
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
import type { TopAchievementItem, Semester } from '@fitgrade/types';
import { formatClassWithGender, formatRawValue } from '@/lib/class-utils';

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
  /** Text to scroll in the marquee when items is empty. */
  fallbackText?: string;
  /** Active semester — drives the badge colour. Defaults to A (violet). */
  semester?: Semester;
}

/** Number of times the fallback text is repeated per marquee group. */
const FALLBACK_REPEAT = 3;

export function TopResultsTicker({ items, fallbackText, semester = 'A' }: TopResultsTickerProps): React.JSX.Element {
  const isEmpty     = items.length === 0;
  const badgeBg     = semester === 'B' ? 'rgba(34,197,94,0.13)'  : 'rgba(109,40,217,0.13)';
  const badgeBorder = semester === 'B' ? 'rgba(34,197,94,0.20)'  : 'rgba(109,40,217,0.20)';
  const trophyCls   = semester === 'B' ? 'text-emerald-600'      : 'text-violet-600';
  const badgeText   = semester === 'B' ? 'text-emerald-700'      : 'text-violet-700';

  if (isEmpty && !fallbackText) return <></>;

  // Fallback scrolls at a calm fixed pace; real items scale with content length.
  const scrollDuration = isEmpty ? 12 : Math.max(10, items.length * 3);

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
          background:           badgeBg,
          backdropFilter:       'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderInlineEnd:      `1px solid ${badgeBorder}`,
        }}
      >
        <Trophy className={`w-3.5 h-3.5 ${trophyCls} shrink-0`} aria-hidden="true" />
        <span className={`text-[11.5px] font-black tracking-tight ${badgeText} whitespace-nowrap select-none`}>
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
              {isEmpty ? (
                /* ── Fallback: scroll the placeholder text 3× with star separators ── */
                Array.from({ length: FALLBACK_REPEAT }, (_, i) => (
                  <span
                    key={`${groupKey}-fallback-${i}`}
                    style={{
                      display:     'inline-flex',
                      alignItems:  'center',
                      gap:         12,
                      paddingLeft:  28,
                      paddingRight: 28,
                      flexShrink:  0,
                    }}
                  >
                    <Trophy
                      className="w-3.5 h-3.5 shrink-0 text-violet-300"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] font-semibold text-slate-500 whitespace-nowrap">
                      {fallbackText}
                    </span>
                    <span className="text-violet-200 text-[12px]" aria-hidden="true">★</span>
                  </span>
                ))
              ) : (
                /* ── Real items ─────────────────────────────────────────────── */
                items.map(({ studentName, examName, score, className, classGenderType, rawValue, unit }, i) => {
                  const Icon        = resolveIcon(examName);
                  const color       = resolveColor(examName);
                  const classLabel  = formatClassWithGender(className, classGenderType);
                  const physicalStr = formatRawValue(rawValue, examName, unit);

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

                      {/* Student name */}
                      <span
                        className="text-[13px] font-bold text-slate-900 whitespace-nowrap"
                        style={{ textShadow: `0 0 12px ${color}55` }}
                      >
                        {studentName}
                      </span>

                      <span className="text-slate-300 text-[11px]" aria-hidden="true">•</span>

                      {/* Class + gender label */}
                      <span className="text-[12px] font-medium text-slate-500 whitespace-nowrap">
                        {classLabel}
                      </span>

                      <span className="text-slate-300 text-[11px]" aria-hidden="true">•</span>

                      {/* Test name */}
                      <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                        {examName}
                      </span>

                      {physicalStr && (
                        <>
                          <span className="text-slate-300 text-[11px]" aria-hidden="true">•</span>

                          {/* Physical result */}
                          <span
                            className="text-[12px] font-semibold whitespace-nowrap"
                            style={{ color }}
                          >
                            {physicalStr}
                          </span>
                        </>
                      )}

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
                })
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
