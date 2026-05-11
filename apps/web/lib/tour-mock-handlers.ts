/**
 * Tour mock handlers — the regex → mock-data table for the fetcher interceptor.
 *
 * The pattern set was derived by reading every tour-targeted page and the
 * supporting hook source files (use-classes, use-top-achievements,
 * use-comparison, use-test-types). It is closed and final, not best-effort —
 * any GET that doesn't match a pattern here falls through to the real API.
 *
 * Why exact tour-demo-class matching:
 *   The tour always navigates to `/classes/tour-demo-class` (synthetic ID
 *   strategy). Matching the literal ID — not a generic `[^/]+` — guarantees
 *   we never accidentally intercept calls for a teacher's real classes,
 *   which could happen if they had a class whose generated UUID happened
 *   to coincide with the regex pattern.
 *
 * Why response is a function, not a static value:
 *   Some patterns ('?semester=A' vs '?semester=B') need to dispatch to
 *   different mock data based on a query-parameter parse. The respond()
 *   callback receives the matched path so the handler can branch.
 */

import {
  TOUR_DEMO_CLASS_ID,
  MOCK_CLASSES,
  MOCK_STUDENTS,
  MOCK_CLASS_DETAILS_A,
  MOCK_CLASS_DETAILS_B,
  MOCK_STATS_A,
  MOCK_STATS_B,
  MOCK_CLASS_AVERAGES_A,
  MOCK_CLASS_AVERAGES_B,
  MOCK_TOP_STUDENTS_A,
  MOCK_TOP_PER_CLASS_A,
  MOCK_TOP_ACHIEVEMENTS,
  MOCK_TEST_TYPES,
  MOCK_EVENT,
} from './tour-mock-data';
import type { TourMockHandler } from './tour-fetcher';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse the `semester` query param. Defaults to 'A' if missing or unrecognised. */
function semesterFromPath(path: string): 'A' | 'B' {
  return path.includes('semester=B') ? 'B' : 'A';
}

// ─── Handler table ────────────────────────────────────────────────────────────
//
// Order matters only when multiple patterns could match the same path. Most
// patterns are mutually exclusive; the only overlap is the synthetic-class-id
// vs. the broader /classes pattern, and we list the more specific ones first
// to make matching deterministic.

export const TOUR_MOCK_HANDLERS: TourMockHandler[] = [
  // ── Class detail (synthetic ID, exact match) ───────────────────────────────
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}$`),
    method:  'GET',
    respond: () => MOCK_CLASSES[0],
  },
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/students$`),
    method:  'GET',
    respond: () => MOCK_STUDENTS,
  },
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/details\\?semester=[AB]$`),
    method:  'GET',
    respond: (path) => semesterFromPath(path) === 'A' ? MOCK_CLASS_DETAILS_A : MOCK_CLASS_DETAILS_B,
  },
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/comparison/availability$`),
    method:  'GET',
    respond: () => ({ hasSemesterBData: false }),
  },
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/attendance\\?date=\\d{4}-\\d{2}-\\d{2}$`),
    method:  'GET',
    respond: () => [],
  },

  // ── POST writes (tour shouldn't trigger them, but stub for safety) ─────────
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/attendance$`),
    method:  'POST',
    respond: () => ({ success: true }),
  },
  {
    pattern: new RegExp(`^/classes/${TOUR_DEMO_CLASS_ID}/sessions$`),
    method:  'POST',
    respond: () => ({ id: 'tour-mock-session' }),
  },

  // ── Class list ─────────────────────────────────────────────────────────────
  {
    pattern: /^\/classes$/,
    method:  'GET',
    respond: () => MOCK_CLASSES,
  },

  // ── Test types catalog ─────────────────────────────────────────────────────
  {
    pattern: /^\/tests\/types$/,
    method:  'GET',
    respond: () => MOCK_TEST_TYPES,
  },

  // ── Dashboard reads (semester-scoped) ──────────────────────────────────────
  {
    pattern: /^\/dashboard\/stats\?semester=[AB]$/,
    method:  'GET',
    respond: (path) => semesterFromPath(path) === 'A' ? MOCK_STATS_A : MOCK_STATS_B,
  },
  {
    pattern: /^\/dashboard\/class-averages\?semester=[AB]$/,
    method:  'GET',
    respond: (path) => semesterFromPath(path) === 'A' ? MOCK_CLASS_AVERAGES_A : MOCK_CLASS_AVERAGES_B,
  },
  {
    pattern: /^\/dashboard\/top-students\?semester=[AB]$/,
    method:  'GET',
    respond: () => MOCK_TOP_STUDENTS_A,
  },
  {
    pattern: /^\/dashboard\/top-per-class\?semester=[AB]$/,
    method:  'GET',
    respond: () => MOCK_TOP_PER_CLASS_A,
  },
  {
    pattern: /^\/dashboard\/top-achievements\?semester=[AB]$/,
    method:  'GET',
    respond: () => MOCK_TOP_ACHIEVEMENTS,
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    pattern: /^\/events$/,
    method:  'GET',
    respond: () => [MOCK_EVENT],
  },
  {
    pattern: /^\/events\/upcoming$/,
    method:  'GET',
    respond: () => MOCK_EVENT,
  },
];
