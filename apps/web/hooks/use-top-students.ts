/**
 * SWR hooks for the top-performing students leaderboard.
 * GET /dashboard/top-students — overall ranking.
 * GET /dashboard/top-students?testTypeId=xxx — ranking for a specific test.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopStudentItem } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Overall top students across all test types. */
export function useTopStudents(): ReturnType<typeof useSWR<TopStudentItem[]>> {
  return useSWR<TopStudentItem[]>('/dashboard/top-students', apiFetcher, {
    revalidateOnFocus: false,
  });
}

/** Top students for a specific test type. Pauses when testTypeId is falsy. */
export function useTopStudentsByTest(testTypeId: string | null): ReturnType<typeof useSWR<TopStudentItem[]>> {
  return useSWR<TopStudentItem[]>(
    testTypeId ? `/dashboard/top-students?testTypeId=${testTypeId}` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );
}
