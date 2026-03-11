'use client';

/**
 * פטורים — Active Exemptions Dashboard
 *
 * Shows all students currently marked as EXCUSED (פטור/פצוע) for today,
 * grouped by class. Teacher can revoke any exemption from this single view.
 *
 * Data flow:
 *   useClasses()                              → list of teacher's classes
 *   GET /classes/:id/attendance?date=today    → attendance records (studentId + status)
 *   useStudents(classId)                      → student names (joined client-side)
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Loader2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useClasses, useStudents } from '@/hooks/use-classes';
import { apiRequest } from '@/lib/api-client';
import { ApiError } from '@fitgrade/types';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id:                 string;
  studentId:          string;
  status:             'PRESENT' | 'ABSENT' | 'EXCUSED';
  exemptionReason:    string | null;
  exemptionExpiresAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function apiFetcher<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'error' | 'success' }

// ─── Class Exemptions Panel ───────────────────────────────────────────────────

interface ClassPanelProps {
  classId:   string;
  className: string;
  today:     string;
  onToast:   (t: ToastState) => void;
}

function ClassExemptionsPanel({ classId, className, today, onToast }: ClassPanelProps): React.JSX.Element {
  const [expanded, setExpanded]     = useState(true);
  const [revoking, setRevoking]     = useState<Set<string>>(new Set());

  const { data: students }   = useStudents(classId);
  const { data: attendance, mutate, isLoading } = useSWR<AttendanceRecord[]>(
    `/classes/${classId}/attendance?date=${today}&activeOnly=true`,
    apiFetcher,
    { revalidateOnFocus: false },
  );

  // With activeOnly=true, all returned records are active EXCUSED ones — build a map for metadata
  const exemptRecordMap = new Map<string, AttendanceRecord>(
    (attendance ?? []).map((r) => [r.studentId, r]),
  );

  // Join with student names
  const exemptStudents = (students ?? []).filter((s) => exemptRecordMap.has(s.id));

  const exemptCount = isLoading ? null : exemptStudents.length;

  async function handleRevoke(studentId: string): Promise<void> {
    if (revoking.has(studentId)) return;
    setRevoking((prev) => new Set([...prev, studentId]));
    try {
      await apiRequest(`/classes/${classId}/attendance`, {
        method: 'POST',
        body:   JSON.stringify({ date: today, records: [{ studentId, status: 'PRESENT' }] }),
      });
      await mutate();
      onToast({ message: 'הפטור בוטל בהצלחה', type: 'success' });
    } catch (err) {
      onToast({
        message: err instanceof ApiError ? err.message : 'שגיאה בביטול הפטור',
        type:    'error',
      });
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-3xl"
      style={{
        background:           'rgba(255,255,255,0.62)',
        backdropFilter:       'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:               '1px solid rgba(255,255,255,0.75)',
        boxShadow:            '0 8px 40px rgba(15,23,42,0.09)',
      }}
    >
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start hover:bg-slate-50/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <ShieldAlert className="h-5 w-5 text-orange-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{className}</p>
            <p className="text-xs text-slate-500">
              {isLoading ? 'טוען...' : `${exemptCount} פטורים פעילים להיום`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {exemptCount !== null && exemptCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
              {exemptCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100/70 px-5 pb-4 pt-2">
              {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  טוען נתוני נוכחות...
                </div>
              ) : exemptStudents.length === 0 ? (
                <div className="flex items-center gap-2 py-5 text-sm text-emerald-600">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  אין תלמידים פטורים בכיתה זו היום
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  <AnimatePresence>
                    {exemptStudents.map((student) => {
                      const initials   = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`;
                      const isRevoking = revoking.has(student.id);
                      const record     = exemptRecordMap.get(student.id);
                      const expiryDate = record?.exemptionExpiresAt
                        ? new Date(record.exemptionExpiresAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null;

                      return (
                        <motion.li
                          key={student.id}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8, scale: 0.97 }}
                          transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
                          className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                          style={{
                            background: 'rgba(255,237,213,0.55)',
                            border:     '1px solid rgba(251,146,60,0.20)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-xs font-bold text-orange-600">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {student.firstName} {student.lastName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <code className="font-mono text-[11px] text-slate-400">
                                  {student.studentCode}
                                </code>
                                <span className="rounded-full bg-orange-200/70 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                  פטור/ה
                                </span>
                              </div>
                              {record?.exemptionReason && (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  <span className="font-semibold">סיבה:</span> {record.exemptionReason}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400">
                                {expiryDate ? `תוקף עד: ${expiryDate}` : 'ללא הגבלת זמן'}
                              </p>
                            </div>
                          </div>

                          {/* Revoke button */}
                          <motion.button
                            type="button"
                            onClick={() => { void handleRevoke(student.id); }}
                            disabled={isRevoking}
                            whileHover={isRevoking ? {} : { scale: 1.04 }}
                            whileTap={isRevoking ? {} : { scale: 0.96 }}
                            className={cn(
                              'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all',
                              isRevoking
                                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                                : 'bg-white/80 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/80 hover:border-emerald-300',
                            )}
                            aria-label={`בטל פטור עבור ${student.firstName} ${student.lastName}`}
                          >
                            {isRevoking ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {isRevoking ? 'מבטל...' : 'בטל פטור'}
                          </motion.button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps { toast: ToastState; onDismiss: () => void }
function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      onAnimationComplete={() => { setTimeout(onDismiss, 3000); }}
      className="fixed bottom-6 start-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl"
      style={{
        transform:            'translateX(-50%)',
        background:           toast.type === 'success' ? 'rgba(5,150,105,0.92)' : 'rgba(220,38,38,0.92)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               toast.type === 'success' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
      }}
    >
      {toast.type === 'success' ? (
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {toast.message}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExemptionsPage(): React.JSX.Element {
  const today = todayIso();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleToast = useCallback((t: ToastState) => { setToast(t); }, []);

  if (classesLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-white/70" />
        <div className="h-36 animate-pulse rounded-3xl bg-white/50" />
        <div className="h-36 animate-pulse rounded-3xl bg-white/40" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
        className="space-y-5"
        dir="rtl"
      >
        {/* ── Page header ───────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.25)]">
            <ShieldAlert className="h-6 w-6 text-orange-600" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">פטורים</h1>
            <p className="text-sm text-slate-500">
              תלמידים עם פטור פעיל להיום · {today}
            </p>
          </div>
        </div>

        {/* ── No classes ────────────────────────────────────── */}
        {(!classes || classes.length === 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white/50 py-16 text-center"
          >
            <Users className="h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="font-semibold text-slate-600">אין כיתות רשומות</p>
            <p className="text-sm text-slate-400">הוסף כיתות מדף הכיתות שלי</p>
          </motion.div>
        )}

        {/* ── Class panels ──────────────────────────────────── */}
        <div className="space-y-3">
          {(classes ?? []).map((cls, i) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
            >
              <ClassExemptionsPanel
                classId={cls.id}
                className={cls.name}
                today={today}
                onToast={handleToast}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Toast ─────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast key="toast" toast={toast} onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
