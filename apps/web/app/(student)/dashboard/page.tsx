'use client';

import { getHebrewGradeLabel, getGradeColorKey } from '@fitgrade/types';
import { useMyAttendance, useMyResults } from '@/hooks/use-student-data';
import type { AttendanceStatus, StudentResult } from '@/hooks/use-student-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Attendance helpers ───────────────────────────────────────────────────────

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'נוכח',
  ABSENT: 'נעדר',
  LATE: 'איחור',
  EXCUSED: 'פטור',
};

const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

/** Formats YYYY-MM-DD → DD/MM/YYYY for Hebrew display. */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('T')[0]!.split('-');
  return `${d}/${m}/${y}`;
}

/** Maps grade key to a Tailwind text-color class. */
const GRADE_TEXT_CLASSES: Record<string, string> = {
  excellent: 'text-green-700',
  good: 'text-blue-700',
  pass: 'text-amber-700',
  fail: 'text-red-700',
};

// ─── Attendance Section ───────────────────────────────────────────────────────

function AttendanceSection(): React.JSX.Element {
  const { data, isLoading, error } = useMyAttendance();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>נוכחות</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>נוכחות</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">שגיאה בטעינת נתוני הנוכחות</p>
        </CardContent>
      </Card>
    );
  }

  const summary = data ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0, records: [] };

  return (
    <Card>
      <CardHeader>
        <CardTitle>נוכחות</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Summary stat pills — RTL: flex-row puts first item on the right */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="נוכח" value={summary.present} colorClass="border-green-200 bg-green-50 text-green-800" />
          <StatPill label="נעדר" value={summary.absent} colorClass="border-red-200 bg-red-50 text-red-800" />
          <StatPill label="איחור" value={summary.late} colorClass="border-yellow-200 bg-yellow-50 text-yellow-800" />
          <StatPill label="פטור" value={summary.excused} colorClass="border-blue-200 bg-blue-50 text-blue-800" />
        </div>

        {summary.total === 0 ? (
          <p className="text-center text-sm text-muted-foreground">אין רשומות נוכחות עדיין</p>
        ) : (
          <>
            {/* Attendance rate bar */}
            <AttendanceBar present={summary.present} total={summary.total} />

            {/* Recent records table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="רשומות נוכחות">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-start font-medium text-muted-foreground">סטטוס</th>
                    <th className="pb-2 text-end font-medium text-muted-foreground">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.records.slice(0, 10).map((record) => (
                    <tr key={record.date} className="border-b last:border-0">
                      <td className="py-2 text-start">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ATTENDANCE_COLORS[record.status]}`}
                        >
                          {ATTENDANCE_LABELS[record.status]}
                        </span>
                      </td>
                      <td className="py-2 text-end font-mono text-muted-foreground">
                        {formatDate(record.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.records.length > 10 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  מציג 10 רשומות אחרונות מתוך {summary.records.length}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatPill({ label, value, colorClass }: StatPillProps): React.JSX.Element {
  return (
    <div className={`rounded-lg border p-3 text-center ${colorClass}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

interface AttendanceBarProps {
  present: number;
  total: number;
}

function AttendanceBar({ present, total }: AttendanceBarProps): React.JSX.Element {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-green-700">{pct}% נוכחות</span>
        <span className="text-muted-foreground">
          {present} מתוך {total} שיעורים
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`אחוז נוכחות: ${pct}%`}
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Results Section ──────────────────────────────────────────────────────────

function ResultsSection(): React.JSX.Element {
  const { data, isLoading, error } = useMyResults();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תוצאות מבחני כושר</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">טוען...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תוצאות מבחני כושר</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">שגיאה בטעינת תוצאות המבחנים</p>
        </CardContent>
      </Card>
    );
  }

  const results: StudentResult[] = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>תוצאות מבחני כושר</CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">אין תוצאות מבחנים עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="תוצאות מבחני כושר">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-start font-medium text-muted-foreground">ציון</th>
                  <th className="pb-2 text-center font-medium text-muted-foreground">ביצוע</th>
                  <th className="pb-2 text-center font-medium text-muted-foreground">מבחן</th>
                  <th className="pb-2 text-end font-medium text-muted-foreground">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => {
                  const colorKey = getGradeColorKey(result.effectiveGrade);
                  const gradeClass = GRADE_TEXT_CLASSES[colorKey] ?? 'text-foreground';
                  return (
                    <tr key={result.id} className="border-b last:border-0">
                      <td className="py-2.5 text-start">
                        <Badge
                          variant="outline"
                          className={`font-semibold ${gradeClass}`}
                          aria-label={`ציון: ${getHebrewGradeLabel(result.effectiveGrade)}`}
                        >
                          {getHebrewGradeLabel(result.effectiveGrade)}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-center font-mono text-muted-foreground">
                        {result.rawValue}
                      </td>
                      <td className="py-2.5 text-center font-medium">{result.testNameHe}</td>
                      <td className="py-2.5 text-end font-mono text-muted-foreground">
                        {formatDate(result.sessionDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">הביצועים שלי</h1>
      <AttendanceSection />
      <ResultsSection />
    </div>
  );
}
