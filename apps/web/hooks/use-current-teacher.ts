/**
 * SWR hook for the authenticated teacher's profile.
 * GET /auth/me — returns { id, name, school, email, avatarUrl }.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

export interface TeacherProfile {
  id: string;
  email: string;
  name: string;
  school: string | null;
  avatarUrl: string | null;
  isOnboardingComplete: boolean;
  defaultMaleTestIds: string[];
  defaultFemaleTestIds: string[];
}

function fetcher(path: string): Promise<TeacherProfile> {
  return apiRequest<TeacherProfile>(path);
}

export function useCurrentTeacher(enabled = true): {
  teacher: TeacherProfile | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useSWR<TeacherProfile>(
    enabled ? '/auth/me' : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  return { teacher: data, isLoading, error };
}
