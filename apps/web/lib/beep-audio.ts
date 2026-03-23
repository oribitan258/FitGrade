/**
 * Web Audio API helpers for the Beep Test console.
 *
 * Usage:
 *   1. Call initAudio() exactly once, inside a user-gesture handler (button click).
 *      This satisfies the browser autoplay policy and keeps AudioContext alive.
 *   2. Call preloadAudio() after initAudio() to fetch and decode both MP3 files
 *      into AudioBuffers. Await it during the SETUP phase so buffers are warm in
 *      memory before the test begins.
 *   3. Call playStartSequence() when transitioning to RUNNING — it plays the
 *      countdown audio and returns the exact countdown duration in ms.
 *   4. Call scheduleBeep() from the RAF loop for every shuttle / level beep.
 *
 * Design notes:
 *   - Module-level singleton AudioContext — created once, never closed during a test.
 *   - AudioBufferSourceNode is created fresh per beep — cheap, GC-collected after stop().
 *   - All playback routes through a GainNode at high volume to cut through gym noise.
 *   - No oscillators — all audio comes from pre-decoded MP3 AudioBuffers.
 */

/** Singleton AudioContext — null until initAudio() is called. */
let audioCtx: AudioContext | null = null;

/** Decoded buffer for the start-sequence (countdown "3, 2, 1" + first beep). */
let startSequenceBuffer: AudioBuffer | null = null;

/** Decoded buffer for all subsequent shuttle / level beeps. */
let regularBeepBuffer: AudioBuffer | null = null;

/**
 * Volume multiplier applied to every beep.
 * 1.5 provides a clear, punchy sound that cuts through outdoor gym noise.
 * Adjust downward (e.g. 1.0) if clipping occurs on the output device.
 */
const BEEP_GAIN = 1.5;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates (or re-uses) the AudioContext.
 * MUST be called synchronously inside a user-gesture handler (e.g., onClick)
 * to satisfy browser autoplay policy. Safe to call multiple times — subsequent
 * calls are no-ops.
 */
export function initAudio(): void {
  if (audioCtx !== null) return;
  audioCtx = new AudioContext();
}

/**
 * Resumes the AudioContext if the browser has suspended it (e.g., after a
 * page-hide event). Call this alongside engine.resume() when the teacher
 * returns to the tab.
 */
export async function resumeAudioContext(): Promise<void> {
  if (audioCtx === null || audioCtx.state !== 'suspended') return;
  await audioCtx.resume();
}

/**
 * Fetches and decodes both MP3 files into AudioBuffers.
 *
 * Must be called after initAudio(). Resolves when both buffers are decoded
 * and ready for zero-latency playback. Call this during the SETUP phase
 * (inside handleStart, immediately after initAudio) so that buffers are hot
 * in memory before the engine's start() fires.
 *
 * Subsequent calls are no-ops (buffers are cached module-level).
 */
export async function preloadAudio(): Promise<void> {
  if (audioCtx === null) {
    throw new Error('initAudio() must be called before preloadAudio()');
  }

  // Already decoded — skip the network round-trip.
  if (startSequenceBuffer !== null && regularBeepBuffer !== null) return;

  const [startArrayBuffer, regularArrayBuffer] = await Promise.all([
    fetch('/sounds/start-sequence.mp3').then((r) => {
      if (!r.ok) throw new Error(`Failed to load start-sequence.mp3 (HTTP ${r.status})`);
      return r.arrayBuffer();
    }),
    fetch('/sounds/regular-beep.mp3').then((r) => {
      if (!r.ok) throw new Error(`Failed to load regular-beep.mp3 (HTTP ${r.status})`);
      return r.arrayBuffer();
    }),
  ]);

  [startSequenceBuffer, regularBeepBuffer] = await Promise.all([
    audioCtx.decodeAudioData(startArrayBuffer),
    audioCtx.decodeAudioData(regularArrayBuffer),
  ]);
}

/**
 * Plays the start-sequence audio ("3, 2, 1" countdown followed immediately by
 * the first test beep) and returns the countdown duration in milliseconds.
 *
 * The returned value is derived directly from the decoded AudioBuffer's duration,
 * so it automatically reflects the exact length of your MP3 — no hardcoded constant.
 *
 * Pass the return value to the engine's start() so the schedule origin is offset
 * by exactly the right amount:
 *
 *   const countdownMs = playStartSequence();
 *   buildSchedule(startLevel, performance.now() + countdownMs);
 *
 * Falls back to 4 000 ms if preloadAudio() was not awaited before start().
 */
export function playStartSequence(): number {
  if (audioCtx === null || startSequenceBuffer === null) {
    // Buffers not ready — return a safe fallback so the engine can still run.
    return 4_000;
  }

  const source = createSource(startSequenceBuffer);
  source.start(audioCtx.currentTime);

  // The audio file contains [spoken "3, 2, 1"] + [first beep].
  // The first beep fires at the very end of the file, so the file's total duration
  // equals the delay until the engine's Level 1 / Shuttle 1 should fire.
  return Math.round(startSequenceBuffer.duration * 1_000);
}

/**
 * Schedules the regular beep sound to play as soon as possible via the Web
 * Audio clock. Call this from the RAF tick loop whenever a beep is due.
 *
 * Using audioCtx.currentTime (the Web Audio scheduler's clock, not the JS
 * wall clock) means the driver layer — not setTimeout — owns the precise
 * sub-millisecond delivery of each beep. The RAF tick delivers the call within
 * ~16 ms of schedule; Web Audio handles the rest.
 *
 * Silently no-ops if initAudio() / preloadAudio() have not been called.
 */
export function scheduleBeep(): void {
  if (audioCtx === null || regularBeepBuffer === null) return;

  const source = createSource(regularBeepBuffer);
  source.start(audioCtx.currentTime);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an AudioBufferSourceNode wired through a high-gain GainNode and
 * connected to the destination. The caller must call source.start() with the
 * desired AudioContext time.
 *
 * A new node pair is created for each playback — this is the correct Web Audio
 * pattern; BufferSourceNodes are single-use by design and collected by the GC
 * automatically after they finish playing.
 */
function createSource(buffer: AudioBuffer): AudioBufferSourceNode {
  // audioCtx is guaranteed non-null by all callers.
  const ctx = audioCtx as AudioContext;

  const source = ctx.createBufferSource();
  const gainNode = ctx.createGain();

  source.buffer = buffer;
  gainNode.gain.setValueAtTime(BEEP_GAIN, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  return source;
}
