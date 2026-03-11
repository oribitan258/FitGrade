import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names, resolving conflicts correctly.
 * Required by shadcn/ui components (added in a later phase).
 *
 * Usage: cn('base-class', condition && 'conditional-class', 'override-class')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a raw fitness-test value for display, based on the test's input type.
 *
 * TIME    → "M:SS"         (e.g. 445 → "7:25")
 * REPS    → integer string (e.g. 33  → "33")
 * GENERAL → one decimal   (e.g. 8.5 → "8.5")
 * PASS_FAIL → null (no raw value to show)
 */
export function formatRawValue(rawValue: number, inputType: string): string | null {
  if (inputType === 'PASS_FAIL') return null;
  if (inputType === 'TIME') {
    const totalSeconds = Math.round(rawValue);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (inputType === 'REPS') return String(Math.round(rawValue));
  return rawValue.toFixed(1);
}
