/**
 * SWR hook for the live test session resource.
 * Fetches GET /sessions/:sessionId — returns session metadata, enrolled students,
 * and all results recorded so far.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { SessionDetail } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/**
 * Returns the full live-session detail.
 * Pauses automatically when sessionId is falsy.
 *
 * @param sessionId - The TestSession ID from the URL param
 * @param revalidateOnFocus - Disable in the live session page to prevent
 *   race conditions with optimistic updates (default: true)
 */
export function useTestSession(
  sessionId: string,
  revalidateOnFocus = false,
): ReturnType<typeof useSWR<SessionDetail>> {
  return useSWR<SessionDetail>(
    sessionId ? `/sessions/${sessionId}` : null,
    apiFetcher,
    { revalidateOnFocus },
  );
}
