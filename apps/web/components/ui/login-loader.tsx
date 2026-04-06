'use client';

/**
 * LoginLoader — 3-dot bouncing animation for authentication loading states.
 * Purple variant for teacher login; green variant for student login.
 * Based on anurag-mishra22/loader-one from 21st.dev, adapted with glass colors.
 */

import { motion } from 'framer-motion';

interface LoginLoaderProps {
  /** 'purple' for teacher (indigo/violet), 'green' for student (emerald/teal) */
  variant: 'purple' | 'green';
  label?: string;
}

const VARIANTS = {
  purple: {
    dots:  ['#818cf8', '#6366f1', '#a78bfa'],
    glow:  ['rgba(129,140,248,0.7)', 'rgba(99,102,241,0.7)', 'rgba(167,139,250,0.7)'],
    label: 'rgba(165,180,252,0.80)',
  },
  green: {
    dots:  ['#34d399', '#10b981', '#2dd4bf'],
    glow:  ['rgba(52,211,153,0.7)',  'rgba(16,185,129,0.7)',  'rgba(45,212,191,0.7)'],
    label: 'rgba(110,231,183,0.80)',
  },
} as const;

export function LoginLoader({ variant, label }: LoginLoaderProps): React.JSX.Element {
  const { dots, glow, label: labelColor } = VARIANTS[variant];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5">
        {([0, 1, 2] as const).map((i) => (
          <motion.div
            key={i}
            className="h-3 w-3 rounded-full"
            style={{
              background: dots[i],
              boxShadow: `0 0 10px ${glow[i]}, 0 0 20px ${glow[i]}`,
            }}
            animate={{
              y:       [0, -12, 0],
              opacity: [0.55, 1, 0.55],
              scale:   [1, 1.3, 1],
            }}
            transition={{
              duration: 1,
              repeat:   Infinity,
              delay:    i * 0.2,
              ease:     'easeInOut',
            }}
          />
        ))}
      </div>

      {label !== undefined && label !== '' && (
        <p className="text-sm font-medium" style={{ color: labelColor }}>
          {label}
        </p>
      )}
    </div>
  );
}
