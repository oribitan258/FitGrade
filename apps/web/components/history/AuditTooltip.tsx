'use client';

import { History } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatRawValue } from '@/lib/utils';
import type { AuditTrailEntry } from '@fitgrade/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface EntryLineProps {
  entry: AuditTrailEntry;
  inputType: string;
}

export function EntryLine({ entry, inputType }: EntryLineProps): React.JSX.Element {
  if (entry.action === 'GRADE_OVERRIDE') {
    const grade = entry.newValue?.['gradeOverride'] as number | undefined;
    const reason = entry.newValue?.['overrideReason'] as string | undefined;
    return (
      <span>
        עקיפת ציון:{' '}
        <span dir="ltr" className="font-mono">
          {grade ?? '?'}
        </span>
        {reason ? ` · סיבה: ${reason}` : null}
      </span>
    );
  }

  // RESULT_EDIT — wrap old→new in dir="ltr" so the arrow always points rightward
  const oldRaw = entry.oldValue?.['rawValue'] as number | undefined;
  const newRaw = entry.newValue?.['rawValue'] as number | undefined;
  const oldFmt = oldRaw !== undefined ? (formatRawValue(oldRaw, inputType) ?? String(oldRaw)) : '?';
  const newFmt = newRaw !== undefined ? (formatRawValue(newRaw, inputType) ?? String(newRaw)) : '?';

  return (
    <span>
      ערך שונה:{' '}
      <span dir="ltr" className="font-mono">
        {oldFmt} → {newFmt}
      </span>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AuditTooltipProps {
  auditTrail: AuditTrailEntry[];
  inputType: string;
}

export function AuditTooltip({ auditTrail, inputType }: AuditTooltipProps): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-default items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 transition-colors hover:bg-orange-100"
            aria-label={`נערך ${auditTrail.length} פעמים — לחץ להצגת היסטוריה`}
          >
            <History className="h-3 w-3" aria-hidden="true" />
            עודכן
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="end"
          className="max-w-xs border-white/70 bg-white/90 p-0 shadow-xl backdrop-blur-xl"
          style={{ borderRadius: '0.75rem' }}
        >
          <div className="px-3 py-2">
            <p className="mb-2 text-[11px] font-semibold text-slate-500">היסטוריית עריכות</p>
            <ul className="space-y-2">
              {auditTrail.map((entry, i) => (
                <li key={i} className="text-start">
                  <p className="text-xs font-medium text-slate-800">
                    <EntryLine entry={entry} inputType={inputType} />
                  </p>
                  <p className="text-[10px] text-slate-400">{formatDate(entry.changedAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
