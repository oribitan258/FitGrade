/**
 * useTodaySchedule — reads the weekly schedule from localStorage
 * (the same source the Schedule page writes to) and computes live lesson
 * statuses entirely client-side, in Israel Standard Time.
 *
 * On first load, if localStorage is empty and classes are available, the hook
 * auto-seeds a realistic weekly schedule with strategic today entries so the
 * dashboard timeline shows past / now / next / later states immediately.
 *
 * Refreshes every 60 s so NOW/NEXT/LATER/PAST labels stay accurate without a
 * page reload.  Storage-event listener provides instant sync when the user edits
 * the schedule in another tab.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClassData, Semester } from '@fitgrade/types';
import { useClasses } from '@/hooks/use-classes';

// ─── Storage key — semester-scoped so A and B schedules don't overwrite each other ──

const storageKey = (semester: Semester): string => `fitgrade-schedule-v1-${semester}`;

// ─── Period table — mirrors the PERIODS array in schedule/page.tsx ───────────

/**
 * Start times for the 16 Israeli school periods.
 * Index 0 = "Period 1" in the UI (07:30–08:15), etc.
 */
export const PERIOD_STARTS: ReadonlyArray<string> = [
  '07:30', '08:15', '09:00', '10:05', '10:50', '11:55',
  '12:40', '13:25', '14:15', '15:00', '15:45', '16:30',
  '17:20', '18:10', '19:00', '19:45',
] as const;

/** Standard Israeli school-period duration in minutes. */
const PERIOD_MINUTES = 45;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleLessonStatus = 'now' | 'next' | 'later' | 'past';

export interface TodayScheduleItem {
  period:    number;
  startTime: string;  // "HH:MM"
  classId:   string;
  className: string;
  status:    ScheduleLessonStatus;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** "HH:MM" → total minutes since midnight. */
function parseMinutes(time: string): number {
  const [hStr = '0', mStr = '0'] = time.split(':');
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
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

// ─── Auto-seeder ──────────────────────────────────────────────────────────────

/**
 * Writes a realistic weekly schedule to localStorage.
 *
 * Today (the current day of week) receives 4 entries placed relative to the
 * current Israel time:
 *   • past   — 2 periods before the pivot (already finished)
 *   • now    — the pivot period (active or the very next one)
 *   • next   — 2 periods after the pivot (upcoming)
 *   • later  — 4 periods after the pivot (later today)
 *
 * All other school days (Sun–Thu) receive 3 spread entries.
 */
function seedDefaultSchedule(classes: readonly ClassData[], semester: Semester): Record<string, string> {
  const n = classes.length;
  const getClassId = (i: number): string => classes[i % n]?.id ?? '';

  const seed: Record<string, string> = {};
  const todayDay = new Date().getDay(); // 0=Sun … 4=Thu
  const nowMin   = nowInIsraelMinutes();

  // Find the first period that is currently active or has not yet started
  let pivot = PERIOD_STARTS.length - 3; // fallback: late afternoon
  for (let p = 0; p < PERIOD_STARTS.length; p++) {
    const start = parseMinutes(PERIOD_STARTS[p] ?? '00:00');
    if (nowMin < start + PERIOD_MINUTES) { pivot = p; break; }
  }

  // Today: 4 strategic entries
  if (todayDay <= 4) {
    const past  = Math.max(0, pivot - 2);
    const now   = pivot;
    const next  = Math.min(pivot + 2, PERIOD_STARTS.length - 2);
    const later = Math.min(pivot + 4, PERIOD_STARTS.length - 1);

    seed[`${todayDay}-${past}`]  = getClassId(0);
    if (now !== past)
      seed[`${todayDay}-${now}`]   = getClassId(1);
    if (next !== now)
      seed[`${todayDay}-${next}`]  = getClassId(2);
    if (later !== next)
      seed[`${todayDay}-${later}`] = getClassId(0);
  }

  // Other school days: 3 classes spread across the day (periods 1, 4, 8)
  const spreadPeriods: ReadonlyArray<number> = [1, 4, 8];
  for (let d = 0; d <= 4; d++) {
    if (d === todayDay) continue;
    for (let i = 0; i < spreadPeriods.length; i++) {
      const p = spreadPeriods[i];
      if (p !== undefined) seed[`${d}-${p}`] = getClassId(i);
    }
  }

  try {
    localStorage.setItem(storageKey(semester), JSON.stringify(seed));
  } catch { /* storage quota exceeded — ignore */ }

  return seed;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodaySchedule(semester: Semester): {
  lessons:   TodayScheduleItem[] | undefined;
  isLoading: boolean;
  error:     unknown;
} {
  const { data: classes, isLoading: classesLoading } = useClasses();
  const [schedule, setSchedule]                       = useState<Record<string, string> | null>(null);
  const seededRef                                     = useRef(false);

  // ── Read localStorage ───────────────────────────────────────────────────────
  const readStorage = useCallback((): void => {
    try {
      const raw = localStorage.getItem(storageKey(semester));
      setSchedule(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    } catch {
      setSchedule({});
    }
  }, [semester]);

  // Mount: initial read + 60-second refresh for live status transitions
  useEffect(() => {
    readStorage();
    const intervalId = setInterval(readStorage, 60_000);
    return () => clearInterval(intervalId);
  }, [readStorage]);

  // Cross-tab sync: picks up schedule changes made in the Schedule page (other tab)
  useEffect(() => {
    function onStorageChange(e: StorageEvent): void {
      if (e.key === storageKey(semester)) readStorage();
    }
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, [readStorage, semester]);

  // ── Auto-seed when schedule is empty and classes are ready ─────────────────
  // Only seed for Semester A (default view). Semester B starts empty until the
  // teacher explicitly assigns classes to slots.
  useEffect(() => {
    if (
      seededRef.current                  || // already ran this session
      semester !== 'A'                   || // only auto-seed semester A
      classesLoading                     || // classes not ready yet
      !classes                           ||
      classes.length === 0               || // no classes to fill
      schedule === null                  || // localStorage not read yet
      Object.keys(schedule).length > 0     // schedule already has entries
    ) return;

    seededRef.current = true;
    setSchedule(seedDefaultSchedule(classes, semester));
  }, [schedule, classes, classesLoading, semester]);

  // ── Derive today's lessons with computed statuses ──────────────────────────

  if (schedule === null || classesLoading) {
    return { lessons: undefined, isLoading: true, error: undefined };
  }

  const todayDay = new Date().getDay();
  if (todayDay > 4) {
    // Shabbat / Friday — no school
    return { lessons: [], isLoading: false, error: undefined };
  }

  const nowMin      = nowInIsraelMinutes();
  let   assignedNext = false;
  const lessons: TodayScheduleItem[] = [];

  for (let p = 0; p < PERIOD_STARTS.length; p++) {
    const classId = schedule[`${todayDay}-${p}`];
    if (!classId) continue;

    const startTime = PERIOD_STARTS[p] ?? '00:00';
    const start     = parseMinutes(startTime);
    const end       = start + PERIOD_MINUTES;

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

    const className = classes?.find((c) => c.id === classId)?.name ?? '—';
    lessons.push({ period: p, startTime, classId, className, status });
  }

  return { lessons, isLoading: false, error: undefined };
}
