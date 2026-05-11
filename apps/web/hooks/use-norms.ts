/**
 * SWR hook for Ministry of Education norm tables.
 * Fetches GET /tests/types/norms?testTypeId=xxx — returns all NormTable bands
 * for a specific test type. The caller filters by gender + age group client-side.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

export interface NormBand {
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  gradeLevel: number;
  score: number;
  /** Lower bound of the raw-value band (inclusive). */
  minValue: number;
  /** Upper bound of the raw-value band (exclusive). */
  maxValue: number;
}

export interface TestTypeNorms {
  testTypeId: string;
  nameHe: string;
  unit: string | null;
  inputType: 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL';
  /** True for distance/reps (higher = better); false for time (lower = better). */
  higherIsBetter: boolean;
  bands: NormBand[];
}

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/**
 * Returns all NormTable bands for the given test type.
 * Pauses when testTypeId is falsy.
 */
export function useTestTypeNorms(
  testTypeId: string | null,
): ReturnType<typeof useSWR<TestTypeNorms>> {
  return useSWR<TestTypeNorms>(
    testTypeId ? `/tests/types/norms?testTypeId=${testTypeId}` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );
}
