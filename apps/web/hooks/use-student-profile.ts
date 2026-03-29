/**
 * SWR hook for the student profile resource.
 * Fetches GET /classes/:classId/students/:studentId/profile
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { StudentProfile } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/**
 * Fetches the full profile for a single student within a class.
 * When `semester` is provided the results are scoped to that semester only.
 * When omitted the API returns data for all semesters (used by the student dashboard).
 * Pauses automatically when either classId or studentId is falsy.
 */
export function useStudentProfile(
  classId: string,
  studentId: string,
  semester?: string,
): ReturnType<typeof useSWR<StudentProfile>> {
  const path =
    classId && studentId
      ? `/classes/${classId}/students/${studentId}/profile${semester ? `?semester=${semester}` : ''}`
      : null;
  return useSWR<StudentProfile>(path, apiFetcher);
}
