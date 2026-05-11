'use client';

import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UserPlus,
} from 'lucide-react';
import {
  createClassSchema,
  type ClassData,
  type CreateClassInput,
  ApiError,
} from '@fitgrade/types';
import { formatClassWithGender } from '@/lib/class-utils';
import { apiRequest, apiUpload } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// ─── Constants ────────────────────────────────────────────────────────────────

const SELECT_STYLES =
  'flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const CLASS_GRADE_OPTIONS = [
  { label: "א'",  value: 1  }, { label: "ב'",  value: 2  }, { label: "ג'",  value: 3  },
  { label: "ד'",  value: 4  }, { label: "ה'",  value: 5  }, { label: "ו'",  value: 6  },
  { label: "ז'",  value: 7  }, { label: "ח'",  value: 8  }, { label: "ט'",  value: 9  },
  { label: "י'",  value: 10 }, { label: 'י"א', value: 11 }, { label: 'י"ב', value: 12 },
] as const;

function computeAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'details' | 'import' | 'success';

interface ImportResult {
  added: number;
  existing: number;
  reEnrolled: number;
}

export interface CreateClassWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ['details', 'import', 'success'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'פרטי כיתה',
  import: 'ייבוא תלמידים',
  success: 'סיכום',
};

function StepIndicator({ current }: { current: WizardStep }): React.JSX.Element {
  const currentIndex = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center justify-center gap-1 pb-2 pt-1">
      {STEP_ORDER.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-200',
            i <= currentIndex ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400',
          )}>
            {i < currentIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={cn(
            'text-xs font-medium transition-colors',
            i === currentIndex ? 'text-indigo-700' : 'text-slate-400',
          )}>
            {STEP_LABELS[step]}
          </span>
          {i < STEP_ORDER.length - 1 && (
            <div className={cn(
              'mx-1 h-px w-6 transition-colors duration-300',
              i < currentIndex ? 'bg-indigo-400' : 'bg-slate-200',
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Details ──────────────────────────────────────────────────────────

function DetailsStep({ onCreated }: { onCreated: (classId: string) => void }): React.JSX.Element {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateClassInput>({
    resolver: zodResolver(createClassSchema),
    defaultValues: { genderType: 'MIXED', academicYear: computeAcademicYear() },
  });

  const watchedName   = watch('name')       ?? '';
  const watchedGender = watch('genderType') ?? 'MIXED';

  async function onSubmit(data: CreateClassInput): Promise<void> {
    try {
      const result = await apiRequest<ClassData>('/classes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      onCreated(result.id);
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'שגיאה ביצירת הכיתה',
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wiz-name" className="text-slate-700 font-medium">שם הכיתה</Label>
          <Input
            id="wiz-name"
            placeholder="כיתה י' 1"
            className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wiz-year" className="text-slate-700 font-medium">שנת לימודים</Label>
          <Input
            id="wiz-year"
            placeholder="2024-2025"
            className="h-11 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
            {...register('academicYear')}
          />
          {errors.academicYear && <p className="text-xs text-red-600">{errors.academicYear.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wiz-gender" className="text-slate-700 font-medium">הרכב כיתה</Label>
        <select id="wiz-gender" className={cn(SELECT_STYLES)} {...register('genderType')}>
          <option value="MIXED">מעורב</option>
          <option value="BOYS">בנים</option>
          <option value="GIRLS">בנות</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wiz-grade" className="text-slate-700 font-medium">
          שכבה
          <span className="ms-1 text-xs text-slate-400 font-normal">(אופציונלי)</span>
        </Label>
        <select
          id="wiz-grade"
          className={cn(SELECT_STYLES)}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            setValue('gradeLevel', v !== '' ? Number(v) : undefined);
          }}
        >
          <option value="">לא ידוע</option>
          {CLASS_GRADE_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>כיתה {label}</option>
          ))}
        </select>
      </div>

      {watchedName.length > 0 && (
        <div className="rounded-xl bg-indigo-50/80 border border-indigo-100 px-3 py-2 text-xs text-indigo-700 font-medium">
          שם הכיתה:{' '}
          <span className="font-bold">{formatClassWithGender(watchedName, watchedGender)}</span>
        </div>
      )}

      {errors.root && (
        <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />שומר...</>
              : 'צור כיתה'}
          </Button>
        </motion.div>
      </div>
    </form>
  );
}

// ─── Step 2: Import ───────────────────────────────────────────────────────────

interface ImportStepProps {
  classId: string;
  onImported: (result: ImportResult) => void;
  onSkip: () => void;
}

function ImportStep({ classId, onImported, onSkip }: ImportStepProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [isUploading,  setIsUploading]  = useState(false);
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File): Promise<void> => {
    setUploadedName(file.name);
    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload<ImportResult>(`/classes/${classId}/students/import`, formData);
      onImported(result);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'שגיאה בייבוא הקובץ');
      setUploadedName(null);
    } finally {
      setIsUploading(false);
    }
  }, [classId, onImported]);

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-4 pt-1">
      <p className="text-sm text-slate-500">
        העלה קובץ Excel עם רשימת התלמידים. ניתן לדלג ולהוסיף ידנית מאוחר יותר.
      </p>

      <div
        role="button"
        aria-label="העלה קובץ Excel"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => { setIsDragging(false); }}
        onDrop={onDrop}
        onClick={() => { fileInputRef.current?.click(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all select-none',
          isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={onFileChange}
        />
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" aria-hidden="true" />
            <p className="text-sm font-medium text-indigo-600">מעלה {uploadedName}...</p>
          </>
        ) : (
          <>
            <FileSpreadsheet className="h-10 w-10 text-slate-300" aria-hidden="true" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-600">גרור קובץ לכאן</p>
              <p className="text-xs text-slate-400 mt-0.5">או לחץ לבחירת קובץ Excel / CSV</p>
            </div>
          </>
        )}
      </div>

      {uploadError !== null && (
        <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          type="button"
          onClick={onSkip}
          className="rounded-xl text-slate-500 text-sm"
        >
          דלג על ייבוא
        </Button>
        <span className="text-xs text-slate-400">Excel / CSV — עד 5MB</span>
      </div>
    </div>
  );
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────

interface StatPillProps { label: string; value: number; color: 'emerald' | 'slate' | 'indigo' }

function StatPill({ label, value, color }: StatPillProps): React.JSX.Element {
  const colorMap: Record<StatPillProps['color'], string> = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    slate:   'bg-slate-50 border-slate-100 text-slate-600',
    indigo:  'bg-indigo-50 border-indigo-100 text-indigo-700',
  };
  return (
    <div className={cn('flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3', colorMap[color])}>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-[0.65rem] font-semibold tracking-wide">{label}</span>
    </div>
  );
}

interface SuccessStepProps {
  classId: string;
  importResult: ImportResult | null;
  onClose: () => void;
}

function SuccessStep({ classId, importResult, onClose }: SuccessStepProps): React.JSX.Element {
  const router = useRouter();

  return (
    <div className="space-y-5 pt-1">
      <div className="flex flex-col items-center gap-2 py-2">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden="true" />
        <p className="text-lg font-bold text-slate-800">הכיתה נוצרה בהצלחה!</p>
      </div>

      {importResult !== null ? (
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="נוספו" value={importResult.added} color="emerald" />
          <StatPill label="קיימים" value={importResult.existing} color="slate" />
          <StatPill label="שויכו מחדש" value={importResult.reEnrolled} color="indigo" />
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">
          לא יובאו תלמידים — ניתן להוסיפם ידנית מתוך דף הכיתה.
        </p>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="outline" type="button" onClick={onClose} className="rounded-xl">
          סגור
        </Button>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            type="button"
            className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            onClick={() => { onClose(); router.push(`/classes/${classId}`); }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            עבור לכיתה
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Wizard root ──────────────────────────────────────────────────────────────

export function CreateClassWizard({
  open,
  onOpenChange,
  onSuccess,
}: CreateClassWizardProps): React.JSX.Element {
  const [step,           setStep]           = useState<WizardStep>('details');
  const [createdClassId, setCreatedClassId] = useState<string | null>(null);
  const [importResult,   setImportResult]   = useState<ImportResult | null>(null);

  function handleClose(): void {
    onOpenChange(false);
    onSuccess?.();
    setTimeout(() => {
      setStep('details');
      setCreatedClassId(null);
      setImportResult(null);
    }, 300);
  }

  const TITLE: Record<WizardStep, string> = {
    details: 'צור כיתה חדשה',
    import:  'ייבוא תלמידים לכיתה',
    success: 'הכיתה מוכנה!',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-800">{TITLE[step]}</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18 }}
          >
            {step === 'details' && (
              <DetailsStep onCreated={(id) => { setCreatedClassId(id); setStep('import'); }} />
            )}
            {step === 'import' && createdClassId !== null && (
              <ImportStep
                classId={createdClassId}
                onImported={(result) => { setImportResult(result); setStep('success'); }}
                onSkip={() => { setImportResult(null); setStep('success'); }}
              />
            )}
            {step === 'success' && createdClassId !== null && (
              <SuccessStep
                classId={createdClassId}
                importResult={importResult}
                onClose={handleClose}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
