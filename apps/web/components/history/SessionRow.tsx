'use client';

import Link from 'next/link';
import { type Variants, motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ClipboardList, Clock, Timer } from 'lucide-react';
import type { SessionHistoryRow, Semester } from '@fitgrade/types';

const SEMESTER_LABEL: Record<Semester, string> = {
  A: "מחצית א'",
  B: "מחצית ב'",
};

interface SessionRowProps {
  session: SessionHistoryRow;
  classId: string;
  variants?: Variants;
}

export function SessionRow({ session, classId, variants }: SessionRowProps): React.JSX.Element {
  const time = new Date(session.conductedAt).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div variants={variants} layout>
      <Link
        href={`/classes/${classId}/history/${session.id}`}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-indigo-50/60 active:bg-indigo-50/80"
      >
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {session.isStopwatch ? (
            <Timer className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{session.testNameHe}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span>{SEMESTER_LABEL[session.semester as Semester]}</span>
            <span aria-hidden="true">·</span>
            <span>{session.resultCount} תוצאות</span>
            {session.completedAt !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  הושלם
                </span>
              </>
            )}
          </div>
        </div>

        {/* Time + chevron */}
        <div className="flex shrink-0 items-center gap-1 text-slate-400">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs tabular-nums">{time}</span>
          <ChevronLeft className="ms-1 h-4 w-4 text-slate-300" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  );
}
