'use client';

/**
 * SWR hook for the paginated session history list.
 * Fetches GET /classes/:classId/sessions — returns rows + total from X-Total-Count header.
 *
 * Uses a custom fetcher (not apiRequest) so it can read the X-Total-Count response header
 * alongside the JSON body. Auth token is sourced from the same in-memory store as apiRequest.
 */
import useSWR from 'swr';
import { ApiError } from '@fitgrade/types';
import { getToken } from '@/lib/api-client';
import type { SessionHistoryRow } from '@fitgrade/types';

const API_BASE: string = process.env['API_URL'] ?? 'http://localhost:3001/api';

export interface SessionPage {
  rows: SessionHistoryRow[];
  total: number;
}

async function fetchSessionHistory(path: string): Promise<SessionPage> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new ApiError(
      response.status,
      body.message ?? 'שגיאה בשרת',
      body.error ?? 'Error',
    );
  }

  const rows = (await response.json()) as SessionHistoryRow[];
  const total = parseInt(response.headers.get('X-Total-Count') ?? '0', 10);
  return { rows, total };
}

/**
 * Returns paginated session history for a class.
 * SWR key includes pagination params so each page is cached independently.
 * Pauses automatically when classId is falsy.
 */
export function useClassSessions(
  classId: string,
  take = 50,
  skip = 0,
): ReturnType<typeof useSWR<SessionPage>> {
  return useSWR<SessionPage>(
    classId ? `/classes/${classId}/sessions?take=${take}&skip=${skip}` : null,
    fetchSessionHistory,
    { revalidateOnFocus: false },
  );
}
