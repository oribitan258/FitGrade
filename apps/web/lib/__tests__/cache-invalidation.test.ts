import { invalidateAfterMutation } from '../cache-invalidation';

const CLASS_ID = 'class-abc';
const SESSION_ID = 'session-xyz';
const OTHER_CLASS = 'class-OTHER';

describe('invalidateAfterMutation', () => {
  let mockMutate: jest.Mock;

  beforeEach(() => {
    mockMutate = jest.fn();
    invalidateAfterMutation(mockMutate, CLASS_ID, SESSION_ID);
  });

  it('calls mutate exactly twice (string matcher + array matcher)', () => {
    expect(mockMutate).toHaveBeenCalledTimes(2);
  });

  // ── String matcher (first call) ────────────────────────────────────────────

  function stringMatcher(): (key: unknown) => boolean {
    return mockMutate.mock.calls[0][0] as (key: unknown) => boolean;
  }

  it('string matcher: matches /dashboard/* prefix', () => {
    expect(stringMatcher()('/dashboard/stats')).toBe(true);
    expect(stringMatcher()('/dashboard/')).toBe(true);
  });

  it('string matcher: matches /classes/:classId/details', () => {
    expect(stringMatcher()(`/classes/${CLASS_ID}/details`)).toBe(true);
    expect(stringMatcher()(`/classes/${CLASS_ID}/details?foo=bar`)).toBe(true);
  });

  it('string matcher: matches /classes/:classId/sessions', () => {
    expect(stringMatcher()(`/classes/${CLASS_ID}/sessions`)).toBe(true);
    expect(stringMatcher()(`/classes/${CLASS_ID}/sessions?take=50&skip=0`)).toBe(true);
  });

  it('string matcher: matches /sessions/:sessionId exactly', () => {
    expect(stringMatcher()(`/sessions/${SESSION_ID}`)).toBe(true);
    // Subpath should NOT match (it's an exact === check)
    expect(stringMatcher()(`/sessions/${SESSION_ID}/results`)).toBe(false);
  });

  it('string matcher: matches /classes/:classId/students/ prefix', () => {
    expect(stringMatcher()(`/classes/${CLASS_ID}/students/student-1/profile`)).toBe(true);
  });

  it('string matcher: does NOT match keys from a different classId', () => {
    expect(stringMatcher()(`/classes/${OTHER_CLASS}/details`)).toBe(false);
    expect(stringMatcher()(`/classes/${OTHER_CLASS}/sessions`)).toBe(false);
    expect(stringMatcher()(`/classes/${OTHER_CLASS}/students/x`)).toBe(false);
  });

  it('string matcher: returns false for non-string keys', () => {
    expect(stringMatcher()(null)).toBe(false);
    expect(stringMatcher()(42)).toBe(false);
    expect(stringMatcher()(undefined)).toBe(false);
    expect(stringMatcher()(['/dashboard/stats'])).toBe(false);
  });

  // ── Array matcher (second call) ────────────────────────────────────────────

  function arrayMatcher(): (key: unknown) => boolean {
    return mockMutate.mock.calls[1][0] as (key: unknown) => boolean;
  }

  it('array matcher: matches ["/class-report", classId, ...]', () => {
    expect(arrayMatcher()(['/class-report', CLASS_ID])).toBe(true);
    expect(arrayMatcher()(['/class-report', CLASS_ID, 'extra'])).toBe(true);
  });

  it('array matcher: matches ["/student-report", classId, ...]', () => {
    expect(arrayMatcher()(['/student-report', CLASS_ID])).toBe(true);
  });

  it('array matcher: does NOT match when classId is different', () => {
    expect(arrayMatcher()(['/class-report', OTHER_CLASS])).toBe(false);
    expect(arrayMatcher()(['/student-report', OTHER_CLASS])).toBe(false);
  });

  it('array matcher: does NOT match non-report array keys', () => {
    expect(arrayMatcher()(['/dashboard', CLASS_ID])).toBe(false);
    expect(arrayMatcher()(['/class-report'])).toBe(false); // length < 2
  });

  it('array matcher: does NOT match string keys', () => {
    expect(arrayMatcher()(`/class-report/${CLASS_ID}`)).toBe(false);
  });

  it('passes revalidate:true option to both mutate calls', () => {
    expect(mockMutate.mock.calls[0][2]).toEqual({ revalidate: true });
    expect(mockMutate.mock.calls[1][2]).toEqual({ revalidate: true });
  });
});
