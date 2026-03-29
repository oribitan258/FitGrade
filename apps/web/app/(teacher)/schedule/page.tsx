'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  Play,
  X,
} from 'lucide-react';
import { useClasses } from '@/hooks/use-classes';
import type { ClassData } from '@fitgrade/types';
import { cn } from '@/lib/utils';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'fitgrade-schedule-v1';

/** Israeli school week: Sunday → Thursday. */
const DAYS = [
  { label: 'ראשון',  shortLabel: 'א׳' },
  { label: 'שני',   shortLabel: 'ב׳' },
  { label: 'שלישי', shortLabel: 'ג׳' },
  { label: 'רביעי', shortLabel: 'ד׳' },
  { label: 'חמישי', shortLabel: 'ה׳' },
] as const;

const PERIODS = [
  { label: '1',  time: '07:30–08:15' },
  { label: '2',  time: '08:15–09:00' },
  { label: '3',  time: '09:00–09:45' },
  { label: '4',  time: '10:05–10:50' },
  { label: '5',  time: '10:50–11:35' },
  { label: '6',  time: '11:55–12:40' },
  { label: '7',  time: '12:40–13:25' },
  { label: '8',  time: '13:25–14:10' },
  { label: '9',  time: '14:15–15:00' },
  { label: '10', time: '15:00–15:45' },
  { label: '11', time: '15:45–16:30' },
  { label: '12', time: '16:30–17:15' },
  { label: '13', time: '17:20–18:05' },
  { label: '14', time: '18:10–18:55' },
  { label: '15', time: '19:00–19:45' },
  { label: '16', time: '19:45–20:00' },
] as const;

/** Glassmorphic accent palette — matches `/classes` page. */
const CLASS_ACCENTS = [
  { bg: 'rgba(99,102,241,0.18)',  border: 'rgba(99,102,241,0.35)',  text: '#4338ca', badgeBg: 'rgba(99,102,241,0.14)',  dot: '#6366f1' },
  { bg: 'rgba(20,184,166,0.18)',  border: 'rgba(20,184,166,0.35)',  text: '#0f766e', badgeBg: 'rgba(20,184,166,0.14)',  dot: '#14b8a6' },
  { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.35)', text: '#6d28d9', badgeBg: 'rgba(139,92,246,0.14)', dot: '#8b5cf6' },
  { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.35)', text: '#065f46', badgeBg: 'rgba(16,185,129,0.14)', dot: '#10b981' },
  { bg: 'rgba(14,165,233,0.18)', border: 'rgba(14,165,233,0.35)', text: '#0369a1', badgeBg: 'rgba(14,165,233,0.14)', dot: '#0ea5e9' },
] as const;

type AccentTuple = typeof CLASS_ACCENTS[number];

// ─── Class picker modal ───────────────────────────────────────────────────────

interface ClassPickerProps {
  classes: ClassData[];
  onPick: (classId: string) => void;
  onClose: () => void;
  getAccent: (cls: ClassData) => AccentTuple;
}

function ClassPicker({ classes, onPick, onClose, getAccent }: ClassPickerProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
        className="w-full max-w-sm rounded-3xl p-5"
        style={{
          background:           'rgba(255,255,255,0.92)',
          backdropFilter:       'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border:               '1px solid rgba(255,255,255,0.7)',
          boxShadow:            '0 24px 64px rgba(15,23,42,0.22)',
        }}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">בחר כיתה</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="סגור"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {classes.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4">אין כיתות — צור כיתה תחילה</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {classes.map((cls) => {
              const accent = getAccent(cls);
              return (
                <motion.button
                  key={cls.id}
                  type="button"
                  onClick={() => onPick(cls.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-2xl px-4 py-3 text-start transition-all"
                  style={{
                    background: accent.bg,
                    border:     `1px solid ${accent.border}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: accent.dot }}
                    />
                    <span className="flex-1 text-sm font-bold" style={{ color: accent.text }}>
                      {cls.name}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {cls.studentCount} תל׳
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Schedule Cell ─────────────────────────────────────────────────────────────

interface CellProps {
  cls:       ClassData | undefined;
  accent:    AccentTuple | undefined;
  onOpen:    () => void;
  onRemove:  () => void;
  onAdd:     () => void;
}

function ScheduleCell({ cls, accent, onOpen, onRemove, onAdd }: CellProps): React.JSX.Element {
  if (!cls || !accent) {
    return (
      <motion.button
        type="button"
        onClick={onAdd}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="group relative h-full w-full rounded-xl border border-dashed border-slate-200/70 bg-white/20 transition-all duration-200 hover:border-indigo-300/60 hover:bg-indigo-50/30"
        aria-label="הוסף כיתה"
      >
        <span className="text-slate-300 group-hover:text-indigo-400 text-lg transition-colors select-none">+</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      className="relative h-full w-full rounded-xl overflow-hidden cursor-pointer group"
      style={{
        background:           accent.bg,
        border:               `1px solid ${accent.border}`,
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:            `0 2px 12px ${accent.border}`,
      }}
      whileHover={{ scale: 1.03, zIndex: 10 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Open lesson link */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-2"
        aria-label={`פתח שיעור — ${cls.name}`}
      >
        <span
          className="text-[11px] font-black leading-tight text-center"
          style={{ color: accent.text }}
        >
          {cls.name}
        </span>
        <span
          className="hidden group-hover:flex items-center gap-0.5 text-[9px] font-bold opacity-80 mt-0.5"
          style={{ color: accent.text }}
        >
          <Play className="h-2.5 w-2.5" aria-hidden="true" />
          פתח
        </span>
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-0.5 end-0.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
        aria-label={`הסר ${cls.name} מהמשבצת`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage(): React.JSX.Element {
  const router = useRouter();
  const { activeSemester } = useSemester();
  const { data: classes, isLoading } = useClasses();

  /** key = "dayIndex-periodIndex" → classId */
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  /** Cell key being assigned — opens picker modal when set */
  const [pickingCell, setPickingCell] = useState<string | null>(null);

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSchedule(JSON.parse(raw) as Record<string, string>);
    } catch {
      // Ignore parse errors — start fresh
    }
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function cellKey(day: number, period: number): string {
    return `${day}-${period}`;
  }

  function getAccent(cls: ClassData): AccentTuple {
    const index = (classes ?? []).findIndex((c) => c.id === cls.id);
    return CLASS_ACCENTS[(index >= 0 ? index : 0) % CLASS_ACCENTS.length]!;
  }

  function getClassForCell(day: number, period: number): ClassData | undefined {
    const classId = schedule[cellKey(day, period)];
    return classId ? (classes ?? []).find((c) => c.id === classId) : undefined;
  }

  function persistSchedule(next: Record<string, string>): void {
    setSchedule(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded — silently ignore
    }
  }

  function handleAssign(classId: string): void {
    if (!pickingCell) return;
    persistSchedule({ ...schedule, [pickingCell]: classId });
    setPickingCell(null);
  }

  function handleRemove(day: number, period: number): void {
    const next = { ...schedule };
    delete next[cellKey(day, period)];
    persistSchedule(next);
  }

  function handleOpenLesson(classId: string): void {
    router.push(`/classes/${classId}/lesson`);
  }

  // ── Today highlight ────────────────────────────────────────────────────────
  // getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Our day index 0=Sun, 1=Mon, ... 4=Thu
  const todayDayIndex = new Date().getDay(); // 0-6
  const todayColIndex = todayDayIndex <= 4 ? todayDayIndex : -1; // highlight only Sun-Thu

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
      className="space-y-6"
      dir="rtl"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">מערכת שעות</h1>
          <p className="mt-1 text-sm text-slate-500">
            לחץ על משבצת ריקה להוספת כיתה, לחץ על כיתה לפתיחת שיעור
          </p>
        </div>
        <motion.div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
          style={{
            background:           'rgba(255,255,255,0.55)',
            backdropFilter:       'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border:               '1px solid rgba(255,255,255,0.7)',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
        >
          <CalendarDays className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-700">
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </motion.div>
      </div>

      <SemesterTransitionWrapper activeSemester={activeSemester}>
      {/* ── Legend ──────────────────────────────────────────────────── */}
      {!isLoading && classes && classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {classes.map((cls, i) => {
            const accent = CLASS_ACCENTS[i % CLASS_ACCENTS.length]!;
            return (
              <span
                key={cls.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: accent.bg, border: `1px solid ${accent.border}`, color: accent.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.dot }} />
                {cls.name}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
        className="overflow-x-auto rounded-3xl"
        style={{
          background:           'rgba(255,255,255,0.52)',
          backdropFilter:       'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border:               '1px solid rgba(255,255,255,0.70)',
          boxShadow:            '0 8px 40px rgba(15,23,42,0.10)',
        }}
      >
        <div className="min-w-[620px]">

          {/* Column headers (period label col + 5 day cols) */}
          <div className="grid border-b border-slate-100/80" style={{ gridTemplateColumns: '5.5rem repeat(5, 1fr)' }}>
            {/* Top-start corner (period column header) */}
            <div className="border-e border-slate-100/60 px-2 py-3" />

            {DAYS.map((day, dayIdx) => {
              const isToday = dayIdx === todayColIndex;
              return (
                <div
                  key={day.label}
                  className={cn(
                    'px-2 py-3 text-center border-e border-slate-100/60 last:border-e-0',
                    isToday && 'bg-indigo-50/50',
                  )}
                >
                  <p className={cn(
                    'text-xs font-bold',
                    isToday ? 'text-indigo-600' : 'text-slate-600',
                  )}>
                    {day.label}
                  </p>
                  {isToday && (
                    <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-indigo-500" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Period rows */}
          {PERIODS.map((period, periodIdx) => (
            <div
              key={period.label}
              className="grid border-b border-slate-100/60 last:border-b-0"
              style={{ gridTemplateColumns: '5.5rem repeat(5, 1fr)', height: '4.5rem' }}
            >
              {/* Period label */}
              <div className="flex flex-col items-center justify-center border-e border-slate-100/60 px-1 py-1 gap-0.5">
                <span className="text-sm font-black text-slate-700">{period.label}</span>
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums leading-tight text-center">{period.time}</span>
              </div>

              {/* Day cells */}
              {DAYS.map((_, dayIdx) => {
                const isToday = dayIdx === todayColIndex;
                const cls = isLoading ? undefined : getClassForCell(dayIdx, periodIdx);
                const accent = cls ? getAccent(cls) : undefined;
                const key = cellKey(dayIdx, periodIdx);

                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center justify-center border-e border-slate-100/60 last:border-e-0 p-1',
                      isToday && 'bg-indigo-50/30',
                    )}
                  >
                    {isLoading ? (
                      <div className="h-8 w-full animate-pulse rounded-lg bg-slate-100/60" />
                    ) : (
                      <ScheduleCell
                        cls={cls}
                        accent={accent}
                        onOpen={() => cls && handleOpenLesson(cls.id)}
                        onRemove={() => handleRemove(dayIdx, periodIdx)}
                        onAdd={() => setPickingCell(key)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Empty state: no classes ──────────────────────────────────── */}
      {!isLoading && classes?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/50 py-14 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
            <BookOpen className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-slate-700">אין כיתות עדיין</p>
            <p className="mt-1 text-sm text-slate-400">צור כיתות תחילה מדף &quot;הכיתות שלי&quot;</p>
          </div>
        </motion.div>
      )}

      </SemesterTransitionWrapper>

      {/* ── Class picker modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {pickingCell !== null && classes && (
          <ClassPicker
            key="picker"
            classes={classes}
            onPick={handleAssign}
            onClose={() => setPickingCell(null)}
            getAccent={getAccent}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
