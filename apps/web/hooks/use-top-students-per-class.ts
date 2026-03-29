/**
 * SWR hook for top 3 students per class.
 * GET /dashboard/top-per-class?semester= — rank 1/2/3 per class by average score.
 * The `semester` parameter is encoded in the SWR key so A and B are cached
 * independently — switching semester is instant on the second visit.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopStudentPerClassItem, Semester } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function useTopStudentsPerClass(semester: Semester): {
  students: TopStudentPerClassItem[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<TopStudentPerClassItem[]>(
    `/dashboard/top-per-class?semester=${semester}`,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  return { students: data, isLoading, error };
}
