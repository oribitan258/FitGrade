'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, BookOpen, ChevronDown, Filter, Info, Search, TrendingUp } from 'lucide-react';
import { useTestTypes } from '@/hooks/use-test-types';
import { useTestTypeNorms, type NormBand } from '@/hooks/use-norms';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const PAGE_ENTER = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { ease: EASE, duration: 0.6, staggerChildren: 0.08 },
  },
};
const ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ease: EASE, duration: 0.5 } },
};

/** Ministry grade brackets. */
const BRACKETS = [
  { label: 'מצטיין',       min: 90, max: 100, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500',   badgeBg: 'bg-emerald-100',  badgeText: 'text-emerald-800'  },
  { label: 'טוב',          min: 75, max: 89,  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',      badgeBg: 'bg-blue-100',     badgeText: 'text-blue-800'     },
  { label: 'עובר',         min: 60, max: 74,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',     badgeBg: 'bg-amber-100',    badgeText: 'text-amber-800'    },
  { label: 'מתחת לנורמה', min: 0,  max: 59,  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',       badgeBg: 'bg-red-100',      badgeText: 'text-red-800'      },
] as const;

type Bracket = (typeof BRACKETS)[number];

function bracketFor(score: number): Bracket {
  return (
    BRACKETS.find((b) => score >= b.min && score <= b.max) ?? BRACKETS[BRACKETS.length - 1]!
  );
}

/** Age group definitions matching Ministry categories. */
const AGE_GROUPS = [
  { key: '10-12', label: "ה'–ו'",    minAge: 10, maxAge: 12 },
  { key: '12-14', label: "ז'–ח'",    minAge: 12, maxAge: 14 },
  { key: '14-15', label: "ט'",       minAge: 14, maxAge: 15 },
  { key: '15-18', label: "י'–י\"ב", minAge: 15, maxAge: 18 },
] as const;

type AgeGroupKey = (typeof AGE_GROUPS)[number]['key'];

const GENDER_OPTS = [
  { value: 'MALE'   as const, label: 'בנים' },
  { value: 'FEMALE' as const, label: 'בנות' },
] as const;

type GenderOpt = (typeof GENDER_OPTS)[number]['value'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format raw value for display in the table. */
function formatThreshold(value: number, inputType: string, unit: string | null): string {
  if (inputType === 'TIME') {
    // value is in seconds — format as M:SS or SS.s
    if (value >= 60) {
      const m = Math.floor(value / 60);
      const s = (value % 60).toFixed(1);
      return `${m}:${Number(s) < 10 ? '0' : ''}${s} דק'`;
    }
    return `${value.toFixed(1)} שנ'`;
  }
  if (inputType === 'REPS') {
    return `${Math.round(value)} חזרות`;
  }
  const suffix = unit ? ` ${unit}` : '';
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}${suffix}`;
}

/** The display threshold for a given band (boundary value a student must hit). */
function bandThreshold(band: NormBand, higherIsBetter: boolean): number {
  // TIME (lower=better): to score ≥ X you must finish before maxValue seconds
  // GENERAL/REPS (higher=better): to score ≥ X you must reach at least minValue
  return higherIsBetter ? band.minValue : band.maxValue;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton(): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.10)]">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 grid grid-cols-3 gap-4">
        {['ציון', 'רמה', 'ביצוע נדרש'].map((h) => (
          <div key={h} className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="border-b border-slate-50 px-5 py-3 grid grid-cols-3 gap-4">
          <div className="h-3 w-8 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ─── Norm Table Display ────────────────────────────────────────────────────────

interface NormTableProps {
  bands: NormBand[];
  inputType: string;
  higherIsBetter: boolean;
  unit: string | null;
  gender: GenderOpt;
  ageGroupKey: AgeGroupKey;
}

function NormTable({ bands, inputType, higherIsBetter, unit, gender, ageGroupKey }: NormTableProps): React.JSX.Element {
  const ageGroup = AGE_GROUPS.find((g) => g.key === ageGroupKey)!;

  // Filter to selected gender + age group
  const filtered = useMemo(
    () =>
      bands.filter(
        (b) =>
          b.gender === gender &&
          b.minAge === ageGroup.minAge &&
          b.maxAge === ageGroup.maxAge,
      ),
    [bands, gender, ageGroup],
  );

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <Info className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">אין נתוני נורמות</p>
          <p className="mt-1 text-sm text-slate-400">
            מבחן זה אינו כולל נתונים עבור קבוצה זו
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/70 shadow-[0_8px_32px_rgba(15,23,42,0.10)]">
      {/* Table header */}
      <div
        className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/90 backdrop-blur-sm px-5 py-3
          grid gap-4"
        style={{ gridTemplateColumns: '60px 1fr 1fr 1fr' }}
      >
        {['ציון', 'רמה', 'ביצוע נדרש', 'ערך תחתון'].map((h) => (
          <span key={h} className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${gender}-${ageGroupKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {filtered.map((band, idx) => {
              const b   = bracketFor(band.score);
              const threshold = bandThreshold(band, higherIsBetter);
              const thresholdStr = formatThreshold(threshold, inputType, unit);
              const minStr = formatThreshold(band.minValue, inputType, unit);

              return (
                <motion.div
                  key={`${band.score}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ease: EASE, duration: 0.3, delay: Math.min(idx * 0.008, 0.4) }}
                  className={cn(
                    'grid gap-4 px-5 py-2.5 items-center transition-colors hover:bg-slate-50/60',
                    b.bg,
                  )}
                  style={{ gridTemplateColumns: '60px 1fr 1fr 1fr' }}
                >
                  {/* Score */}
                  <span className={cn('text-base font-extrabold', b.text)}>
                    {band.score}
                  </span>

                  {/* Level badge */}
                  <span
                    className={cn(
                      'inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
                      b.bg, b.text, b.border,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', b.dot)} />
                    {b.label}
                  </span>

                  {/* Required performance (upper/lower bound depending on direction) */}
                  <span className={cn('text-sm font-semibold', b.text)}>
                    {higherIsBetter ? `לפחות ${thresholdStr}` : `עד ${thresholdStr}`}
                  </span>

                  {/* Raw min value for reference */}
                  <span className="text-xs text-slate-400 font-mono">
                    {minStr}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Filter Row ───────────────────────────────────────────────────────────────

interface FilterPillsProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: FilterPillsProps<T>): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            whileTap={{ scale: 0.96 }}
            className={cn(
              'relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
              active ? 'text-white' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700',
            )}
          >
            {active && (
              <motion.div
                layoutId={`pill-bg-${options[0]?.value}-group`}
                className="absolute inset-0 rounded-xl bg-indigo-600 shadow-[0_4px_16px_rgba(99,102,241,0.40)]"
                transition={{ ease: EASE, duration: 0.3 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Age group filter — only show available groups ────────────────────────────

function ageGroupOpts(
  bands: NormBand[],
  gender: GenderOpt,
): readonly { value: AgeGroupKey; label: string }[] {
  const available = new Set(
    bands
      .filter((b) => b.gender === gender)
      .map((b) => `${b.minAge}-${b.maxAge}`),
  );
  return AGE_GROUPS.filter((g) => available.has(g.key)).map((g) => ({
    value: g.key,
    label: g.label,
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AchievementTablesPage(): React.JSX.Element {
  const { data: testTypes, isLoading: typesLoading } = useTestTypes();

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [gender, setGender]                 = useState<GenderOpt>('MALE');
  // Default to ט' (14–15) age group to match the default run2000 test
  const [ageGroupKey, setAgeGroupKey]       = useState<AgeGroupKey>('14-15');
  const [search, setSearch]                 = useState('');

  // Auto-select "ריצת 2000 מטר" (run2000) when the test-type catalog first loads.
  // Falls back to the first type in the list if run2000 is not found.
  useEffect(() => {
    if (!testTypes || selectedTypeId !== null) return;
    const run2000 = testTypes.find((t) => t.nameHe === 'ריצת 2000 מטר');
    setSelectedTypeId(run2000?.id ?? testTypes[0]?.id ?? null);
  }, [testTypes, selectedTypeId]);

  const { data: norms, isLoading: normsLoading } = useTestTypeNorms(selectedTypeId);

  // Derive available age groups for current gender
  const availableAgeGroups = useMemo(
    () => (norms ? ageGroupOpts(norms.bands, gender) : []),
    [norms, gender],
  );

  // Auto-correct ageGroupKey when available groups change
  const effectiveAgeGroupKey: AgeGroupKey = useMemo(() => {
    if (availableAgeGroups.some((g) => g.value === ageGroupKey)) return ageGroupKey;
    return availableAgeGroups[0]?.value ?? '14-15';
  }, [availableAgeGroups, ageGroupKey]);

  // Filtered test type list for the dropdown search
  const filteredTypes = useMemo(
    () =>
      (testTypes ?? []).filter((t) =>
        t.nameHe.includes(search) || (t.unit ?? '').includes(search),
      ),
    [testTypes, search],
  );

  const selectedType = (testTypes ?? []).find((t) => t.id === selectedTypeId);

  return (
    <motion.div
      variants={PAGE_ENTER}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Page header ─────────────────────────────────────────── */}
      <motion.div variants={ITEM} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            טבלאות הישגים
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            טבלאות הנורמות הרשמיות של משרד החינוך לחינוך גופני
          </p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 shadow-sm"
        >
          <BookOpen className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        </div>
      </motion.div>

      {/* ── Grade scale summary ─────────────────────────────────── */}
      <motion.div variants={ITEM} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BRACKETS.map((b) => (
          <div
            key={b.label}
            className={`rounded-2xl border ${b.border} ${b.bg} px-4 py-3.5 text-center shadow-sm`}
          >
            <p className={`text-2xl font-extrabold ${b.text}`}>
              {b.min === 0 ? `0–${b.max}` : `${b.min}${b.max < 100 ? `–${b.max}` : '+'}`}
            </p>
            <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border ${b.border} ${b.badgeBg} px-2.5 py-0.5`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${b.dot}`} />
              <span className={`text-xs font-bold ${b.badgeText}`}>{b.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Filter panel ────────────────────────────────────────── */}
      <motion.div
        variants={ITEM}
        className="rounded-2xl bg-indigo-50/80 backdrop-blur-xl border border-white/80 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.10)]"
      >
        <div className="flex flex-wrap items-start gap-6">

          {/* Test type selector */}
          <div className="flex-1 min-w-[220px] space-y-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                סוג מבחן
              </span>
            </div>
            {typesLoading ? (
              <div className="h-11 animate-pulse rounded-xl bg-slate-200/60" />
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center">
                  <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
                <div className="relative">
                  <select
                    value={selectedTypeId ?? ''}
                    onChange={(e) => setSelectedTypeId(e.target.value || null)}
                    className="flex h-11 w-full appearance-none rounded-xl border border-slate-200/80 bg-white/80 ps-9 pe-10 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                    aria-label="בחר סוג מבחן"
                  >
                    {filteredTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nameHe}
                        {t.unit ? ` (${t.unit})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
                    <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gender filter */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 block">
              מגדר
            </span>
            <FilterPills
              options={GENDER_OPTS}
              value={gender}
              onChange={(v) => {
                setGender(v);
              }}
            />
          </div>

          {/* Age group filter */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 block">
              קבוצת גיל (כיתה)
            </span>
            {availableAgeGroups.length > 0 ? (
              <FilterPills
                options={availableAgeGroups}
                value={effectiveAgeGroupKey}
                onChange={setAgeGroupKey}
              />
            ) : normsLoading ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-9 w-16 animate-pulse rounded-xl bg-slate-200/60" />
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-400">טוען...</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Table card ──────────────────────────────────────────── */}
      <motion.div
        variants={ITEM}
        className="rounded-2xl bg-white/75 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.10)] overflow-hidden"
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
              <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {selectedType ? selectedType.nameHe : 'טבלת נורמות'}
              </h2>
              <p className="text-xs text-slate-400">
                {GENDER_OPTS.find((g) => g.value === gender)?.label ?? ''} ·{' '}
                {AGE_GROUPS.find((g) => g.key === effectiveAgeGroupKey)?.label ?? ''} ·{' '}
                {selectedType?.unit ?? 'ביצועים'}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4">
            {BRACKETS.map((b) => (
              <span key={b.label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', b.dot)} />
                {b.label} ({b.min}
                {b.max < 100 ? `–${b.max}` : '+'})
              </span>
            ))}
          </div>
        </div>

        {/* Table body — three states:
            1. Types loading or no type selected yet → skeleton
            2. Type selected and norms loading      → skeleton
            3. Norms ready                          → table */}
        <AnimatePresence mode="wait">
          {!selectedTypeId || typesLoading ? (
            <motion.div
              key="skeleton-init"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <TableSkeleton />
            </motion.div>
          ) : normsLoading ? (
            <motion.div
              key="skeleton-norms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <TableSkeleton />
            </motion.div>
          ) : norms ? (
            <motion.div
              key={`table-${selectedTypeId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <NormTable
                bands={norms.bands}
                inputType={norms.inputType}
                higherIsBetter={norms.higherIsBetter}
                unit={norms.unit}
                gender={gender}
                ageGroupKey={effectiveAgeGroupKey}
              />
            </motion.div>
          ) : (
            <motion.div
              key="no-data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Info className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <p className="font-semibold text-slate-700">אין נתונים זמינים</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Algorithm explainer ─────────────────────────────────── */}
      <motion.div
        variants={ITEM}
        className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-5 shadow-sm backdrop-blur-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100">
            <TrendingUp className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">כיצד מחושב הציון?</h3>
        </div>
        <ol className="space-y-3">
          {[
            { step: '1', title: 'קביעת ערך גולמי', desc: 'המורה מזין את התוצאה בשטח: זמן (שניות), חזרות, או עובר/נכשל.' },
            { step: '2', title: 'חיפוש בטבלת הנורמות', desc: 'המערכת מוצאת את שורת הנורמה המתאימה לפי: גיל התלמיד ביום המבחן, מגדר, וסוג המבחן.' },
            { step: '3', title: 'חישוב הציון (0–100)', desc: 'הציון הוא הערך המספרי מהטבלה. ציון 100 = ביצוע מושלם לפי נורמות המשרד.' },
            { step: '4', title: 'קביעת תווית עברית', desc: '90–100 = מצטיין · 75–89 = טוב · 60–74 = עובר · 0–59 = מתחת לנורמה.' },
          ].map(({ step, title, desc }) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {step}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-xs text-amber-800">
            <strong>שים לב:</strong> המורה יכול לדרוס ציון מחושב בכל עת — הציון הסופי הנרשם הוא תמיד הגבוה ביניהם, אלא אם נקבע ידנית.
          </p>
        </div>
      </motion.div>

      {/* ── Info note ───────────────────────────────────────────── */}
      <motion.p variants={ITEM} className="text-xs text-slate-400 text-center pb-4">
        הנתונים מבוססים על טבלאות הנורמות הרשמיות של משרד החינוך — חינוך גופני ·
        עמודת &quot;ביצוע נדרש&quot; מציגה את הסף המינימלי להשגת כל ציון
      </motion.p>
    </motion.div>
  );
}
