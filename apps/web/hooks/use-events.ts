import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import type { EventData } from '@fitgrade/types';

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

/** Fetches all events for the authenticated teacher, ordered by date. */
export function useEvents(): ReturnType<typeof useSWR<EventData[]>> {
  return useSWR<EventData[]>('/events', apiFetcher);
}

/** Fetches only the next upcoming event (eventDate ≥ now), or null if none. */
export function useUpcomingEvent(): ReturnType<typeof useSWR<EventData | null>> {
  return useSWR<EventData | null>('/events/upcoming', apiFetcher, {
    revalidateOnFocus: false,
  });
}
