/**
 * useTodaySchedule — reads the weekly schedule from localStorage
 * and computes live lesson statuses entirely client-side, in Israel Standard Time.
 *
 * Storage format:
 *   v2 (preferred): fitgrade-schedule-v2-${semester}  →  ScheduleEvent[]
 *   v1 (fallback):  fitgrade-schedule-v1-${semester}  →  Record<"day-period", classId>
 *
 * On first load, if no v2 data exists the hook auto-seeds a realistic schedule
 * (semester A only) and writes it to v2.  Storage-event listener provides instant
 * cross-tab sync when the Schedule page mutates events.
 *
 * Refreshes every 60 s so NOW/NEXT/LATER/PAST labels stay accurate without a
 * page reload.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClassData, Semester } from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ScheduleEventType = 'lesson' | 'break' | 'meeting';

/** A single calendar event stored in the v2 schedule format. */
export interface ScheduleEvent {
  id: string;
  type: ScheduleEventType;
  /** Only present when type === 'lesson'. */
  classId?: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  day: number;       // 0 = Sunday … 5 = Friday
}

export type ScheduleLessonStatus = 'now' | 'next' | 'later' | 'past';

export interface TodayScheduleItem {
  period:    number; // -1 when not aligned to a standard school period
  startTime: string; // "HH:MM"
  endTime:   string; // "HH:MM"
  classId:   string;
  className: string;
  status:    ScheduleLessonStatus;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const storageKeyV2 = (semester: Semester): string => `fitgrade-schedule-v2-${semester}`;
const storageKeyV1 = (semester: Semester): string => `fitgrade-schedule-v1-${semester}`;

// ─── Period table ─────────────────────────────────────────────────────────────

export const PERIOD_STARTS: ReadonlyArray<string> = [
  '07:30', '08:15', '09:00', '10:05', '10:50', '11:55',
  '12:40', '13:25', '14:15', '15:00', '15:45', '16:30',
  '17:20', '18:10', '19:00', '19:45',
] as const;

const PERIOD_MINUTES = 45;

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** "HH:MM" → total minutes since midnight. */
function parseMinutes(time: string): number {
  const [hStr = '0', mStr = '0'] = time.split(':');
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
}

/** Minutes since midnight → "HH:MM". */
function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Current time as minutes since midnight, in Israel Standard Time. */
function nowInIsraelMinutes(): number {
  const s = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  });
  const h = parseInt(s.slice(0, 2), 10) % 24;
  const m = parseInt(s.slice(3, 5), 10);
  return h * 60 + m;
}

// ─── V1 → V2 migration ───────────────────────────────────────────────────────

function migrateV1ToEvents(v1: Record<string, string>): ScheduleEvent[] {
  return Object.entries(v1).map(([key, classId]) => {
    const [dayStr = '0', periodStr = '0'] = key.split('-');
    const day       = parseInt(dayStr, 10);
    const periodIdx = parseInt(periodStr, 10);
    const startTime = PERIOD_STARTS[periodIdx] ?? '07:30';
    const endTime   = formatMinutes(parseMinutes(startTime) + PERIOD_MINUTES);
    return { id: `migrated-${key}`, type: 'lesson' as const, classId, startTime, endTime, day };
  });
}

// ─── Auto-seeder (v2 format) ──────────────────────────────────────────────────

function seedDefaultScheduleV2(classes: readonly ClassData[], semester: Semester): ScheduleEvent[] {
  const n         = classes.length;
  const getClass  = (i: number): string => classes[i % n]?.id ?? '';
  const events: ScheduleEvent[] = [];
  const todayDay  = new Date().getDay();
  const nowMin    = nowInIsraelMinutes();

  // Find the first period that is currently active or has not yet started
  let pivot = PERIOD_STARTS.length - 3;
  for (let p = 0; p < PERIOD_STARTS.length; p++) {
    if (nowMin < parseMinutes(PERIOD_STARTS[p] ?? '00:00') + PERIOD_MINUTES) {
      pivot = p;
      break;
    }
  }

  const addEvent = (day: number, periodIdx: number, classIdx: number): void => {
    const startTime = PERIOD_STARTS[Math.min(periodIdx, PERIOD_STARTS.length - 1)] ?? '07:30';
    events.push({
      id:        `seed-${day}-${periodIdx}`,
      type:      'lesson',
      classId:   getClass(classIdx),
      startTime,
      endTime:   formatMinutes(parseMinutes(startTime) + PERIOD_MINUTES),
      day,
    });
  };

  // Today: 4 strategic entries spread around the current time (Sun–Fri)
  if (todayDay <= 5) {
    const pts = [...new Set([
      Math.max(0, pivot - 2),
      pivot,
      Math.min(pivot + 2, PERIOD_STARTS.length - 2),
      Math.min(pivot + 4, PERIOD_STARTS.length - 1),
    ])];
    pts.forEach((p, i) => addEvent(todayDay, p, i));
  }

  // Other school days: 3 spread entries
  for (let d = 0; d <= 4; d++) {
    if (d === todayDay) continue;
    [1, 4, 8].forEach((p, i) => addEvent(d, p, i));
  }

  try { localStorage.setItem(storageKeyV2(semester), JSON.stringify(events)); } catch { /* quota */ }
  return events;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodaySchedule(semester: Semester): {
  lessons:   TodayScheduleItem[] | undefined;
  isLoading: boolean;
  error:     unknown;
} {
  const { data: classes, isLoading: classesLoading } = useClasses();
  const [events, setEvents] = useState<ScheduleEvent[] | null>(null);
  const seededRef           = useRef(false);

  // ── Read localStorage — try v2 first, fall back to v1 ─────────────────────
  const readStorage = useCallback((): void => {
    try {
      const rawV2 = localStorage.getItem(storageKeyV2(semester));
      if (rawV2) {
        setEvents(JSON.parse(rawV2) as ScheduleEvent[]);
        return;
      }
      // Fall back to v1 (old Record<string,string> format) — migrate on the fly
      const rawV1 = localStorage.getItem(storageKeyV1(semester));
      if (rawV1) {
        const migrated = migrateV1ToEvents(JSON.parse(rawV1) as Record<string, string>);
        // Write migrated data back to v2 so we don't re-migrate next time
        try { localStorage.setItem(storageKeyV2(semester), JSON.stringify(migrated)); } catch { /* quota */ }
        setEvents(migrated);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    }
  }, [semester]);

  // Mount: initial read + 60-second refresh for live status transitions
  useEffect(() => {
    readStorage();
    const id = setInterval(readStorage, 60_000);
    return () => clearInterval(id);
  }, [readStorage]);

  // Cross-tab sync: listen to both v1 and v2 key changes
  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key === storageKeyV2(semester) || e.key === storageKeyV1(semester)) {
        readStorage();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [readStorage, semester]);

  // ── Auto-seed (semester A only, v2 format, once per session) ──────────────
  useEffect(() => {
    if (
      seededRef.current  ||
      semester !== 'A'   ||
      classesLoading     ||
      !classes           ||
      classes.length === 0 ||
      events === null    ||
      events.length > 0
    ) return;
    seededRef.current = true;
    setEvents(seedDefaultScheduleV2(classes, semester));
  }, [events, classes, classesLoading, semester]);

  // ── Derive today's lessons with computed statuses ──────────────────────────

  if (events === null || classesLoading) {
    return { lessons: undefined, isLoading: true, error: undefined };
  }

  const todayDay = new Date().getDay();
  // Saturday (6) has no lessons — return empty
  if (todayDay > 5) {
    return { lessons: [], isLoading: false, error: undefined };
  }

  const nowMin      = nowInIsraelMinutes();
  let   assignedNext = false;
  const lessons: TodayScheduleItem[] = [];

  const todayLessons = events
    .filter((e) => e.day === todayDay && e.type === 'lesson' && Boolean(e.classId))
    .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));

  for (const event of todayLessons) {
    const start = parseMinutes(event.startTime);
    const end   = parseMinutes(event.endTime);

    let status: ScheduleLessonStatus;
    if (nowMin >= start && nowMin < end) {
      status = 'now';
    } else if (nowMin < start && !assignedNext) {
      status = 'next';
      assignedNext = true;
    } else if (nowMin < start) {
      status = 'later';
    } else {
      status = 'past';
    }

    const period    = PERIOD_STARTS.indexOf(event.startTime);
    const className = classes?.find((c) => c.id === event.classId)?.name ?? '—';
    lessons.push({
      period,
      startTime: event.startTime,
      endTime:   event.endTime,
      classId:   event.classId ?? '',
      className,
      status,
    });
  }

  return { lessons, isLoading: false, error: undefined };
}
