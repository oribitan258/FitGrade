'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MessageSquare, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopilotContext } from '@/hooks/use-copilot-context';
import { useCopilotStream } from '@/hooks/use-copilot-stream';
import {
  cancelCopilotAction,
  confirmCopilotAction,
  deleteCopilotConversation,
} from '@/lib/copilot-api';
import { ApiError } from '@fitgrade/types';
import type {
  CopilotMessage,
  CopilotPanelState,
  CopilotPanelTab,
  CopilotSSEEvent,
  PendingActionPreview,
} from '@fitgrade/types';

import { CopilotMessageList }    from './copilot-message-list';
import { CopilotInput }          from './copilot-input';
import { CopilotStarterPrompts } from './copilot-starter-prompts';
import { PendingActionCard }     from './pending-action-card';
import { CopilotHistory }        from './copilot-history';

// ─── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Context indicator ─────────────────────────────────────────────────────

function ContextIndicator({
  classId,
  studentId,
}: {
  classId: string | null;
  studentId: string | null;
}): React.JSX.Element | null {
  if (!classId && !studentId) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-800/50 px-2.5 py-1 text-xs font-medium text-violet-200"
      dir="rtl"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" />
      {studentId ? `תלמיד: ${studentId.slice(0, 6)}…` : `כיתה: ${classId!.slice(0, 6)}…`}
    </div>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

interface CopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The main 420px Copilot slide-over panel — dark violet glassmorphism theme.
 *
 * State machine:
 *   idle → thinking → streaming_answer → idle          (READ path)
 *   idle → thinking → pending_action   → executing → idle (WRITE path)
 */
export function CopilotPanel({ isOpen, onClose }: CopilotPanelProps): React.JSX.Element {
  const { context, contextRef } = useCopilotContext();

  // ── Local state ──────────────────────────────────────────────────────────
  const [messages,        setMessages]        = useState<CopilotMessage[]>([]);
  const [panelState,      setPanelState]      = useState<CopilotPanelState>('idle');
  const [activeTab,       setActiveTab]       = useState<CopilotPanelTab>('chat');
  const [inputValue,      setInputValue]      = useState('');
  const [activeToolName,  setActiveToolName]  = useState<string | null>(null);
  const [pendingAction,   setPendingAction]   = useState<{
    actionId: string;
    preview: PendingActionPreview;
  } | null>(null);

  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());

  // ── SSE event handler ────────────────────────────────────────────────────

  const handleEvent = useCallback((event: CopilotSSEEvent) => {
    switch (event.type) {
      case 'thinking':
        break;

      case 'token':
        setPanelState('streaming_answer');
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + (event.delta ?? '') },
            ];
          }
          return [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: event.delta ?? '',
              createdAt: new Date().toISOString(),
              isStreaming: true,
            },
          ];
        });
        break;

      case 'tool_call':
        setActiveToolName(event.toolName ?? null);
        break;

      case 'tool_result':
        setActiveToolName(null);
        break;

      case 'pending_action':
        if (event.actionId && event.preview) {
          setPendingAction({ actionId: event.actionId, preview: event.preview });
          setPanelState('pending_action');
        }
        break;

      case 'error':
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: event.message ?? 'שגיאה בלתי צפויה',
            createdAt: new Date().toISOString(),
          },
        ]);
        setActiveToolName(null);
        setPanelState('idle');
        break;

      case 'done':
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.isStreaming) {
            return [...prev.slice(0, -1), { ...last, isStreaming: false }];
          }
          return prev;
        });
        setActiveToolName(null);
        setPanelState('idle');
        break;
    }
  }, []);

  const { sendMessage, cancel } = useCopilotStream({
    conversationId,
    onEvent: handleEvent,
  });

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || panelState !== 'idle') return;

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'user',
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
      setInputValue('');
      setPanelState('thinking');
      sendMessage(trimmed, contextRef.current);
    },
    [panelState, sendMessage, contextRef],
  );

  const handleApprove = useCallback(async () => {
    if (!pendingAction) return;
    setPanelState('executing');
    try {
      await confirmCopilotAction(pendingAction.actionId);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: 'הפעולה בוצעה בהצלחה ✓',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.statusCode === 410
          ? 'הפעולה פגה תוקף — נסה שנית'
          : 'שגיאה בביצוע הפעולה';
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: msg,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setPendingAction(null);
      setPanelState('idle');
    }
  }, [pendingAction]);

  const handleCancel = useCallback(async () => {
    if (!pendingAction) return;
    await cancelCopilotAction(pendingAction.actionId).catch(() => {});
    setPendingAction(null);
    setPanelState('idle');
  }, [pendingAction]);

  const handleExpire = useCallback(() => {
    setPendingAction(null);
    setPanelState('idle');
    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'assistant',
        content: 'הפעולה פגה תוקף (60 שניות)',
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const handleClose = useCallback(() => {
    cancel();
    void deleteCopilotConversation(conversationId).catch(() => {});
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setPanelState('idle');
    setPendingAction(null);
    setActiveToolName(null);
    setInputValue('');
    onClose();
  }, [cancel, conversationId, onClose]);

  const isBusy = panelState === 'pending_action' || panelState === 'executing';

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[3px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="panel"
            role="complementary"
            aria-label="עוזר AI"
            className="fixed inset-y-0 end-0 z-40 flex w-full flex-col md:w-[420px] border-s border-white/10"
            style={{
              background:
                'linear-gradient(160deg, rgba(14,5,38,0.97) 0%, rgba(36,10,80,0.98) 55%, rgba(20,7,52,0.97) 100%)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              boxShadow:
                '-8px 0 48px rgba(109,40,217,0.30), -1px 0 0 rgba(139,92,246,0.20)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between border-b border-white/10 px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              dir="rtl"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {/* Glowing dot */}
                  <span
                    className="h-2 w-2 rounded-full bg-violet-400"
                    style={{ boxShadow: '0 0 8px rgba(167,139,250,0.8)' }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-white">עוזר AI</span>
                  <ContextIndicator
                    classId={context.classId}
                    studentId={context.studentId}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="סגור עוזר AI"
                className="flex h-8 w-8 items-center justify-center rounded-full text-violet-400/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* ── Tab switcher ── */}
            <div
              className="flex border-b border-white/10 px-4 pt-2"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              role="tablist"
              aria-label="לשוניות הצ'אט"
              dir="rtl"
            >
              {(
                [
                  { id: 'chat',    label: "צ'אט",    Icon: MessageSquare },
                  { id: 'history', label: 'היסטוריה', Icon: History },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => { setActiveTab(id); }}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm font-medium transition-colors',
                    activeTab === id
                      ? 'border-violet-400 text-violet-300'
                      : 'border-transparent text-violet-500/50 hover:text-violet-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Content area ── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {activeTab === 'history' ? (
                <CopilotHistory />
              ) : (
                <>
                  {messages.length === 0 && panelState === 'idle' ? (
                    <CopilotStarterPrompts
                      pathname={context.currentRoute}
                      classId={context.classId}
                      studentId={context.studentId}
                      onSelect={(prompt) => { setInputValue(prompt); }}
                    />
                  ) : (
                    <CopilotMessageList
                      messages={messages}
                      panelState={panelState}
                      activeToolName={activeToolName}
                    />
                  )}

                  {pendingAction && (
                    <PendingActionCard
                      preview={pendingAction.preview}
                      onApprove={() => { void handleApprove(); }}
                      onCancel={() => { void handleCancel(); }}
                      onExpire={handleExpire}
                      isExecuting={panelState === 'executing'}
                    />
                  )}

                  <CopilotInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSend={() => { handleSend(inputValue); }}
                    disabled={isBusy || panelState === 'thinking' || panelState === 'streaming_answer'}
                  />
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
