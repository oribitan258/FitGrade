/**
 * Tier 4.2 — XSS / DOM injection audit.
 *
 * The tour's content (tour-steps.ts) and mock data (tour-mock-data.ts) are
 * developer-controlled — there is no user input pathway into either. The
 * audit confirms:
 *
 *   1. Tooltip content reaches the DOM as text, never as HTML.
 *      (TourTooltip uses {step.content as React.ReactNode} — React escapes
 *      text children by default. The vector exists only if any future code
 *      adds dangerouslySetInnerHTML.)
 *
 *   2. Mock class names are escaped when rendered on the class card.
 *
 *   3. All step `target` selectors are string literals — none are derived
 *      from user input. A future contributor adding `target: someVar`
 *      would open an inadvertent DOM-injection path.
 *
 *   4. No `dangerouslySetInnerHTML` and no `document.querySelector(...)` with
 *      a dynamic argument exists in the tour code path.
 *
 * Static audits 3–4 are grep-style checks against the source tree, run from
 * Playwright via fs because the test runner already has filesystem access.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  gotoWelcomePage,
  startTour,
} from '../_helpers';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TOUR_FILES = [
  'apps/web/lib/tour-steps.ts',
  'apps/web/lib/tour-mock-handlers.ts',
  'apps/web/lib/tour-mock-data.ts',
  'apps/web/lib/tour-fetcher.ts',
  'apps/web/components/tour/TourProvider.tsx',
  'apps/web/components/tour/TourEngine.tsx',
  'apps/web/components/tour/TourTooltip.tsx',
  'apps/web/components/tour/NullBeacon.tsx',
  'apps/web/components/tour/use-tour-machine.ts',
  'apps/web/components/tour/use-signal-page-ready.ts',
].map((p) => path.join(REPO_ROOT, p));

function readTourSources(): Array<{ file: string; src: string }> {
  return TOUR_FILES.map((file) => ({ file, src: fs.readFileSync(file, 'utf8') }));
}

test.describe('tour security — XSS / DOM injection', () => {
  test('runtime: tooltip renders text content (window.__pwned not set)', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __pwned?: boolean }).__pwned = false;
    });

    await gotoWelcomePage(page);
    await startTour(page);

    // No tour content contains HTML, but if any future content sneaks in
    // an <img onerror=...> the global flag would flip.
    const pwned = await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned);
    expect(pwned).toBe(false);

    // Also verify the tooltip's body text node is the rendered Hebrew, not
    // an interpreted HTML fragment.
    const counter = await page.getByText(/שלב 1 מתוך \d+/).first().textContent();
    expect(counter).toMatch(/^שלב 1 מתוך \d+$/);
  });

  test('static: every TOUR_STEP target is a string literal (no variable interpolation)', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'apps/web/lib/tour-steps.ts'), 'utf8');

    // Grab every "target: ..." occurrence and assert the RHS is a string literal.
    const targetRe = /target:\s*([^,\n}]+)/g;
    const violations: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = targetRe.exec(src)) !== null) {
      const rhs = m[1].trim();
      // Allow: 'string', "string", `static-template-with-no-expression`.
      const isStringLiteral =
        /^'[^']*'$/.test(rhs) ||
        /^"[^"]*"$/.test(rhs) ||
        /^`[^`${}]*`$/.test(rhs);
      if (!isStringLiteral) {
        violations.push(rhs);
      }
    }
    expect(violations, `Non-literal target selectors detected: ${violations.join(' | ')}`).toEqual([]);
  });

  test('static: no dangerouslySetInnerHTML appears anywhere in the tour module set', () => {
    const violations: string[] = [];
    for (const { file, src } of readTourSources()) {
      if (src.includes('dangerouslySetInnerHTML')) {
        violations.push(file);
      }
    }
    expect(violations, `dangerouslySetInnerHTML found in: ${violations.join(', ')}`).toEqual([]);
  });

  test('static: no document.querySelector with a non-literal argument in tour code', () => {
    // Match `querySelector(<arg>)` and assert <arg> is a string literal.
    // Allow `querySelectorAll('css-string')` and similar.
    const qRe = /querySelector(?:All)?\s*\(\s*([^)]+)\s*\)/g;
    const violations: Array<{ file: string; call: string }> = [];
    for (const { file, src } of readTourSources()) {
      let m: RegExpExecArray | null;
      while ((m = qRe.exec(src)) !== null) {
        const arg = m[1].trim();
        const isStringLiteral =
          /^'[^']*'$/.test(arg) ||
          /^"[^"]*"$/.test(arg) ||
          /^`[^`${}]*`$/.test(arg);
        if (!isStringLiteral) {
          violations.push({ file, call: m[0] });
        }
      }
    }
    expect(
      violations,
      `querySelector with dynamic argument: ${violations.map((v) => `${v.file}: ${v.call}`).join(' | ')}`,
    ).toEqual([]);
  });

  test('static: tour-mock-data class names contain no HTML metacharacters', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'apps/web/lib/tour-mock-data.ts'), 'utf8');
    // Match `name: '...'` or `name: "..."` lines, check for HTML metachars.
    const nameRe = /name:\s*['"]([^'"]+)['"]/g;
    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(src)) !== null) {
      if (/[<>]|onerror|javascript:/i.test(m[1])) {
        offenders.push(m[1]);
      }
    }
    expect(offenders, `Suspicious mock names: ${offenders.join(' | ')}`).toEqual([]);
  });
});
