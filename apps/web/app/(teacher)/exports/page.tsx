'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useClasses } from '@/hooks/use-classes';
import { useSemester } from '@/contexts/semester-context';
import { getToken } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ExportsPage(): React.JSX.Element {
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { activeSemester } = useSemester();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExportCsv(): Promise<void> {
    if (!selectedClassId) return;
    setDownloading(true);
    setError(null);
    try {
      const semesterParam = activeSemester ? `?semester=${activeSemester}` : '';
      // apiRequest returns parsed JSON — for file downloads we fetch directly
      const token = getToken();
      const API_BASE = process.env['API_URL'] ?? 'http://localhost:3001/api';
      const res = await fetch(
        `${API_BASE}/reports/class/${selectedClassId}/export/csv${semesterParam}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(`שגיאה ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cls = (classes ?? []).find((c) => c.id === selectedClassId);
      a.download = `fitgrade-${cls?.name ?? selectedClassId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהורדת הקובץ');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.45 }}
      >
        <h1 className="text-2xl font-extrabold text-slate-900">ייצוא נתונים</h1>
        <p className="mt-1 text-sm text-slate-500">הורד קובץ CSV של ציוני כיתה לפתיחה ב-Excel</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ease: EASE, duration: 0.45, delay: 0.08 }}
        className="overflow-hidden rounded-2xl border border-white/20 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.09)] backdrop-blur-2xl p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          </div>
          <div>
            <p className="font-bold text-slate-800">ייצוא ציוני כיתה — CSV</p>
            <p className="text-xs text-slate-500">
              כולל ממוצע כושר, ניהול, ציון מומלץ, ציון מורה והערה
            </p>
          </div>
        </div>

        {/* Class picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700" htmlFor="export-class-select">
            בחר כיתה
          </label>
          {classesLoading ? (
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <select
              id="export-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
            >
              <option value="">— בחר כיתה —</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Download button */}
        <button
          type="button"
          onClick={() => { void handleExportCsv(); }}
          disabled={!selectedClassId || downloading}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all',
            selectedClassId && !downloading
              ? 'bg-emerald-600 text-white shadow-[0_4px_14px_rgba(5,150,105,0.35)] hover:bg-emerald-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
          aria-busy={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {downloading ? 'מוריד...' : 'ייצוא ל-CSV'}
        </button>
      </motion.div>
    </div>
  );
}
