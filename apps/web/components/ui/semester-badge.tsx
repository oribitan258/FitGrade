'use client';

/**
 * SemesterBadge — tiny inline pill identifying which semester a data-write
 * action belongs to. Reads from SemesterContext by default; accepts an
 * optional `semester` prop to override (used by the Reports page which has
 * its own local ReportScope state, independent of the global context).
 *
 * Usage:
 *   <SemesterBadge />                   → shows active semester from context
 *   <SemesterBadge semester="B" />      → always shows "מחצית ב'" in green
 */

import { useSemester } from '@/contexts/semester-context';
import type { Semester } from '@fitgrade/types';

interface SemesterBadgeProps {
  /** Override the context value. Useful for Report page's local 3-state selector. */
  semester?: Semester;
}

export function SemesterBadge({ semester: semesterProp }: SemesterBadgeProps): React.JSX.Element {
  const { activeSemester } = useSemester();
  const semester = semesterProp ?? activeSemester;

  const label = semester === 'A' ? "מחצית א'" : "מחצית ב'";

  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={
        semester === 'A'
          ? {
              background: 'rgba(139,92,246,0.10)',
              color:      'rgba(109,40,217,0.90)',
              border:     '1px solid rgba(139,92,246,0.22)',
            }
          : {
              background: 'rgba(34,197,94,0.10)',
              color:      'rgba(22,163,74,0.90)',
              border:     '1px solid rgba(34,197,94,0.22)',
            }
      }
    >
      {label}
    </span>
  );
}
