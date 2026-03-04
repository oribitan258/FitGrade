import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface TestSession {
  id: string;
  classId: string;
  testTypeId: string;
  conductedAt: string;
  isStopwatch: boolean;
  startedAt: string | null;
}

export interface TestResult {
  id: string;
  sessionId: string;
  studentId: string;
  rawValue: number;
  calculatedGrade: number;
  gradeOverride: number | null;
}

export function useCreateSession(classId: string) {
  return useMutation<
    TestSession,
    Error,
    { testTypeId: string; conductedAt: string; isStopwatch: boolean }
  >({
    mutationFn: (payload) =>
      api.post<TestSession>(`/classes/${classId}/sessions`, payload),
  });
}

/** Submit a single student result — called once per student tap/entry. */
export function useSubmitResult(sessionId: string) {
  return useMutation<TestResult, Error, { studentId: string; rawValue: number }>({
    mutationFn: (payload) =>
      api.post<TestResult>(`/sessions/${sessionId}/results`, payload),
  });
}
