import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TestSummaryForGrade {
  studentGrades: Array<{ studentId: string; effectiveGrade: number }>;
}

/** Averages effectiveGrade across all test types per student. Grades of 0 are excluded. */
export function computeGeneralGradesMap(testSummaries: TestSummaryForGrade[]): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const ts of testSummaries) {
    for (const sg of ts.studentGrades) {
      if (sg.effectiveGrade > 0) {
        const acc = totals.get(sg.studentId) ?? { sum: 0, count: 0 };
        acc.sum += sg.effectiveGrade;
        acc.count += 1;
        totals.set(sg.studentId, acc);
      }
    }
  }
  const map = new Map<string, number>();
  for (const [sid, { sum, count }] of totals) {
    map.set(sid, Math.round(sum / count));
  }
  return map;
}

/**
 * Merges Tailwind CSS class names, resolving conflicts correctly.
 * Required by shadcn/ui components (added in a later phase).
 *
 * Usage: cn('base-class', condition && 'conditional-class', 'override-class')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a raw fitness-test value for display, based on the test's input type.
 *
 * TIME    → "M:SS"         (e.g. 445 → "7:25")
 * REPS    → integer string (e.g. 33  → "33")
 * GENERAL → one decimal   (e.g. 8.5 → "8.5")
 * PASS_FAIL → null (no raw value to show)
 */
export function formatRawValue(rawValue: number, inputType: string): string | null {
  if (inputType === 'PASS_FAIL') return null;
  if (inputType === 'TIME') {
    const totalSeconds = Math.round(rawValue);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (inputType === 'REPS') return String(Math.round(rawValue));
  return rawValue.toFixed(1);
}
