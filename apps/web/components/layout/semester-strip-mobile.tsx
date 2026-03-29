'use client';

/**
 * SemesterStripMobile — sticky semester indicator for mobile viewports.
 *
 * Rendered inside TeacherShell above {children}, visible only on screens
 * narrower than `md` breakpoint. Hidden entirely during an active beep test
 * (Zen Mode) so it never clutters the field session screen.
 *
 * Layout (RTL):
 *   Right (start): colored dot + "מחצית א'/ב' פעילה"
 *   Left  (end):   compact two-button toggle pill
 */

import { motion } from 'framer-motion';
import { useSemester } from '@/contexts/semester-context';
import { useBeepTestContext } from '@/contexts/beep-test-context';
import type { Semester } from '@fitgrade/types';

// ─── Color tokens (light theme — strip lives in the light content area) ───────

const STRIP_TOKENS: Record<Semester, {
  dotColor:      string;
  labelColor:    string;
  pillBg:        string;
  pillBorder:    string;
  pillShadow:    string;
  pillTextColor: string;
  label:         string;
}> = {
  A: {
    dotColor:      'rgba(139,92,246,1)',
    labelColor:    'rgba(109,40,217,0.85)',
    pillBg:        'rgba(139,92,246,0.15)',
    pillBorder:    'rgba(139,92,246,0.35)',
    pillShadow:    '0 0 10px rgba(168,85,247,0.25)',
    pillTextColor: 'rgba(109,40,217,0.95)',
    label:         "מחצית א'",
  },
  B: {
    dotColor:      'rgba(22,163,74,1)',
    labelColor:    'rgba(22,163,74,0.85)',
    pillBg:        'rgba(34,197,94,0.15)',
    pillBorder:    'rgba(34,197,94,0.35)',
    pillShadow:    '0 0 10px rgba(34,197,94,0.22)',
    pillTextColor: 'rgba(22,163,74,0.95)',
    label:         "מחצית ב'",
  },
};

export function SemesterStripMobile(): React.JSX.Element | null {
  const { activeSemester, setActiveSemester } = useSemester();
  const { isTestActive } = useBeepTestContext();

  // Completely removed from the DOM during active beep test
  if (isTestActive) return null;

  const tok = STRIP_TOKENS[activeSemester];

  return (
    <div
      className="md:hidden sticky top-0 z-30 flex h-10 items-center justify-between px-4"
      style={{
        background:    'rgba(255,255,255,0.78)',
        backdropFilter:'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom:  '1px solid rgba(0,0,0,0.07)',
      }}
      dir="rtl"
      aria-label="מחוון סמסטר פעיל"
    >
      {/* Start side (right in RTL): active semester label */}
      <div className="flex items-center gap-1.5">
        <motion.span
          animate={{ color: tok.dotColor }}
          transition={{ duration: 0.45 }}
          className="text-[8px] leading-none"
          aria-hidden="true"
        >
          ●
        </motion.span>
        <motion.span
          animate={{ color: tok.labelColor }}
          transition={{ duration: 0.45 }}
          className="text-[12px] font-bold"
        >
          {tok.label} פעילה
        </motion.span>
      </div>

      {/* End side (left in RTL): compact toggle pill */}
      <div
        className="flex"
        style={{
          background:   'rgba(0,0,0,0.06)',
          border:       '1px solid rgba(0,0,0,0.08)',
          borderRadius: 12,
          padding:      2,
        }}
        role="radiogroup"
        aria-label="בחירת סמסטר"
      >
        {(['A', 'B'] as const).map((sem) => {
          const isActiveSem   = activeSemester === sem;
          const semTok        = STRIP_TOKENS[sem];
          return (
            <button
              key={sem}
              type="button"
              role="radio"
              aria-checked={isActiveSem}
              onClick={() => { setActiveSemester(sem); }}
              className="relative rounded-[10px] px-3 py-1 text-[11px] font-bold transition-colors duration-250"
              style={{
                color:    isActiveSem ? semTok.pillTextColor : 'rgba(0,0,0,0.32)',
                minWidth: 68,
              }}
            >
              {/* Sliding active indicator */}
              {isActiveSem && (
                <motion.div
                  layoutId="semester-pill-mobile"
                  className="absolute inset-0 rounded-[10px]"
                  animate={{
                    backgroundColor: semTok.pillBg,
                    boxShadow:       semTok.pillShadow,
                    borderColor:     semTok.pillBorder,
                  }}
                  style={{ border: '1px solid' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  initial={false}
                />
              )}
              <span className="relative z-10 block leading-none">
                {semTok.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
