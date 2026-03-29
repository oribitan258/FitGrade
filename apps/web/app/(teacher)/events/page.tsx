'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, MapPin, Plus, Trash2, Calendar } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { createEventSchema } from '@fitgrade/types';
import type { CreateEventInput, EventData } from '@fitgrade/types';
import { useEvents } from '@/hooks/use-events';
import { apiRequest } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSemester } from '@/contexts/semester-context';
import { SemesterBadge } from '@/components/ui/semester-badge';
import { SemesterTransitionWrapper } from '@/components/layout/semester-transition-wrapper';

// ─── Animation presets ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;
const ITEM = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.4 } },
  exit:   { opacity: 0, y: -8, transition: { ease: EASE, duration: 0.25 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).format(new Date(iso));
}

function daysUntil(iso: string): number {
  return Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function getDaysBadge(days: number): { text: string; cls: string } {
  if (days < 0)  return { text: 'עבר',           cls: 'bg-slate-100 text-slate-500' };
  if (days === 0) return { text: 'היום',          cls: 'bg-green-100 text-green-700' };
  if (days === 1) return { text: 'מחר',           cls: 'bg-amber-100 text-amber-700' };
  if (days <= 7)  return { text: `עוד ${days} ימים`, cls: 'bg-amber-100 text-amber-700' };
  return            { text: `עוד ${days} ימים`, cls: 'bg-indigo-50 text-indigo-600' };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-slate-200/60" />
      ))}
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onDelete,
}: {
  event: EventData;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const days = daysUntil(event.eventDate);
  const badge = getDaysBadge(days);
  const isPast = days < 0;

  return (
    <motion.div
      layout
      variants={ITEM}
      initial="hidden"
      animate="show"
      exit="exit"
      whileHover={isPast ? {} : { y: -2, boxShadow: '0 12px 36px rgba(99,102,241,0.14)', transition: { ease: EASE, duration: 0.3 } }}
      className={`rounded-2xl border p-5 backdrop-blur-xl shadow-[0_4px_20px_rgba(15,23,42,0.08)] ${
        isPast
          ? 'border-slate-200/60 bg-slate-50/70'
          : 'border-white/80 bg-white/70'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className={`flex shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[52px] ${
          isPast ? 'bg-slate-200/80 text-slate-400' : 'bg-indigo-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.35)]'
        }`}>
          <span className="text-xl font-extrabold leading-none tabular-nums">
            {new Date(event.eventDate).getDate()}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
            {new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(new Date(event.eventDate))}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className={`text-base font-bold truncate ${isPast ? 'text-slate-400' : 'text-slate-900'}`}>
              {event.title}
            </h3>
            <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
              {badge.text}
            </span>
          </div>

          {event.description && (
            <p className={`text-sm mb-1.5 line-clamp-2 ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
              {event.description}
            </p>
          )}

          <div className={`flex flex-wrap items-center gap-3 text-xs ${isPast ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
              {formatEventDate(event.eventDate)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => onDelete(event.id)}
          aria-label={`מחק אירוע: ${event.title}`}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Add Event Dialog ─────────────────────────────────────────────────────────

function AddEventDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({ resolver: zodResolver(createEventSchema) });

  async function onSubmit(data: CreateEventInput): Promise<void> {
    await apiRequest('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start">הוספת אירוע חדש</DialogTitle>
          <DialogDescription className="text-start">
            הוסף אירוע ספורטיבי ללוח האירועים של הכיתה
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4 mt-2" noValidate>
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title">כותרת האירוע *</Label>
            <Input
              id="event-title"
              placeholder="יום ספורט בית-ספרי"
              {...register('title')}
              aria-describedby={errors.title ? 'event-title-err' : undefined}
            />
            {errors.title && (
              <p id="event-title-err" className="text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="event-date">תאריך האירוע *</Label>
            <Input
              id="event-date"
              type="date"
              {...register('eventDate')}
              aria-describedby={errors.eventDate ? 'event-date-err' : undefined}
            />
            {errors.eventDate && (
              <p id="event-date-err" className="text-xs text-red-600">{errors.eventDate.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="event-location">מיקום</Label>
            <Input
              id="event-location"
              placeholder="מגרש הספורט"
              {...register('location')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">תיאור</Label>
            <Textarea
              id="event-desc"
              placeholder="פרטים נוספים על האירוע..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'שומר...' : 'הוסף אירוע'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  title,
  onConfirm,
  onClose,
  isDeleting,
}: {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start">מחיקת אירוע</DialogTitle>
          <DialogDescription className="text-start">
            האם למחוק את האירוע &quot;{title}&quot;? פעולה זו אינה ניתנת לביטול.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>ביטול</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'מוחק...' : 'מחק'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventsPage(): React.JSX.Element {
  const { activeSemester } = useSemester();
  const { data: events, isLoading, mutate } = useEvents();
  const { mutate: globalMutate } = useSWRConfig();

  const [addOpen, setAddOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventData | null>(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  async function handleCreated(): Promise<void> {
    await mutate();
    await globalMutate('/events/upcoming');
    setAddOpen(false);
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/events/${deleteTarget.id}`, { method: 'DELETE' });
      await mutate();
      await globalMutate('/events/upcoming');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const now = new Date();
  const upcoming = events?.filter((e) => new Date(e.eventDate) >= now) ?? [];
  const past     = events?.filter((e) => new Date(e.eventDate) < now)  ?? [];

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.25)]"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CalendarDays className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              אירועים וטורנירים
            </h1>
            <p className="text-sm text-slate-500">ניהול אירועים ספורטיביים בית-ספריים</p>
          </div>
        </div>

        <Button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 shadow-[0_2px_12px_rgba(99,102,241,0.30)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוסף אירוע
          <SemesterBadge />
        </Button>
      </div>

      <SemesterTransitionWrapper activeSemester={activeSemester}>
      {isLoading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-8">
          {/* Upcoming events */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              אירועים קרובים ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center"
              >
                <CalendarDays className="h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="text-sm text-slate-400">אין אירועים קרובים — לחץ &quot;הוסף אירוע&quot; כדי להוסיף</p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {upcoming.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDelete={(id) => setDeleteTarget(events!.find((e) => e.id === id) ?? null)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </section>

          {/* Past events */}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                אירועים שעברו ({past.length})
              </h2>
              <AnimatePresence mode="popLayout">
                <div className="space-y-3">
                  {past.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDelete={(id) => setDeleteTarget(events!.find((e) => e.id === id) ?? null)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </section>
          )}
        </div>
      )}
      </SemesterTransitionWrapper>

      <AddEventDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { void handleCreated(); }}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.title ?? ''}
        onConfirm={() => { void handleDelete(); }}
        onClose={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </>
  );
}
