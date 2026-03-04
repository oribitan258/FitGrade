/**
 * SWR hooks for the student self-service portal.
 * Both hooks call the student-scoped endpoints that enforce ownership
 * via the JWT (jwtPayload.sub === studentId).
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

// ─── API response shapes ──────────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface StudentAttendanceRecord {
  date: string;
  status: AttendanceStatus;
}

export interface StudentAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  records: StudentAttendanceRecord[];
}

export interface StudentResult {
  id: string;
  sessionDate: string;
  testNameHe: string;
  rawValue: number;
  /** gradeOverride ?? calculatedGrade — pass through getHebrewGradeLabel() before rendering. */
  effectiveGrade: number;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyAttendance(): ReturnType<
  typeof useSWR<StudentAttendanceSummary>
> {
  return useSWR<StudentAttendanceSummary>('/students/me/attendance', apiFetcher);
}

export function useMyResults(): ReturnType<typeof useSWR<StudentResult[]>> {
  return useSWR<StudentResult[]>('/students/me/results', apiFetcher);
}
