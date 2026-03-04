import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ClassData } from '@fitgrade/types';

export function useClasses() {
  return useQuery<ClassData[], Error>({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassData[]>('/classes'),
  });
}
