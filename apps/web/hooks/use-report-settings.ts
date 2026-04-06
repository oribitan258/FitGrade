/**
 * SWR hook + mutation helper for the teacher's report settings.
 * GET  /settings/report-settings
 * PATCH /settings/report-settings
 */
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';

export interface ReportSettings {
  passingGrade: number;
  teacherName: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  teacherSignature: string | null;
}

export type UpdateReportSettingsPayload = Partial<ReportSettings>;

export const REPORT_SETTINGS_KEY = '/settings/report-settings';

export function useReportSettings(): ReturnType<typeof useSWR<ReportSettings>> {
  return useSWR<ReportSettings>(
    REPORT_SETTINGS_KEY,
    (path: string) => apiRequest<ReportSettings>(path),
    { revalidateOnFocus: false },
  );
}

export async function updateReportSettings(
  payload: UpdateReportSettingsPayload,
): Promise<ReportSettings> {
  return apiRequest<ReportSettings>(REPORT_SETTINGS_KEY, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
