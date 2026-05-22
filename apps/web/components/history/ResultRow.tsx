'use client';

import { motion, type Variants } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { getHebrewGradeLabel } from '@fitgrade/types';
import type { LiveStudentResult, SessionStudent } from '@fitgrade/types';
import { RawValueCell } from './RawValueCell';
import { AuditTooltip } from './AuditTooltip';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-slate-200 text-slate-700',
  'bg-cyan-100 text-cyan-700',
] as const;

function avatarTint(name: string): string {
  let code = 0;
  for (let i = 0; i < name.length; i++) code += name.charCodeAt(i);
  return AVATAR_TINTS[code % AVATAR_TINTS.length]!;
}

function gradeBadgeCn(grade: number): string {
  if (grade >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (grade >= 75) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (grade >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: LiveStudentResult;
  student: SessionStudent | undefined;
  inputType: string;
  unit: string | null;
  onEditRawValue: (resultId: string, newValue: number) => Promise<void>;
  onOverride: (resultId: string) => void;
  onDelete: (resultId: string) => void;
  variants?: Variants;
}


export function ResultRow({
  result,
  student,
  inputType,
  unit,
  onEditRawValue,
  onOverride,
  onDelete,
  variants,
}: ResultRowProps): React.JSX.Element {
  const firstName = student?.firstName ?? '?';
  const lastName = student?.lastName ?? '';
  const fullName = student !== undefined ? `${firstName} ${lastName}` : 'תלמיד לא ידוע';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const tint = avatarTint(fullName);

  const effectiveGrade = result.gradeOverride ?? result.calculatedGrade;

  return (
    <motion.div
      variants={variants}
      layout
      className="flex items-center gap-3 px-4 py-3"
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          tint,
        )}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Student name */}
      <p className="w-28 shrink-0 truncate text-sm font-medium text-slate-800 sm:w-36">
        {fullName}
      </p>

      {/* Raw value (editable) */}
      <div className="flex-1">
        <RawValueCell
          resultId={result.resultId}
          rawValue={result.rawValue}
          inputType={inputType}
          unit={unit}
          onSave={onEditRawValue}
        />
      </div>

      {/* Effective grade badge */}
      <span
        className={cn(
          'hidden shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold sm:inline-flex',
          gradeBadgeCn(effectiveGrade),
        )}
      >
        {getHebrewGradeLabel(effectiveGrade)}
        {result.gradeOverride !== null && (
          <span className="ms-1 opacity-60" aria-label="ציון עקיפה">✱</span>
        )}
      </span>

      {/* Audit trail badge — visible when result was edited */}
      {result.auditTrail.length > 0 && (
        <div className="hidden shrink-0 sm:block">
          <AuditTooltip auditTrail={result.auditTrail} inputType={inputType} />
        </div>
      )}

      {/* Override grade button */}
      <button
        type="button"
        onClick={() => onOverride(result.resultId)}
        aria-label={`עקיפת ציון עבור ${fullName}`}
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Delete result button */}
      <button
        type="button"
        onClick={() => onDelete(result.resultId)}
        aria-label={`מחק תוצאה של ${fullName}`}
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
