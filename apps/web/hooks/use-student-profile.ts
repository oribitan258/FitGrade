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
 * Pauses automatically when either classId or studentId is falsy.
 */
export function useStudentProfile(
  classId: string,
  studentId: string,
): ReturnType<typeof useSWR<StudentProfile>> {
  return useSWR<StudentProfile>(
    classId && studentId
      ? `/classes/${classId}/students/${studentId}/profile`
      : null,
    apiFetcher,
  );
}
