'use client';

import { useEffect } from 'react';
import { initRumBeacon } from '@/lib/rum-beacon';

/** Mounts the web-vitals RUM beacon once on the client. No UI output. */
export function RumInit(): null {
  useEffect(() => {
    initRumBeacon();
  }, []);

  return null;
}
