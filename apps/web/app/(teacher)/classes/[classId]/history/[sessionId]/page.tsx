'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  Timer,
  Trash2,
  Users,
} from 'lucide-react';
import { useTestSession } from '@/hooks/use-test-session';
import { useResultMutations } from '@/hooks/use-result-mutations';
import { ResultRow } from '@/components/history/ResultRow';
import { DeleteSessionConfirmDialog } from '@/components/history/DeleteSessionConfirmDialog';
import { DeleteResultConfirmDialog } from '@/components/history/DeleteResultConfirmDialog';
import { GradeOverrideDialog } from '@/components/history/GradeOverrideDialog';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import type { LiveStudentResult, SessionDetail, SessionStudent } from '@fitgrade/types';
import { ApiError } from '@fitgrade/types';

// ─── Animation variants ────────────────────────────────────────────────────────

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 28,
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const ITEM = {
  hidden: { opacity: 0, y: 18, rotateX: 6 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 26 },
  },
};

const ROW_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const ROW_ITEM = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStudentMap(students: SessionStudent[]): Map<string, SessionStudent> {
  return new Map(students.map((s) => [s.id, s]));
}

function formatConductedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}


// ─── Dialog state ──────────────────────────────────────────────────────────────

type ActiveDialog =
  | { type: 'none' }
  | { type: 'deleteSession' }
  | { type: 'deleteResult'; resultId: string; studentName: string }
  | { type: 'overrideGrade'; resultId: string; studentName: string; currentOverride: number | null };

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SessionDetailPage(): React.JSX.Element {
  const { classId, sessionId } = useParams<{ classId: string; sessionId: string }>();
  const router = useRouter();
  const mutations = useResultMutations();

  const { data: session, isLoading, error, mutate: mutateSession } = useTestSession(sessionId);

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ type: 'none' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openDeleteSession(): void {
    setActiveDialog({ type: 'deleteSession' });
  }

  function openDeleteResult(result: LiveStudentResult, studentName: string): void {
    setActiveDialog({ type: 'deleteResult', resultId: result.resultId, studentName });
  }

  function openOverrideGrade(result: LiveStudentResult, studentName: string): void {
    setActiveDialog({
      type: 'overrideGrade',
      resultId: result.resultId,
      studentName,
      currentOverride: result.gradeOverride,
    });
  }

  function closeDialog(): void {
    setActiveDialog({ type: 'none' });
  }

  async function handleDeleteSession(): Promise<void> {
    setIsDeleting(true);
    // Navigate FIRST so /sessions/:sessionId is no longer subscribed when
    // invalidateAfterMutation fires — prevents a spurious 404 error toast. (per handoff)
    router.push(`/classes/${classId}/history`);
    try {
      await mutations.deleteSession(sessionId, classId);
    } catch (err) {
      setIsDeleting(false);
      setToastError(err instanceof ApiError ? err.message : 'שגיאה במחיקת המבחן');
    }
  }

  async function handleDeleteResult(): Promise<void> {
    if (activeDialog.type !== 'deleteResult') return;
    const { resultId, studentName } = activeDialog;

    setIsDeleting(true);

    // Optimistic: remove result from local SWR cache immediately
    await mutateSession(
      (current: SessionDetail | undefined) =>
        current === undefined
          ? undefined
          : { ...current, results: current.results.filter((r) => r.resultId !== resultId) },
      { revalidate: false },
    );

    closeDialog();

    try {
      await mutations.deleteResult(resultId, sessionId, classId);
    } catch (err) {
      // Rollback: refetch real data
      await mutateSession();
      setToastError(
        err instanceof ApiError ? err.message : `שגיאה במחיקת התוצאה של ${studentName}`,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleOverrideGrade(grade: number, reason: string): Promise<void> {
    if (activeDialog.type !== 'overrideGrade') return;
    const { resultId, studentName } = activeDialog;

    setIsOverriding(true);

    // Optimistic: update grade override in local SWR cache
    await mutateSession(
      (current: SessionDetail | undefined) =>
        current === undefined
          ? undefined
          : {
              ...current,
              results: current.results.map((r) =>
                r.resultId === resultId ? { ...r, gradeOverride: grade } : r,
              ),
            },
      { revalidate: false },
    );

    closeDialog();

    try {
      await mutations.overrideGrade(resultId, sessionId, classId, {
        gradeOverride: grade,
        overrideReason: reason,
      });
    } catch (err) {
      await mutateSession();
      setToastError(
        err instanceof ApiError ? err.message : `שגיאה בעקיפת הציון של ${studentName}`,
      );
    } finally {
      setIsOverriding(false);
    }
  }

  async function handleEditRawValue(resultId: string, newValue: number): Promise<void> {
    await mutations.editRawValue(resultId, sessionId, classId, newValue);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const studentMap = session !== undefined ? buildStudentMap(session.students) : new Map();
  const uniqueStudentCount = new Set(session?.results.map((r) => r.studentId) ?? []).size;

  return (
    <div className="min-h-screen px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <BackButton />

      <motion.div
        variants={PAGE_ENTER}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl"
        style={{ perspective: 800 }}
      >
        {/* Breadcrumb */}
        <motion.div variants={ITEM} className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href={`/classes/${classId}`} className="transition-colors hover:text-violet-600">
            כיתה
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/classes/${classId}/history`}
            className="flex items-center gap-1 transition-colors hover:text-violet-600"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            היסטוריה
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-slate-700 truncate max-w-[160px]">
            {session?.testNameHe ?? '...'}
          </span>
        </motion.div>

        {/* Session header */}
        {session !== undefined && (
          <motion.div variants={ITEM} className="mb-6">
            <div
              className="rounded-3xl p-5"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.70)',
                boxShadow:
                  '0 2px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    {session.isStopwatch ? (
                      <Timer className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <ClipboardList className="h-5 w-5" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-800">{session.testNameHe}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatConductedAt(session.conductedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {session.results.length} תוצאות
                      </span>
                      {session.completedAt !== null && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          הושלם
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete session button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openDeleteSession}
                  className="shrink-0 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="me-1.5 h-4 w-4" aria-hidden="true" />
                  מחק מבחן
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" aria-label="טוען..." />
          </div>
        )}

        {/* Error */}
        {error !== undefined && !isLoading && (
          <motion.div
            variants={ITEM}
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <p className="font-medium text-red-700">שגיאה בטעינת המבחן</p>
            <p className="mt-1 text-sm text-red-500">
              {error instanceof Error ? error.message : 'שגיאה לא ידועה'}
            </p>
          </motion.div>
        )}

        {/* Inline error toast */}
        <AnimatePresence>
          {toastError !== null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {toastError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results table */}
        {session !== undefined && session.results.length === 0 && (
          <motion.div
            variants={ITEM}
            className="flex flex-col items-center justify-center py-20 text-center text-slate-400"
          >
            <ClipboardList className="mb-3 h-10 w-10 opacity-30" aria-hidden="true" />
            <p className="text-base font-medium text-slate-500">אין תוצאות במבחן זה</p>
          </motion.div>
        )}

        {session !== undefined && session.results.length > 0 && (
          <motion.div variants={ITEM}>
            <div
              className="overflow-hidden rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.70)',
                boxShadow:
                  '0 2px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)',
              }}
            >
              <motion.div
                variants={ROW_STAGGER}
                className="divide-y divide-slate-100/80"
              >
                <AnimatePresence mode="popLayout">
                  {session.results.map((result) => (
                    <ResultRow
                      key={result.resultId}
                      result={result}
                      student={studentMap.get(result.studentId)}
                      inputType={session.testInputType}
                      unit={session.testUnit}
                      onEditRawValue={handleEditRawValue}
                      onOverride={(resultId) => {
                        const r = session.results.find((x) => x.resultId === resultId);
                        if (r === undefined) return;
                        const s = studentMap.get(r.studentId);
                        openOverrideGrade(r, s !== undefined ? `${s.firstName} ${s.lastName}` : 'תלמיד');
                      }}
                      onDelete={(resultId) => {
                        const r = session.results.find((x) => x.resultId === resultId);
                        if (r === undefined) return;
                        const s = studentMap.get(r.studentId);
                        openDeleteResult(r, s !== undefined ? `${s.firstName} ${s.lastName}` : 'תלמיד');
                      }}
                      variants={ROW_ITEM}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <DeleteSessionConfirmDialog
        open={activeDialog.type === 'deleteSession'}
        resultCount={session?.results.length ?? 0}
        studentCount={uniqueStudentCount}
        isDeleting={isDeleting}
        onConfirm={() => void handleDeleteSession()}
        onCancel={closeDialog}
      />

      <DeleteResultConfirmDialog
        open={activeDialog.type === 'deleteResult'}
        studentName={activeDialog.type === 'deleteResult' ? activeDialog.studentName : ''}
        isDeleting={isDeleting}
        onConfirm={() => void handleDeleteResult()}
        onCancel={closeDialog}
      />

      <GradeOverrideDialog
        open={activeDialog.type === 'overrideGrade'}
        studentName={activeDialog.type === 'overrideGrade' ? activeDialog.studentName : ''}
        currentOverride={
          activeDialog.type === 'overrideGrade' ? activeDialog.currentOverride : null
        }
        isSubmitting={isOverriding}
        onConfirm={(grade, reason) => void handleOverrideGrade(grade, reason)}
        onCancel={closeDialog}
      />
    </div>
  );
}
