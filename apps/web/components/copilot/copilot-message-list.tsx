'use client';

import { useEffect, useRef } from 'react';
import type { CopilotMessage, CopilotPanelState } from '@fitgrade/types';
import { CopilotMessage as CopilotMessageBubble } from './copilot-message';
import { Loader2 } from 'lucide-react';

interface CopilotMessageListProps {
  messages: CopilotMessage[];
  panelState: CopilotPanelState;
  /** Hebrew name of the READ tool currently loading, or null */
  activeToolName: string | null;
}

/**
 * Scrollable list of chat messages.
 * Auto-scrolls to the bottom whenever a new message or token arrives.
 */
export function CopilotMessageList({
  messages,
  panelState,
  activeToolName,
}: CopilotMessageListProps): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, panelState]);

  const isThinking = panelState === 'thinking';

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" dir="rtl">
      {messages.map((msg) => (
        <CopilotMessageBubble key={msg.id} message={msg} />
      ))}

      {/* Thinking indicator */}
      {isThinking && (
        <div className="flex justify-end">
          <div
            className="flex items-center gap-2 rounded-2xl rounded-ss-sm border border-white/10 px-4 py-2.5 text-sm text-violet-300"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden="true" />
            <span>חושב...</span>
          </div>
        </div>
      )}

      {/* Tool loading badge */}
      {activeToolName && (
        <div className="flex justify-end">
          <div
            className="flex items-center gap-2 rounded-full border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-300"
            style={{ background: 'rgba(109,40,217,0.25)' }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" aria-hidden="true" />
            נטען מידע — {activeToolName}
          </div>
        </div>
      )}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
