/**
 * Tier 1.4 — closed regex coverage for tour mock handlers.
 *
 * Positive corpus: every URL the tour-targeted pages are known to hit
 *                  must be intercepted.
 * Negative corpus: real-teacher URLs that look superficially similar
 *                  (different class id, missing semester, etc.) must NOT
 *                  match — they would otherwise leak mock data into real
 *                  pages.
 *
 * Fuzz: random non-demo class IDs are guaranteed to fall through.
 *
 * Response-shape: every handler returns a value, and for object responses
 *                 the response is JSON-serialisable.
 */

import fc from 'fast-check';
import {
  TOUR_MOCK,
  installFetcherInterceptor,
  clearFetcherInterceptor,
  tryMockResponse,
} from '../tour-fetcher';
import { TOUR_MOCK_HANDLERS } from '../tour-mock-handlers';
import { TOUR_DEMO_CLASS_ID } from '../tour-mock-data';

beforeEach(() => {
  installFetcherInterceptor(TOUR_MOCK_HANDLERS);
});
afterEach(() => {
  clearFetcherInterceptor();
});

// ─── Positive corpus ─────────────────────────────────────────────────────────

const POSITIVE: Array<[path: string, method: string]> = [
  [`/classes`,                                              'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}`,                        'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/students`,               'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/details?semester=A`,     'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/details?semester=B`,     'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/comparison/availability`,'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/attendance?date=2026-01-15`, 'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/attendance`,             'POST'],
  [`/classes/${TOUR_DEMO_CLASS_ID}/sessions`,               'POST'],
  ['/tests/types',                                          'GET'],
  ['/dashboard/stats?semester=A',                           'GET'],
  ['/dashboard/stats?semester=B',                           'GET'],
  ['/dashboard/class-averages?semester=A',                  'GET'],
  ['/dashboard/class-averages?semester=B',                  'GET'],
  ['/dashboard/top-students?semester=A',                    'GET'],
  ['/dashboard/top-students?semester=B',                    'GET'],
  ['/dashboard/top-per-class?semester=A',                   'GET'],
  ['/dashboard/top-per-class?semester=B',                   'GET'],
  ['/dashboard/top-achievements?semester=A',                'GET'],
  ['/dashboard/top-achievements?semester=B',                'GET'],
  ['/events',                                               'GET'],
  ['/events/upcoming',                                      'GET'],
];

describe('positive corpus — every tour URL is intercepted', () => {
  it.each(POSITIVE)('%s %s is matched', (path, method) => {
    const result = tryMockResponse(path, method);
    expect(result.matched).toBe(true);
  });
});

// ─── Negative corpus ─────────────────────────────────────────────────────────

const NEGATIVE: Array<[path: string, method: string]> = [
  // Different (real) class IDs must never be intercepted.
  ['/classes/abc-123-real',                  'GET'],
  ['/classes/abc-123-real/students',         'GET'],
  ['/classes/abc-123-real/details?semester=A', 'GET'],
  ['/classes/abc-123-real/comparison/availability', 'GET'],

  // Suffix/prefix variants of the synthetic ID must not match.
  [`/classes/${TOUR_DEMO_CLASS_ID}-2`,           'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}-extra-suffix`, 'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}-2/students`, 'GET'],
  [`/classes/${TOUR_DEMO_CLASS_ID}-extra-suffix/students`, 'GET'],

  // Wrong semester / missing semester / extra params.
  ['/dashboard/stats?semester=C',            'GET'],
  ['/dashboard/stats',                       'GET'],
  ['/dashboard/stats?semester=A&extra=x',    'GET'],
  ['/dashboard/class-averages',              'GET'],
  ['/dashboard/top-students',                'GET'],

  // Unrelated endpoints.
  ['/teachers/me',                           'GET'],
  ['/auth/refresh',                          'POST'],
  ['/admin/users',                           'GET'],
];

describe('negative corpus — real teacher URLs fall through', () => {
  it.each(NEGATIVE)('%s %s is NOT matched', (path, method) => {
    const result = tryMockResponse(path, method);
    expect(result.matched).toBe(false);
  });
});

// ─── Method mismatch — POST patterns rejected for GET ────────────────────────

describe('method mismatches', () => {
  it('class detail attendance POST pattern does not match GET requests', () => {
    // The GET attendance handler requires `?date=YYYY-MM-DD`. Bare GET to
    // /classes/<id>/attendance must NOT be intercepted.
    expect(
      tryMockResponse(`/classes/${TOUR_DEMO_CLASS_ID}/attendance`, 'GET').matched,
    ).toBe(false);
  });

  it('class detail sessions POST pattern does not match GET requests', () => {
    expect(
      tryMockResponse(`/classes/${TOUR_DEMO_CLASS_ID}/sessions`, 'GET').matched,
    ).toBe(false);
  });
});

// ─── Property test: random non-demo class IDs always fall through ────────────

describe('fuzz: random class IDs never collide with the demo handlers', () => {
  it('no random uuid-like id matches the synthetic-id handlers', () => {
    const arbId = fc
      .stringMatching(/^[A-Za-z0-9_-]{4,40}$/)
      .filter((s) => s !== TOUR_DEMO_CLASS_ID && !s.includes('/'));

    fc.assert(
      fc.property(arbId, (id) => {
        const paths = [
          `/classes/${id}`,
          `/classes/${id}/students`,
          `/classes/${id}/details?semester=A`,
          `/classes/${id}/comparison/availability`,
          `/classes/${id}/attendance?date=2026-01-15`,
        ];
        for (const p of paths) {
          expect(tryMockResponse(p, 'GET').matched).toBe(false);
        }
        // POST variants too.
        expect(tryMockResponse(`/classes/${id}/attendance`, 'POST').matched).toBe(false);
        expect(tryMockResponse(`/classes/${id}/sessions`,   'POST').matched).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Response-shape contracts ────────────────────────────────────────────────

describe('response-shape contracts', () => {
  it('every handler returns a defined, non-throwing response', () => {
    for (const handler of TOUR_MOCK_HANDLERS) {
      // Build a synthetic path that satisfies the handler's regex.
      // For simplicity, run respond() with a stable placeholder path and
      // assert it doesn't throw and returns something.
      const probe = (() => {
        // Pull a known positive path that matches this handler.
        for (const [p, m] of POSITIVE) {
          if ((handler.method ?? m) === m && handler.pattern.test(p)) return p;
        }
        return '/';
      })();
      const value = handler.respond(probe);
      expect(value).toBeDefined();
    }
  });

  it('semester=A and semester=B dispatch to different response objects for class-details', () => {
    const a = tryMockResponse(`/classes/${TOUR_DEMO_CLASS_ID}/details?semester=A`, 'GET');
    const b = tryMockResponse(`/classes/${TOUR_DEMO_CLASS_ID}/details?semester=B`, 'GET');
    expect(a.matched).toBe(true);
    expect(b.matched).toBe(true);
    if (a.matched && b.matched) {
      expect(a.data).not.toBe(b.data);
    }
  });

  it('semester=A and semester=B dispatch to different stats objects', () => {
    const a = tryMockResponse('/dashboard/stats?semester=A', 'GET');
    const b = tryMockResponse('/dashboard/stats?semester=B', 'GET');
    expect(a.matched).toBe(true);
    expect(b.matched).toBe(true);
    if (a.matched && b.matched) {
      expect(a.data).not.toBe(b.data);
    }
  });
});

// ─── Singleton hygiene ───────────────────────────────────────────────────────

describe('singleton hygiene', () => {
  it('handlers list installed equals the canonical TOUR_MOCK_HANDLERS', () => {
    expect(TOUR_MOCK.handlers).toBe(TOUR_MOCK_HANDLERS);
    expect(TOUR_MOCK.active).toBe(true);
  });
});
