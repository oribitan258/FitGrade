'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart2,
  Check,
  CheckSquare,
  Loader2,
  Pencil,
  Square,
  X,
  Zap,
} from 'lucide-react';
import type { StudentData, TestSummary } from '@fitgrade/types';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useReportSettings } from '@/hooks/use-report-settings';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GradeMatrixProps {
  classId: string;
  students: StudentData[];
  testSummaries: TestSummary[];
  /** Effective fitness test weight % (0–100) for the "Final Grade" calculation. */
  testWeight: number;
  /** Called after each successful grade save to trigger SWR revalidation. */
  onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-slate-200 text-slate-700',
  'bg-cyan-100 text-cyan-700',
] as const;

/** Separator that never appears in UUIDs — safe to use as a compound key. */
const KEY_SEP = '__';

function cellKey(studentId: string, testTypeId: string): string {
  return `${studentId}${KEY_SEP}${testTypeId}`;
}

function parseCellKey(key: string): [string, string] {
  const idx = key.indexOf(KEY_SEP);
  return [key.slice(0, idx), key.slice(idx + KEY_SEP.length)];
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function gradeCellClasses(grade: number, passingGrade: number): string {
  if (grade >= 90) return 'bg-emerald-50 text-emerald-700';
  if (grade >= 75) return 'bg-blue-50 text-blue-700';
  if (grade >= passingGrade) return 'bg-amber-50 text-amber-700';
  if (grade > 0)   return 'bg-red-50 text-red-600';
  return 'bg-slate-50 text-slate-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GradeMatrix({
  classId,
  students,
  testSummaries,
  testWeight,
  onRefresh,
}: GradeMatrixProps): React.JSX.Element {

  // ── Teacher report settings (passing grade threshold) ─────────────────────
  const { data: reportSettings } = useReportSettings();
  /** Fallback to 60 while SWR loads — matches the DB default, prevents color flicker. */
  const effectivePassingGrade = reportSettings?.passingGrade ?? 60;

  // ── Build lookup maps from testSummaries ──────────────────────────────────

  type GradeEntry = {
    effectiveGrade: number;
    rawValue: number | null;
    /** Teacher's explicit override from the latest session. null = auto-calculated (never overridden or cleared). */
    gradeOverride: number | null;
  };

  const gradesByTestType = useMemo<Map<string, Map<string, GradeEntry>>>(() => {
    const outer = new Map<string, Map<string, GradeEntry>>();
    for (const ts of testSummaries) {
      const inner = new Map<string, GradeEntry>();
      for (const sg of ts.studentGrades) {
        inner.set(sg.studentId, {
          effectiveGrade: sg.effectiveGrade,
          rawValue: sg.rawValue,
          gradeOverride: sg.gradeOverride,
        });
      }
      outer.set(ts.testTypeId, inner);
    }
    return outer;
  }, [testSummaries]);

  /** Test type columns where at least one student already has a result. */
  const columnsWithData = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const ts of testSummaries) {
      if (ts.studentGrades.length > 0) s.add(ts.testTypeId);
    }
    return s;
  }, [testSummaries]);

  // ── Per-cell state ────────────────────────────────────────────────────────

  /** Optimistic local overrides keyed by cellKey. null = teacher explicitly cleared (no override). */
  const [localGrades, setLocalGrades] = useState<Map<string, number | null>>(new Map());
  const [savingCells, setSavingCells]  = useState<Set<string>>(new Set());
  const [savedCells, setSavedCells]    = useState<Set<string>>(new Set());
  const [errorCells, setErrorCells]    = useState<Map<string, string>>(new Map());

  /** Key of the cell currently open for inline editing (null = none). */
  const [editingCell, setEditingCell]  = useState<string | null>(null);
  const [editValue, setEditValue]      = useState('');
  const inputRef                       = useRef<HTMLInputElement>(null);

  /** Whether bulk-selection mode is active. */
  const [bulkMode, setBulkMode]        = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue]      = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);

  const debounceRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Focus the inline input whenever the editing cell changes
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const hasResult = useCallback(
    (studentId: string, testTypeId: string): boolean =>
      gradesByTestType.get(testTypeId)?.has(studentId) ?? false,
    [gradesByTestType],
  );

  /**
   * Returns the value to show in the cell:
   * - Local optimistic state wins if present.
   * - Otherwise: teacher's gradeOverride if set, else the auto-calculated effectiveGrade.
   * Returns null when the teacher explicitly cleared the override (locally or via server).
   */
  const getDisplayGrade = useCallback(
    (studentId: string, testTypeId: string): number | null => {
      const key = cellKey(studentId, testTypeId);
      if (localGrades.has(key)) return localGrades.get(key) ?? null;
      const entry = gradesByTestType.get(testTypeId)?.get(studentId);
      if (!entry) return null;
      // gradeOverride is the teacher's last explicit value; null means only calculated grade exists
      return entry.gradeOverride ?? entry.effectiveGrade;
    },
    [localGrades, gradesByTestType],
  );

  /**
   * True when the teacher has an active explicit override on this cell (not cleared, not auto-only).
   * Controls bold vs. light-grey rendering.
   */
  const hasTeacherOverride = useCallback(
    (studentId: string, testTypeId: string): boolean => {
      const key = cellKey(studentId, testTypeId);
      if (localGrades.has(key)) return localGrades.get(key) !== null;
      return (gradesByTestType.get(testTypeId)?.get(studentId)?.gradeOverride ?? null) !== null;
    },
    [localGrades, gradesByTestType],
  );

  /**
   * True when the column has data from other students but THIS student has no TestResult at all.
   * This is the only case that shows the red "חסר" badge.
   * A cleared override (gradeOverride = null) still has a calculatedGrade, so it is NOT missing.
   */
  const isMissing = useCallback(
    (studentId: string, testTypeId: string): boolean =>
      columnsWithData.has(testTypeId) && !hasResult(studentId, testTypeId),
    [columnsWithData, hasResult],
  );

  // ── Core save ─────────────────────────────────────────────────────────────

  const commitSave = useCallback(
    async (studentId: string, testTypeId: string, grade: number | null): Promise<void> => {
      const key = cellKey(studentId, testTypeId);

      const timer = debounceRefs.current.get(key);
      if (timer) {
        clearTimeout(timer);
        debounceRefs.current.delete(key);
      }

      // Snapshot the previous local value so we can revert to it on failure.
      // Must be read before any state mutation below.
      const prevLocal = localGrades.get(key);
      const hadPrevLocal = localGrades.has(key);

      setSavingCells((prev) => { const n = new Set(prev); n.add(key); return n; });
      setErrorCells((prev) => { const n = new Map(prev); n.delete(key); return n; });

      try {
        await apiRequest(
          `/classes/${classId}/students/${studentId}/grade-override`,
          {
            method: 'PATCH',
            body: JSON.stringify({ testTypeId, gradeOverride: grade }),
          },
        );
        setLocalGrades((prev) => { const n = new Map(prev); n.set(key, grade); return n; });
        setSavedCells((prev) => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(() => {
          setSavedCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
        }, 1800);
        onRefresh();
      } catch {
        setErrorCells((prev) => { const n = new Map(prev); n.set(key, 'שגיאה בשמירה'); return n; });
        // Revert to the exact previous local state (not just "delete key"), so the
        // cell shows what was there before the failed save attempt.
        setLocalGrades((prev) => {
          const n = new Map(prev);
          if (hadPrevLocal) {
            n.set(key, prevLocal ?? null);
          } else {
            n.delete(key);
          }
          return n;
        });
      } finally {
        setSavingCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
      }
    },
    [classId, localGrades, onRefresh],
  );

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleCellClick = useCallback(
    (studentId: string, testTypeId: string): void => {
      if (!hasResult(studentId, testTypeId)) return;

      if (bulkMode) {
        const key = cellKey(studentId, testTypeId);
        setSelectedCells((prev) => {
          const n = new Set(prev);
          if (n.has(key)) n.delete(key); else n.add(key);
          return n;
        });
        return;
      }

      const key = cellKey(studentId, testTypeId);
      setEditingCell(key);
      setEditValue(String(getDisplayGrade(studentId, testTypeId) ?? ''));
    },
    [bulkMode, hasResult, getDisplayGrade],
  );

  const handleEditChange = useCallback(
    (value: string): void => {
      setEditValue(value);
      if (!editingCell) return;
      const [studentId, testTypeId] = parseCellKey(editingCell);

      const key = editingCell;
      const existing = debounceRefs.current.get(key);
      if (existing) clearTimeout(existing);

      // Empty string → debounce a null save (clear override)
      if (value === '') {
        debounceRefs.current.set(
          key,
          setTimeout(() => { void commitSave(studentId, testTypeId, null); }, 800),
        );
        return;
      }

      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0 || num > 100) return;
      debounceRefs.current.set(
        key,
        setTimeout(() => { void commitSave(studentId, testTypeId, num); }, 800),
      );
    },
    [editingCell, commitSave],
  );

  const handleEditCommit = useCallback((): void => {
    if (!editingCell) return;
    const [studentId, testTypeId] = parseCellKey(editingCell);
    if (editValue === '') {
      // Empty input on commit → clear the override (null)
      void commitSave(studentId, testTypeId, null);
    } else {
      const num = parseInt(editValue, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        void commitSave(studentId, testTypeId, num);
      }
    }
    setEditingCell(null);
  }, [editingCell, editValue, commitSave]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') { e.preventDefault(); handleEditCommit(); }
      else if (e.key === 'Escape') { setEditingCell(null); }
    },
    [handleEditCommit],
  );

  const toggleBulkMode = useCallback((): void => {
    setBulkMode((prev) => {
      if (prev) { setSelectedCells(new Set()); setBulkValue(''); }
      return !prev;
    });
  }, []);

  const applyBulkValue = useCallback(async (): Promise<void> => {
    const num = parseInt(bulkValue, 10);
    if (isNaN(num) || num < 0 || num > 100) return;
    setBulkApplying(true);
    try {
      await Promise.allSettled(
        Array.from(selectedCells).map((key) => {
          const [studentId, testTypeId] = parseCellKey(key);
          return commitSave(studentId, testTypeId, num);
        }),
      );
      setSelectedCells(new Set());
      setBulkValue('');
      setBulkMode(false);
    } finally {
      setBulkApplying(false);
    }
  }, [bulkValue, selectedCells, commitSave]);

  // ── Derived: fitness average per student ─────────────────────────────────

  const studentFitnessAvg = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const student of students) {
      const grades: number[] = [];
      for (const ts of testSummaries) {
        const key = cellKey(student.id, ts.testTypeId);
        let g: number | null;
        if (localGrades.has(key)) {
          g = localGrades.get(key) ?? null;
        } else {
          const entry = gradesByTestType.get(ts.testTypeId)?.get(student.id);
          // Average uses effectiveGrade (calculatedGrade + overrides combined)
          g = entry?.effectiveGrade ?? null;
        }
        if (g !== null && g > 0) grades.push(g);
      }
      if (grades.length > 0) {
        map.set(student.id, Math.round(grades.reduce((s, g) => s + g, 0) / grades.length));
      }
    }
    return map;
  }, [students, testSummaries, localGrades, gradesByTestType]);

  // ── Derived: completion stats ─────────────────────────────────────────────

  const completedCount = useMemo(
    () =>
      students.filter((s) =>
        testSummaries.every((ts) => hasResult(s.id, ts.testTypeId)),
      ).length,
    [students, testSummaries, hasResult],
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  if (testSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
          <BarChart2 className="h-6 w-6 text-indigo-400" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">אין נתוני מבחנים עדיין</p>
          <p className="mt-1 text-sm text-slate-400">צור מפגש בחינה כדי לראות את המטריצה</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-4">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">

        {/* Completion stats */}
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{completedCount}</span>
          {' '}מתוך{' '}
          <span className="font-semibold text-slate-700">{students.length}</span>
          {' '}תלמידים השלימו את כל המבחנים
        </p>

        {/* Legend + bulk toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-[11px] md:flex">
            {([
              ['bg-emerald-400', 'מצטיין 90+'],
              ['bg-blue-400',    'טוב 75–89'],
              ['bg-amber-400',   'עובר 60–74'],
              ['bg-red-400',     'מתחת לנורמה'],
            ] as const).map(([color, label]) => (
              <div key={label} className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', color)} />
                <span className="text-slate-500">{label}</span>
              </div>
            ))}
          </div>

          <motion.button
            type="button"
            onClick={toggleBulkMode}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all',
              bulkMode
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {bulkMode
              ? <CheckSquare className="h-4 w-4" aria-hidden="true" />
              : <Square className="h-4 w-4" aria-hidden="true" />
            }
            סמן כמה במקביל
          </motion.button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.07)]"
      >
        <table
          className="min-w-full border-collapse text-sm"
          dir="rtl"
          aria-label="מטריצת ציוני תלמידים"
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <thead>
            <tr className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/60">

              {/* Sticky name column header */}
              <th
                scope="col"
                className="sticky end-0 z-20 min-w-[172px] border-e border-slate-200/80 bg-slate-50/95 px-4 py-3.5 text-start text-[11px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-sm"
              >
                שם תלמיד
              </th>

              {/* Per-test headers */}
              {testSummaries.map((ts) => (
                <th
                  key={ts.testTypeId}
                  scope="col"
                  className="min-w-[100px] px-3 py-3 text-center text-[11px] uppercase tracking-wide text-slate-500"
                >
                  <div className="font-bold text-slate-700">{ts.nameHe}</div>
                  {ts.unit && (
                    <div className="mt-0.5 font-normal text-slate-400">{ts.unit}</div>
                  )}
                </th>
              ))}

              {/* Fitness avg header */}
              <th
                scope="col"
                className="min-w-[90px] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-600"
              >
                ממוצע כושר
              </th>
            </tr>
          </thead>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-slate-50">
            {students.map((student, idx) => {
              const finalGrade = studentFitnessAvg.get(student.id) ?? null;
              const tint       = AVATAR_TINTS[idx % AVATAR_TINTS.length]!;
              const initials   = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;

              return (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.025, 0.5) }}
                  className="group transition-colors hover:bg-indigo-50/20"
                >
                  {/* ── Sticky name cell ───────────────────────────────────── */}
                  <td className="sticky end-0 z-10 border-e border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-sm">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                          tint,
                        )}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold leading-tight text-slate-800">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-[10px] text-slate-400">{student.studentCode}</div>
                      </div>
                    </div>
                  </td>

                  {/* ── Grade cells ────────────────────────────────────────── */}
                  {testSummaries.map((ts) => {
                    const key          = cellKey(student.id, ts.testTypeId);
                    const gradeExists  = hasResult(student.id, ts.testTypeId);
                    const grade        = getDisplayGrade(student.id, ts.testTypeId);
                    const isOverridden = hasTeacherOverride(student.id, ts.testTypeId);
                    const missing      = isMissing(student.id, ts.testTypeId);
                    const isEditing    = editingCell === key;
                    const isSaving     = savingCells.has(key);
                    const isSaved      = savedCells.has(key);
                    const isSelected   = selectedCells.has(key);
                    const hasErr       = errorCells.has(key);

                    return (
                      <td
                        key={ts.testTypeId}
                        onClick={() => { handleCellClick(student.id, ts.testTypeId); }}
                        className={cn(
                          'relative px-2 py-2 text-center transition-all duration-150',
                          gradeExists ? 'cursor-pointer' : 'cursor-default',
                          // Editing ring — highest priority visual
                          isEditing && 'ring-2 ring-indigo-400 ring-inset bg-white',
                          // Bulk selection ring
                          isSelected && !isEditing && 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/70',
                          // Save-success flash
                          isSaved && !isEditing && 'bg-emerald-50',
                          // Error state
                          hasErr && !isEditing && 'bg-red-50/80',
                          // Missing data highlight (no TestResult at all)
                          missing && !isEditing && !isSaved && !hasErr && 'bg-red-50/50',
                          // Color-coded background only when teacher has an explicit override
                          !isEditing && !isSaved && !hasErr && !missing && isOverridden && grade !== null && grade > 0
                            && gradeCellClasses(grade, effectivePassingGrade),
                        )}
                        aria-label={
                          gradeExists
                            ? `ציון ${ts.nameHe} של ${student.firstName} ${student.lastName}: ${grade ?? 'אין'}`
                            : undefined
                        }
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="number"
                            min={0}
                            max={100}
                            value={editValue}
                            onChange={(e) => { handleEditChange(e.target.value); }}
                            onKeyDown={handleEditKeyDown}
                            onBlur={handleEditCommit}
                            className="w-14 rounded border-0 bg-transparent text-center text-sm font-bold text-indigo-700 outline-none"
                            aria-label={`עריכת ציון ${ts.nameHe} של ${student.firstName} ${student.lastName}`}
                          />
                        ) : (
                          <div className="flex items-center justify-center gap-0.5">
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />
                            ) : isSaved ? (
                              <>
                                <span className="font-bold tabular-nums text-emerald-700">{grade ?? '—'}</span>
                                <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                              </>
                            ) : hasErr ? (
                              <span className="text-[10px] font-medium text-red-500">שגיאה</span>
                            ) : missing ? (
                              <span className="text-[11px] font-medium text-red-300">חסר</span>
                            ) : grade !== null && grade > 0 ? (
                              <>
                                {/* Bold if teacher overrode; light grey if only auto-calculated */}
                                <span className={cn(
                                  'tabular-nums',
                                  isOverridden ? 'font-bold' : 'font-normal text-slate-400',
                                )}>
                                  {grade}
                                </span>
                                {gradeExists && (
                                  <Pencil
                                    className="h-2.5 w-2.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-50"
                                    aria-hidden="true"
                                  />
                                )}
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>
                        )}

                        {/* Bulk selection dot indicator */}
                        {isSelected && (
                          <span
                            className="absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-indigo-500"
                            aria-hidden="true"
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* ── Fitness avg cell ────────────────────────────────────── */}
                  <td
                    className={cn(
                      'px-3 py-2 text-center font-bold tabular-nums',
                      finalGrade !== null ? gradeCellClasses(finalGrade, effectivePassingGrade) : 'text-slate-300',
                    )}
                  >
                    {finalGrade !== null ? finalGrade : '—'}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      {/* ── Bulk mode floating panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {bulkMode && selectedCells.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="fixed inset-x-0 bottom-6 z-50 flex justify-center"
            aria-live="polite"
            aria-label="כלי החלת ערך על תאים נבחרים"
          >
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-xl">

              {/* Count label */}
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-white">
                  {selectedCells.size} תאים נבחרו
                </span>
              </div>

              <div className="h-4 w-px bg-white/20" aria-hidden="true" />

              {/* Grade input */}
              <input
                type="number"
                min={0}
                max={100}
                value={bulkValue}
                onChange={(e) => { setBulkValue(e.target.value); }}
                placeholder="0–100"
                className="w-20 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center text-sm font-bold text-white placeholder-white/30 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                aria-label="ציון להחלה על תאים נבחרים"
                onKeyDown={(e) => { if (e.key === 'Enter') { void applyBulkValue(); } }}
              />

              {/* Apply */}
              <motion.button
                type="button"
                onClick={() => { void applyBulkValue(); }}
                disabled={bulkApplying || bulkValue === ''}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
              >
                {bulkApplying
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : <Check className="h-3.5 w-3.5" aria-hidden="true" />
                }
                החל
              </motion.button>

              {/* Clear selection */}
              <button
                type="button"
                onClick={() => { setSelectedCells(new Set()); }}
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:text-white"
                aria-label="נקה בחירה"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
