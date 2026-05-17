'use strict';

/**
 * Artillery custom processor — race condition assertion for stopwatch taps.
 *
 * Used by: load-tests/scenarios/live-session-burst.yml
 *
 * Validates that the API correctly deduplicates concurrent taps for the same
 * student. The invariant: each student can have at most ONE result per session.
 * If two concurrent taps for the same studentIndex both return 201, the API
 * has a race condition — a duplicate row escaped the unique constraint.
 *
 * How it works:
 *   - afterResponse hook `assertNoDuplicateResult` is called on every 201/409 tap response.
 *   - For 201: records the (sessionId, studentIndex) → resultId mapping.
 *   - For 201 with a mapping already present: increment the duplicateCount counter.
 *   - After the run, Artillery calls `teardown` to assert duplicateCount === 0.
 *
 * A non-zero duplicateCount triggers a hard fail that surfaces as an Artillery
 * aggregate error, which the CI job treats as a threshold violation and
 * auto-creates a GitHub issue via the existing nightly notify pattern.
 */

/** In-memory map: `${sessionId}:${studentIndex}` → resultId (first 201 seen) */
const seenResults = new Map();

/** Count of duplicate 201 responses (should be zero). */
let duplicateCount = 0;

/** Count of correct 409 dedup responses. */
let correctDedupCount = 0;

/**
 * afterResponse hook — called by Artillery after every stopwatch tap response.
 * Artillery signature: (requestParams, response, context, ee, next) => void
 */
function assertNoDuplicateResult(requestParams, response, context, ee, next) {
  const status = response.statusCode;

  if (status === 409) {
    correctDedupCount++;
    ee.emit('counter', 'engine.http.responses.correct_dedup', 1);
    return next();
  }

  if (status !== 201) {
    return next();
  }

  // Parse the response body — Artillery may have already parsed it
  let body;
  try {
    body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
  } catch {
    return next();
  }

  // Build the dedup key from sessionId + studentIndex in the request body
  let reqBody;
  try {
    reqBody = typeof requestParams.body === 'string'
      ? JSON.parse(requestParams.body)
      : requestParams.body;
  } catch {
    return next();
  }

  const sessionId    = reqBody?.sessionId    ?? 'unknown-session';
  const studentIndex = reqBody?.studentIndex ?? 'unknown-student';
  const key          = `${sessionId}:${studentIndex}`;
  const resultId     = body?.id;

  if (seenResults.has(key)) {
    const existing = seenResults.get(key);
    duplicateCount++;

    const msg =
      `[race-assertion] DUPLICATE RESULT: student ${studentIndex} in session ${sessionId} ` +
      `got 201 twice. First resultId: ${existing}, second resultId: ${resultId}`;

    console.error(msg);
    ee.emit('counter', 'fitgrade.race_condition.duplicate_result', 1);
  } else {
    seenResults.set(key, resultId);
    ee.emit('counter', 'fitgrade.tap.recorded', 1);
  }

  return next();
}

/**
 * Teardown hook — called once after the entire Artillery run completes.
 * Throws if any duplicates were detected, which causes Artillery to exit non-zero.
 */
function teardown(context, ee, done) {
  const totalSeen   = seenResults.size;
  const totalDedup  = correctDedupCount;
  const totalDupe   = duplicateCount;

  console.log(
    `[race-assertion] Summary: ${totalSeen} unique results recorded, ` +
    `${totalDedup} correct 409 dedups, ${totalDupe} race-condition duplicates`,
  );

  if (totalDupe > 0) {
    const err = new Error(
      `[race-assertion] FAIL: ${totalDupe} duplicate result(s) detected. ` +
      'The stopwatch tap endpoint has a race condition — two concurrent 201s for the same student.',
    );
    // Emit as an Artillery error metric so it appears in the report
    ee.emit('counter', 'fitgrade.race_condition.total_failures', totalDupe);
    return done(err);
  }

  console.log('[race-assertion] PASS: no race conditions detected.');
  return done();
}

module.exports = { assertNoDuplicateResult, teardown };
