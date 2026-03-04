import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { StudentData } from '@fitgrade/types';

export function useClassStudents(classId: string) {
  return useQuery<StudentData[], Error>({
    queryKey: ['students', classId],
    queryFn: () => api.get<StudentData[]>(`/classes/${classId}/students`),
    enabled: classId.length > 0,
  });
}
