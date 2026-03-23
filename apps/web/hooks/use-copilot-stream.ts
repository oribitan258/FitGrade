'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getCopilotStreamUrl, initCopilotChat } from '@/lib/copilot-api';
import type { CopilotPageContext, CopilotSSEEvent } from '@fitgrade/types';

export interface UseCopilotStreamReturn {
  /**
   * Initiates a POST /copilot/chat call, obtains a stream token, then opens
   * an EventSource and dispatches each CopilotSSEEvent to `onEvent`.
   */
  sendMessage: (message: string, context: CopilotPageContext) => void;
  /** Closes the active EventSource connection (no-op if none is open). */
  cancel: () => void;
}

/**
 * Manages the two-step SSE lifecycle:
 *  1. POST /copilot/chat  → { streamToken }
 *  2. GET  /copilot/stream/:streamToken  (EventSource)
 *
 * `onEvent` is called for every CopilotSSEEvent received. The EventSource is
 * closed automatically on 'done' / 'error' events or when `cancel()` is called.
 */
export function useCopilotStream(options: {
  conversationId: string;
  onEvent: (event: CopilotSSEEvent) => void;
}): UseCopilotStreamReturn {
  const { conversationId } = options;

  const eventSourceRef = useRef<EventSource | null>(null);

  // Use a ref for the callback so the EventSource handler never captures a stale closure
  const onEventRef = useRef(options.onEvent);
  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (message: string, context: CopilotPageContext): void => {
      cancel(); // Close any existing connection before starting a new one

      void (async () => {
        try {
          const { streamToken } = await initCopilotChat({
            message,
            conversationId,
            context,
          });

          const url = getCopilotStreamUrl(streamToken);
          const es  = new EventSource(url);
          eventSourceRef.current = es;

          es.onmessage = (msgEvent: MessageEvent<string>) => {
            try {
              const data = JSON.parse(msgEvent.data) as CopilotSSEEvent;
              onEventRef.current(data);

              if (data.type === 'done' || data.type === 'error') {
                es.close();
                eventSourceRef.current = null;
              }
            } catch {
              // Ignore malformed SSE frames — backend guarantees valid JSON
            }
          };

          es.onerror = () => {
            onEventRef.current({ type: 'error', message: 'שגיאה בחיבור לשרת' });
            es.close();
            eventSourceRef.current = null;
          };
        } catch {
          onEventRef.current({ type: 'error', message: 'שגיאה בשליחת הודעה' });
        }
      })();
    },
    [cancel, conversationId],
  );

  // Close the connection when the hook is unmounted (e.g. panel closes)
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { sendMessage, cancel };
}
