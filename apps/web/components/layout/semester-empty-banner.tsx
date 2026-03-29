'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface SemesterEmptyBannerProps {
  visible: boolean;
}

export function SemesterEmptyBanner({ visible }: SemesterEmptyBannerProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          dir="rtl"
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-800"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            טרם הוזנו נתונים למחצית ב׳ — ניתן להתחיל להוסיף מבחנים ונוכחות כעת
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
