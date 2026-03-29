import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { DashboardStats, Semester } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/**
 * Fetches aggregated dashboard stats for the authenticated teacher.
 * The `semester` parameter is encoded in the SWR key so A and B are cached
 * independently — switching semester is instant on the second visit.
 */
export function useDashboardStats(semester: Semester): ReturnType<typeof useSWR<DashboardStats>> {
  return useSWR<DashboardStats>(`/dashboard/stats?semester=${semester}`, apiFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000, // 30s — stat aggregation is expensive; data is not real-time
    keepPreviousData: true,   // old semester data stays visible while new semester loads
  });
}
