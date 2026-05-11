/**
 * Tier 1.3 — fetcher interceptor singleton.
 *
 * Verifies the module-scope contract:
 *   - tryMockResponse short-circuits when TOUR_MOCK.active is false.
 *   - installFetcherInterceptor replaces (does not append) the handler list.
 *   - clearFetcherInterceptor turns off active and empties handlers.
 *   - method matching is case-insensitive; undefined method matches any.
 *   - handler order is deterministic (first match wins).
 */

import {
  TOUR_MOCK,
  installFetcherInterceptor,
  clearFetcherInterceptor,
  tryMockResponse,
  type TourMockHandler,
} from '../tour-fetcher';

// Reset module state between tests to keep cases independent.
afterEach(() => {
  clearFetcherInterceptor();
});

describe('tryMockResponse — inactive state', () => {
  it('returns { matched: false } when TOUR_MOCK.active is false', () => {
    // Default state.
    expect(TOUR_MOCK.active).toBe(false);
    expect(tryMockResponse('/classes', 'GET')).toEqual({ matched: false });
  });

  it('returns { matched: false } even with handlers registered if not active', () => {
    // Forcibly populate handlers but keep active=false (defensive).
    TOUR_MOCK.handlers = [{ pattern: /.*/, respond: () => ({ x: 1 }) }];
    TOUR_MOCK.active   = false;
    expect(tryMockResponse('/anything', 'GET')).toEqual({ matched: false });
    TOUR_MOCK.handlers = [];
  });
});

describe('installFetcherInterceptor', () => {
  it('sets active=true and replaces handlers', () => {
    const a: TourMockHandler = { pattern: /^\/a$/, respond: () => 'A' };
    const b: TourMockHandler = { pattern: /^\/b$/, respond: () => 'B' };

    installFetcherInterceptor([a]);
    expect(TOUR_MOCK.active).toBe(true);
    expect(TOUR_MOCK.handlers).toEqual([a]);

    installFetcherInterceptor([b]);
    // Replacement, not append.
    expect(TOUR_MOCK.handlers).toEqual([b]);
  });
});

describe('clearFetcherInterceptor', () => {
  it('sets active=false and empties handlers', () => {
    installFetcherInterceptor([{ pattern: /.*/, respond: () => null }]);
    expect(TOUR_MOCK.active).toBe(true);
    clearFetcherInterceptor();
    expect(TOUR_MOCK.active).toBe(false);
    expect(TOUR_MOCK.handlers).toEqual([]);
  });

  it('post-clear, tryMockResponse returns { matched: false }', () => {
    installFetcherInterceptor([{ pattern: /^\/x$/, respond: () => 1 }]);
    expect(tryMockResponse('/x', 'GET')).toEqual({ matched: true, data: 1 });
    clearFetcherInterceptor();
    expect(tryMockResponse('/x', 'GET')).toEqual({ matched: false });
  });
});

describe('tryMockResponse — method matching', () => {
  it('handler with method "POST" does not match GET requests', () => {
    installFetcherInterceptor([
      { pattern: /^\/r$/, method: 'POST', respond: () => 'p' },
    ]);
    expect(tryMockResponse('/r', 'GET')).toEqual({ matched: false });
    expect(tryMockResponse('/r', 'POST')).toEqual({ matched: true, data: 'p' });
  });

  it('handler without method matches any method', () => {
    installFetcherInterceptor([
      { pattern: /^\/any$/, respond: () => 'ok' },
    ]);
    for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
      expect(tryMockResponse('/any', m)).toEqual({ matched: true, data: 'ok' });
    }
  });

  it('method comparison is case-insensitive', () => {
    installFetcherInterceptor([
      { pattern: /^\/c$/, method: 'POST', respond: () => 'p' },
    ]);
    expect(tryMockResponse('/c', 'post')).toEqual({ matched: true, data: 'p' });
    expect(tryMockResponse('/c', 'PoSt')).toEqual({ matched: true, data: 'p' });
  });
});

describe('tryMockResponse — handler order (first match wins)', () => {
  it('returns the first matching handler when multiple patterns overlap', () => {
    const first:  TourMockHandler = { pattern: /^\/dup/, respond: () => 'first' };
    const second: TourMockHandler = { pattern: /^\/dup/, respond: () => 'second' };

    installFetcherInterceptor([first, second]);
    expect(tryMockResponse('/dup', 'GET')).toEqual({ matched: true, data: 'first' });

    installFetcherInterceptor([second, first]);
    expect(tryMockResponse('/dup', 'GET')).toEqual({ matched: true, data: 'second' });
  });
});

describe('tryMockResponse — non-matching path', () => {
  it('returns matched:false when no handler regex matches', () => {
    installFetcherInterceptor([
      { pattern: /^\/match$/, respond: () => 'm' },
    ]);
    expect(tryMockResponse('/no-match', 'GET')).toEqual({ matched: false });
  });
});

describe('respond() receives the matched path', () => {
  it('passes the original path string to respond()', () => {
    const captured: string[] = [];
    installFetcherInterceptor([
      {
        pattern: /^\/echo\/.+/,
        respond: (path) => {
          captured.push(path);
          return path;
        },
      },
    ]);
    const result = tryMockResponse('/echo/hello-world', 'GET');
    expect(result).toEqual({ matched: true, data: '/echo/hello-world' });
    expect(captured).toEqual(['/echo/hello-world']);
  });
});
