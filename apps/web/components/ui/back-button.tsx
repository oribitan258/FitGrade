'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * Universal floating back button — fixed at the physical-left / logical-end
 * corner (insetInlineEnd: 16px) so it never collides with the RTL hamburger
 * menu which lives at the physical-right / logical-start corner.
 *
 * RTL: ArrowRight (→) points toward the physical right, which is the
 * "back" direction in Hebrew navigation (previous screen = to the right).
 */
export function BackButton(): React.JSX.Element {
  const router = useRouter();
  return (
    <motion.button
      type="button"
      onClick={() => router.back()}
      aria-label="חזור לעמוד הקודם"
      initial={{ opacity: 0, scale: 0.80 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35, delay: 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      whileTap={{ scale: 0.93 }}
      className="fixed z-50 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/60 pe-3.5 ps-2.5 py-2.5 text-slate-700 shadow-[0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors hover:text-violet-600 print:hidden"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        insetInlineEnd: '16px',
      } as React.CSSProperties}
    >
      <ArrowRight className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="hidden text-sm font-semibold md:inline">חזור</span>
    </motion.button>
  );
}
