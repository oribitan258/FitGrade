'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCopilotHistory, revertCopilotAction } from '@/lib/copilot-api';
import { ApiError } from '@fitgrade/types';
import type { AiActionLogItem } from '@fitgrade/types';
import useSWR from 'swr';

// ─── SWR fetcher ───────────────────────────────────────────────────────────

async function historyFetcher(): Promise<AiActionLogItem[]> {
  return getCopilotHistory();
}

// ─── Relative time helper ──────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diffMs  = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `לפני ${diffHr} שעות`;
  const diffDay = Math.floor(diffHr / 24);
  return `לפני ${diffDay} ימים`;
}

// ─── Single history row ────────────────────────────────────────────────────

function HistoryRow({
  item,
  onReverted,
}: {
  item: AiActionLogItem;
  onReverted: (id: string) => void;
}): React.JSX.Element {
  const [expanded,  setExpanded]  = useState(false);
  const [reverting, setReverting] = useState(false);
  const [localItem, setLocalItem] = useState(item);

  const isReverted = localItem.revertedAt !== null;

  async function handleRevert(): Promise<void> {
    setReverting(true);
    try {
      await revertCopilotAction(localItem.id);
      setLocalItem((prev) => ({ ...prev, revertedAt: new Date().toISOString() }));
      onReverted(localItem.id);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.statusCode === 410
          ? 'הפעולה כבר שוחזרה'
          : 'שגיאה בשחזור הפעולה';
      alert(msg); // Fallback — parent should show a toast in Phase 4 wiring
    } finally {
      setReverting(false);
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-white/10 transition-opacity',
        isReverted && 'opacity-50',
      )}
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      {/* Row header */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); }}
        className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-white/5"
        aria-expanded={expanded}
      >
        <div className="flex flex-1 flex-col gap-1" dir="rtl">
          <p
            className={cn(
              'text-sm font-semibold text-violet-100',
              isReverted && 'line-through text-violet-300/60',
            )}
          >
            {localItem.summary}
          </p>
          <div className="flex items-center gap-2 text-xs text-violet-400/70">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>{relativeTime(localItem.createdAt)}</span>
            {isReverted && (
              <span className="rounded-full border border-amber-500/30 bg-amber-900/30 px-2 py-0.5 text-amber-300/80">
                בוצע שחזור
              </span>
            )}
          </div>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-violet-400/60"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </motion.span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 px-4 pb-4 pt-3" dir="rtl">
              {/* Params summary */}
              <pre
                className="max-h-32 overflow-auto rounded-lg border border-white/8 p-3 text-xs text-violet-300/80 leading-relaxed whitespace-pre-wrap"
                style={{ background: 'rgba(0,0,0,0.25)' }}
              >
                {JSON.stringify(localItem.params, null, 2)}
              </pre>

              {/* Revert button */}
              {!isReverted && (
                <button
                  type="button"
                  onClick={() => { void handleRevert(); }}
                  disabled={reverting}
                  className={cn(
                    'mt-3 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    reverting
                      ? 'cursor-not-allowed border-white/10 text-violet-400/40'
                      : 'border-red-400/30 text-red-400 hover:border-red-400/60 hover:bg-red-900/20',
                  )}
                >
                  <RotateCcw
                    className={cn('h-3 w-3', reverting && 'animate-spin')}
                    aria-hidden="true"
                  />
                  {reverting ? 'משחזר...' : 'שחזר פעולה'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── History tab root ───────────────────────────────────────────────────────

/**
 * History tab: fetches the last 50 AI WRITE actions for the authenticated teacher,
 * renders them as expandable glass cards, and allows rolling back each action.
 */
export function CopilotHistory(): React.JSX.Element {
  const { data, isLoading, error, mutate } = useSWR<AiActionLogItem[]>(
    '/copilot/history',
    historyFetcher,
    { revalidateOnFocus: false },
  );

  function handleReverted(id: string): void {
    void mutate(
      (prev) =>
        prev?.map((item) =>
          item.id === id ? { ...item, revertedAt: new Date().toISOString() } : item,
        ),
      { revalidate: false },
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center" dir="rtl">
        <p className="text-sm text-violet-400/70">טוען היסטוריה...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center" dir="rtl">
        <p className="text-sm text-red-400">שגיאה בטעינת ההיסטוריה</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" dir="rtl">
        <Clock className="h-10 w-10 text-violet-500/40" aria-hidden="true" />
        <p className="text-sm text-violet-200/70">אין פעולות AI עדיין</p>
        <p className="text-xs text-violet-400/50">פעולות שמבוצעות על ידי העוזר יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3" dir="rtl">
      {data.map((item) => (
        <HistoryRow key={item.id} item={item} onReverted={handleReverted} />
      ))}
    </div>
  );
}
