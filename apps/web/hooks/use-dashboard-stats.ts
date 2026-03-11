import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { DashboardStats } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Fetches aggregated dashboard stats for the authenticated teacher. */
export function useDashboardStats(): ReturnType<typeof useSWR<DashboardStats>> {
  return useSWR<DashboardStats>('/dashboard/stats', apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s — stat aggregation is expensive; data is not real-time
  });
}
