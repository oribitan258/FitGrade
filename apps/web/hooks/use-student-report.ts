/**
 * SWR hook for the formal student report resource.
 * Fetches GET /classes/:classId/students/:studentId/report
 *
 * Uses an array key so that every dependency (classId, studentId, semester) is
 * an explicit cache-key element. When the sidebar switches semester, semesterFilter
 * changes → this key changes → SWR immediately fetches fresh data for the new semester.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { StudentReport } from '@fitgrade/types';

type ReportKey = readonly [tag: '/student-report', classId: string, studentId: string, semester: string | null];

/**
 * Fetches the formal report for a single student within a class.
 * When `semester` is provided the results are scoped to that semester only.
 * Pauses automatically when either classId or studentId is falsy.
 */
export function useStudentReport(
  classId: string,
  studentId: string,
  semester?: string,
): ReturnType<typeof useSWR<StudentReport>> {
  const key: ReportKey | null =
    classId && studentId
      ? ['/student-report', classId, studentId, semester ?? null]
      : null;

  return useSWR<StudentReport>(
    key,
    ([, cId, sId, sem]: ReportKey) => {
      const semParam = sem ? `?semester=${sem}` : '';
      return apiRequest<StudentReport>(`/classes/${cId}/students/${sId}/report${semParam}`);
    },
    { revalidateOnFocus: false },
  );
}
