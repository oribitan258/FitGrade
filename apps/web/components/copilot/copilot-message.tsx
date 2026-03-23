'use client';

import { cn } from '@/lib/utils';
import type { CopilotMessage as CopilotMessageType } from '@fitgrade/types';

interface CopilotMessageProps {
  message: CopilotMessageType;
}

/**
 * Single chat bubble — dark panel theme.
 * User messages: start-aligned (right in RTL), violet bubble.
 * Assistant messages: end-aligned (left in RTL), dark glass bubble.
 */
export function CopilotMessage({ message }: CopilotMessageProps): React.JSX.Element {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-start' : 'justify-end',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-se-sm text-white'
            : 'rounded-ss-sm border border-white/10 text-violet-100',
        )}
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                boxShadow: '0 2px 12px rgba(109,40,217,0.35)',
              }
            : {
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(8px)',
              }
        }
        dir="rtl"
      >
        {message.content}
        {message.isStreaming && (
          <span
            className="ms-1 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-violet-400 opacity-80"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
