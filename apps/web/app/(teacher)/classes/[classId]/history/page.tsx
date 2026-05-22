'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, History, Loader2 } from 'lucide-react';
import { useClass } from '@/hooks/use-classes';
import { useClassSessions } from '@/hooks/use-class-sessions';
import { SessionRow } from '@/components/history/SessionRow';
import { BackButton } from '@/components/ui/back-button';
import type { SessionHistoryRow } from '@fitgrade/types';

// ─── Animation variants (matches classes/[classId]/page.tsx canon) ─────────────

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 22, rotateX: 7 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 26 },
  },
};

const ROW_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const ROW_ITEM = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

// ─── Date grouping ─────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return 'היום';
  if (sameDay(date, yesterday)) return 'אתמול';
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupSessions(rows: SessionHistoryRow[]): [string, SessionHistoryRow[]][] {
  const map = new Map<string, SessionHistoryRow[]>();
  for (const row of rows) {
    const label = getDateLabel(row.conductedAt);
    const existing = map.get(label) ?? [];
    existing.push(row);
    map.set(label, existing);
  }
  return Array.from(map.entries());
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EmptyState(): React.JSX.Element {
  return (
    <motion.div
      variants={ITEM}
      className="flex flex-col items-center justify-center py-24 text-center text-slate-400"
    >
      <History className="mb-4 h-12 w-12 opacity-30" aria-hidden="true" />
      <p className="text-lg font-medium text-slate-500">אין היסטוריית מבחנים בכיתה זו</p>
      <p className="mt-1 text-sm">לאחר ביצוע מבחן הראשון, הוא יופיע כאן</p>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage(): React.JSX.Element {
  const { classId } = useParams<{ classId: string }>();
  const { data: cls } = useClass(classId);
  const { data: sessionPage, isLoading, error } = useClassSessions(classId);

  const groups = sessionPage !== undefined ? groupSessions(sessionPage.rows) : [];
  const isEmpty = !isLoading && error === undefined && groups.length === 0;

  return (
    <div className="min-h-screen px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <BackButton />

      <motion.div
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl"
        style={{ perspective: 800 }}
      >
        {/* Page header */}
        <motion.div variants={ITEM} className="mb-8">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Link
              href={`/classes/${classId}`}
              className="transition-colors hover:text-violet-600"
            >
              {cls?.name ?? '...'}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-700">היסטוריה</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <History className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">היסטוריית מבחנים</h1>
              {sessionPage !== undefined && (
                <p className="text-sm text-slate-500">{sessionPage.total} מבחנים סה״כ</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" aria-label="טוען היסטוריה..." />
          </div>
        )}

        {/* Error */}
        {error !== undefined && !isLoading && (
          <motion.div
            variants={ITEM}
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <p className="font-medium text-red-700">שגיאה בטעינת ההיסטוריה</p>
            <p className="mt-1 text-sm text-red-500">
              {error instanceof Error ? error.message : 'שגיאה לא ידועה — נסה לרענן את הדף'}
            </p>
          </motion.div>
        )}

        {/* Empty state */}
        {isEmpty && <EmptyState />}

        {/* Session groups */}
        {groups.length > 0 && (
          <motion.div variants={ROW_STAGGER} className="space-y-6">
            <AnimatePresence mode="popLayout">
              {groups.map(([dateLabel, sessions]) => (
                <motion.div key={dateLabel} variants={ITEM} layout>
                  {/* Date group label */}
                  <div className="mb-2 flex items-center gap-2 ps-1">
                    <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="text-sm font-semibold text-slate-600">{dateLabel}</span>
                  </div>

                  {/* Glass card */}
                  <div
                    className="overflow-hidden rounded-3xl"
                    style={{
                      background: 'rgba(255,255,255,0.78)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255,255,255,0.70)',
                      boxShadow:
                        '0 2px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
                    }}
                  >
                    <motion.div
                      variants={ROW_STAGGER}
                      className="divide-y divide-slate-100/80"
                    >
                      {sessions.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          classId={classId}
                          variants={ROW_ITEM}
                        />
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
