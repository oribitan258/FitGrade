'use client';

/**
 * Mutation hook for the session history feature.
 * Exposes four operations — edit raw value, override grade, delete result, delete session.
 * Each operation calls the API then invalidates all stale SWR keys via cache-invalidation.ts.
 *
 * Callers are responsible for optimistic UI where specified:
 *   - overrideGrade  → YES (client knows effectiveGrade = override ?? calculated)
 *   - deleteResult   → YES (remove from list, rollback on error)
 *   - deleteSession  → YES (remove from list, router.push back, rollback on error)
 *   - editRawValue   → NO  (client cannot predict GradingService output — show inline spinner)
 */
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { apiRequest } from '@/lib/api-client';
import { invalidateAfterMutation } from '@/lib/cache-invalidation';
import type { ResultResponse } from '@fitgrade/types';

export interface OverrideGradePayload {
  gradeOverride: number;
  overrideReason?: string;
}

export interface UseResultMutationsResult {
  /** PATCH /sessions/:sessionId/results/:resultId/raw-value — recalculates grade server-side. */
  editRawValue: (
    resultId: string,
    sessionId: string,
    classId: string,
    rawValue: number,
  ) => Promise<ResultResponse>;
  /** PATCH /sessions/:sessionId/results/:resultId — applies manual grade override. */
  overrideGrade: (
    resultId: string,
    sessionId: string,
    classId: string,
    dto: OverrideGradePayload,
  ) => Promise<ResultResponse>;
  /** DELETE /sessions/:sessionId/results/:resultId/history — no undo window. */
  deleteResult: (
    resultId: string,
    sessionId: string,
    classId: string,
  ) => Promise<void>;
  /** DELETE /sessions/:sessionId — cascades to all results; irreversible. */
  deleteSession: (sessionId: string, classId: string) => Promise<void>;
}

export function useResultMutations(): UseResultMutationsResult {
  const { mutate } = useSWRConfig();

  const editRawValue = useCallback(
    async (
      resultId: string,
      sessionId: string,
      classId: string,
      rawValue: number,
    ): Promise<ResultResponse> => {
      const result = await apiRequest<ResultResponse>(
        `/sessions/${sessionId}/results/${resultId}/raw-value`,
        { method: 'PATCH', body: JSON.stringify({ rawValue }) },
      );
      invalidateAfterMutation(mutate, classId, sessionId);
      return result;
    },
    [mutate],
  );

  const overrideGrade = useCallback(
    async (
      resultId: string,
      sessionId: string,
      classId: string,
      dto: OverrideGradePayload,
    ): Promise<ResultResponse> => {
      const result = await apiRequest<ResultResponse>(
        `/sessions/${sessionId}/results/${resultId}`,
        { method: 'PATCH', body: JSON.stringify(dto) },
      );
      invalidateAfterMutation(mutate, classId, sessionId);
      return result;
    },
    [mutate],
  );

  const deleteResult = useCallback(
    async (resultId: string, sessionId: string, classId: string): Promise<void> => {
      await apiRequest<void>(
        `/sessions/${sessionId}/results/${resultId}/history`,
        { method: 'DELETE' },
      );
      invalidateAfterMutation(mutate, classId, sessionId);
    },
    [mutate],
  );

  const deleteSession = useCallback(
    async (sessionId: string, classId: string): Promise<void> => {
      await apiRequest<void>(`/sessions/${sessionId}`, { method: 'DELETE' });
      invalidateAfterMutation(mutate, classId, sessionId);
    },
    [mutate],
  );

  return { editRawValue, overrideGrade, deleteResult, deleteSession };
}
