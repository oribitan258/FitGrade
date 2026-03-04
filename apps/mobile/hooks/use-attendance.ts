import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export function useAttendance(classId: string, date: string) {
  return useQuery<AttendanceRecord[], Error>({
    queryKey: ['attendance', classId, date],
    queryFn: () =>
      api.get<AttendanceRecord[]>(`/classes/${classId}/attendance?date=${date}`),
    enabled: classId.length > 0,
  });
}

interface BulkAttendancePayload {
  date: string;
  records: Array<{ studentId: string; status: AttendanceStatus }>;
}

export function useSaveAttendance(classId: string) {
  const queryClient = useQueryClient();
  return useMutation<AttendanceRecord[], Error, BulkAttendancePayload>({
    mutationFn: (payload) =>
      api.post<AttendanceRecord[]>(`/classes/${classId}/attendance`, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['attendance', classId, variables.date],
      });
    },
  });
}
