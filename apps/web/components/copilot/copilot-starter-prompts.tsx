'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getStarterPrompts } from '@/lib/copilot-api';

interface CopilotStarterPromptsProps {
  pathname: string;
  classId: string | null;
  studentId: string | null;
  /** Called with the prompt text when a pill is clicked (populates input, does NOT auto-send) */
  onSelect: (prompt: string) => void;
}

/**
 * Glowing contextual prompt pills shown in the empty-state of the chat tab.
 * Derived client-side from the current route — no API call needed.
 */
export function CopilotStarterPrompts({
  pathname,
  classId,
  studentId,
  onSelect,
}: CopilotStarterPromptsProps): React.JSX.Element {
  const prompts = getStarterPrompts(pathname, classId, studentId);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6" dir="rtl">
      {/* Icon + heading */}
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-500/30"
          style={{
            background: 'rgba(109,40,217,0.20)',
            boxShadow: '0 0 20px rgba(139,92,246,0.25)',
          }}
        >
          <Sparkles className="h-5 w-5 text-violet-300" aria-hidden="true" />
        </div>
        <p className="text-center text-sm font-semibold text-violet-100">במה אוכל לעזור?</p>
        <p className="text-center text-xs text-violet-400/60">בחר הצעה או כתוב שאלה חופשית</p>
      </div>

      {/* Prompt pills */}
      <div className="flex flex-col gap-2.5 w-full">
        {prompts.map((prompt, i) => (
          <motion.button
            key={prompt}
            type="button"
            onClick={() => { onSelect(prompt); }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.28 }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl border border-violet-500/25 px-4 py-3 text-start text-sm font-medium text-violet-200 transition-all duration-200 hover:border-violet-400/55 hover:text-white"
            style={{
              background: 'rgba(109,40,217,0.12)',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(109,40,217,0.28)';
              e.currentTarget.style.boxShadow  = '0 0 18px rgba(139,92,246,0.22), inset 0 0 12px rgba(139,92,246,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(109,40,217,0.12)';
              e.currentTarget.style.boxShadow  = 'none';
            }}
          >
            {prompt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
