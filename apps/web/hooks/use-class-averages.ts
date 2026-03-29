/**
 * useClassAverages — fetches monthly average grades per class from
 * GET /dashboard/class-averages?semester=A|B
 *
 * Returns one row per (month × class). The dashboard chart component
 * pivots these rows into the wide format Recharts expects.
 */
'use client';

import useSWR from 'swr';
import type { Semester } from '@fitgrade/types';
import { apiRequest } from '@/lib/api-client';

export interface MonthlyClassAverage {
  month: string;      // "YYYY-MM"
  classId: string;
  className: string;
  avg: number;        // 0–100
}

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function useClassAverages(semester: Semester): {
  data: MonthlyClassAverage[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<MonthlyClassAverage[]>(
    `/dashboard/class-averages?semester=${semester}`,
    apiFetcher,
    { revalidateOnFocus: false },
  );
  return { data, isLoading, error };
}
