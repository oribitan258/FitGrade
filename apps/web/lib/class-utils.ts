import type { ClassGenderType } from '@fitgrade/types';

/** Maps ClassGenderType enum values to Hebrew display labels. */
const GENDER_TYPE_LABELS: Record<ClassGenderType, string> = {
  BOYS:  'בנים',
  GIRLS: 'בנות',
  MIXED: 'מעורב',
};

/**
 * Formats a class name with its gender-composition suffix.
 *
 * Examples:
 *   formatClassWithGender("ז' 2", 'GIRLS')  → "ז' 2 בנות"
 *   formatClassWithGender("י' 3", 'MIXED')  → "י' 3 מעורב"
 *   formatClassWithGender("ח' 1", 'BOYS')   → "ח' 1 בנים"
 */
export function formatClassWithGender(
  className: string,
  genderType: ClassGenderType,
): string {
  return `${className} ${GENDER_TYPE_LABELS[genderType]}`;
}

/**
 * Formats a raw physical measurement into a human-readable Hebrew string.
 *
 * Detection is driven exclusively by the Hebrew test name — the DB `unit`
 * field is treated as a last-resort fallback only, because seeded data may
 * carry incorrect unit labels (e.g. sit-ups stored with unit "ס\"מ").
 *
 * Priority rules (first match wins):
 *
 *   Time/Runs  (examName includes 'ריצה'):
 *     Value is total seconds → "7:04 דקות"
 *
 *   Reps  (examName includes 'בטן' | 'מתח' | 'סמיכה' | 'תלי תמיכה'):
 *     Round to integer → "42 חזרות"
 *
 *   Distance/Flexibility  (examName includes 'גמישות' | 'קפיצה' | 'הדיפת'):
 *     Round to 1 decimal, drop trailing .0 → "29.1 ס\"מ"
 *
 *   Fallback:
 *     Use DB unit if available → "3.5 מטר", else raw number string
 *
 * Returns empty string when rawValue is null.
 */
export function formatRawValue(
  rawValue: number | null,
  examName: string,
  unit: string | null,
): string {
  if (rawValue === null) return '';

  // ── Time-based: running tests — value is always total seconds ──────────
  if (/ריצה/.test(examName)) {
    const totalSeconds = Math.round(rawValue);
    const minutes      = Math.floor(totalSeconds / 60);
    const seconds      = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')} דקות`;
  }

  // ── Rep-based: sit-ups, pull-ups, push-ups, dips ────────────────────────
  if (/בטן|מתח|סמיכה|תלי תמיכה/.test(examName)) {
    return `${Math.round(rawValue)} חזרות`;
  }

  // ── Distance / flexibility — 1 decimal place, drop trailing .0 ─────────
  if (/גמישות|קפיצה|הדיפת/.test(examName)) {
    const rounded   = Math.round(rawValue * 10) / 10;
    const formatted = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
    return `${formatted} ס"מ`;
  }

  // ── Fallback: trust the DB unit if present, else raw number ─────────────
  if (unit) return `${rawValue} ${unit}`;
  return String(rawValue);
}
