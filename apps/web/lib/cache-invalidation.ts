/**
 * Single source of truth for SWR cache invalidation after history mutations.
 *
 * Pass the `mutate` function from `useSWRConfig()` and the IDs affected by
 * the mutation. All SWR keys that could be stale will be marked for revalidation.
 *
 * Covers:
 *   1. /dashboard/*                        — stat cards and leaderboard
 *   2. /classes/:classId/details*          — semester aggregates
 *   3. /classes/:classId/sessions*         — history list (this feature)
 *   4. /classes/:classId/comparison*       — norm comparison chart
 *   5. /sessions/:sessionId                — live-session detail
 *   6. /classes/:classId/students/:studentId/profile — student profile charts
 *   7. ['/class-report', classId, ...]               — array-keyed report hooks
 *   8. ['/student-report', classId, ...]             — array-keyed student report hooks
 */
export function invalidateAfterMutation(
  mutate: (
    matcher: (key: unknown) => boolean,
    data?: undefined,
    opts?: { revalidate?: boolean },
  ) => unknown,
  classId: string,
  sessionId: string,
): void {
  void mutate(
    (key: unknown): boolean => {
      if (typeof key !== 'string') return false;
      return (
        key.startsWith('/dashboard/') ||
        key.startsWith(`/classes/${classId}/details`) ||
        key.startsWith(`/classes/${classId}/sessions`) ||
        key.startsWith(`/classes/${classId}/comparison`) ||
        key === `/sessions/${sessionId}` ||
        key.startsWith(`/classes/${classId}/students/`)
      );
    },
    undefined,
    { revalidate: true },
  );

  void mutate(
    (key: unknown): boolean =>
      Array.isArray(key) &&
      key.length >= 2 &&
      (key[0] === '/class-report' || key[0] === '/student-report') &&
      key[1] === classId,
    undefined,
    { revalidate: true },
  );
}
