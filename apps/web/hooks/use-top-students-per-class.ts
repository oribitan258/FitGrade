/**
 * SWR hook for top 3 students per class.
 * GET /dashboard/top-per-class — rank 1/2/3 per class by average score.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopStudentPerClassItem } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function useTopStudentsPerClass(): {
  students: TopStudentPerClassItem[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<TopStudentPerClassItem[]>(
    '/dashboard/top-per-class',
    apiFetcher,
    { revalidateOnFocus: false },
  );
  return { students: data, isLoading, error };
}
