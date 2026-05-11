'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/ui/back-button';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  Clock,
  Coffee,
  Handshake,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useClasses } from '@/hooks/use-classes';
import { useSignalPageReady } from '@/components/tour/use-signal-page-ready';
import type { ScheduleEvent, ScheduleEventType } from '@/hooks/use-today-schedule';
import { PERIOD_STARTS } from '@/hooks/use-today-schedule';
import { useSemester } from '@/contexts/semester-context';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';
import type { ClassData, Semester } from '@fitgrade/types';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = (semester: Semester): string => `fitgrade-schedule-v2-${semester}`;

const EASE = [0.22, 1, 0.36, 1] as const;

const DAYS = [
  { label: 'ראשון',  short: "א'" },
  { label: 'שני',    short: "ב'" },
  { label: 'שלישי',  short: "ג'" },
  { label: 'רביעי',  short: "ד'" },
  { label: 'חמישי',  short: "ה'" },
  { label: 'שישי',   short: "ו'" }, // index 5 — optional
] as const;

const CLASS_ACCENTS = [
  { bg: 'rgba(99,102,241,0.16)',  border: 'rgba(99,102,241,0.38)',  text: '#4338ca' },
  { bg: 'rgba(20,184,166,0.16)',  border: 'rgba(20,184,166,0.38)',  text: '#0f766e' },
  { bg: 'rgba(139,92,246,0.16)', border: 'rgba(139,92,246,0.38)', text: '#6d28d9' },
  { bg: 'rgba(16,185,129,0.16)', border: 'rgba(16,185,129,0.38)', text: '#065f46' },
  { bg: 'rgba(14,165,233,0.16)', border: 'rgba(14,165,233,0.38)', text: '#0369a1' },
] as const;

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function formatDuration(start: string, end: string): string {
  const diff = parseMinutes(end) - parseMinutes(start);
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} דק'`;
  return m === 0 ? `${h} שע'` : `${h} שע' ${m} דק'`;
}

// ─── Event style helpers ──────────────────────────────────────────────────────

interface EventColors {
  bg: string; border: string; text: string; label: string; Icon: React.ElementType;
}

function eventColors(type: ScheduleEventType, classIdx?: number): EventColors {
  if (type === 'lesson') {
    const accent = CLASS_ACCENTS[(classIdx ?? 0) % CLASS_ACCENTS.length]!;
    return { bg: accent.bg, border: accent.border, text: accent.text, label: 'שיעור', Icon: Users };
  }
  if (type === 'break') {
    return { bg: 'rgba(16,185,129,0.11)', border: 'rgba(16,185,129,0.28)', text: '#065f46', label: 'הפסקה', Icon: Coffee };
  }
  return { bg: 'rgba(245,158,11,0.11)', border: 'rgba(245,158,11,0.28)', text: '#92400e', label: 'פגישה', Icon: Handshake };
}

// ─── Gap detection & timeline builder ────────────────────────────────────────

interface GapSlot   { kind: 'gap';   startTime: string; endTime: string; }
interface EventSlot { kind: 'event'; event: ScheduleEvent; }
type TimelineSlot = EventSlot | GapSlot;

function buildTimeline(events: ScheduleEvent[]): TimelineSlot[] {
  const sorted = [...events].sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));
  const slots: TimelineSlot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const evt  = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev) {
      const gap = parseMinutes(evt.startTime) - parseMinutes(prev.endTime);
      if (gap >= 5) slots.push({ kind: 'gap', startTime: prev.endTime, endTime: evt.startTime });
    }
    slots.push({ kind: 'event', event: evt });
  }
  return slots;
}

// ─── Add-Event Modal ──────────────────────────────────────────────────────────

interface EventModalProps {
  classes:    ClassData[];
  initialDay: number;
  showFriday: boolean;
  onSave:     (event: ScheduleEvent) => void;
  onClose:    () => void;
}

function EventModal({ classes, initialDay, showFriday, onSave, onClose }: EventModalProps): React.JSX.Element {
  const [type,      setType]      = useState<ScheduleEventType>('lesson');
  const [day,       setDay]       = useState<number>(initialDay);
  const [classId,   setClassId]   = useState<string>(classes[0]?.id ?? '');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime,   setEndTime]   = useState('08:45');

  const isValid = startTime < endTime && (type !== 'lesson' || classId !== '');

  function handleSave(): void {
    onSave({ id: crypto.randomUUID(), type, classId: type === 'lesson' ? classId : undefined, startTime, endTime, day });
    onClose();
  }

  const TYPE_OPTIONS: Array<{ value: ScheduleEventType; label: string; color: string }> = [
    { value: 'lesson',  label: 'שיעור', color: '#6366f1' },
    { value: 'break',   label: 'הפסקה', color: '#10b981' },
    { value: 'meeting', label: 'פגישה', color: '#f59e0b' },
  ];

  // Only show days that are visible in the tabs
  const visibleDayCount = showFriday ? 6 : 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.60)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ ease: EASE, duration: 0.35 }}
        className="w-full max-w-sm rounded-3xl p-6"
        style={{
          background:           'rgba(255,255,255,0.96)',
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border:               '1px solid rgba(255,255,255,0.85)',
          boxShadow:            '0 32px 80px rgba(15,23,42,0.24), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">הוספת אירוע</h2>
            <p className="text-xs text-slate-400">הגדר את פרטי האירוע ולחץ שמור</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="סגור">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Event type pills */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">סוג אירוע</p>
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
            {TYPE_OPTIONS.map(({ value, label, color }) => {
              const active = type === value;
              return (
                <button key={value} type="button" onClick={() => setType(value)}
                  className="rounded-lg py-2 text-xs font-bold transition-all duration-200"
                  style={{ background: active ? color : 'transparent', color: active ? '#fff' : '#64748b', boxShadow: active ? `0 2px 8px ${color}55` : 'none' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day selector */}
        <div className="mb-4">
          <label htmlFor="event-day" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">יום</label>
          <select id="event-day" value={day} onChange={(e) => setDay(parseInt(e.target.value, 10))}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-400">
            {DAYS.slice(0, visibleDayCount).map((d, i) => (
              <option key={i} value={i}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Class selector */}
        {type === 'lesson' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ ease: EASE, duration: 0.2 }}
            className="mb-4 overflow-hidden">
            <label htmlFor="event-class" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">כיתה</label>
            {classes.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">אין כיתות — צור כיתה תחילה מדף &quot;הכיתות שלי&quot;</p>
            ) : (
              <select id="event-class" value={classId} onChange={(e) => setClassId(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-400">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </motion.div>
        )}

        {/* Time pickers */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-start" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">התחלה</label>
            <input id="event-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-400" />
          </div>
          <div>
            <label htmlFor="event-end" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">סיום</label>
            <input id="event-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-400" />
          </div>
        </div>
        {!isValid && startTime >= endTime && startTime !== '' && (
          <p className="mb-3 -mt-4 text-xs text-red-500">שעת הסיום חייבת להיות אחרי שעת ההתחלה</p>
        )}

        <motion.button type="button" onClick={handleSave} disabled={!isValid}
          whileHover={{ scale: isValid ? 1.02 : 1 }} whileTap={{ scale: isValid ? 0.97 : 1 }}
          className="h-12 w-full rounded-2xl text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
          שמור אירוע
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── Timeline Block ───────────────────────────────────────────────────────────

interface EventBlockProps {
  event:      ScheduleEvent;
  classData?: ClassData;
  classIdx:   number;
  onRemove:   () => void;
  onOpen:     () => void;
}

function EventBlock({ event, classData, classIdx, onRemove, onOpen }: EventBlockProps): React.JSX.Element {
  const colors   = eventColors(event.type, classIdx);
  const { Icon } = colors;
  const duration = formatDuration(event.startTime, event.endTime);

  return (
    <motion.div layout
      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8, scale: 0.97 }} transition={{ ease: EASE, duration: 0.28 }}
      className="group relative flex items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: `0 2px 16px ${colors.border}60` }}>
      <div className="absolute start-0 top-3 bottom-3 w-1 rounded-full" style={{ background: colors.border }} aria-hidden="true" />
      <div className="ms-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${colors.border}55` }}>
        <Icon className="h-4 w-4" style={{ color: colors.text }} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" style={{ color: colors.text }}>
          {event.type === 'lesson' ? (classData?.name ?? '—') : colors.label}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
          {event.startTime} – {event.endTime}
          {duration && <span className="ms-1 opacity-70">({duration})</span>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {event.type === 'lesson' && classData && (
          <button type="button" onClick={onOpen}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-slate-600 transition-colors hover:bg-white hover:text-indigo-600"
            aria-label={`פתח שיעור — ${classData.name}`}>
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onRemove}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          aria-label="הסר אירוע">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Gap Block ────────────────────────────────────────────────────────────────

function GapBlock({ startTime, endTime }: { startTime: string; endTime: string }): React.JSX.Element {
  const duration = formatDuration(startTime, endTime);
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(241,245,249,0.65)', border: '1px dashed rgba(148,163,184,0.40)', backdropFilter: 'blur(8px)' }}
      aria-label={`חלון זמן ריק ${startTime}–${endTime}`}>
      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
      <p className="text-xs font-semibold text-slate-400">
        חלון פנוי · {startTime}–{endTime}
        {duration && <span className="ms-1 opacity-70">({duration})</span>}
      </p>
    </div>
  );
}

// ─── Day Timeline ─────────────────────────────────────────────────────────────

interface DayTimelineProps {
  slots:        TimelineSlot[];
  classes:      ClassData[];
  onRemove:     (id: string) => void;
  onOpenLesson: (classId: string) => void;
}

function DayTimeline({ slots, classes, onRemove, onOpenLesson }: DayTimelineProps): React.JSX.Element {
  if (slots.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/40 py-12 text-center">
        <CalendarDays className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="font-semibold text-slate-500">אין אירועים ביום זה</p>
        <p className="text-sm text-slate-400">לחץ על + כדי להוסיף שיעור, הפסקה או פגישה</p>
      </motion.div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {slots.map((slot) => {
          if (slot.kind === 'gap') {
            return <GapBlock key={`gap-${slot.startTime}-${slot.endTime}`} startTime={slot.startTime} endTime={slot.endTime} />;
          }
          const { event } = slot;
          const classData = event.classId ? classes.find((c) => c.id === event.classId) : undefined;
          const classIdx  = classData ? classes.findIndex((c) => c.id === event.classId) : 0;
          return (
            <EventBlock key={event.id} event={event} classData={classData}
              classIdx={classIdx >= 0 ? classIdx : 0}
              onRemove={() => onRemove(event.id)}
              onOpen={() => event.classId && onOpenLesson(event.classId)} />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulePage(): React.JSX.Element {
  const router = useRouter();
  const { activeSemester } = useSemester();
  const { data: classes, isLoading: classesLoading } = useClasses();

  useSignalPageReady('schedule', classes !== undefined);

  // Today's day index (0=Sun … 5=Fri, 6=Sat)
  const todayDayRaw = new Date().getDay();
  // Default tab: clamp Saturday → Sunday, allow Friday (5)
  const defaultDay  = todayDayRaw === 6 ? 0 : Math.min(todayDayRaw, 5);

  const [activeDay,  setActiveDay]  = useState<number>(defaultDay);
  const [events,     setEvents]     = useState<ScheduleEvent[]>([]);
  const [showModal,  setShowModal]  = useState(false);
  const initializedRef = useRef<string>('');

  // Load schedule from localStorage
  useEffect(() => {
    const sem    = activeSemester as Semester;
    const semKey = String(sem);
    if (initializedRef.current === semKey) return;

    try {
      const rawV2 = localStorage.getItem(STORAGE_KEY(sem));
      if (rawV2) {
        setEvents(JSON.parse(rawV2) as ScheduleEvent[]);
        initializedRef.current = semKey;
        return;
      }
      if (!classesLoading) {
        const rawV1 =
          localStorage.getItem(`fitgrade-schedule-v1-${semKey}`) ??
          localStorage.getItem('fitgrade-schedule-v1');
        if (rawV1) {
          const v1       = JSON.parse(rawV1) as Record<string, string>;
          const migrated = migrateV1(v1);
          setEvents(migrated);
          try { localStorage.setItem(STORAGE_KEY(sem), JSON.stringify(migrated)); } catch { /* quota */ }
        }
        initializedRef.current = semKey;
      }
    } catch {
      setEvents([]);
      initializedRef.current = String(activeSemester);
    }
  }, [activeSemester, classesLoading]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function migrateV1(v1: Record<string, string>): ScheduleEvent[] {
    return Object.entries(v1).map(([key, classId]) => {
      const [dayStr = '0', periodStr = '0'] = key.split('-');
      const day       = parseInt(dayStr, 10);
      const periodIdx = parseInt(periodStr, 10);
      const startTime = PERIOD_STARTS[periodIdx] ?? '07:30';
      const endMins   = parseMinutes(startTime) + 45;
      const endTime   = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;
      return { id: `migrated-${key}`, type: 'lesson' as const, classId, startTime, endTime, day };
    });
  }

  const persistEvents = useCallback((next: ScheduleEvent[]): void => {
    setEvents(next);
    try { localStorage.setItem(STORAGE_KEY(activeSemester as Semester), JSON.stringify(next)); } catch { /* quota */ }
  }, [activeSemester]);

  function handleAddEvent(event: ScheduleEvent): void { persistEvents([...events, event]); }
  function handleRemoveEvent(id: string): void { persistEvents(events.filter((e) => e.id !== id)); }
  function handleOpenLesson(classId: string): void { router.push(`/classes/${classId}/lesson`); }

  // ── Derived state ──────────────────────────────────────────────────────────

  const visibleDayCount = 6;

  const dayEvents = events.filter((e) => e.day === activeDay);
  const timeline  = buildTimeline(dayEvents);

  // Today dot index: -1 on Saturday (no school)
  const todayColIdx = todayDayRaw <= 5 ? todayDayRaw : -1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <BackButton />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.55 }}
        className="flex flex-col gap-5 pb-28 pt-16 md:pt-0"
        dir="rtl"
      >
        <SemesterTransitionWrapper activeSemester={activeSemester}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">מערכת שעות</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {DAYS[activeDay]?.label} · {events.filter((e) => e.day === activeDay).length} אירועים
              </p>
            </div>
            <motion.div
              className="flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.75)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, ease: EASE, duration: 0.45 }}
            >
              <CalendarDays className="h-4 w-4 text-indigo-500" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-700 md:text-sm">
                {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </motion.div>
          </div>

          {/* ── Day Tabs ─────────────────────────────────────────────────── */}
          <div
            className="grid grid-cols-6 gap-1 rounded-2xl p-1"
            style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.72)', boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
            role="tablist"
            aria-label="ימות השבוע"
          >
            {DAYS.slice(0, visibleDayCount).map((day, idx) => {
              const isActive = idx === activeDay;
              const isToday  = idx === todayColIdx;
              const count    = events.filter((e) => e.day === idx).length;
              return (
                <button
                  key={day.label}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveDay(idx)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 font-bold transition-all min-h-[52px]',
                    'text-[11px]',
                    isActive
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 active:bg-slate-100',
                  )}
                >
                  {/* On mobile show short form (א', ב' …); on sm+ show full label */}
                  <span className="hidden sm:inline">{day.label}</span>
                  <span className="sm:hidden">{day.short}</span>
                  {count > 0 && (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none',
                      isActive ? 'bg-white/30 text-white' : 'bg-indigo-100 text-indigo-600',
                    )}>
                      {count}
                    </span>
                  )}
                  {isToday && !isActive && (
                    <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-indigo-500" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>


          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <motion.div
            key={activeDay}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: EASE, duration: 0.3 }}
          >
            {classesLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-100/70" />
                ))}
              </div>
            ) : (classes?.length === 0 && events.length === 0) ? (
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
            ) : (
              <DayTimeline
                slots={timeline}
                classes={classes ?? []}
                onRemove={handleRemoveEvent}
                onOpenLesson={handleOpenLesson}
              />
            )}
          </motion.div>

        </SemesterTransitionWrapper>
      </motion.div>

      {/* ── Floating Action Button ───────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={() => setShowModal(true)}
        aria-label="הוסף אירוע"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ease: EASE, delay: 0.4, duration: 0.4 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl text-white print:hidden"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 8px 28px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.12)' }}
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </motion.button>

      {/* ── Event Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <EventModal
            key="event-modal"
            classes={classes ?? []}
            initialDay={activeDay}
            showFriday={true}
            onSave={handleAddEvent}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
