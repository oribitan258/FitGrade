/**
 * SWR hooks for the semester A vs B comparison engine.
 * Both hooks use keepPreviousData and revalidateOnFocus:false
 * to prevent flickering when the user navigates back to this page.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

// ─── API response types ────────────────────────────────────────────────────

export interface ComparisonAvailabilityDto {
  hasSemesterBData: boolean;
}

export interface StudentComparisonGradeDto {
  studentId: string;
  /** Average effective grade (0–100) across all sessions for this test + semester. */
  effectiveGrade: number;
}

export interface ComparisonGradeDistributionDto {
  excellent: number; // ≥ 90
  good: number;      // 75–89
  pass: number;      // 60–74
  fail: number;      // < 60
}

export interface SemesterTestDataDto {
  classAvg: number;
  distribution: ComparisonGradeDistributionDto;
  studentGrades: StudentComparisonGradeDto[];
}

export interface TestComparisonDto {
  testTypeId: string;
  nameHe: string;
  unit: string | null;
  /** null when the test was never conducted in Semester A. */
  semesterA: SemesterTestDataDto | null;
  /** null when the test has not been conducted in Semester B yet. */
  semesterB: SemesterTestDataDto | null;
  /** null when either semester is missing data for this test. */
  deltaClassAvg: number | null;
}

export interface ClassComparisonResponseDto {
  testComparisons: TestComparisonDto[];
  classAverageA: number | null;
  classAverageB: number | null;
  deltaClassAverage: number | null;
}

// ─── Fetcher ───────────────────────────────────────────────────────────────

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Lightweight check — returns whether Semester B has any test results for the
 * given class. Used to enable/disable the comparison button on the class page.
 * Pauses when classId is falsy.
 */
export function useComparisonAvailability(
  classId: string,
): ReturnType<typeof useSWR<ComparisonAvailabilityDto>> {
  return useSWR<ComparisonAvailabilityDto>(
    classId ? `/classes/${classId}/comparison/availability` : null,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}

/**
 * Fetches the full semester A vs B comparison for a class.
 * Pauses when classId is falsy.
 */
export function useClassComparison(
  classId: string,
): ReturnType<typeof useSWR<ClassComparisonResponseDto>> {
  return useSWR<ClassComparisonResponseDto>(
    classId ? `/classes/${classId}/comparison` : null,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}
