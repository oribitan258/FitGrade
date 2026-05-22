'use client';

import { useRef, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { cn, formatRawValue } from '@/lib/utils';

function parseTimeInput(raw: string): number | null {
  const m = /^(\d+):(\d{1,2})$/.exec(raw.trim());
  if (m !== null) {
    const secs = parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
    return parseInt(m[2]!, 10) < 60 ? secs : null;
  }
  const n = parseFloat(raw.trim());
  return isNaN(n) ? null : n;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface RawValueCellProps {
  resultId: string;
  rawValue: number;
  inputType: string;
  unit: string | null;
  onSave: (resultId: string, newValue: number) => Promise<void>;
}

export function RawValueCell({
  resultId,
  rawValue,
  inputType,
  unit,
  onSave,
}: RawValueCellProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // PASS_FAIL: display-only, no editing
  if (inputType === 'PASS_FAIL') {
    return (
      <span className="text-sm font-medium text-slate-600">
        {rawValue >= 1 ? 'עבר' : 'נכשל'}
      </span>
    );
  }

  const displayValue = formatRawValue(rawValue, inputType);

  function startEditing(): void {
    if (status === 'saving') return;
    setInputValue(formatRawValue(rawValue, inputType) ?? String(rawValue));
    setStatus('idle');
    setErrorMsg(null);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitEdit(): Promise<void> {
    const trimmed = inputValue.trim();
    if (trimmed === '' || trimmed === (formatRawValue(rawValue, inputType) ?? String(rawValue))) {
      setIsEditing(false);
      return;
    }

    const parsed =
      inputType === 'TIME' ? parseTimeInput(trimmed) : parseFloat(trimmed);

    if (parsed === null || isNaN(parsed as number) || (parsed as number) < 0) {
      setErrorMsg(inputType === 'TIME' ? 'פורמט: דקות:שניות (למשל 7:25)' : 'ערך לא תקין');
      return;
    }

    setIsEditing(false);
    setStatus('saving');
    setErrorMsg(null);

    try {
      await onSave(resultId, parsed as number);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'שגיאה בשמירה');
      setTimeout(() => { setStatus('idle'); setErrorMsg(null); }, 4000);
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode={inputType === 'TIME' ? 'text' : 'decimal'}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setErrorMsg(null); }}
          onBlur={() => { void commitEdit(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void commitEdit(); }
            if (e.key === 'Escape') setIsEditing(false);
          }}
          dir="ltr"
          aria-label="ערך גולמי לעריכה"
          className="w-20 rounded-md border border-indigo-300 bg-white px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {errorMsg !== null && (
          <p className="text-[10px] text-red-600">{errorMsg}</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={status === 'saving'}
      title={errorMsg ?? undefined}
      aria-label={`ערך: ${displayValue ?? '—'}. לחץ לעריכה`}
      className={cn(
        'group flex min-w-[4.5rem] items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors',
        status === 'idle' && 'border border-dashed border-slate-200 bg-slate-50/60 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50',
        status === 'saving' && 'cursor-wait text-slate-400',
        status === 'saved' && 'bg-emerald-50 text-emerald-700',
        status === 'error' && 'bg-red-50 text-red-600',
      )}
    >
      {status === 'saving' && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {status === 'saved' && (
        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
      )}
      <span className="font-mono tabular-nums">
        {displayValue ?? '—'}
        {unit !== null && status !== 'saved' && (
          <span className="ms-1 text-xs text-slate-400">{unit}</span>
        )}
      </span>
      {status === 'idle' && (
        <Pencil
          className="h-3 w-3 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
