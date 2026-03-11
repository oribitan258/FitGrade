/**
 * SWR hooks for the Reports Center.
 * Fetches GET /reports/class/:classId — per-student final grade report rows.
 * Fetches GET /reports/comments-bank — Ministry of Education verbal comments.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { ReportRow } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Fetches all report rows for a class. Pauses when classId is falsy. */
export function useClassReport(classId: string): ReturnType<typeof useSWR<ReportRow[]>> {
  return useSWR<ReportRow[]>(
    classId ? `/reports/class/${classId}` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );
}

/** Fetches the Ministry of Education verbal comments bank. Data is stable — mounts once. */
export function useCommentsBank(): ReturnType<typeof useSWR<string[]>> {
  return useSWR<string[]>('/reports/comments-bank', apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnMount: true,
    dedupingInterval: 60_000,
  });
}
