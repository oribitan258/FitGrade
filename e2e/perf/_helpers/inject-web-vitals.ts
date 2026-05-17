import * as path from 'path';
import type { Page } from '@playwright/test';

const VENDOR_PATH = path.join(__dirname, 'vendor', 'web-vitals.iife.js');

/**
 * Injects web-vitals v4 (vendored, no CDN) into the page before navigation.
 * Must be called BEFORE page.goto().
 *
 * Registers:
 *   window.__perfMetrics.inp        → INP entries (reportAllChanges: true)
 *   window.__perfMetrics.lcp        → LCP entries
 *   window.__perfMetrics.cls        → CLS entries
 *   window.__perfMetrics.fcp        → FCP entries
 *   window.__perfMetrics.longtasks  → longtask entries with attribution
 */
export async function injectWebVitals(page: Page): Promise<void> {
  await page.addInitScript({ path: VENDOR_PATH });
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wv = (window as any).webVitals as {
      onINP: (cb: (m: unknown) => void, opts?: object) => void;
      onLCP: (cb: (m: unknown) => void, opts?: object) => void;
      onCLS: (cb: (m: unknown) => void, opts?: object) => void;
      onFCP: (cb: (m: unknown) => void, opts?: object) => void;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__perfMetrics = {
      inp: [] as unknown[],
      lcp: [] as unknown[],
      cls: [] as unknown[],
      fcp: [] as unknown[],
      longtasks: [] as { duration: number; name: string; attribution: string | undefined }[],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (window as any).__perfMetrics;

    wv.onINP((metric) => m.inp.push(metric), { reportAllChanges: true });
    wv.onLCP((metric) => m.lcp.push(metric), { reportAllChanges: true });
    wv.onCLS((metric) => m.cls.push(metric), { reportAllChanges: true });
    wv.onFCP((metric) => m.fcp.push(metric), { reportAllChanges: true });

    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          m.longtasks.push({
            duration: entry.duration,
            name: entry.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            attribution: (entry as any).attribution?.[0]?.containerName,
          });
        });
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask not supported in this browser — safe to ignore
    }
  });
}

/** Flush pending INP callbacks then read all accumulated metrics. */
export interface PerfMetrics {
  inp: { value: number; name: string; rating: string }[];
  lcp: { value: number; name: string; rating: string }[];
  cls: { value: number; name: string; rating: string }[];
  fcp: { value: number; name: string; rating: string }[];
  longtasks: { duration: number; name: string; attribution: string | undefined }[];
}

export async function readPerfMetrics(page: Page): Promise<PerfMetrics> {
  // Flush event-timing buffer
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ric = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 0));
        ric(resolve, { timeout: 500 });
      }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__perfMetrics as PerfMetrics);
}

/** Compute p75 from an array of INP entry values (ms). */
export function computeP75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(0.75 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
