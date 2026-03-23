'use client';

import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface CopilotTriggerButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Global floating action button — hidden when the panel is open so it never
 * overlaps the panel's input area. AnimatePresence handles the pop-in/out.
 */
export function CopilotTriggerButton({
  isOpen,
  onToggle,
}: CopilotTriggerButtonProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.button
          type="button"
          onClick={onToggle}
          aria-label="פתח עוזר AI"
          aria-expanded={false}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.08 }}
          className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            boxShadow: '0 4px 24px rgba(124,58,237,0.55), 0 0 0 1px rgba(139,92,246,0.3)',
          }}
        >
          <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />

          {/* Pulse ring */}
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-violet-400"
            animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            aria-hidden="true"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
