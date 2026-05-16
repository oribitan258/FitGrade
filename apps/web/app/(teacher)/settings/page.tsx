'use client';

/**
 * Settings page — Report & Grading Presentation
 *
 * Section 1: Grading Policy (existing WeightSlider — unchanged)
 * Section 2: Report settings — passing grade, teacher name, school name,
 *             and drawn signature (Base64 PNG stored as teacherSignature).
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import { motion } from 'framer-motion';
import {
  Settings2,
  CheckCircle2,
  AlertCircle,
  Eraser,
  FileText,
  Loader2,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { useSWRConfig } from 'swr';

import { WeightSlider } from '@/components/ui/weight-slider';
import { useGradingPolicy, updateGradingPolicy } from '@/hooks/use-grading-policy';
import {
  useReportSettings,
  updateReportSettings,
  REPORT_SETTINGS_KEY,
} from '@/hooks/use-report-settings';
import { useCurrentTeacher } from '@/hooks/use-current-teacher';
import { apiRequest } from '@/lib/api-client';
import { fireConfetti } from '@/lib/confetti';
import { useTour } from '@/components/tour/TourProvider';

// ─── Animation variants ───────────────────────────────────────────────────────

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { staggerChildren: 0.07 } },
};
const ITEM = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

// ─── Form types ───────────────────────────────────────────────────────────────

interface ReportFormValues {
  passingGrade: number;
  teacherName: string;
  schoolName: string;
}

// ─── Glassmorphism card wrapper ───────────────────────────────────────────────

function GlassCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <motion.div
      variants={ITEM}
      className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }): React.JSX.Element {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { teacher } = useCurrentTeacher();
  const { notifySettingsMounted } = useTour();

  // Drive tour cleanup: finishing → cleanup → idle
  useEffect(() => { notifySettingsMounted(); }, [notifySettingsMounted]);
  const isOnboardingComplete = teacher?.isOnboardingComplete ?? true;

  // Ref used by "שמור וסיים מדריך" to signal the submit handler to also complete onboarding
  const finishAfterSaveRef = useRef(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // ── Grading policy (existing) ─────────────────────────────────────────────
  const { data: policy, isLoading: policyLoading, error: policyError } = useGradingPolicy();

  const [fitnessWeight, setFitnessWeight] = useState(55);
  const [conductWeight, setConductWeight] = useState(45);
  const [policyIsSaving, setPolicyIsSaving] = useState(false);
  const [policySaveStatus, setPolicySaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (policy) {
      setFitnessWeight(policy.fitnessWeight);
      setConductWeight(policy.conductWeight);
    }
  }, [policy]);

  function handleWeightChange(fw: number, cw: number): void {
    setFitnessWeight(fw);
    setConductWeight(cw);
    setPolicySaveStatus('idle');
  }

  async function handlePolicySave(): Promise<void> {
    if (fitnessWeight + conductWeight !== 100) return;
    setPolicyIsSaving(true);
    setPolicySaveStatus('idle');
    try {
      const updated = await updateGradingPolicy({ fitnessWeight, conductWeight });
      await mutate('/settings/grading-policy', updated, false);
      setPolicySaveStatus('success');
      setTimeout(() => setPolicySaveStatus('idle'), 3000);
    } catch {
      setPolicySaveStatus('error');
    } finally {
      setPolicyIsSaving(false);
    }
  }

  const isPolicyDirty =
    policy !== undefined &&
    (fitnessWeight !== policy.fitnessWeight || conductWeight !== policy.conductWeight);

  // ── Report settings ────────────────────────────────────────────────────────
  const { data: reportSettings, isLoading: reportLoading } = useReportSettings();
  const [reportSaveStatus, setReportSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reportIsSaving, setReportIsSaving] = useState(false);

  const { control, handleSubmit, reset, formState: { isDirty: isReportDirty, isValid: isReportValid } } =
    useForm<ReportFormValues>({
      mode: 'onChange',
      defaultValues: {
        passingGrade: 60,
        teacherName: '',
        schoolName: '',
      },
    });

  // ── Signature canvas — declared before effects that reference them ─────────
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [sigIsEmpty, setSigIsEmpty] = useState(true);
  // Defer canvas mount to browser only (canvas API not available during SSR)
  const [canvasMounted, setCanvasMounted] = useState(false);
  useEffect(() => { setCanvasMounted(true); }, []);

  // Sync form once data arrives
  useEffect(() => {
    if (reportSettings) {
      reset({
        passingGrade: reportSettings.passingGrade,
        teacherName:  reportSettings.teacherName ?? '',
        schoolName:   reportSettings.schoolName ?? '',
      });
    }
  }, [reportSettings, reset]);

  // Restore drawn signature only after canvas is mounted — canvas API unavailable during SSR
  useEffect(() => {
    if (canvasMounted && reportSettings?.teacherSignature && sigCanvasRef.current) {
      sigCanvasRef.current.fromDataURL(reportSettings.teacherSignature);
      setSigIsEmpty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMounted, reportSettings?.teacherSignature]);

  const handleSigEnd = useCallback(() => {
    setSigIsEmpty(sigCanvasRef.current?.isEmpty() ?? true);
  }, []);

  function clearSignature(): void {
    sigCanvasRef.current?.clear();
    setSigIsEmpty(true);
  }

  // ── Report form submit ────────────────────────────────────────────────────
  async function onReportSubmit(values: ReportFormValues): Promise<void> {
    setReportIsSaving(true);
    setReportSaveStatus('idle');
    const shouldFinish = finishAfterSaveRef.current;
    finishAfterSaveRef.current = false;
    try {
      const sigDataUrl: string | null = sigIsEmpty
        ? null
        : (sigCanvasRef.current?.toDataURL('image/png') ?? null);

      const updated = await updateReportSettings({
        passingGrade:     values.passingGrade,
        teacherName:      values.teacherName.trim() || null,
        schoolName:       values.schoolName.trim() || null,
        teacherSignature: sigDataUrl,
      });
      await mutate(REPORT_SETTINGS_KEY, updated, false);
      reset({
        passingGrade: updated.passingGrade,
        teacherName:  updated.teacherName ?? '',
        schoolName:   updated.schoolName ?? '',
      });

      if (shouldFinish) {
        await completeOnboarding();
      } else {
        setReportSaveStatus('success');
        setTimeout(() => setReportSaveStatus('idle'), 3000);
      }
    } catch {
      setReportSaveStatus('error');
    } finally {
      setReportIsSaving(false);
    }
  }

  async function completeOnboarding(): Promise<void> {
    setIsFinishing(true);
    try {
      await apiRequest('/auth/onboarding/complete', { method: 'POST' });
      await mutate('/auth/me');
      fireConfetti();
      router.push('/dashboard');
    } catch {
      setIsFinishing(false);
    }
  }

  async function handleFinishLater(): Promise<void> {
    await completeOnboarding();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-8 pt-16 px-4 pb-4 md:p-6"
      dir="rtl"
      variants={PAGE_ENTER}
      initial="hidden"
      animate="show"
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100">
          <Settings2 className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">הגדרות</h1>
          <p className="text-sm text-slate-500">מדיניות ציונים, דוחות וחתימה</p>
        </div>
      </motion.div>

      {/* ── Section 1: Grading Policy ─────────────────────────────────────── */}
      <GlassCard>
        <SectionHeading
          title="מדיניות ציון — ברירת מחדל"
          subtitle="חלוקת המשקל בין כושר גופני לתלמידות בחישוב הציון הסופי המומלץ."
        />

        {policyLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : policyError ? (
          <p className="text-center text-sm text-red-500">שגיאה בטעינת ההגדרות</p>
        ) : (
          <>
            <WeightSlider
              fitnessWeight={fitnessWeight}
              conductWeight={conductWeight}
              onChange={handleWeightChange}
              disabled={policyIsSaving}
            />

            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-700">דוגמה לחישוב:</p>
              <p className="mt-1">
                תלמיד עם ממוצע כושר{' '}
                <span className="font-bold text-indigo-700">80</span> ותלמידות{' '}
                <span className="font-bold text-violet-700">90</span> יקבל ציון מומלץ:{' '}
                <span className="font-bold text-slate-800">
                  {Math.round(80 * (fitnessWeight / 100) + 90 * (conductWeight / 100))}
                </span>
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              {policySaveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> נשמר בהצלחה
                </span>
              )}
              {policySaveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                  <AlertCircle className="h-4 w-4" /> שגיאה בשמירה — נסה שוב
                </span>
              )}
              {policySaveStatus === 'idle' && <span />}

              <button
                type="button"
                onClick={() => { void handlePolicySave(); }}
                disabled={policyIsSaving || !isPolicyDirty || fitnessWeight + conductWeight !== 100}
                className="rounded-2xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {policyIsSaving ? 'שומר...' : 'שמור הגדרות'}
              </button>
            </div>
          </>
        )}
      </GlassCard>

      {/* ── Section 2: Report Settings ────────────────────────────────────── */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <FileText className="h-4 w-4 text-violet-600" />
          </div>
          <SectionHeading
            title="הגדרות דוחות"
            subtitle="פרטים שיופיעו בראש דוחות ה-PDF שתפיק"
          />
        </div>

        {reportLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : (
          <form data-tour="settings-form" onSubmit={(e) => { void handleSubmit(onReportSubmit)(e); }} noValidate>
            <div className="space-y-5">
              {/* Passing grade */}
              <Controller
                control={control}
                name="passingGrade"
                rules={{ required: true, min: 0, max: 100 }}
                render={({ field, fieldState }) => (
                  <FieldWrapper label="רף ציון עובר">
                    <input
                      {...field}
                      type="number"
                      min={0}
                      max={100}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    {fieldState.error && (
                      <p className="text-xs text-red-500">יש להזין ערך בין 0 ל-100</p>
                    )}
                    <p className="text-xs text-slate-400">
                      תלמידים מתחת לציון זה יסומנו כ&ldquo;לא עובר&rdquo; בדוחות
                    </p>
                  </FieldWrapper>
                )}
              />

              {/* Teacher name */}
              <Controller
                control={control}
                name="teacherName"
                render={({ field }) => (
                  <FieldWrapper label="שם המורה">
                    <input
                      {...field}
                      type="text"
                      placeholder="לדוגמה: אורי ביטן"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <p className="text-xs text-slate-400">
                      שם זה יוצג בברכה בדשבורד ובדוחות PDF
                    </p>
                  </FieldWrapper>
                )}
              />

              {/* School name */}
              <Controller
                control={control}
                name="schoolName"
                render={({ field }) => (
                  <FieldWrapper label="שם בית הספר">
                    <input
                      {...field}
                      type="text"
                      placeholder="לדוגמה: בית הספר הריאלי"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </FieldWrapper>
                )}
              />

              {/* Signature pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-700">
                    חתימת המורה
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="נקה חתימה"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    נקה חתימה
                  </button>
                </div>

                <div
                  className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors focus-within:border-indigo-300"
                  style={{ height: 140 }}
                >
                  {canvasMounted && (
                    <SignatureCanvas
                      ref={(ref) => { sigCanvasRef.current = ref; }}
                      penColor="#1e293b"
                      canvasProps={{
                        className: 'w-full h-full',
                        style: { touchAction: 'none' },
                      }}
                      onEnd={handleSigEnd}
                    />
                  )}
                </div>

                {sigIsEmpty && (
                  <p className="text-xs text-slate-400">
                    חתום כאן בעכבר או במגע — החתימה תופיע בתחתית דוחות ה-PDF
                  </p>
                )}
              </div>
            </div>

            {/* Save row */}
            <div className="mt-7 flex items-center justify-between gap-4 flex-wrap">
              {reportSaveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> נשמר בהצלחה
                </span>
              )}
              {reportSaveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                  <AlertCircle className="h-4 w-4" /> שגיאה בשמירה — נסה שוב
                </span>
              )}
              {reportSaveStatus === 'idle' && <span />}

              {isOnboardingComplete ? (
                /* ── Normal save button ── */
                <button
                  type="submit"
                  disabled={reportIsSaving || (!isReportDirty && sigIsEmpty && !reportSettings?.teacherSignature)}
                  className="flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reportIsSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {reportIsSaving ? 'שומר...' : 'שמור שינויים'}
                </button>
              ) : (
                /* ── Onboarding completion buttons ── */
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="submit"
                    disabled={reportIsSaving || isFinishing || !isReportDirty || !isReportValid}
                    onClick={() => { finishAfterSaveRef.current = true; }}
                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {(reportIsSaving || isFinishing) && <Loader2 className="h-4 w-4 animate-spin" />}
                    שמור וסיים מדריך
                  </button>
                  <button
                    type="button"
                    disabled={isFinishing}
                    onClick={() => { void handleFinishLater(); }}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    דלג וסיים מדריך
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </GlassCard>

      {/* ── Info box ──────────────────────────────────────────────────────── */}
      <motion.div
        variants={ITEM}
        className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800"
      >
        <p className="font-semibold">שינוי משקל לא ישפיע על ציונים ששמרת ידנית.</p>
        <p className="mt-1 text-amber-700">
          הציון המומלץ מחושב מחדש בכל פתיחה של דוח כיתה. ציון שנשמר על ידך ידנית נשאר ללא שינוי.
        </p>
      </motion.div>
    </motion.div>
  );
}
