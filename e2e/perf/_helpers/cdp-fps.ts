import type { CDPSession } from '@playwright/test';

interface CDPMetric {
  name: string;
  value: number;
}

interface CDPMetricsResult {
  metrics: CDPMetric[];
}

/** Extract a named metric from a CDP Performance.getMetrics response. */
function pick(result: CDPMetricsResult, name: string): number {
  return result.metrics.find((m) => m.name === name)?.value ?? 0;
}

export interface FrameSnapshot {
  framesDropped: number;
  framesPresented: number;
  frameTime: number;
}

/**
 * Take a CDP frame-metrics snapshot (before or after an animation window).
 * Requires Performance.enable to have been called on the session already.
 */
export async function snapshotFrameMetrics(cdp: CDPSession): Promise<FrameSnapshot> {
  const result = (await cdp.send('Performance.getMetrics')) as CDPMetricsResult;
  return {
    framesDropped:    pick(result, 'DroppedFrames'),
    framesPresented:  pick(result, 'VisibleFrames'),
    frameTime:        pick(result, 'FrameTime'),
  };
}

/**
 * Compute dropped frames between two snapshots.
 * Assert dropped frame COUNT, not FPS ratio — ratios hide tail jank.
 */
export function droppedFrames(before: FrameSnapshot, after: FrameSnapshot): number {
  return Math.max(0, after.framesDropped - before.framesDropped);
}

/**
 * Enable CDP Performance and return a measurement pair:
 *   { before, measure, after }
 *
 * Usage:
 *   const fps = await prepareFpsMeasurement(cdp);
 *   const before = await fps.snap();
 *   // ... drive animation ...
 *   const after  = await fps.snap();
 *   const dropped = droppedFrames(before, after);
 */
export async function enablePerformance(cdp: CDPSession): Promise<void> {
  await cdp.send('Performance.enable');
}
