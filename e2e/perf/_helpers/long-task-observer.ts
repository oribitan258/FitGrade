import type { Page } from '@playwright/test';

export interface LongTask {
  duration: number;
  name: string;
  attribution: string | undefined;
}

/**
 * Read the longtask array accumulated by inject-web-vitals.ts.
 * Returns all longtasks recorded since page load (observer is buffered).
 */
export async function readLongTasks(page: Page): Promise<LongTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__perfMetrics?.longtasks ?? []);
}

/**
 * Total Blocking Time: sum of (duration - 50) for all longtasks > 50 ms.
 * Matches the Web Vitals / Lighthouse TBT definition.
 */
export function computeTBT(tasks: LongTask[]): number {
  return tasks.reduce((sum, t) => sum + (t.duration > 50 ? t.duration - 50 : 0), 0);
}

/** Maximum single longtask duration in the list. */
export function maxLongtask(tasks: LongTask[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.duration), 0);
}

/**
 * Reset the longtask accumulator so a subsequent measurement window
 * only captures tasks that occur after this call.
 */
export async function resetLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (window as any).__perfMetrics;
    if (m) m.longtasks = [];
  });
}
