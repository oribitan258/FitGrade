'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type {
  AttendancePendingPreview,
  ExercisePlanPendingPreview,
  PendingActionPreview,
  TestResultPendingPreview,
} from '@fitgrade/types';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Action TTL in seconds — must match the backend PendingActionStore TTL */
const TTL_SECONDS = 60;

const RADIUS      = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Preview renderers ─────────────────────────────────────────────────────

function AttendancePreview({ preview }: { preview: AttendancePendingPreview }): React.JSX.Element {
  const warningThreshold = 5;
  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <p className="text-xs font-semibold text-gray-500">
        {preview.className} · {preview.date}
      </p>
      {preview.rows.length > warningThreshold && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>פעולה זו משפיעה על {preview.rows.length} תלמידים</span>
        </div>
      )}
      <div className="max-h-36 overflow-y-auto rounded-lg border border-violet-100 bg-white/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-violet-100 bg-violet-50/60">
              <th className="px-3 py-1.5 text-start font-semibold text-gray-600">תלמיד</th>
              <th className="px-3 py-1.5 text-start font-semibold text-gray-600">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.studentName} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-1.5 text-gray-700">{row.studentName}</td>
                <td className="px-3 py-1.5 text-gray-600">{row.statusHe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExercisePlanPreview({ preview }: { preview: ExercisePlanPendingPreview }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white/60 p-3 text-sm" dir="rtl">
      <p className="font-semibold text-gray-800">{preview.studentName}</p>
      <p className="text-gray-600">מסלול: {preview.trackName}</p>
      <p className="text-gray-600">פוקוס שבוע 1: {preview.week1Focus}</p>
    </div>
  );
}

function TestResultPreview({ preview }: { preview: TestResultPendingPreview }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white/60 p-3 text-sm" dir="rtl">
      <p className="font-semibold text-gray-800">{preview.studentName}</p>
      <p className="text-gray-600">{preview.testTypeNameHe}</p>
      <p className="text-lg font-bold text-violet-700">{preview.rawValue}</p>
    </div>
  );
}

// ─── Tool display names ─────────────────────────────────────────────────────

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  save_attendance:      'שמירת נוכחות',
  generate_exercise_plan: 'יצירת תוכנית אימון',
  submit_test_result:   'הוספת תוצאת מבחן',
};

// ─── Component ─────────────────────────────────────────────────────────────

interface PendingActionCardProps {
  preview: PendingActionPreview;
  onApprove: () => void;
  onCancel: () => void;
  /** Called when the 60-second countdown elapses before the teacher acts */
  onExpire: () => void;
  /** True while the approval API call is in flight */
  isExecuting: boolean;
}

/**
 * Human-in-the-Loop confirmation card shown when Claude proposes a WRITE action.
 *
 * Shows a countdown ring (60 s), a structured preview of what will change, and
 * Approve / Cancel buttons. Calls `onExpire` when the countdown reaches zero.
 */
export function PendingActionCard({
  preview,
  onApprove,
  onCancel,
  onExpire,
  isExecuting,
}: PendingActionCardProps): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState(TTL_SECONDS);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    setTimeLeft(TTL_SECONDS);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { clearInterval(interval); };
  }, [preview]);

  const progress         = timeLeft / TTL_SECONDS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isUrgent         = timeLeft <= 10;
  const displayName      = TOOL_DISPLAY_NAMES[preview.toolName] ?? preview.toolName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="prismatic-glass mx-3 mb-3 flex flex-col gap-3 rounded-2xl p-4"
      dir="rtl"
      role="alertdialog"
      aria-label={`פעולה ממתינה: ${displayName}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">
            ממתין לאישור
          </p>
          <p className="text-sm font-bold text-gray-800">{displayName}</p>
        </div>

        {/* Countdown ring */}
        <div className="relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center">
          <svg
            width="72"
            height="72"
            className="-rotate-90"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="36" cy="36" r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="4"
            />
            {/* Progress */}
            <circle
              cx="36" cy="36" r={RADIUS}
              fill="none"
              stroke={isUrgent ? '#ef4444' : '#7c3aed'}
              strokeWidth="4"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <span
            className={cn(
              'absolute text-sm font-bold',
              isUrgent ? 'text-red-500' : 'text-gray-700',
            )}
          >
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Structured preview */}
      {preview.toolName === 'save_attendance' && (
        <AttendancePreview preview={preview as AttendancePendingPreview} />
      )}
      {preview.toolName === 'generate_exercise_plan' && (
        <ExercisePlanPreview preview={preview as ExercisePlanPendingPreview} />
      )}
      {preview.toolName === 'submit_test_result' && (
        <TestResultPreview preview={preview as TestResultPendingPreview} />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isExecuting || timeLeft === 0}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors',
            isExecuting || timeLeft === 0
              ? 'cursor-not-allowed bg-gray-300'
              : 'bg-emerald-600 hover:bg-emerald-700',
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {isExecuting ? 'מבצע...' : 'אשר פעולה'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isExecuting}
          className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          ביטול
        </button>
      </div>
    </motion.div>
  );
}
