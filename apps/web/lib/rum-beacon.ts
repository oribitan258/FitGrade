/**
 * Production RUM beacon — sends web-vitals observations to POST /api/rum.
 *
 * Batches metrics and flushes on:
 *   - visibilitychange (page hide / tab close) — uses navigator.sendBeacon
 *   - pagehide event — belt-and-suspenders for iOS Safari
 *   - 5-second idle timer — for long-lived sessions
 *
 * Design choices:
 *   - sendBeacon for unload-safe delivery (non-blocking, browser-queued)
 *   - fetch fallback when sendBeacon is unavailable
 *   - Silently ignores all errors — RUM is best-effort, never blocks UX
 *   - Only initialised in production (NEXT_PUBLIC_API_URL must be set)
 */

import { onINP, onLCP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals';

interface RumEntry {
  metricName: string;
  value: number;
  rating: string;
  navigationType: string;
  pageUrl: string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? '';
const RUM_ENDPOINT = `${API_URL}/rum`;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 10;

const queue: RumEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(metric: Metric): void {
  if (queue.length >= MAX_BATCH) return; // drop if queue full — never block

  queue.push({
    metricName:     metric.name,
    value:          metric.value,
    rating:         metric.rating,
    navigationType: metric.navigationType,
    pageUrl:        window.location.href,
  });

  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function flush(): void {
  flushTimer = null;
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ metrics: batch });

  // sendBeacon is fire-and-forget — survives page unload
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(RUM_ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }

  // Fetch fallback (keepalive ensures delivery across navigation)
  fetch(RUM_ENDPOINT, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {
    // Best-effort — swallow silently
  });
}

/** Call once per app mount (client-side only, production only). */
export function initRumBeacon(): void {
  if (typeof window === 'undefined') return;
  if (!API_URL) return; // not configured — skip

  // Register web-vitals callbacks with reportAllChanges so we capture
  // INP updates as the user interacts (not just the final value on unload)
  onINP(enqueue, { reportAllChanges: true });
  onLCP(enqueue, { reportAllChanges: true });
  onCLS(enqueue, { reportAllChanges: true });
  onFCP(enqueue);
  onTTFB(enqueue);

  // Flush on page hide (tab close, navigation away, backgrounding on mobile)
  const onHide = (): void => flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);
}
