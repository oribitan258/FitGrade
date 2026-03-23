'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/use-voice-input';

interface CopilotInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
}

/**
 * Chat input row: RTL textarea + optional mic button + send button.
 * Styled for the dark violet panel theme.
 *
 * - Enter (without Shift) submits.
 * - Mic button pulses red while recording; hidden on unsupported browsers.
 * - Send button glows violet when there is text to send.
 */
export function CopilotInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'שאל שאלה או בקש פעולה...',
}: CopilotInputProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFinalTranscript = (text: string) => {
    onChange(value ? `${value} ${text}` : text);
    textareaRef.current?.focus();
  };

  const { isListening, interimTranscript, isSupported, startListening, stopListening } =
    useVoiceInput(handleFinalTranscript);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) onSend();
    }
  };

  const displayValue       = isListening && interimTranscript ? interimTranscript : value;
  const isPlaceholderInterim = isListening && interimTranscript && !value;
  const canSend              = !disabled && (value.trim().length > 0 || !!interimTranscript);

  return (
    <div
      className="border-t border-white/10 px-3 py-3"
      style={{ background: 'rgba(0,0,0,0.25)' }}
      dir="rtl"
    >
      <div
        className="flex items-end gap-2 rounded-2xl border border-white/10 p-2 transition-colors focus-within:border-violet-500/50"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => { onChange(e.target.value); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          dir="rtl"
          aria-label="הקלד הודעה לעוזר AI"
          className={cn(
            'flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white placeholder:text-violet-400/45',
            'outline-none scrollbar-none max-h-28',
            isPlaceholderInterim && 'text-violet-400/70',
          )}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />

        {/* Mic button — hidden if unsupported */}
        {isSupported && (
          <motion.button
            type="button"
            onClick={() => { isListening ? stopListening() : startListening(); }}
            whileTap={{ scale: 0.85 }}
            aria-label={isListening ? 'הפסק הקלטה' : 'הפעל הקלטת קול'}
            aria-pressed={isListening}
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors',
              isListening
                ? 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.5)]'
                : 'text-violet-400 hover:bg-white/10 hover:text-violet-200',
            )}
          >
            {isListening ? (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="flex items-center justify-center"
              >
                <MicOff className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )}
          </motion.button>
        )}

        {/* Send button */}
        <motion.button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          whileTap={{ scale: 0.85 }}
          aria-label="שלח הודעה"
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all',
            canSend
              ? 'bg-violet-500 text-white hover:bg-violet-400'
              : 'bg-white/10 text-white/25 cursor-not-allowed',
          )}
          style={canSend ? { boxShadow: '0 0 14px rgba(139,92,246,0.45)' } : undefined}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  );
}
