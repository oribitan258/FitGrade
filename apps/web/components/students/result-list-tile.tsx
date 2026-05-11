'use client';

import { getHebrewGradeLabel } from '@fitgrade/types';
import type { ReportTestResult } from '@fitgrade/types';
import { cn, formatRawValue } from '@/lib/utils';

function gradeStyle(score: number, passingGrade: number): {
  bg: string; text: string; border: string; dot: string;
} {
  if (score >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (score >= 75) return { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    };
  if (score >= 60) return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   };
  if (score >= passingGrade) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
  return                           { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface ResultListTileProps {
  result: ReportTestResult;
  passingGrade?: number;
}

export function ResultListTile({ result, passingGrade = 55 }: ResultListTileProps): React.JSX.Element {
  const gs = gradeStyle(result.grade, passingGrade);
  const raw = result.rawValue !== null ? (formatRawValue(result.rawValue, result.inputType) ?? null) : null;

  return (
    <div className="mb-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-slate-800">
            {result.nameHe}
            {result.unit && (
              <span className="ms-1.5 text-xs font-normal text-slate-400">({result.unit})</span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{formatDate(result.conductedAt)}</p>
          {raw !== null && (
            <p className="mt-1 font-mono tabular-nums text-sm text-slate-700">{raw}</p>
          )}
          {result.classAvg > 0 && (
            <p className="mt-1 text-xs text-slate-400">ממוצע כיתה: {result.classAvg}</p>
          )}
        </div>
        <span className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold',
          gs.bg, gs.text, gs.border,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', gs.dot)} />
          {getHebrewGradeLabel(result.grade)}
        </span>
      </div>
    </div>
  );
}
