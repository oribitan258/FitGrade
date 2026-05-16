'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type { ClassGenderType, Gender } from '@fitgrade/types';
import { formatClassWithGender } from '@/lib/class-utils';
import { apiRequest, apiUpload } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const GRADE_OPTIONS = [
  "א'", "ב'", "ג'", "ד'", "ה'", "ו'",
  "ז'", "ח'", "ט'", "י'", 'י"א', 'י"ב',
] as const;

type GradeOption = typeof GRADE_OPTIONS[number];

const GRADE_OPTION_TO_INT: Record<GradeOption, number> = {
  "א'": 1, "ב'": 2, "ג'": 3, "ד'": 4, "ה'": 5, "ו'": 6,
  "ז'": 7, "ח'": 8, "ט'": 9, "י'": 10, 'י"א': 11, 'י"ב': 12,
};

// ─── Local types ──────────────────────────────────────────────────────────────

interface ManualStudentRow {
  key:        string;
  firstName:  string;
  lastName:   string;
  nationalId: string;
}

interface ImportResult {
  added:       number;
  existing:    number;
  reEnrolled?: number;
  errors:      string[];
}

function makeRow(): ManualStudentRow {
  return { key: crypto.randomUUID(), firstName: '', lastName: '', nationalId: '' };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AddClassModalProps {
  open:    boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddClassModal({ open, onClose }: AddClassModalProps): React.JSX.Element {
  const router = useRouter();

  // ── Step 1 state ────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState<1 | 2>(1);
  const [grade,       setGrade]       = useState<GradeOption>("ז'");
  const [classNumber, setClassNumber] = useState('1');
  const [semester,    setSemester]    = useState<'A' | 'B'>('A');
  const [genderType,  setGenderType]  = useState<ClassGenderType>('MIXED');
  const [s1Loading,   setS1Loading]   = useState(false);
  const [s1Error,     setS1Error]     = useState<string | null>(null);
  const [createdId,   setCreatedId]   = useState<string | null>(null);

  // ── Step 2 state ────────────────────────────────────────────────────────────
  const [addMode,      setAddMode]      = useState<'manual' | 'excel'>('manual');
  const [rows,         setRows]         = useState<ManualStudentRow[]>([makeRow()]);
  const [excelFile,    setExcelFile]    = useState<File | null>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [s2Loading,    setS2Loading]    = useState(false);
  const [s2Error,      setS2Error]      = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset(): void {
    setStep(1); setGrade("ז'"); setClassNumber('1'); setSemester('A'); setGenderType('MIXED');
    setS1Loading(false); setS1Error(null); setCreatedId(null);
    setAddMode('manual'); setRows([makeRow()]); setExcelFile(null); setIsDragging(false);
    setS2Loading(false); setS2Error(null); setImportResult(null);
  }

  // ── Step 1: create the class ────────────────────────────────────────────────
  async function handleCreateClass(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setS1Loading(true); setS1Error(null);
    const now = new Date();
    const year = now.getFullYear();
    const academicYear = now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    const name = `כיתה ${grade} ${classNumber}`;
    try {
      const created = await apiRequest<{ id: string }>('/classes', {
        method: 'POST',
        body: JSON.stringify({ name, academicYear, semester, genderType, gradeLevel: GRADE_OPTION_TO_INT[grade] }),
      });
      setCreatedId(created.id);
      setStep(2);
    } catch (err: unknown) {
      setS1Error(err instanceof Error ? err.message : 'שגיאה ביצירת הכיתה');
    } finally {
      setS1Loading(false);
    }
  }

  // ── Step 2: add students ────────────────────────────────────────────────────
  async function handleAddStudents(): Promise<void> {
    if (!createdId) return;
    const inferGender = (): Gender => genderType === 'GIRLS' ? 'FEMALE' : 'MALE';
    setS2Loading(true); setS2Error(null);
    try {
      if (addMode === 'excel' && excelFile !== null) {
        const fd = new FormData();
        fd.append('file', excelFile);
        const res = await apiUpload<ImportResult>(`/classes/${createdId}/students/import`, fd);
        setImportResult(res);
        router.refresh();
        return;
      }
      const validRows = rows.filter(
        (r) => r.firstName.trim() && r.lastName.trim() && /^\d{1,9}$/.test(r.nationalId),
      );
      await Promise.all(
        validRows.map((r) =>
          apiRequest(`/classes/${createdId}/students`, {
            method: 'POST',
            body: JSON.stringify({
              firstName:  r.firstName.trim(),
              lastName:   r.lastName.trim(),
              nationalId: r.nationalId,
              gender:     inferGender(),
            }),
          }),
        ),
      );
      router.refresh();
      onClose();
      reset();
    } catch (err: unknown) {
      setS2Error(err instanceof Error ? err.message : 'שגיאה בהוספת התלמידים');
    } finally {
      setS2Loading(false);
    }
  }

  function handleSkip(): void {
    router.refresh();
    onClose();
    reset();
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const INPUT_CLS = 'w-full rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-300 transition-all backdrop-blur-sm';
  const LABEL_CLS = 'block text-xs font-bold text-slate-500 mb-1 tracking-wide uppercase';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-3xl p-0"
        dir="rtl"
        style={{
          background:           'rgba(255,255,255,0.93)',
          backdropFilter:       'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border:               '1px solid rgba(255,255,255,0.80)',
          boxShadow:            '0 24px 64px rgba(5,150,105,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
        } as React.CSSProperties}
      >
        {/* ── Header band ── */}
        <div
          className="px-6 py-5"
          style={{
            background:   'linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(8,145,178,0.04) 100%)',
            borderBottom: '1px solid rgba(5,150,105,0.10)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                <BookOpen className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              </div>
              <div>
                <DialogHeader>
                  <DialogTitle className="text-start text-base font-black text-slate-800">
                    {step === 1 ? 'יצירת כיתה חדשה' : 'הוספת תלמידים לכיתה'}
                  </DialogTitle>
                </DialogHeader>
                <p className="mt-0.5 text-xs text-slate-500">
                  {step === 1 ? 'שלב 1 מתוך 2 — פרטי הכיתה' : 'שלב 2 מתוך 2 — אוכלוסיית כיתה'}
                </p>
              </div>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-1.5 me-1">
              {([1, 2] as const).map((s) => (
                <div
                  key={s}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width:      step === s ? 20 : 8,
                    background: step === s ? '#059669' : 'rgba(5,150,105,0.25)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>

          {/* ══════════ STEP 1 ══════════ */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ ease: EASE, duration: 0.28 }}
              onSubmit={handleCreateClass}
              className="flex flex-col gap-4 p-6"
              noValidate
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>שכבה</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as GradeOption)}
                    required
                    className={INPUT_CLS}
                  >
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g}>כיתה {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>מספר כיתה</label>
                  <input
                    type="number"
                    value={classNumber}
                    onChange={(e) => setClassNumber(e.target.value)}
                    min={1}
                    max={15}
                    required
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>מחצית</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value as 'A' | 'B')}
                    required
                    className={INPUT_CLS}
                  >
                    <option value="A">מחצית א&apos;</option>
                    <option value="B">מחצית ב&apos;</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>הרכב מגדרי</label>
                  <select
                    value={genderType}
                    onChange={(e) => setGenderType(e.target.value as ClassGenderType)}
                    required
                    className={INPUT_CLS}
                  >
                    <option value="MIXED">מעורב</option>
                    <option value="BOYS">בנים</option>
                    <option value="GIRLS">בנות</option>
                  </select>
                </div>
              </div>

              {/* Name preview */}
              <div
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-emerald-700"
                style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.16)' }}
              >
                שם הכיתה:{' '}
                <span className="font-black">
                  {formatClassWithGender(`כיתה ${grade} ${classNumber}`, genderType)}
                </span>
              </div>

              {s1Error !== null && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-red-700"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {s1Error}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={s1Loading}
                whileHover={!s1Loading ? { y: -1, boxShadow: '0 10px 28px rgba(5,150,105,0.45)' } : {}}
                whileTap={!s1Loading ? { scale: 0.98 } : {}}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#059669,#0891b2)', boxShadow: '0 4px 16px rgba(5,150,105,0.32)' }}
              >
                {s1Loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>יוצר...</span></>
                  : <><span>הבא — הוסף תלמידים</span><ChevronLeft className="h-4 w-4" aria-hidden="true" /></>}
              </motion.button>
            </motion.form>
          )}

          {/* ══════════ STEP 2 ══════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ ease: EASE, duration: 0.28 }}
              className="flex flex-col gap-4 p-6"
            >
              {/* Mode toggle */}
              <div
                className="grid grid-cols-2 gap-2 rounded-2xl p-1"
                style={{ background: 'rgba(241,245,249,0.80)', border: '1px solid rgba(226,232,240,0.60)' }}
              >
                {(['manual', 'excel'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setAddMode(m); setS2Error(null); }}
                    className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all duration-200"
                    style={addMode === m
                      ? { background: '#fff', color: '#0f172a', boxShadow: '0 2px 10px rgba(15,23,42,0.08)' }
                      : { color: '#94a3b8' }}
                  >
                    {m === 'manual'
                      ? <><Users className="h-3.5 w-3.5" aria-hidden="true" /><span>הזנה ידנית</span></>
                      : <><FileText className="h-3.5 w-3.5" aria-hidden="true" /><span>Excel / CSV</span></>}
                  </button>
                ))}
              </div>

              {/* ── Manual rows ── */}
              {addMode === 'manual' && (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pe-1">
                  <div className="grid gap-2 px-1" style={{ gridTemplateColumns: '1fr 1fr 100px 32px' }}>
                    {['שם פרטי', 'שם משפחה', 'ת.ז'].map((h) => (
                      <span key={h} className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{h}</span>
                    ))}
                    <span />
                  </div>

                  {rows.map((row, idx) => (
                    <div key={row.key} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 1fr 100px 32px' }}>
                      <input
                        type="text"
                        value={row.firstName}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, firstName: e.target.value };
                          setRows(next);
                        }}
                        placeholder="שם פרטי"
                        className="rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all"
                      />
                      <input
                        type="text"
                        value={row.lastName}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, lastName: e.target.value };
                          setRows(next);
                        }}
                        placeholder="שם משפחה"
                        className="rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={row.nationalId}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, nationalId: e.target.value.replace(/\D/g, '') };
                          setRows(next);
                        }}
                        placeholder="123456789"
                        className="rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-300 outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                        disabled={rows.length === 1}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-30"
                        aria-label="הסר שורה"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setRows([...rows, makeRow()])}
                    className="flex items-center gap-1.5 self-start rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    הוסף שורה
                  </button>
                </div>
              )}

              {/* ── Excel drag-and-drop ── */}
              {addMode === 'excel' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => { setExcelFile(e.target.files?.[0] ?? null); setS2Error(null); }}
                  />
                  <motion.div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setIsDragging(false);
                      const f = e.dataTransfer.files[0];
                      if (f) { setExcelFile(f); setS2Error(null); }
                    }}
                    animate={{ scale: isDragging ? 1.02 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl py-8 text-center transition-all"
                    style={isDragging
                      ? { background: 'rgba(5,150,105,0.06)', border: '2px dashed rgba(5,150,105,0.50)' }
                      : { background: 'rgba(248,250,252,0.80)', border: '2px dashed rgba(148,163,184,0.40)' }}
                    role="button"
                    tabIndex={0}
                    aria-label="בחר קובץ Excel או CSV"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  >
                    {excelFile !== null ? (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{excelFile.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {(excelFile.size / 1024).toFixed(0)} KB · לחץ להחלפה
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl"
                          style={{ background: isDragging ? 'rgba(5,150,105,0.12)' : 'rgba(241,245,249,1)' }}
                        >
                          <Upload className="h-6 w-6 text-slate-400" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">גרור קובץ לכאן</p>
                          <p className="mt-0.5 text-xs text-slate-400">או לחץ לבחירה · Excel / CSV</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                          <span className="text-[11px] font-semibold text-slate-500">.xlsx · .xls · .csv</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    העמודות הנדרשות: שם פרטי, שם משפחה, ת.ז, מגדר
                  </p>
                </div>
              )}

              {/* Import result */}
              {importResult !== null && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-700"
                  style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.20)' }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    נוספו {importResult.added} תלמידים
                    {(importResult.existing ?? 0) > 0 && ` · ${importResult.existing} קיימים`}
                    {(importResult.reEnrolled ?? 0) > 0 && ` · ${importResult.reEnrolled} שובצו מחדש`}
                  </span>
                </div>
              )}

              {s2Error !== null && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-red-700"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {s2Error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={s2Loading}
                  className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  דלג וסיים
                </button>
                <motion.button
                  type="button"
                  onClick={() => { void handleAddStudents(); }}
                  disabled={s2Loading || (addMode === 'excel' && excelFile === null) || importResult !== null}
                  whileHover={!s2Loading ? { y: -1, boxShadow: '0 10px 28px rgba(5,150,105,0.45)' } : {}}
                  whileTap={!s2Loading ? { scale: 0.98 } : {}}
                  className="flex-[2] flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-black text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#059669,#0891b2)', boxShadow: '0 4px 16px rgba(5,150,105,0.32)' }}
                >
                  {s2Loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>מוסיף...</span></>
                    : addMode === 'excel'
                      ? <><Upload className="h-4 w-4" aria-hidden="true" /><span>העלה וסיים</span></>
                      : <><Users className="h-4 w-4" aria-hidden="true" /><span>הוסף תלמידים וסיים</span></>}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
