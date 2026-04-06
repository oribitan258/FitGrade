/**
 * SWR hook + mutation helpers for the teacher's global grading policy.
 * GET  /settings/grading-policy → { fitnessWeight, conductWeight }
 * PATCH /settings/grading-policy
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

export interface GradingPolicy {
  fitnessWeight: number;
  conductWeight: number;
}

export function useGradingPolicy(): ReturnType<typeof useSWR<GradingPolicy>> {
  return useSWR<GradingPolicy>(
    '/settings/grading-policy',
    (path: string) => apiRequest<GradingPolicy>(path),
    { revalidateOnFocus: false },
  );
}

export async function updateGradingPolicy(policy: GradingPolicy): Promise<GradingPolicy> {
  return apiRequest<GradingPolicy>('/settings/grading-policy', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
}

export async function updateClassGradingPolicy(
  classId: string,
  testWeight: number | null,
  talmidautWeight: number | null,
): Promise<void> {
  await apiRequest(`/classes/${classId}/grading-policy`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testWeight, talmidautWeight }),
  });
}
