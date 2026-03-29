/**
 * SWR hooks for the Reports Center.
 * Fetches GET /reports/class/:classId — per-student final grade report rows.
 * Fetches GET /reports/comments-bank — Ministry of Education verbal comments.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { ReportRow } from '@fitgrade/types';

type ClassReportKey = readonly [tag: '/class-report', classId: string, semester: string | null];

/**
 * Fetches all report rows for a class, scoped to the given semester.
 * Pass `undefined` for semester to get all-year data.
 * Pauses when classId is falsy.
 */
export function useClassReport(classId: string, semester?: string): ReturnType<typeof useSWR<ReportRow[]>> {
  const key: ClassReportKey | null = classId
    ? ['/class-report', classId, semester ?? null]
    : null;

  return useSWR<ReportRow[]>(
    key,
    ([, cId, sem]: ClassReportKey) => {
      const semParam = sem ? `?semester=${sem}` : '';
      return apiRequest<ReportRow[]>(`/reports/class/${cId}${semParam}`);
    },
    { revalidateOnFocus: false },
  );
}

/** Fetches the Ministry of Education verbal comments bank. Data is stable — mounts once. */
export function useCommentsBank(): ReturnType<typeof useSWR<string[]>> {
  return useSWR<string[]>('/reports/comments-bank', (path: string) => apiRequest<string[]>(path), {
    revalidateOnFocus: false,
    revalidateOnMount: true,
    dedupingInterval: 60_000,
  });
}
