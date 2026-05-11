/**
 * Tour fetcher interceptor.
 *
 * The onboarding tour's mock-data layer lives behind a single chokepoint:
 * apiRequest() in api-client.ts consults this module BEFORE issuing any
 * real fetch. When the tour is active and a registered handler matches
 * the request's path + method, the handler's response is returned directly
 * and no network request is made.
 *
 * Why this exists:
 *   v2 of the tour seeded individual SWR cache keys. Any hook key the
 *   page called that wasn't in the seeded list fell through to a real
 *   API call and produced 404s / error boundaries. Maintaining key parity
 *   was a manual audit that drifted the moment a hook was added.
 *
 *   This module replaces the per-key approach with URL-pattern matching
 *   at the point of egress. Adding a new SWR hook automatically gets the
 *   mock response if its URL matches an existing pattern.
 *
 * SSR note:
 *   This module is plain JavaScript — no 'use client' directive — so
 *   api-client.ts (which is imported by both server and client code)
 *   can safely import it. On the server, TOUR_MOCK.active is always
 *   false, making tryMockResponse a no-op.
 */

export interface TourMockHandler {
  /** RegExp matched against the path (e.g. /^\/classes\/tour-demo-class$/). */
  pattern: RegExp;
  /** HTTP method to match. Omit to match any method. Compared case-insensitively. */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Returns the mock response body. Receives the matched path for parameterised handlers. */
  respond: (path: string) => unknown;
}

interface TourMockState {
  active:   boolean;
  handlers: TourMockHandler[];
}

/** Module-scope singleton — read by apiRequest, written by Tour lifecycle. */
export const TOUR_MOCK: TourMockState = {
  active:   false,
  handlers: [],
};

/**
 * Activate the interceptor with a fixed set of handlers.
 * Called by the tour state machine during the 'seeding' phase.
 */
export function installFetcherInterceptor(handlers: TourMockHandler[]): void {
  TOUR_MOCK.handlers = handlers;
  TOUR_MOCK.active   = true;
}

/**
 * Deactivate the interceptor and drop all handlers.
 * Called by the tour state machine during the 'cleanup' phase.
 */
export function clearFetcherInterceptor(): void {
  TOUR_MOCK.active   = false;
  TOUR_MOCK.handlers = [];
}

/** Discriminated union — clearer than null-vs-valid-null ambiguity. */
export type MockLookupResult =
  | { matched: true;  data: unknown }
  | { matched: false };

/**
 * Look up a matching handler for the given request.
 *
 * Returns { matched: true, data } when:
 *   - the interceptor is active, AND
 *   - some handler's pattern matches the path, AND
 *   - the handler's method is undefined or matches the request method.
 *
 * Returns { matched: false } otherwise — the caller falls through to fetch().
 */
export function tryMockResponse(path: string, method: string): MockLookupResult {
  if (!TOUR_MOCK.active) return { matched: false };

  const upperMethod = method.toUpperCase();
  for (const handler of TOUR_MOCK.handlers) {
    if (handler.method !== undefined && handler.method !== upperMethod) continue;
    if (handler.pattern.test(path)) {
      return { matched: true, data: handler.respond(path) };
    }
  }
  return { matched: false };
}
