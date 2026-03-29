/**
 * SWR hook for the top individual test achievements leaderboard.
 * GET /dashboard/top-achievements?semester= — top 10, one best result per student.
 * The `semester` parameter is encoded in the SWR key so A and B are cached
 * independently — switching semester is instant on the second visit.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopAchievementItem, Semester } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function useTopAchievements(semester: Semester): {
  achievements: TopAchievementItem[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<TopAchievementItem[]>(
    `/dashboard/top-achievements?semester=${semester}`,
    apiFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  return { achievements: data, isLoading, error };
}
