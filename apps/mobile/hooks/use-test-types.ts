import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type TestInputType = 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL';

export interface TestType {
  id: string;
  nameHe: string;
  inputType: TestInputType;
  unit: string | null;
  isGlobal: boolean;
}

export function useTestTypes() {
  return useQuery<TestType[], Error>({
    queryKey: ['testTypes'],
    queryFn: () => api.get<TestType[]>('/tests/types'),
  });
}
