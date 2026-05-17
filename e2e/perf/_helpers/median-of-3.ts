/**
 * Runs an async function 3 times and returns the median of a numeric signal.
 * Single-run failures → warning only; 2-of-3 failures → hard fail.
 *
 * @param label  Human-readable label for logging
 * @param fn     Async function that produces a result T each run
 * @param pick   Extracts the numeric signal from each result
 */
export async function runMedianOf3<T>(
  label: string,
  fn: () => Promise<T>,
  pick: (result: T) => number,
): Promise<{ median: number; runs: T[] }> {
  const runs: T[] = [];

  for (let i = 0; i < 3; i++) {
    console.log(`[perf] ${label} — run ${i + 1}/3`);
    const result = await fn();
    runs.push(result);
  }

  const values = runs.map(pick).sort((a, b) => a - b);
  const median = values[1]; // middle of 3 sorted values

  console.log(`[perf] ${label} — runs: [${values.join(', ')}] → median: ${median}`);
  return { median, runs };
}
