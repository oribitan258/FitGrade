/**
 * SWR hooks for classes and students resources.
 * All fetches go through apiRequest so the Bearer token is attached automatically.
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { ClassData, ClassDetails, StudentData } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Fetches the authenticated teacher's class list. */
export function useClasses(): ReturnType<typeof useSWR<ClassData[]>> {
  return useSWR<ClassData[]>('/classes', apiFetcher, {
    revalidateOnFocus: false,
  });
}

/** Fetches a single class by ID. Pauses when classId is falsy. */
export function useClass(classId: string): ReturnType<typeof useSWR<ClassData>> {
  return useSWR<ClassData>(classId ? `/classes/${classId}` : null, apiFetcher, {
    revalidateOnFocus: false,
  });
}

/** Fetches all students enrolled in a class. Pauses when classId is falsy. */
export function useStudents(classId: string): ReturnType<typeof useSWR<StudentData[]>> {
  return useSWR<StudentData[]>(
    classId ? `/classes/${classId}/students` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );
}

/** Fetches aggregated class details (per-test summaries, attendance %). Pauses when classId is falsy. */
export function useClassDetails(classId: string): ReturnType<typeof useSWR<ClassDetails>> {
  return useSWR<ClassDetails>(
    classId ? `/classes/${classId}/details` : null,
    apiFetcher,
    { revalidateOnFocus: false },
  );
}
