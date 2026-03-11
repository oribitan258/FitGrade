'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  Printer,
  Save,
  ShieldAlert,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useClasses } from '@/hooks/use-classes';
import { useClassReport, useCommentsBank } from '@/hooks/use-reports';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ApiError } from '@fitgrade/types';
import type { ReportRow } from '@fitgrade/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const TAB_IDS = ['grades', 'attendance', 'exemptions', 'tests'] as const;
type TabId = (typeof TAB_IDS)[number];

type SortBy = 'alpha' | 'grade-high' | 'grade-low';

const SORT_LABELS: Record<SortBy, string> = {
  'alpha':      'שם (א-ב)',
  'grade-high': 'ציון (גבוה לנמוך)',
  'grade-low':  'ציון (נמוך לגבוה)',
};

const TAB_LABELS: Record<TabId, string> = {
  grades:     'ציונים סופיים',
  attendance: 'דוח נוכחות',
  exemptions: 'דוח פטורים',
  tests:      'תוצאות לפי מבחן',
};

const TAB_ICONS: Record<TabId, React.ElementType> = {
  grades:     FileText,
  attendance: Users,
  exemptions: ShieldAlert,
  tests:      TrendingUp,
};

/** Thresholds for grade colour coding */
function gradeColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Sorting helpers ───────────────────────────────────────────────────────────

/** Default sort: alphabetical by lastName then firstName using Hebrew locale */
function sortAlphabetically(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName, 'he');
    if (byLast !== 0) return byLast;
    return a.firstName.localeCompare(b.firstName, 'he');
  });
}

/** Apply a custom id-order on top of the row array */
function applySortOrder(rows: ReportRow[], order: string[]): ReportRow[] {
  const index = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => {
    const ai = index.get(a.studentId) ?? order.length;
    const bi = index.get(b.studentId) ?? order.length;
    return ai - bi;
  });
}

// ─── Local edit state per student ─────────────────────────────────────────────

interface LocalEdit {
  finalGrade: string; // string so we can handle empty input gracefully
  comment: string;
}

type EditMap = Map<string, LocalEdit>;

function buildInitialEdits(rows: ReportRow[]): EditMap {
  const map: EditMap = new Map();
  for (const row of rows) {
    map.set(row.studentId, {
      finalGrade: String(row.teacherFinalGrade ?? row.recommendedFinalGrade),
      comment: row.verbalComment ?? row.suggestedComment,
    });
  }
  return map;
}

// ─── Per-tab Mashov TSV generators ────────────────────────────────────────────

/** Strip extra whitespace and non-printable chars from a string for TSV export */
function sanitize(s: string): string {
  return s
    .replace(/[\t\r\n]/g, ' ')  // tabs/newlines → space (TSV safety)
    .replace(/  +/g, ' ')       // collapse multiple spaces
    .trim();
}

function buildGradesTSV(rows: ReportRow[], edits: EditMap): string {
  return rows
    .map((row) => {
      const edit = edits.get(row.studentId);
      const grade = parseInt(edit?.finalGrade ?? String(row.teacherFinalGrade ?? row.recommendedFinalGrade), 10);
      const comment = sanitize(edit?.comment ?? row.verbalComment ?? row.suggestedComment);
      const name = sanitize(`${row.firstName} ${row.lastName}`);
      return `${name}\t${isNaN(grade) ? '' : grade}\t${comment}`;
    })
    .join('\n');
}

function buildAttendanceTSV(rows: ReportRow[]): string {
  return rows
    .map((row) => {
      const name = sanitize(`${row.firstName} ${row.lastName}`);
      return `${name}\t${row.unexcusedAbsences}`;
    })
    .join('\n');
}

function buildExemptionsTSV(rows: ReportRow[], edits: EditMap): string {
  return rows
    .filter((r) => r.unexcusedAbsences >= 3)
    .map((row) => {
      const edit = edits.get(row.studentId);
      const reason = sanitize(edit?.comment ?? row.suggestedComment);
      const name = sanitize(`${row.firstName} ${row.lastName}`);
      return `${name}\t${reason}`;
    })
    .join('\n');
}

function buildTSVForTab(tab: TabId, rows: ReportRow[], edits: EditMap): string {
  switch (tab) {
    case 'grades':     return buildGradesTSV(rows, edits);
    case 'attendance': return buildAttendanceTSV(rows);
    case 'exemptions': return buildExemptionsTSV(rows, edits);
    case 'tests':      return buildGradesTSV(rows, edits); // same columns as grades
  }
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(rows: ReportRow[], edits: EditMap, className: string): void {
  const BOM = '\uFEFF'; // UTF-8 BOM for Hebrew Excel compatibility
  const headers = [
    'שם תלמיד', 'קוד תלמיד', 'ממוצע מבחנים', 'ציון התנהגות',
    'ציון מומלץ', 'ציון סופי', 'הערה מילולית', 'חיסורים',
  ];
  const csvRows = rows.map((row) => {
    const edit = edits.get(row.studentId);
    const finalGrade = edit?.finalGrade ?? String(row.teacherFinalGrade ?? row.recommendedFinalGrade);
    const comment = edit?.comment ?? row.verbalComment ?? row.suggestedComment;
    return [
      `${row.firstName} ${row.lastName}`,
      row.studentCode,
      row.fitnessAvg,
      row.conductScore,
      row.recommendedFinalGrade,
      finalGrade,
      `"${comment.replace(/"/g, '""')}"`,
      row.unexcusedAbsences,
    ].join(',');
  });
  const csv = BOM + [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `דוח-ציונים-${className}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Comment Combobox ─────────────────────────────────────────────────────────

interface CommentComboboxProps {
  value: string;
  onChange: (v: string) => void;
  bank: string[];
  printMode: boolean;
}

function CommentCombobox({ value, onChange, bank, printMode }: CommentComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return bank;
    const q = query.trim().toLowerCase();
    return bank.filter((c) => c.toLowerCase().includes(q));
  }, [query, bank]);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  if (printMode) {
    return <span className="text-sm text-slate-700">{value || '—'}</span>;
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery(value); } }}
        placeholder="בחר או הקלד הערה…"
        className="h-9 text-xs rounded-lg border-slate-200 bg-white/80 focus-visible:ring-indigo-400"
        aria-label="הערה מילולית"
        dir="rtl"
      />
      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ ease: EASE, duration: 0.18 }}
            className="absolute top-full z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-white/80 bg-white/95 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl text-sm"
            role="listbox"
          >
            {filtered.map((comment) => (
              <li
                key={comment}
                role="option"
                aria-selected={comment === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(comment);
                  setQuery(comment);
                  setOpen(false);
                }}
                className={cn(
                  'cursor-pointer px-3 py-2 text-xs leading-relaxed hover:bg-indigo-50 hover:text-indigo-800',
                  comment === value && 'bg-indigo-50 font-semibold text-indigo-700',
                )}
              >
                {comment}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="h-12 animate-pulse rounded-xl bg-white/60" />
      ))}
    </div>
  );
}

// ─── Final Grades Tab ─────────────────────────────────────────────────────────

interface FinalGradesTabProps {
  rows: ReportRow[];
  localEdits: EditMap;
  bank: string[];
  onEditGrade: (studentId: string, grade: string) => void;
  onEditComment: (studentId: string, comment: string) => void;
  printMode: boolean;
}

function FinalGradesTab({
  rows, localEdits, bank, onEditGrade, onEditComment, printMode,
}: FinalGradesTabProps): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center">
        <Users className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-600">אין תלמידים בכיתה זו</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/78 bg-white/70 shadow-[0_8px_28px_rgba(15,23,42,0.08)] print:shadow-none print:border-slate-200">
      <div
        className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 print:bg-slate-50"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 3fr' }}
      >
        {['שם תלמיד', 'ממוצע מבחנים', 'ציון התנהגות'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
        ))}
        {/* Glowing "Recommended Grade" header */}
        <span className="text-[11px] font-black uppercase tracking-wider bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(99,102,241,0.35)]">
          ציון מומלץ ✦
        </span>
        {['ציון סופי', 'הערה מילולית'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-slate-50">
        {rows.map((row) => {
          const edit = localEdits.get(row.studentId);
          const gradeDisplay = edit?.finalGrade ?? String(row.recommendedFinalGrade);
          const commentDisplay = edit?.comment ?? row.suggestedComment;
          const gradeNum = parseInt(gradeDisplay, 10);
          const isSuggested =
            !row.teacherFinalGrade &&
            parseInt(gradeDisplay, 10) === row.recommendedFinalGrade &&
            commentDisplay === row.suggestedComment;

          return (
            <div
              key={row.studentId}
              className="grid items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 transition-colors"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 3fr' }}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                <p className="text-xs text-slate-400 font-mono">{row.studentCode}</p>
                {row.unexcusedAbsences > 0 && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-1.5 py-px">
                    {row.unexcusedAbsences} חיסורים
                  </span>
                )}
              </div>
              <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(row.fitnessAvg))}>
                {row.fitnessAvg > 0 ? row.fitnessAvg : '—'}
              </span>
              <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(row.conductScore))}>
                {row.conductScore > 0 ? row.conductScore : '—'}
              </span>
              {/* Recommended — highlighted badge */}
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 text-sm font-black tabular-nums text-indigo-700 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                {row.recommendedFinalGrade}
              </span>
              {/* Final grade — editable */}
              {printMode ? (
                <span className={cn('text-lg font-extrabold tabular-nums', !isNaN(gradeNum) && gradeColor(gradeNum))}>
                  {gradeDisplay || '—'}
                </span>
              ) : (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeDisplay}
                  onChange={(e) => onEditGrade(row.studentId, e.target.value)}
                  className={cn(
                    'h-9 w-16 text-center font-extrabold text-base rounded-lg border-slate-200 bg-white/80',
                    'focus-visible:ring-indigo-400 tabular-nums',
                    !isNaN(gradeNum) && gradeNum >= 90 && 'text-emerald-600',
                    !isNaN(gradeNum) && gradeNum >= 75 && gradeNum < 90 && 'text-blue-600',
                    !isNaN(gradeNum) && gradeNum >= 60 && gradeNum < 75 && 'text-amber-600',
                    !isNaN(gradeNum) && gradeNum < 60 && 'text-red-600',
                  )}
                  aria-label={`ציון סופי עבור ${row.firstName} ${row.lastName}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <CommentCombobox
                  value={commentDisplay}
                  onChange={(v) => onEditComment(row.studentId, v)}
                  bank={bank}
                  printMode={printMode}
                />
                {isSuggested && !printMode && (
                  <span
                    className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-px text-[9px] font-bold text-indigo-500 whitespace-nowrap"
                    title="הוצע על ידי המערכת"
                  >
                    AI
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Attendance Tab ────────────────────────────────────────────────────────────

interface AttendanceTabProps {
  rows: ReportRow[];
  localEdits: EditMap;
  bank: string[];
  onEditComment: (studentId: string, comment: string) => void;
  printMode: boolean;
}

function AttendanceTab({ rows, localEdits, bank, onEditComment, printMode }: AttendanceTabProps): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">אין נתוני נוכחות</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/78 bg-white/70 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
      <div
        className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 3fr' }}
      >
        {['שם תלמיד', 'שיעורים', 'חיסורים', 'אחוז נוכחות', 'סטטוס', 'הערה מילולית'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((row) => {
          const present = row.totalLessons - row.unexcusedAbsences;
          const pct = row.totalLessons > 0 ? Math.round((present / row.totalLessons) * 100) : 100;
          const edit = localEdits.get(row.studentId);
          const commentDisplay = edit?.comment ?? row.suggestedComment;
          return (
            <div
              key={row.studentId}
              className="grid items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 transition-colors"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 3fr' }}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
              </div>
              <span className="text-sm font-semibold text-slate-700 tabular-nums">{row.totalLessons}</span>
              <span className={cn('text-sm font-bold tabular-nums', row.unexcusedAbsences > 3 ? 'text-red-600' : 'text-slate-700')}>
                {row.unexcusedAbsences}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className={cn('h-full rounded-full', pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ ease: EASE, duration: 0.8 }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 tabular-nums">{pct}%</span>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                pct >= 80 ? 'bg-emerald-50 text-emerald-700' : pct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
              )}>
                {pct >= 80 ? 'תקין' : pct >= 60 ? 'לתשומת לב' : 'חריג'}
              </span>
              <CommentCombobox
                value={commentDisplay}
                onChange={(v) => onEditComment(row.studentId, v)}
                bank={bank}
                printMode={printMode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Exemptions Tab ───────────────────────────────────────────────────────────

interface ExemptionsTabProps {
  rows: ReportRow[];
  localEdits: EditMap;
  bank: string[];
  onEditComment: (studentId: string, comment: string) => void;
  printMode: boolean;
}

function ExemptionsTab({ rows, localEdits, bank, onEditComment, printMode }: ExemptionsTabProps): React.JSX.Element {
  const atRisk = rows.filter((r) => r.unexcusedAbsences >= 3);
  if (atRisk.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 py-14 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
        <p className="font-semibold text-emerald-700">לא נמצאו תלמידים עם חיסורים חריגים</p>
        <p className="text-sm text-emerald-600">כל התלמידים עם פחות מ-3 חיסורים</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500 mb-3">תלמידים עם 3 חיסורים ומעלה — {atRisk.length} תלמידים</p>
      <div className="overflow-hidden rounded-2xl border border-white/78 bg-white/70 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
        <div
          className="grid gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3"
          style={{ gridTemplateColumns: '2fr 1fr 3fr' }}
        >
          {['שם תלמיד', 'חיסורים', 'הערה מילולית'].map((h) => (
            <span key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</span>
          ))}
        </div>
        <div className="divide-y divide-slate-50">
          {atRisk.map((row) => {
            const edit = localEdits.get(row.studentId);
            const commentDisplay = edit?.comment ?? row.suggestedComment;
            return (
              <div
                key={row.studentId}
                className="grid items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 transition-colors"
                style={{ gridTemplateColumns: '2fr 1fr 3fr' }}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                  <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
                </div>
                <span className="text-lg font-extrabold text-red-600 tabular-nums">{row.unexcusedAbsences}</span>
                <CommentCombobox
                  value={commentDisplay}
                  onChange={(v) => onEditComment(row.studentId, v)}
                  bank={bank}
                  printMode={printMode}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Test Results Tab ─────────────────────────────────────────────────────────

interface TestResultsTabProps {
  rows: ReportRow[];
  localEdits: EditMap;
  bank: string[];
  onEditComment: (studentId: string, comment: string) => void;
  printMode: boolean;
}

function TestResultsTab({ rows, localEdits, bank, onEditComment, printMode }: TestResultsTabProps): React.JSX.Element {
  const allTestTypes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      for (const t of row.testBreakdown) {
        if (!seen.has(t.testTypeId)) seen.set(t.testTypeId, t.nameHe);
      }
    }
    return Array.from(seen.entries()).map(([id, nameHe]) => ({ id, nameHe }));
  }, [rows]);

  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTestId === null && allTestTypes[0]) {
      setSelectedTestId(allTestTypes[0].id);
    }
  }, [allTestTypes, selectedTestId]);

  const selectedName = allTestTypes.find((t) => t.id === selectedTestId)?.nameHe;

  const filteredRows = useMemo(() => {
    if (!selectedTestId) return [];
    return rows
      .map((row) => {
        const t = row.testBreakdown.find((b) => b.testTypeId === selectedTestId);
        return { ...row, testGrade: t?.grade ?? null };
      })
      .filter((r) => r.testGrade !== null)
      .sort((a, b) => (b.testGrade ?? 0) - (a.testGrade ?? 0));
  }, [rows, selectedTestId]);

  if (allTestTypes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center">
        <TrendingUp className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-600">אין נתוני מבחנים עדיין</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {allTestTypes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedTestId(t.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
              selectedTestId === t.id
                ? 'bg-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]'
                : 'bg-white/80 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700',
            )}
          >
            {t.nameHe}
          </button>
        ))}
      </div>
      {selectedTestId && (
        <div className="overflow-hidden rounded-2xl border border-white/78 bg-white/70 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-sm font-bold text-slate-700">
              תוצאות — {selectedName}
              <span className="ms-2 text-xs font-normal text-slate-400">({filteredRows.length} תלמידים)</span>
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {filteredRows.map((row, i) => {
              const edit = localEdits.get(row.studentId);
              const commentDisplay = edit?.comment ?? row.suggestedComment;
              return (
                <div
                  key={row.studentId}
                  className="grid items-center gap-4 px-4 py-3 hover:bg-indigo-50/30 transition-colors"
                  style={{ gridTemplateColumns: 'auto 1fr auto 3fr' }}
                >
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold',
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400',
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                    <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
                  </div>
                  <span className={cn('text-xl font-extrabold tabular-nums', gradeColor(row.testGrade ?? 0))}>
                    {row.testGrade}
                  </span>
                  <CommentCombobox
                    value={commentDisplay}
                    onChange={(v) => onEditComment(row.studentId, v)}
                    bank={bank}
                    printMode={printMode}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Smart Sync Dialog ────────────────────────────────────────────────────────

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (order: string[]) => void;
  rows: ReportRow[];
}

function SyncDialog({ open, onClose, onApply, rows }: SyncDialogProps): React.JSX.Element | null {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setText('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  function handleApply(): void {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('יש להדביק רשימת שמות');
      return;
    }

    const ordered: string[] = [];
    const notFound: string[] = [];

    for (const rawName of lines) {
      // Normalize and try both "First Last" and "Last First" orders
      const name = rawName.replace(/\s+/g, ' ').trim();
      const match = rows.find(
        (r) =>
          `${r.firstName} ${r.lastName}` === name ||
          `${r.lastName} ${r.firstName}` === name,
      );
      if (match && !ordered.includes(match.studentId)) {
        ordered.push(match.studentId);
      } else if (!match) {
        notFound.push(name);
      }
    }

    if (ordered.length === 0) {
      setError('לא נמצאו תלמידים תואמים — בדוק שמות ונסה שוב');
      return;
    }

    // Append unmatched students at end (so table is complete)
    for (const row of rows) {
      if (!ordered.includes(row.studentId)) ordered.push(row.studentId);
    }

    if (notFound.length > 0) {
      setError(`אוחזר בהצלחה! לא זוהו: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? '...' : ''}`);
    }

    onApply(ordered);
    if (notFound.length === 0) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="התאם סדר למשוב"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ ease: EASE, duration: 0.25 }}
            className="relative z-10 w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-[0_32px_80px_rgba(15,23,42,0.30)] p-6"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute start-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="סגור"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Header */}
            <div className="mb-4">
              <div className="flex items-center gap-2.5 mb-1">
                <ArrowUpDown className="h-5 w-5 text-violet-600 shrink-0" aria-hidden="true" />
                <h2 className="text-lg font-extrabold text-slate-800">התאם סדר למשוב</h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                העתק את עמודת שמות התלמידים ממשוב, הדבק כאן, והטבלה שלנו תסתדר בדיוק לפי הסדר הזה!
              </p>
            </div>

            {/* Instruction steps */}
            <ol className="mb-4 space-y-2 text-sm text-slate-800 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-[11px] mt-0.5">1</span>
                פתח את משוב בכרטיסייה נוספת
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-[11px] mt-0.5">2</span>
                סמן והעתק את עמודת שמות התלמידים (כל שם בשורה נפרדת)
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white font-bold text-[11px] mt-0.5">3</span>
                הדבק כאן ולחץ &quot;סנכרן&quot;
              </li>
            </ol>

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              placeholder={'ישראל ישראלי\nסמדר כהן\nדוד לוי'}
              rows={8}
              dir="rtl"
              className="mb-3 resize-none rounded-xl border-slate-300 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-400"
              aria-label="רשימת שמות ממשוב"
            />

            {/* Error / success message */}
            {error && (
              <p className={cn(
                'mb-3 rounded-xl px-3 py-2 text-xs font-medium',
                error.startsWith('אוחזר') ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100',
              )}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                ביטול
              </button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={!text.trim()}
                className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                סנכרן סדר
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage(): React.JSX.Element {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('grades');
  const [localEdits, setLocalEdits] = useState<EditMap>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [copiedToMashov, setCopiedToMashov] = useState(false);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('alpha');

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: rows, isLoading: reportLoading, mutate: mutateReport } = useClassReport(selectedClassId);
  const { data: bank = [] } = useCommentsBank();

  const selectedClass = classes?.find((c) => c.id === selectedClassId);

  // Initialise local edits whenever new report data arrives
  useEffect(() => {
    if (rows) setLocalEdits(buildInitialEdits(rows));
  }, [rows]);

  // Auto-select first class
  useEffect(() => {
    if (!selectedClassId && classes && classes.length > 0 && classes[0]) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Reset custom order when class changes
  useEffect(() => {
    setCustomOrder(null);
  }, [selectedClassId]);

  const reportRows = rows ?? [];

  /** Rows sorted by teacher's chosen sort, or by custom Mashov order */
  const sortedRows = useMemo<ReportRow[]>(() => {
    if (customOrder !== null) return applySortOrder(reportRows, customOrder);
    if (sortBy === 'grade-high') {
      return [...reportRows].sort((a, b) =>
        (b.teacherFinalGrade ?? b.recommendedFinalGrade) - (a.teacherFinalGrade ?? a.recommendedFinalGrade),
      );
    }
    if (sortBy === 'grade-low') {
      return [...reportRows].sort((a, b) =>
        (a.teacherFinalGrade ?? a.recommendedFinalGrade) - (b.teacherFinalGrade ?? b.recommendedFinalGrade),
      );
    }
    return sortAlphabetically(reportRows);
  }, [reportRows, customOrder, sortBy]);

  const isDirty = useMemo(() => {
    if (!rows) return false;
    for (const row of rows) {
      const edit = localEdits.get(row.studentId);
      if (!edit) continue;
      const savedGrade = String(row.teacherFinalGrade ?? row.recommendedFinalGrade);
      const savedComment = row.verbalComment ?? row.suggestedComment;
      if (edit.finalGrade !== savedGrade || edit.comment !== savedComment) return true;
    }
    return false;
  }, [rows, localEdits]);

  function handleEditGrade(studentId: string, grade: string): void {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      const curr = next.get(studentId);
      if (curr) next.set(studentId, { ...curr, finalGrade: grade });
      return next;
    });
    setSaveSuccess(false);
  }

  function handleEditComment(studentId: string, comment: string): void {
    setLocalEdits((prev) => {
      const next = new Map(prev);
      const curr = next.get(studentId);
      if (curr) next.set(studentId, { ...curr, comment });
      return next;
    });
    setSaveSuccess(false);
  }

  async function handleSave(): Promise<void> {
    if (!selectedClassId || saving) return;
    setSaving(true);
    setSaveError(null);
    const grades = Array.from(localEdits.entries()).map(([studentId, edit]) => ({
      studentId,
      teacherFinalGrade: parseInt(edit.finalGrade, 10) || undefined,
      verbalComment: edit.comment || undefined,
    }));
    try {
      await apiRequest(`/reports/class/${selectedClassId}`, {
        method: 'PATCH',
        body: JSON.stringify({ grades }),
      });
      setSaveSuccess(true);
      void mutateReport();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'שגיאה בשמירה — נסה שוב');
    } finally {
      setSaving(false);
    }
  }

  function handleCopyToMashov(): void {
    const tsv = buildTSVForTab(activeTab, sortedRows, localEdits);
    void navigator.clipboard.writeText(tsv).then(() => {
      setCopiedToMashov(true);
      setTimeout(() => setCopiedToMashov(false), 3500);
    });
  }

  function handlePrintPDF(): void {
    setPrintMode(true);
    setTimeout(() => { window.print(); setPrintMode(false); }, 100);
  }

  const avgFinalGrade = useMemo(() => {
    if (reportRows.length === 0) return 0;
    const grades = reportRows.map((r) => {
      const edit = localEdits.get(r.studentId);
      return parseInt(edit?.finalGrade ?? String(r.recommendedFinalGrade), 10) || 0;
    });
    return Math.round(grades.reduce((s, g) => s + g, 0) / grades.length);
  }, [reportRows, localEdits]);

  return (
    <>
      {/* ── Print styles ──────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; inset: 0; padding: 24px; font-size: 12px; }
          button, select { display: none !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      <div className="space-y-6 print-area">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-l from-indigo-700 via-violet-700 to-indigo-800 bg-clip-text text-transparent">מרכז דוחות</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              הפקת דוחות ציונים, נוכחות ופטורים לפי כיתה
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Export Excel */}
            <Button
              type="button"
              variant="outline"
              disabled={sortedRows.length === 0}
              onClick={() => downloadCSV(sortedRows, localEdits, selectedClass?.name ?? '')}
              className="gap-2 rounded-xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              ייצא לאקסל
            </Button>

            {/* PDF */}
            <Button
              type="button"
              variant="outline"
              disabled={sortedRows.length === 0}
              onClick={handlePrintPDF}
              className="gap-2 rounded-xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              ייצא ל-PDF
            </Button>

            {/* Print */}
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false); }, 100); }}
              className="gap-2 rounded-xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              הדפס דוח
            </Button>

            {/* Smart Order Sync */}
            <Button
              type="button"
              variant="outline"
              disabled={sortedRows.length === 0}
              onClick={() => setSyncDialogOpen(true)}
              className={cn(
                'gap-2 rounded-xl shadow-sm transition-all',
                customOrder !== null
                  ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                  : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50',
              )}
              title="התאם את סדר הטבלה לסדר התלמידים במשוב"
            >
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              {customOrder !== null ? 'סדר מותאם ✓' : 'התאם סדר למשוב'}
            </Button>

            {/* Copy to Mashov */}
            <Button
              type="button"
              disabled={sortedRows.length === 0}
              onClick={handleCopyToMashov}
              className={cn(
                'gap-2 rounded-xl shadow-sm transition-all duration-300',
                copiedToMashov
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-violet-600 hover:bg-violet-700 text-white',
              )}
            >
              {copiedToMashov ? (
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Clipboard className="h-4 w-4" aria-hidden="true" />
              )}
              {copiedToMashov ? 'הועתק!' : 'העתק למשוב'}
            </Button>

            {/* Save */}
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="button"
                disabled={saving || !isDirty}
                onClick={() => { void handleSave(); }}
                className={cn(
                  'gap-2 rounded-xl shadow-sm transition-colors',
                  saveSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700',
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? 'שומר...' : saveSuccess ? 'נשמר!' : 'שמור שינויים'}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* ── Prominent Class Selector ─────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-l from-indigo-50 to-violet-50 border border-indigo-100 p-4 shadow-[0_4px_20px_rgba(99,102,241,0.10)] print:hidden">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" aria-hidden="true" />
              <span className="text-sm font-bold text-indigo-800">בחירת כיתה</span>
            </div>
            {classesLoading ? (
              <div className="h-11 w-56 animate-pulse rounded-xl bg-indigo-100/60" />
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSaveSuccess(false); }}
                className="h-11 min-w-56 rounded-xl border-2 border-indigo-200 bg-white px-4 text-base font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
                aria-label="בחר כיתה"
              >
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {/* Sort control */}
            {reportRows.length > 0 && !customOrder && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-indigo-700">מיין לפי:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="h-9 rounded-xl border-2 border-indigo-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  aria-label="מיין לפי"
                >
                  {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedClass && (
              <div className="flex items-center gap-3">
                {customOrder !== null && (
                  <>
                    <span className="text-sm text-violet-700 font-semibold">סדר מותאם למשוב</span>
                    <button
                      type="button"
                      onClick={() => setCustomOrder(null)}
                      className="text-xs text-violet-600 hover:text-violet-800 underline underline-offset-2 transition-colors"
                    >
                      אפס לסדר א-ב
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Summary stats ──────────────────────────────────────────────── */}
        {!reportLoading && reportRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden"
          >
            {[
              { label: 'תלמידים', value: reportRows.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'ממוצע ציון סופי', value: avgFinalGrade, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'ממוצע מבחנים', value: reportRows.length > 0 ? Math.round(reportRows.reduce((s, r) => s + r.fitnessAvg, 0) / reportRows.length) : 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'סה"כ חיסורים', value: reportRows.reduce((s, r) => s + r.unexcusedAbsences, 0), icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <motion.div
                key={label}
                whileHover={{ y: -4, scale: 1.02, boxShadow: '0 16px 40px rgba(15,23,42,0.14)', transition: { type: 'spring', stiffness: 400, damping: 30 } }}
                whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 30 } }}
                className="rounded-2xl bg-white/80 backdrop-blur-2xl border border-white/20 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.09)]"
              >
                <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-xl', bg)}>
                  <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                </div>
                <div className={cn('text-2xl font-extrabold tabular-nums', color)}>{value}</div>
                <div className="mt-0.5 text-xs text-slate-500">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 print:hidden">
            {saveError}
          </div>
        )}

        {/* ── Mashov copy toast ───────────────────────────────────────────── */}
        <AnimatePresence>
          {copiedToMashov && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ ease: EASE, duration: 0.25 }}
              className="fixed bottom-6 start-6 z-50 flex items-start gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-white shadow-[0_12px_36px_rgba(5,150,105,0.4)] print:hidden max-w-xs"
            >
              <ClipboardCheck className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">הועתק בהצלחה! 📋</p>
                <p className="mt-0.5 text-xs text-emerald-100 leading-relaxed">
                  יש לוודא שהסדר שבחרת תואם למשוב, ואז לעמוד על המשבצת הראשונה וללחוץ Ctrl+V
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-2xl bg-slate-100/80 p-1 print:hidden">
          {TAB_IDS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200',
                  active
                    ? 'bg-white shadow-sm text-indigo-700'
                    : 'text-slate-600 hover:text-slate-800',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{TAB_LABELS[tab]}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab content ────────────────────────────────────────────────── */}
        {!selectedClassId ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center">
            <BookOpen className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-slate-600">בחר כיתה להצגת הדוח</p>
          </div>
        ) : reportLoading ? (
          <ReportSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ ease: EASE, duration: 0.3 }}
            >
              {activeTab === 'grades' && (
                <FinalGradesTab
                  rows={sortedRows}
                  localEdits={localEdits}
                  bank={bank}
                  onEditGrade={handleEditGrade}
                  onEditComment={handleEditComment}
                  printMode={printMode}
                />
              )}
              {activeTab === 'attendance' && (
                <AttendanceTab
                  rows={sortedRows}
                  localEdits={localEdits}
                  bank={bank}
                  onEditComment={handleEditComment}
                  printMode={printMode}
                />
              )}
              {activeTab === 'exemptions' && (
                <ExemptionsTab
                  rows={sortedRows}
                  localEdits={localEdits}
                  bank={bank}
                  onEditComment={handleEditComment}
                  printMode={printMode}
                />
              )}
              {activeTab === 'tests' && (
                <TestResultsTab
                  rows={sortedRows}
                  localEdits={localEdits}
                  bank={bank}
                  onEditComment={handleEditComment}
                  printMode={printMode}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Smart Sync Dialog ───────────────────────────────────────────── */}
      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onApply={(order) => { setCustomOrder(order); }}
        rows={reportRows}
      />
    </>
  );
}
