'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WeightSlider } from '@/components/ui/weight-slider';
import { useSemester } from '@/contexts/semester-context';
import { useClasses } from '@/hooks/use-classes';
import { useClassReport, useCommentsBank } from '@/hooks/use-reports';
import { useGradingPolicy, updateClassGradingPolicy } from '@/hooks/use-grading-policy';
import { useReportSettings } from '@/hooks/use-report-settings';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ApiError } from '@fitgrade/types';
import type { ReportRow } from '@fitgrade/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Print detection hook ──────────────────────────────────────────────────────

/**
 * Returns `true` from the moment the print dialog opens until it closes.
 * Also accepts an externalOverride so the print-button click arms the flag
 * a React tick before window.print() fires (covers the 100ms setTimeout gap).
 *
 * WHY THIS EXISTS:
 * Framer Motion applies animation initial-states as inline styles
 * (e.g. `style="opacity:0; transform:translateY(24px)"`).
 * Inline styles have higher specificity than ANY stylesheet rule, including
 * `!important`, so CSS cannot fix a blank print page — we must remove the
 * `initial` prop entirely so the element renders at its final state.
 */
function useIsPrinting(externalOverride = false): boolean {
  const [browserPrinting, setBrowserPrinting] = useState(false);
  useEffect(() => {
    const before = (): void => setBrowserPrinting(true);
    const after  = (): void => setBrowserPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint',  after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint',  after);
    };
  }, []);
  return browserPrinting || externalOverride;
}

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
  // Row 1: class title so Excel opens with a clear header
  const titleRow = `"דוח כיתתי - ${className.replace(/"/g, '""')}"`;
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
  const csv = BOM + [titleRow, headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // File name includes class name so saved files are easy to identify
  a.download = `דוח-כיתה-${className}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Full-year Excel export: flat comparison table.
 * Columns: שם תלמיד | ממוצע מחצית א' | ממוצע מחצית ב' | שינוי | ציון מומלץ
 * No charts — pure data for teachers to paste into external tools.
 */
function downloadFullYearCSV(merged: MergedStudentRow[], className: string): void {
  const BOM = '\uFEFF';
  const titleRow = `"דוח שנה שלמה - ${className.replace(/"/g, '""')}"`;
  const headers = [
    'שם תלמיד',
    "ממוצע מחצית א'",
    "ממוצע מחצית ב'",
    'שינוי',
    'ציון מומלץ',
  ];
  const csvRows = merged.map((row) => {
    const semA = row.semA?.fitnessAvg ?? '';
    const semB = row.semB?.fitnessAvg ?? '';
    const delta = row.semA !== null && row.semB !== null
      ? (row.delta > 0 ? `+${row.delta}` : String(row.delta))
      : '';
    const recommended = row.semB?.recommendedFinalGrade ?? row.semA?.recommendedFinalGrade ?? '';
    return [
      `${row.firstName} ${row.lastName}`,
      semA,
      semB,
      delta,
      recommended,
    ].join(',');
  });
  const csv = BOM + [titleRow, headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `דוח-שנה-שלמה-${className}.csv`;
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
      <table className="w-full border-collapse">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '38%' }} />
        </colgroup>
        <thead className="bg-slate-50/80 print:bg-slate-50">
          <tr className="border-b border-slate-100">
            {['שם תלמיד', 'ממוצע מבחנים', 'ציון התנהגות'].map((h) => (
              <th key={h} className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
            ))}
            <th className="px-4 py-3 text-start text-[11px] font-black uppercase tracking-wider bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(99,102,241,0.35)] print:text-indigo-700 print:bg-none">
              ציון מומלץ ✦
            </th>
            {['ציון סופי', 'הערה מילולית'].map((h) => (
              <th key={h} className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
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
              <tr key={row.studentId} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                  <p className="text-xs text-slate-400 font-mono">{row.studentCode}</p>
                  {row.unexcusedAbsences > 0 && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-1.5 py-px">
                      {row.unexcusedAbsences} חיסורים
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(row.fitnessAvg))}>
                    {row.fitnessAvg > 0 ? row.fitnessAvg : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={cn('text-lg font-extrabold tabular-nums', gradeColor(row.conductScore))}>
                    {row.conductScore > 0 ? row.conductScore : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 text-sm font-black tabular-nums text-indigo-700 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                    {row.recommendedFinalGrade}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle">
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
                </td>
                <td className="px-4 py-3 align-middle">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      <table className="w-full border-collapse">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '38%' }} />
        </colgroup>
        <thead className="bg-slate-50/80">
          <tr className="border-b border-slate-100">
            {['שם תלמיד', 'שיעורים', 'חיסורים', 'אחוז נוכחות', 'סטטוס', 'הערה מילולית'].map((h) => (
              <th key={h} className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const present = row.totalLessons - row.unexcusedAbsences;
            const pct = row.totalLessons > 0 ? Math.round((present / row.totalLessons) * 100) : 100;
            const edit = localEdits.get(row.studentId);
            const commentDisplay = edit?.comment ?? row.suggestedComment;
            return (
              <tr key={row.studentId} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                  <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{row.totalLessons}</span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={cn('text-sm font-bold tabular-nums', row.unexcusedAbsences > 3 ? 'text-red-600' : 'text-slate-700')}>
                    {row.unexcusedAbsences}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 print:hidden">
                      <motion.div
                        className={cn('h-full rounded-full', pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ ease: EASE, duration: 0.8 }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                    pct >= 80 ? 'bg-emerald-50 text-emerald-700' : pct >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                  )}>
                    {pct >= 80 ? 'תקין' : pct >= 60 ? 'לתשומת לב' : 'חריג'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle">
                  <CommentCombobox
                    value={commentDisplay}
                    onChange={(v) => onEditComment(row.studentId, v)}
                    bank={bank}
                    printMode={printMode}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
        <table className="w-full border-collapse">
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '50%' }} />
          </colgroup>
          <thead className="bg-slate-50/80">
            <tr className="border-b border-slate-100">
              {['שם תלמיד', 'חיסורים', 'הערה מילולית'].map((h) => (
                <th key={h} className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {atRisk.map((row) => {
              const edit = localEdits.get(row.studentId);
              const commentDisplay = edit?.comment ?? row.suggestedComment;
              return (
                <tr key={row.studentId} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 align-middle">
                    <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                    <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-lg font-extrabold text-red-600 tabular-nums">{row.unexcusedAbsences}</span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <CommentCombobox
                      value={commentDisplay}
                      onChange={(v) => onEditComment(row.studentId, v)}
                      bank={bank}
                      printMode={printMode}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '55%' }} />
            </colgroup>
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">#</th>
                <th className="px-4 py-3 text-start text-sm font-bold text-slate-700">
                  תוצאות — {selectedName}
                  <span className="ms-2 text-xs font-normal text-slate-400">({filteredRows.length} תלמידים)</span>
                </th>
                <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">ציון</th>
                <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-wider text-slate-400">הערה מילולית</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const edit = localEdits.get(row.studentId);
                const commentDisplay = edit?.comment ?? row.suggestedComment;
                return (
                  <tr key={row.studentId} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 align-middle">
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold',
                        i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400',
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="text-sm font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
                      <p className="font-mono text-xs text-slate-400">{row.studentCode}</p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={cn('text-xl font-extrabold tabular-nums', gradeColor(row.testGrade ?? 0))}>
                        {row.testGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CommentCombobox
                        value={commentDisplay}
                        onChange={(v) => onEditComment(row.studentId, v)}
                        bank={bank}
                        printMode={printMode}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

// ─── Full Year Annual Summary ──────────────────────────────────────────────────

interface MergedStudentRow {
  studentId: string;
  firstName: string;
  lastName: string;
  semA: ReportRow | null;
  semB: ReportRow | null;
  /** fitnessAvg change: semB − semA. 0 when either semester is missing. */
  delta: number;
}

interface ChartPoint {
  nameHe: string;
  semA: number;
  semB: number;
}

function buildMergedRows(rowsA: ReportRow[], rowsB: ReportRow[]): MergedStudentRow[] {
  const mapA = new Map(rowsA.map((r) => [r.studentId, r]));
  const mapB = new Map(rowsB.map((r) => [r.studentId, r]));
  const allIds = new Set([...rowsA.map((r) => r.studentId), ...rowsB.map((r) => r.studentId)]);
  return Array.from(allIds)
    .map((id): MergedStudentRow => {
      const a = mapA.get(id) ?? null;
      const b = mapB.get(id) ?? null;
      const source = (a ?? b)!;
      return {
        studentId: id,
        firstName: source.firstName,
        lastName: source.lastName,
        semA: a,
        semB: b,
        delta: a && b ? b.fitnessAvg - a.fitnessAvg : 0,
      };
    })
    .sort((x, y) => x.lastName.localeCompare(y.lastName, 'he'));
}

function buildChartData(rowsA: ReportRow[], rowsB: ReportRow[]): ChartPoint[] {
  const aggA = new Map<string, { sum: number; count: number; nameHe: string }>();
  const aggB = new Map<string, { sum: number; count: number; nameHe: string }>();

  for (const row of rowsA) {
    for (const t of row.testBreakdown) {
      const e = aggA.get(t.testTypeId) ?? { sum: 0, count: 0, nameHe: t.nameHe };
      e.sum += t.grade; e.count += 1;
      aggA.set(t.testTypeId, e);
    }
  }
  for (const row of rowsB) {
    for (const t of row.testBreakdown) {
      const e = aggB.get(t.testTypeId) ?? { sum: 0, count: 0, nameHe: t.nameHe };
      e.sum += t.grade; e.count += 1;
      aggB.set(t.testTypeId, e);
    }
  }

  const allTestIds = new Set([...Array.from(aggA.keys()), ...Array.from(aggB.keys())]);
  return Array.from(allTestIds).map((id): ChartPoint => {
    const a = aggA.get(id);
    const b = aggB.get(id);
    return {
      nameHe: (a ?? b)!.nameHe,
      semA: a ? Math.round(a.sum / a.count) : 0,
      semB: b ? Math.round(b.sum / b.count) : 0,
    };
  });
}

function TrendIndicator({ delta }: { delta: number }): React.JSX.Element {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
        —
      </span>
    );
  }
  const isUp = delta > 0;
  const abs = Math.abs(delta);
  const strong = abs >= 5;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
        isUp
          ? strong
            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-emerald-50 text-emerald-600'
          : strong
            ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
            : 'bg-red-50 text-red-500',
      )}
    >
      {isUp
        ? <TrendingUp   className="h-3 w-3 shrink-0" aria-hidden="true" />
        : <TrendingDown className="h-3 w-3 shrink-0" aria-hidden="true" />
      }
      {isUp ? '+' : ''}{delta}
    </span>
  );
}

// ─── Custom Recharts bar shapes — gradient fills ──────────────────────────────

type BarShapeProps = { x?: number; y?: number; width?: number; height?: number };

/** Violet→Indigo gradient bar for Semester A */
function BarShapeA({ x = 0, y = 0, width = 0, height = 0 }: BarShapeProps): React.JSX.Element | null {
  if (height <= 0 || width <= 0) return null;
  return <rect x={x} y={y} width={width} height={height} fill="url(#barGradA)" rx={5} ry={5} />;
}

/** Emerald→Green gradient bar for Semester B */
function BarShapeB({ x = 0, y = 0, width = 0, height = 0 }: BarShapeProps): React.JSX.Element | null {
  if (height <= 0 || width <= 0) return null;
  return <rect x={x} y={y} width={width} height={height} fill="url(#barGradB)" rx={5} ry={5} />;
}

// ─────────────────────────────────────────────────────────────────────────────

function FullYearSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-2xl bg-slate-100" />
        <div className="h-36 rounded-2xl bg-slate-100" />
      </div>
      <div className="h-64 rounded-2xl bg-slate-100" />
      <div className="h-96 rounded-2xl bg-slate-100" />
    </div>
  );
}

interface FullYearViewProps {
  rowsA: ReportRow[];
  rowsB: ReportRow[];
  isLoading: boolean;
  classLabel: string;
  /** Set to true before window.print() fires so all motion elements skip their
   *  initial-invisible state and render at their final (opacity:1, y:0) values. */
  printMode?: boolean;
}

function FullYearView({ rowsA, rowsB, isLoading, classLabel, printMode = false }: FullYearViewProps): React.JSX.Element {
  /** True whenever the browser is about to print (covers both the print button
   *  and Ctrl+P). While true every motion element skips its initial state. */
  const isPrinting = useIsPrinting(printMode);
  const { data: reportSettings } = useReportSettings();
  // All hooks before any conditional return
  const merged     = useMemo(() => buildMergedRows(rowsA, rowsB),   [rowsA, rowsB]);
  const chartData  = useMemo(() => buildChartData(rowsA, rowsB),    [rowsA, rowsB]);

  const classAvgA  = rowsA.length > 0
    ? Math.round(rowsA.reduce((s, r) => s + r.fitnessAvg, 0) / rowsA.length) : 0;
  const classAvgB  = rowsB.length > 0
    ? Math.round(rowsB.reduce((s, r) => s + r.fitnessAvg, 0) / rowsB.length) : 0;
  const totalAbsences = rowsA.reduce((s, r) => s + r.unexcusedAbsences, 0)
                      + rowsB.reduce((s, r) => s + r.unexcusedAbsences, 0);
  const studentCount = merged.length;

  const topImprover = useMemo((): MergedStudentRow | null => {
    const candidates = merged.filter((r) => r.semA !== null && r.semB !== null && r.delta > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, r) => r.delta > best.delta ? r : best);
  }, [merged]);

  const perfectAttendance = useMemo(
    () => merged.filter((r) =>
      (r.semA?.unexcusedAbsences ?? 1) === 0 &&
      (r.semB?.unexcusedAbsences ?? 1) === 0 &&
      (r.semA !== null || r.semB !== null),
    ),
    [merged],
  );

  const printDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  if (isLoading) return <FullYearSkeleton />;

  return (
    <div className="space-y-6">
      {/* ── Print-only annual report header ──────────────────────────── */}
      <div className="border-b-2 border-slate-800 pb-5 mb-2" dir="rtl">
        <div className="flex items-start justify-between">
          <div>
            {reportSettings?.schoolName && (
              <p className="text-sm font-bold text-slate-500 mb-0.5">{reportSettings.schoolName}</p>
            )}
            <h1 className="text-xl font-bold text-slate-900">דו&quot;ח ריכוז ציונים שנתי — תשפ&quot;ו</h1>
            <p className="mt-1 text-sm font-semibold text-slate-700">כיתה: {classLabel}</p>
          </div>
          <div className="text-end text-xs text-slate-500 space-y-0.5">
            <p>תאריך הפקה: {printDate}</p>
            <p>סה&quot;כ תלמידים: {studentCount}</p>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: 'תלמידים',          value: studentCount,  icon: Users,       color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
            { label: "ממוצע מחצית א'",   value: classAvgA,     icon: TrendingUp,  color: 'text-violet-600',  bg: 'bg-violet-50'  },
            { label: "ממוצע מחצית ב'",   value: classAvgB,     icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'חיסורים שנתיים',   value: totalAbsences, icon: BookOpen,    color: 'text-amber-600',   bg: 'bg-amber-50'   },
          ] satisfies Array<{ label: string; value: number; icon: React.ElementType; color: string; bg: string }>
        ).map(({ label, value, icon: Icon, color, bg }, idx) => (
          <motion.div
            key={label}
            initial={isPrinting ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isPrinting ? 0 : idx * 0.08, type: 'spring', stiffness: 320, damping: 26 }}
            whileHover={isPrinting ? undefined : { y: -6, scale: 1.03, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
            className="relative overflow-hidden rounded-2xl bg-white/85 backdrop-blur-2xl border border-white/30 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.07)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.13)] transition-shadow cursor-default print:shadow-none print:border-slate-200 print:bg-white print:border-slate-200"
          >
            {/* Decorative gradient orb — pure decoration, hidden in print */}
            <div className={cn('pointer-events-none absolute -end-5 -top-5 h-20 w-20 rounded-full opacity-25 blur-2xl print:hidden', bg)} aria-hidden="true" />
            <div className={cn('relative mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm', bg)}>
              <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
            </div>
            <div className={cn('relative text-3xl font-extrabold tabular-nums', color)}>{value}</div>
            <div className="relative mt-0.5 text-xs font-medium text-slate-500">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Insights ──────────────────────────────────────────────────── */}
      {(topImprover !== null || perfectAttendance.length > 0) && (
        <motion.div
          initial={isPrinting ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isPrinting ? 0 : 0.35, ease: EASE, duration: 0.4 }}
          className="grid gap-4 sm:grid-cols-2 print:grid-cols-2"
        >
          {/* Top improver */}
          {topImprover !== null && (
            <motion.div
              whileHover={isPrinting ? undefined : { y: -4, scale: 1.02, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
              className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 to-orange-50/95 backdrop-blur-sm p-5 shadow-sm hover:shadow-[0_12px_36px_rgba(245,158,11,0.20)] transition-shadow print:shadow-none print:border-amber-200 print:bg-amber-50"
            >
              {/* Decorative orb */}
              <div className="pointer-events-none absolute -start-4 -bottom-4 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl print:hidden" aria-hidden="true" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 shadow-sm">
                  <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">תלמיד/ת השנה</p>
                  <p className="text-xs font-medium text-amber-700">המשתפר/ת ביותר</p>
                </div>
              </div>
              <p className="relative text-lg font-extrabold text-slate-800">
                {topImprover.firstName} {topImprover.lastName}
              </p>
              <p className="relative mt-1 text-sm text-amber-700">
                שיפור של{' '}
                <span className="font-bold text-emerald-600">+{topImprover.delta}</span>
                {' '}נקודות ממחצית א׳ למחצית ב׳
              </p>
            </motion.div>
          )}

          {/* Perfect attendance */}
          {perfectAttendance.length > 0 && (
            <motion.div
              whileHover={isPrinting ? undefined : { y: -4, scale: 1.02, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
              className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 to-teal-50/95 backdrop-blur-sm p-5 shadow-sm hover:shadow-[0_12px_36px_rgba(16,185,129,0.18)] transition-shadow print:shadow-none print:border-emerald-200 print:bg-emerald-50"
            >
              {/* Decorative orb */}
              <div className="pointer-events-none absolute -start-4 -bottom-4 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl print:hidden" aria-hidden="true" />
              <div className="relative flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 shadow-sm">
                  <Star className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">שיאני הנוכחות</p>
                  <p className="text-xs font-medium text-emerald-700">ללא חיסורים כל השנה</p>
                </div>
              </div>
              <div className="relative flex flex-wrap gap-2">
                {perfectAttendance.slice(0, 6).map((r) => (
                  <span key={r.studentId} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 shadow-sm">
                    {r.firstName} {r.lastName}
                  </span>
                ))}
                {perfectAttendance.length > 6 && (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm text-emerald-600">
                    +{perfectAttendance.length - 6} נוספים
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── Performance bar chart ─────────────────────────────────────── */}
      {chartData.length > 0 && (
        <motion.div
          initial={isPrinting ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isPrinting ? 0 : 0.45, ease: EASE, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-sm p-5 shadow-[0_4px_24px_rgba(15,23,42,0.07)] print:shadow-none print:border-slate-200 print:bg-white"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-sm font-bold text-slate-700">
                ממוצע כיתתי לפי מבחן — השוואה בין מחצית א׳ למחצית ב׳
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">גבוה יותר = ביצועים טובים יותר</p>
            </div>
            {/* Custom legend pills */}
            <div className="flex items-center gap-3 shrink-0 print:hidden">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700">
                <span className="h-3 w-3 rounded-full bg-gradient-to-b from-violet-500 to-indigo-600 inline-block" />
                מחצית א׳
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <span className="h-3 w-3 rounded-full bg-gradient-to-b from-emerald-400 to-green-600 inline-block" />
                מחצית ב׳
              </span>
            </div>
          </div>

          {/* dir="ltr" keeps Recharts SVG rendering correct inside an RTL page */}
          <div dir="ltr" className="relative mt-4 h-64">
            {/* Hidden SVG — defines gradients used by BarShapeA / BarShapeB */}
            <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', overflow: 'hidden' }}>
              <defs>
                <linearGradient id="barGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#7c3aed" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity={0.88} />
                </linearGradient>
                <linearGradient id="barGradB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.88} />
                </linearGradient>
              </defs>
            </svg>

            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 44 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="nameHe"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>,
                    name === 'semA' ? "מחצית א'" : "מחצית ב'",
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    direction: 'rtl',
                    border: '1px solid rgba(226,232,240,0.9)',
                    boxShadow: '0 12px 32px rgba(15,23,42,0.15)',
                    backdropFilter: 'blur(8px)',
                    background: 'rgba(255,255,255,0.96)',
                  }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)', radius: 6 }}
                />
                {/* Legend is replaced by custom pills above — hide built-in */}
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="semA" shape={<BarShapeA />} maxBarSize={26} name="semA" />
                <Bar dataKey="semB" shape={<BarShapeB />} maxBarSize={26} name="semB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ── Comparative table ─────────────────────────────────────────── */}
      <motion.div
        initial={isPrinting ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: isPrinting ? 0 : 0.58, ease: EASE, duration: 0.4 }}
      >
      {merged.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center">
          <BookOpen className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="font-semibold text-slate-600">אין נתוני שנה שלמה להצגה</p>
          <p className="text-sm text-slate-400">יש לוודא שנרשמו ציונים במחצית א׳ ו/או ב׳</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.06)] print:shadow-none">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 print:bg-slate-100">
                <th className="py-3 ps-5 pe-3 text-start font-semibold text-slate-600">#</th>
                <th className="py-3 px-3 text-start font-semibold text-slate-700">שם תלמיד/ה</th>
                <th className="py-3 px-3 text-center font-semibold text-violet-600">מבחנים מחצית א׳</th>
                <th className="py-3 px-3 text-center font-semibold text-emerald-600">מבחנים מחצית ב׳</th>
                <th className="py-3 px-3 text-center font-semibold text-slate-600">מגמה</th>
                <th className="py-3 ps-3 pe-5 text-center font-semibold text-slate-700">ציון מומלץ</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((row, idx) => {
                const recommended = row.semB?.recommendedFinalGrade ?? row.semA?.recommendedFinalGrade ?? 0;
                return (
                  <motion.tr
                    key={row.studentId}
                    initial={isPrinting ? false : { opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: isPrinting ? 0 : 0.65 + idx * 0.025, ease: EASE, duration: 0.28 }}
                    className={cn(
                      'border-b border-slate-100 hover:bg-indigo-50/40 transition-colors duration-150',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                    )}
                  >
                    <td className="py-3 ps-5 pe-3 text-slate-400 text-xs tabular-nums">{idx + 1}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {row.semA !== null
                        ? <span className={cn('font-bold', gradeColor(row.semA.fitnessAvg))}>{row.semA.fitnessAvg}</span>
                        : <span className="text-slate-300 text-xs">אין נתון</span>
                      }
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums">
                      {row.semB !== null
                        ? <span className={cn('font-bold', gradeColor(row.semB.fitnessAvg))}>{row.semB.fitnessAvg}</span>
                        : <span className="text-slate-300 text-xs">אין נתון</span>
                      }
                    </td>
                    <td className="py-3 px-3 text-center">
                      <TrendIndicator delta={row.delta} />
                    </td>
                    <td className="py-3 ps-3 pe-5 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center rounded-xl px-2.5 py-0.5 text-sm font-extrabold tabular-nums',
                        recommended >= 90 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : recommended >= 75 ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                          : recommended >= 60 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          : 'bg-red-50 text-red-700 ring-1 ring-red-200',
                      )}>
                        {recommended}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </motion.div>

      {/* ── Print-only signature footer ───────────────────────────────── */}
      <div className="mt-8 border-t-2 border-slate-300 pt-8 print:mt-6 print:break-inside-avoid" dir="rtl">
        <div className="flex justify-between gap-12">
          {/* Teacher signature */}
          <div className="flex-1 text-center">
            {reportSettings?.teacherSignature ? (
              <div className="mb-2 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={reportSettings.teacherSignature}
                  alt="חתימת מורה"
                  className="h-16 object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-10">___________________________</p>
            )}
            <p className="text-sm font-semibold text-slate-700">
              {reportSettings?.teacherName ?? 'המורה לחינוך גופני'}
            </p>
            <p className="text-xs text-slate-400">חתימת המורה</p>
          </div>
          {/* Date — filled automatically */}
          <div className="flex-1 text-center">
            <div className="mb-2 flex h-16 items-center justify-center">
              <p className="text-base font-bold text-slate-800">{printDate}</p>
            </div>
            <p className="text-sm font-semibold text-slate-700">&nbsp;</p>
            <p className="text-xs text-slate-400">תאריך</p>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-slate-400">
          דוח זה הופק ממערכת FitGrade · {printDate}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage(): React.JSX.Element {
  // Sidebar is boss — read active semester from context
  const { semesterFilter, activeSemester } = useSemester();
  // Local "שנה שלמה" override — teacher can widen to full year on this page
  const [showFullYear, setShowFullYear] = useState(false);

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

  // ── Class grading-policy override dialog ──────────────────────────────────────
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyFitness, setPolicyFitness] = useState(55);
  const [policyConduct, setPolicyConduct] = useState(45);
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // 'YEAR' toggle overrides sidebar; otherwise sidebar semesterFilter is the source of truth
  const semesterParam = showFullYear ? undefined : semesterFilter;

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: rows, isLoading: reportLoading, mutate: mutateReport } = useClassReport(selectedClassId, semesterParam);
  const { data: bank = [] } = useCommentsBank();
  const { data: globalPolicy } = useGradingPolicy();
  const { data: reportSettings } = useReportSettings();

  // Full-year parallel fetches — only active when showFullYear is toggled on
  const fullYearClassId = showFullYear ? selectedClassId : '';
  const { data: rowsA = [], isLoading: loadingA } = useClassReport(fullYearClassId, 'A');
  const { data: rowsB = [], isLoading: loadingB } = useClassReport(fullYearClassId, 'B');

  const selectedClass = classes?.find((c) => c.id === selectedClassId);

  // Sidebar is the source of truth: switching A↔B collapses the Full Year view.
  // This prevents the state lock where the page stays in Full Year after the
  // teacher selects a specific semester in the sidebar.
  useEffect(() => {
    setShowFullYear(false);
  }, [activeSemester]);

  // Initialise local edits whenever new report data arrives
  useEffect(() => {
    if (rows) setLocalEdits(buildInitialEdits(rows));
  }, [rows]);

  // Auto-select first class when the class list loads or changes
  useEffect(() => {
    if (!selectedClassId && classes && classes.length > 0 && classes[0]) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Reset custom order when class changes
  useEffect(() => {
    setCustomOrder(null);
  }, [selectedClassId]);

  // Seed dialog with current class weights when it opens
  function openPolicyDialog(): void {
    const fw = selectedClass?.testWeight ?? globalPolicy?.fitnessWeight ?? 55;
    const cw = selectedClass?.talmidautWeight ?? globalPolicy?.conductWeight ?? 45;
    setPolicyFitness(fw);
    setPolicyConduct(cw);
    setPolicyConfirmed(false);
    setPolicyError(null);
    setPolicyDialogOpen(true);
  }

  async function savePolicyOverride(): Promise<void> {
    if (!selectedClassId) return;
    setPolicySaving(true);
    setPolicyError(null);
    try {
      await updateClassGradingPolicy(selectedClassId, policyFitness, policyConduct);
      await mutateReport();
      setPolicyDialogOpen(false);
    } catch {
      setPolicyError('שגיאה בשמירה — נסה שוב');
    } finally {
      setPolicySaving(false);
    }
  }

  async function resetPolicyOverride(): Promise<void> {
    if (!selectedClassId) return;
    setPolicySaving(true);
    setPolicyError(null);
    try {
      await updateClassGradingPolicy(selectedClassId, null, null);
      await mutateReport();
      setPolicyDialogOpen(false);
    } catch {
      setPolicyError('שגיאה באיפוס — נסה שוב');
    } finally {
      setPolicySaving(false);
    }
  }

  const reportRows = rows ?? [];

  // Merged rows for full-year Excel export — kept at page level so the
  // export button can call downloadFullYearCSV without drilling into FullYearView.
  const mergedForExport = useMemo(
    () => (showFullYear ? buildMergedRows(rowsA, rowsB) : []),
    [showFullYear, rowsA, rowsB],
  );

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
    // flushSync guarantees React commits printMode:true to the DOM BEFORE
    // window.print() is called — no race condition, no stale invisible states.
    flushSync(() => setPrintMode(true));
    window.print();
    setPrintMode(false);
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
        /* @page must be at top level — not inside @media print */
        @page { margin: 10mm; size: A4 landscape; }

        @media print {
          /* ── 1. Force exact color rendering (charts, badges, grade colours) ── */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            /* ── CRITICAL: reset ALL Framer Motion inline animation states ──
               The layout wrapper (motion.div in layout.tsx) sits ABOVE .print-area
               and has initial:{ opacity:0, scale:1.02, filter:blur(3px) }.
               If that ancestor has opacity<1 or a blur, everything inside is
               invisible regardless of .print-area * rules.
               This global * rule defeats any stale inline animation state on
               ANY element — ancestor OR descendant. */
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }

          /* ── 2. Reset ancestor containers that clip to one viewport height ── */
          html, body, #__next, main,
          div[class*="h-screen"], div[class*="overflow-hidden"], div[class*="overflow-auto"] {
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
          }

          /* ── 3. Isolate the print area ─────────────────────────────────── */
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          /* CRITICAL: Do NOT use position:absolute + inset-inline-start:50% + translateX(-50%)
             because the global * { transform:none } rule (needed for Framer Motion) kills
             the translateX correction, leaving the element offset by 50% in RTL.
             Use position:static + margin:auto instead — direction-agnostic and safe. */
          .print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 297mm !important;
            margin: 0 auto !important;
            padding: 0 4mm !important;
            box-sizing: border-box !important;
            font-size: 10px;
            color: #000;
            direction: rtl;
          }

          /* ── 4. Force visibility — belt-and-suspenders on top of the JS fix ──
             The JS isPrinting hook already removes initial:{opacity:0} props,
             but this CSS acts as a second safety net in case any element still
             carries an inline opacity/transform (e.g. exit animations mid-flight). */
          .print-area * {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
            transition: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            text-shadow: none !important;
            overflow: visible !important;     /* don't clip content in print */
            max-height: none !important;      /* no fixed-height containers hiding rows */
          }

          /* Recharts SVG: force all text and paths to be visible */
          .print-area .recharts-text,
          .print-area .recharts-cartesian-axis-tick-value,
          .print-area text { fill: #334155 !important; color: #334155 !important; }
          .print-area .recharts-cartesian-grid line { stroke: #e2e8f0 !important; }

          /* Force ALL text to be readable — prevents white-on-white in any renderer */
          .print-area { color: #0f172a; }

          /* Force critical text colours so nothing renders white-on-white */
          .print-area .text-slate-800,
          .print-area .text-slate-900 { color: #0f172a !important; }
          .print-area .text-slate-700 { color: #334155 !important; }
          .print-area .text-slate-600 { color: #475569 !important; }
          .print-area .text-slate-500 { color: #64748b !important; }
          .print-area .text-slate-400 { color: #94a3b8 !important; }

          /* Glassmorphism large-card backgrounds → white */
          .print-area .bg-white\\/80,
          .print-area .bg-white\\/70,
          .print-area .bg-white\\/90 { background: white !important; }

          /* ── 5. Preserve grade colour coding ────────────────────────────── */
          .print-area .text-emerald-600 { color: #059669 !important; }
          .print-area .text-blue-600    { color: #2563eb !important; }
          .print-area .text-amber-600   { color: #d97706 !important; }
          .print-area .text-red-600     { color: #dc2626 !important; }
          .print-area .text-violet-600  { color: #7c3aed !important; }
          .print-area .text-indigo-700  { color: #4338ca !important; }
          .print-area .text-emerald-700 { color: #047857 !important; }
          .print-area .text-amber-700   { color: #b45309 !important; }

          /* ── 6. Preserve semantic background colours (stat cards, insights) */
          .print-area [class~="bg-indigo-50"]   { background-color: #eef2ff !important; }
          .print-area [class~="bg-violet-50"]   { background-color: #f5f3ff !important; }
          .print-area [class~="bg-emerald-50"]  { background-color: #ecfdf5 !important; }
          .print-area [class~="bg-amber-50"]    { background-color: #fffbeb !important; }
          .print-area [class~="bg-amber-100"]   { background-color: #fef3c7 !important; }
          .print-area [class~="bg-emerald-100"] { background-color: #d1fae5 !important; }
          .print-area [class~="bg-slate-50"]    { background-color: #f8fafc !important; }
          .print-area [class~="bg-slate-100"]   { background-color: #f1f5f9 !important; }

          /* ── 6b. Preserve insight card gradient backgrounds ──────────────── */
          .print-area [class*="from-amber-50"]   { background: linear-gradient(135deg, #fffbeb, #fff7ed) !important; }
          .print-area [class*="from-emerald-50"] { background: linear-gradient(135deg, #ecfdf5, #f0fdfa) !important; }
          /* Ring colours on recommended grade pills */
          .print-area [class*="ring-emerald"] { outline: 1px solid #6ee7b7 !important; }
          .print-area [class*="ring-blue"]    { outline: 1px solid #93c5fd !important; }
          .print-area [class*="ring-amber"]   { outline: 1px solid #fcd34d !important; }
          .print-area [class*="ring-red"]     { outline: 1px solid #fca5a5 !important; }

          /* ── 7. Fix gradient text (bg-clip-text) → solid indigo ─────────── */
          .print-area .bg-clip-text {
            -webkit-text-fill-color: #4338ca !important;
            background: none !important;
          }

          /* ── 8. Charts: never break across pages ─────────────────────────── */
          .print-area .recharts-wrapper,
          .print-area .recharts-responsive-container,
          .print-area .h-64,
          .print-area .h-56 {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Insight cards: keep stat grids together but allow tables to flow */
          .print-area .grid { break-inside: avoid; page-break-inside: avoid; }

          /* ── 9. Tables: header repeats, rows intact ──────────────────────── */
          .print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-area thead { display: table-header-group; }
          .print-area tr    { break-inside: avoid; page-break-inside: avoid; }
          .print-area td, .print-area th { padding: 5px 8px !important; font-size: 9px !important; }

          /* ── 10. Force full-width block on overflow-hidden wrappers (table containers) ─
             The overflow-hidden div is a flex/grid child that can shrink. Force it to
             stretch to 100% so the table inside always fills the page width.          */
          .print-area .overflow-hidden {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            box-sizing: border-box !important;
          }

          /* ── 11. Symmetric grid columns in print ────────────────────────────
             MUST include display:grid — rule 2 forces all overflow-hidden divs to
             display:block, and the ancestor chain may inherit that reset.            */
          .print-area .sm\\:grid-cols-4 { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
          .print-area .sm\\:grid-cols-2 { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; }
          /* Force stat-card grid into single 4-col row — default grid-cols-2 = 2×2 = wastes half a page */
          .print-area .grid-cols-2      { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
          /* Insight cards: keep 2-col grid */
          .print-area .sm\\:grid-cols-2.print\\:grid-cols-2 { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; }

          /* ── 12. Hide interactive / decorative UI ─────────────────────────── */
          button, select, input[type="number"], input[type="text"], textarea {
            display: none !important;
          }

          /* ── 13. Compact spacing: collapse large web gaps for A4 ─────────────
             space-y-6 = 1.5rem = 24px between each section. On A4 landscape
             (net height ≈ 760px with 10mm margins) that alone eats ~120px.         */
          .print-area .space-y-6 > * + * { margin-top: 8px !important; }
          .print-area .space-y-4 > * + * { margin-top: 6px !important; }
          .print-area .space-y-3 > * + * { margin-top: 4px !important; }
          .print-area .gap-3,
          .print-area .gap-4     { gap: 5px !important; }
          .print-area .mb-6      { margin-bottom: 10px !important; }
          .print-area .pb-4,
          .print-area .pb-5      { padding-bottom: 8px !important; }
          .print-area .mb-3,
          .print-area .mb-2      { margin-bottom: 4px !important; }
          .print-area .mt-4      { margin-top: 6px !important; }

          /* ── 14. Compact card padding (rem = root 16px, not .print-area 10px) */
          .print-area .p-4 { padding: 8px 10px !important; }
          .print-area .p-5 { padding: 8px 10px !important; }

          /* ── 15. Shrink oversized stat-card numbers ──────────────────────── */
          .print-area .text-3xl { font-size: 18px !important; line-height: 1.2 !important; }
          .print-area .text-2xl { font-size: 15px !important; line-height: 1.2 !important; }

          /* ── 16. Chart: cap at 180 px + force full width ─────────────────────
             h-64 = 16rem = 256 px at root 16px — far too tall for A4.
             [dir="ltr"] is the chart's RTL-isolation wrapper — must be 100% wide. */
          .print-area .h-64   { height: 180px !important; max-height: 180px !important; }
          .print-area .h-56   { height: 150px !important; max-height: 150px !important; }
          .print-area [dir="ltr"] { width: 100% !important; display: block !important; }

        }
      `}</style>

      <div className="space-y-6 print-area print:block print:h-auto print:min-h-0 print:overflow-visible print:p-0 print:m-0 print:max-w-none">
        {/* ── Print-only class header — hidden in Full Year mode (FullYearView has its own) ── */}
        {!showFullYear && (
          <div className="border-b border-slate-300 pb-4 mb-6 text-center" dir="rtl">
            {reportSettings?.schoolName && (
              <p className="text-base font-bold text-slate-600 mb-1">{reportSettings.schoolName}</p>
            )}
            <h1 className="text-2xl font-bold text-slate-900">
              דוח ציונים כיתתי — {selectedClass?.name ?? ''}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {TAB_LABELS[activeTab]} &bull; {new Date().toLocaleDateString('he-IL')}
            </p>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-l from-indigo-700 via-violet-700 to-indigo-800 bg-clip-text text-transparent">מרכז דוחות</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              הפקת דוחות ציונים, נוכחות ופטורים לפי כיתה
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Export Excel — flat comparison table in Full Year mode; per-semester table otherwise */}
            <Button
              type="button"
              variant="outline"
              disabled={showFullYear ? mergedForExport.length === 0 : sortedRows.length === 0}
              onClick={() =>
                showFullYear
                  ? downloadFullYearCSV(mergedForExport, selectedClass?.name ?? '')
                  : downloadCSV(sortedRows, localEdits, selectedClass?.name ?? '')
              }
              className="gap-2 rounded-xl border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              ייצא לאקסל
            </Button>

            {/* PDF — prints FullYearView (with chart + insights) in Full Year mode */}
            <Button
              type="button"
              variant="outline"
              disabled={showFullYear ? mergedForExport.length === 0 : sortedRows.length === 0}
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
              onClick={() => { flushSync(() => setPrintMode(true)); window.print(); setPrintMode(false); }}
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

        {/* ── Scope indicator — sidebar controls A/B; page adds "שנה שלמה" override ── */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] print:hidden flex items-center gap-4 flex-wrap">
          {/* Active semester badge — always reflects the sidebar; never says שנה שלמה */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
              מחצית פעילה
            </span>
            <span
              className="rounded-full px-3 py-1 text-[13px] font-bold"
              style={{
                background: activeSemester === 'A' ? 'rgba(139,92,246,0.12)' : 'rgba(34,197,94,0.12)',
                color:      activeSemester === 'A' ? 'rgba(109,40,217,0.95)' : 'rgba(22,163,74,0.95)',
                border: `1px solid ${activeSemester === 'A' ? 'rgba(139,92,246,0.28)' : 'rgba(34,197,94,0.28)'}`,
              }}
            >
              {activeSemester === 'A' ? "מחצית א'" : "מחצית ב'"}
            </span>
          </div>

          {/* Vertical divider */}
          <div className="h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />

          {/* ONE שנה שלמה toggle — the only place this label appears */}
          <button
            type="button"
            onClick={() => setShowFullYear((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition-all duration-200',
              showFullYear
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                : 'border border-black/[0.08] bg-black/[0.04] text-slate-500 hover:bg-black/[0.07] hover:text-slate-700',
            )}
            aria-pressed={showFullYear}
          >
            <span>שנה שלמה ✦</span>
            {showFullYear && <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
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
                {/* Per-class grading policy button */}
                <button
                  type="button"
                  onClick={openPolicyDialog}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 hover:border-indigo-300"
                  title="הגדרות מדיניות ציון לכיתה זו"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  מדיניות ציון
                  {selectedClass.testWeight !== null && (
                    <span className="ms-1 rounded-full bg-indigo-100 px-1.5 py-px text-[10px] font-bold text-indigo-600">
                      {selectedClass.testWeight}/{selectedClass.talmidautWeight}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Class Grading Policy Dialog ──────────────────────────────────── */}
        <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-indigo-500" />
                מדיניות ציון — {selectedClass?.name ?? ''}
              </DialogTitle>
            </DialogHeader>

            {/* Warning if this is a per-class override */}
            {!policyConfirmed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">שים לב: דריסת ברירת המחדל הגלובלית</p>
                <p className="mt-1 text-amber-700">
                  הגדרות אלה ידרסו את מדיניות הציון הגלובלית עבור כיתה זו בלבד.
                  {globalPolicy && (
                    <span> ברירת המחדל הנוכחית: כושר {globalPolicy.fitnessWeight}% / תלמידות {globalPolicy.conductWeight}%.</span>
                  )}
                </p>
                <button
                  onClick={() => setPolicyConfirmed(true)}
                  className="mt-2 rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
                >
                  הבנתי — המשך
                </button>
              </div>
            )}

            {policyConfirmed && (
              <div className="space-y-5 pt-1">
                <WeightSlider
                  fitnessWeight={policyFitness}
                  conductWeight={policyConduct}
                  onChange={(fw, cw) => { setPolicyFitness(fw); setPolicyConduct(cw); }}
                  disabled={policySaving}
                />

                {policyError && (
                  <p className="text-center text-sm text-red-500">{policyError}</p>
                )}

                <div className="flex items-center justify-between gap-3">
                  {selectedClass?.testWeight !== null ? (
                    <button
                      type="button"
                      onClick={resetPolicyOverride}
                      disabled={policySaving}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      חזור לברירת מחדל
                    </button>
                  ) : <span />}

                  <button
                    type="button"
                    onClick={savePolicyOverride}
                    disabled={policySaving || policyFitness + policyConduct !== 100}
                    className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {policySaving ? 'שומר...' : 'שמור לכיתה זו'}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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

        {/* ── Tabs — hidden in Full Year mode ────────────────────────────── */}
        {!showFullYear && (
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
        )}

        {/* ── Full Year View / Tab content ────────────────────────────── */}
        {!selectedClassId ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 py-14 text-center">
            <BookOpen className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-slate-600">בחר כיתה להצגת הדוח</p>
          </div>
        ) : showFullYear ? (
          <FullYearView
            rowsA={rowsA}
            rowsB={rowsB}
            isLoading={loadingA || loadingB}
            classLabel={selectedClass?.name ?? ''}
            printMode={printMode}
          />
        ) : reportLoading ? (
          <ReportSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={printMode ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={printMode ? undefined : { opacity: 0, y: -8 }}
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
        {/* ── Print-only signature footer ───────────────────────────────── */}
        {!showFullYear && (
          <div className="mt-8 border-t-2 border-slate-300 pt-8 print:mt-6 print:break-inside-avoid" dir="rtl">
            <div className="flex justify-between gap-12">
              {/* Teacher signature */}
              <div className="flex-1 text-center">
                {reportSettings?.teacherSignature ? (
                  <div className="mb-2 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={reportSettings.teacherSignature}
                      alt="חתימת מורה"
                      className="h-16 object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mb-10">___________________________</p>
                )}
                <p className="text-sm font-semibold text-slate-700">
                  {reportSettings?.teacherName ?? 'המורה לחינוך גופני'}
                </p>
                <p className="text-xs text-slate-400">חתימת המורה</p>
              </div>
              {/* Date — filled automatically */}
              <div className="flex-1 text-center">
                <div className="mb-2 flex h-16 items-center justify-center">
                  <p className="text-base font-bold text-slate-800">{new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700">&nbsp;</p>
                <p className="text-xs text-slate-400">תאריך</p>
              </div>
            </div>
            <p className="mt-6 text-center text-[10px] text-slate-400">
              דוח זה הופק ממערכת FitGrade · {new Date().toLocaleDateString('he-IL')}
            </p>
          </div>
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
