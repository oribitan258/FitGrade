'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

/**
 * Returns a stable `invalidateDashboard` callback that marks every
 * `/dashboard/...` SWR key as stale in the global cache.
 *
 * Mounted consumers refetch immediately; unmounted ones refetch on their
 * next mount. Covers all endpoint variants regardless of semester or
 * testTypeId query params because the filter matches by prefix.
 *
 * Call after any mutation that can change leaderboard / carousel data:
 *   POST   /sessions/:id/results        (result saved)
 *   DELETE /sessions/:id/results/:id    (result deleted / overwritten)
 *   PATCH  /sessions/:id/complete       (session finalised)
 */
export function useDashboardInvalidate(): () => void {
  const { mutate } = useSWRConfig();

  return useCallback((): void => {
    void mutate(
      (key: unknown): boolean =>
        typeof key === 'string' && key.startsWith('/dashboard/'),
      undefined,
      { revalidate: true },
    );
  }, [mutate]);
}
