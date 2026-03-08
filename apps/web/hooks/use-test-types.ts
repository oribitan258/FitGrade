/**
 * SWR hook for the fitness test type catalog.
 * Fetches GET /tests/types — returns all system-seeded test types
 * with their Hebrew names, input types, and units.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

export interface TestType {
  id: string;
  nameHe: string;
  descriptionHe: string | null;
  /** Determines the recording mode: TIME → stopwatch, REPS/GENERAL/PASS_FAIL → manual entry */
  inputType: 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL';
  unit: string | null;
  isGlobal: boolean;
}

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Returns the full test type catalog. Data is stable — revalidates only on mount. */
export function useTestTypes(): ReturnType<typeof useSWR<TestType[]>> {
  return useSWR<TestType[]>('/tests/types', apiFetcher, {
    revalidateOnFocus: false,
  });
}
