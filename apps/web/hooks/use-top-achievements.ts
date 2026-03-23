/**
 * SWR hook for the top individual test achievements leaderboard.
 * GET /dashboard/top-achievements — top 10, one best result per student.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { TopAchievementItem } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function useTopAchievements(): {
  achievements: TopAchievementItem[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<TopAchievementItem[]>(
    '/dashboard/top-achievements',
    apiFetcher,
    { revalidateOnFocus: false },
  );
  return { achievements: data, isLoading, error };
}
