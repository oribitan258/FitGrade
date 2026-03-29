/**
 * SWR hooks for the top-performing students leaderboard.
 * GET /dashboard/top-students?semester= — overall ranking.
 * GET /dashboard/top-students?semester=&testTypeId=xxx — ranking for a specific test.
 *
 * Both hooks encode `semester` in the SWR key so A and B are cached
 * independently — switching semester is instant on the second visit.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopStudentItem, Semester } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Overall top students across all test types for the given semester. */
export function useTopStudents(semester: Semester): ReturnType<typeof useSWR<TopStudentItem[]>> {
  return useSWR<TopStudentItem[]>(
    `/dashboard/top-students?semester=${semester}`,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}

/**
 * Top students for a specific test type and semester.
 * Pauses when testTypeId is falsy.
 */
export function useTopStudentsByTest(
  testTypeId: string | null,
  semester: Semester,
): ReturnType<typeof useSWR<TopStudentItem[]>> {
  return useSWR<TopStudentItem[]>(
    testTypeId ? `/dashboard/top-students?testTypeId=${testTypeId}&semester=${semester}` : null,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}
