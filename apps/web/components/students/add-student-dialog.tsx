'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Loader2, Upload, UserPlus, X } from 'lucide-react';
import {
  createStudentSchema,
  type CreateStudentInput,
  type StudentData,
  ApiError,
} from '@fitgrade/types';
import { apiRequest, apiUpload } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const SELECT_STYLES =
  'flex h-14 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

interface AddStudentDialogProps {
  classId: string;
  genderType: 'BOYS' | 'GIRLS' | 'MIXED';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AddStudentResponse {
  student: StudentData;
}

interface ImportResult {
  added: number;
  existing: number;
  reEnrolled: number;
  errors: Array<{ row: number; nationalId?: string; reason: string }>;
}

type Tab = 'manual' | 'import';

// ─── Import Tab ────────────────────────────────────────────────────────────────

function ImportTab({
  classId,
  onSuccess,
  onClose,
}: {
  classId: string;
  onSuccess: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const fileInputRef             = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]      = useState<ImportResult | null>(null);
  const [error, setError]        = useState<string | null>(null);
  const [fileName, setFileName]  = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(xlsx|csv)$/i)) {
      setError('סוג קובץ לא נתמך — יש לבחור קובץ Excel (.xlsx) או CSV');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('הקובץ גדול מדי — גודל מקסימלי 5MB');
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload<ImportResult>(
        `/classes/${classId}/students/import`,
        formData,
      );
      setResult(res);
      if (res.added > 0 || res.reEnrolled > 0) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'שגיאה בייבוא הקובץ');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent): void {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  }

  if (result) {
    const hasErrors = result.errors.length > 0;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-700 mb-2">ייבוא הושלם ✓</p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-white p-2">
              <p className="text-2xl font-black text-emerald-600">{result.added}</p>
              <p className="text-xs text-slate-500 mt-0.5">נוספו</p>
            </div>
            <div className="rounded-xl bg-white p-2">
              <p className="text-2xl font-black text-blue-600">{result.reEnrolled}</p>
              <p className="text-xs text-slate-500 mt-0.5">הצטרפו מחדש</p>
            </div>
            <div className="rounded-xl bg-white p-2">
              <p className="text-2xl font-black text-slate-400">{result.existing}</p>
              <p className="text-xs text-slate-500 mt-0.5">כבר קיימים</p>
            </div>
          </div>
        </div>

        {hasErrors && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-red-600">שורות שנכשלו ({result.errors.length}):</p>
            <ul className="max-h-32 overflow-y-auto rounded-xl border border-red-100 bg-red-50 divide-y divide-red-100">
              {result.errors.map((e) => (
                <li key={e.row} className="px-3 py-1.5 text-xs text-red-700">
                  <span className="font-bold">שורה {e.row}</span>
                  {e.nationalId ? ` · ת.ז ${e.nationalId}` : ''} — {e.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={onClose} className="h-12 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700">
          סיום
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        העלה קובץ Excel (.xlsx) או CSV עם עמודות: <span className="font-bold text-slate-700">מספר זהות, שם פרטי, שם משפחה</span>. עמודת מגדר אופציונלית.
      </p>

      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 bg-slate-50/80 hover:border-indigo-300 hover:bg-indigo-50/30',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="העלה קובץ"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={onFileChange}
          className="sr-only"
          aria-hidden="true"
        />
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-600">
              מייבא <span className="text-indigo-600">{fileName}</span>...
            </p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
              <FileUp className="h-6 w-6 text-indigo-500" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">גרור קובץ לכאן</p>
              <p className="text-xs text-slate-400 mt-0.5">או לחץ לבחירת קובץ · Excel / CSV · עד 5MB</p>
            </div>
            {fileName && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {fileName}
              </span>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Upload className="me-2 h-4 w-4" aria-hidden="true" />
        בחר קובץ
      </Button>
    </div>
  );
}

// ─── Main Dialog ───────────────────────────────────────────────────────────────

export function AddStudentDialog({
  classId,
  genderType,
  open,
  onOpenChange,
  onSuccess,
}: AddStudentDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('manual');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CreateStudentInput>({ resolver: zodResolver(createStudentSchema) });

  async function onSubmit(data: CreateStudentInput): Promise<void> {
    if (genderType === 'GIRLS' && data.gender === 'MALE') {
      setError('gender', { message: 'לא ניתן להוסיף תלמיד זכר לכיתת בנות' });
      return;
    }
    if (genderType === 'BOYS' && data.gender === 'FEMALE') {
      setError('gender', { message: 'לא ניתן להוסיף תלמידה נקבה לכיתת בנים' });
      return;
    }
    try {
      await apiRequest<AddStudentResponse>(
        `/classes/${classId}/students`,
        { method: 'POST', body: JSON.stringify(data) },
      );
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setError('nationalId', { message: err.message });
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'שגיאה בהוספת התלמיד' });
      }
    }
  }

  function handleClose(next: boolean): void {
    if (!next) { reset(); setTab('manual'); }
    onOpenChange(next);
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title="הוסף תלמיד לכיתה"
      description={tab === 'manual' ? 'מלא את פרטי התלמיד. תעודת זהות נדרשת להתחברות.' : 'ייבוא רשימת תלמידים מקובץ Excel או CSV'}
      className="max-w-lg"
    >
      {/* Tab switcher */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {([
          { key: 'manual', label: 'הוסף ידנית', icon: UserPlus },
          { key: 'import', label: 'ייבוא מקובץ', icon: FileUp },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all',
              tab === key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'manual' ? (
          <motion.form
            key="manual"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
                <Label htmlFor="add-sf" className="font-medium text-slate-700">שם פרטי</Label>
                <Input
                  id="add-sf"
                  placeholder="ישראל"
                  className="h-14 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
                  {...register('firstName')}
                />
                {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
              </motion.div>
              <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
                <Label htmlFor="add-sl" className="font-medium text-slate-700">שם משפחה</Label>
                <Input
                  id="add-sl"
                  placeholder="ישראלי"
                  className="h-14 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
                  {...register('lastName')}
                />
                {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
              </motion.div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
                <Label htmlFor="add-sn" className="font-medium text-slate-700">תעודת זהות</Label>
                <Input
                  id="add-sn"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="123456789"
                  className="h-14 rounded-xl border-slate-200 bg-slate-50/80 focus-visible:ring-indigo-400"
                  {...register('nationalId')}
                />
                {errors.nationalId
                  ? <p className="text-xs text-red-600">{errors.nationalId.message}</p>
                  : <p className="text-[11px] text-slate-400">(ת.ז תשמש כשם המשתמש והסיסמה של התלמיד)</p>
                }
              </motion.div>
              <motion.div className="space-y-1.5" whileHover={{ y: -1 }}>
                <Label htmlFor="add-sg" className="font-medium text-slate-700">מין</Label>
                <select id="add-sg" className={cn(SELECT_STYLES)} {...register('gender')}>
                  <option value="">בחר מין</option>
                  <option value="MALE">זכר</option>
                  <option value="FEMALE">נקבה</option>
                  <option value="OTHER">אחר</option>
                </select>
                {errors.gender && <p className="text-xs text-red-600">{errors.gender.message}</p>}
              </motion.div>
            </div>

            {errors.root && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errors.root.message}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => { handleClose(false); }}
                className="h-14 w-full rounded-xl sm:h-10 sm:w-auto"
              >
                ביטול
              </Button>
              <motion.div whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-14 w-full gap-2 rounded-xl bg-indigo-600 shadow-sm hover:bg-indigo-700 sm:h-10 sm:w-auto"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  {isSubmitting ? 'מוסיף...' : 'הוסף תלמיד'}
                </Button>
              </motion.div>
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="import"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            <ImportTab
              classId={classId}
              onSuccess={onSuccess}
              onClose={() => handleClose(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveDialog>
  );
}
