#!/usr/bin/env ts-node
/**
 * RTL Compliance Audit — static analysis for FitGrade web frontend.
 *
 * Scans apps/web/ for banned physical directional Tailwind classes and
 * other RTL violations. Exits with code 1 if any violation is found.
 *
 * Run: ts-node scripts/rtl-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ─── Configuration ────────────────────────────────────────────────────────────

const SCAN_ROOT = path.resolve(__dirname, '../apps/web');
const SCAN_EXTENSIONS = new Set(['.tsx', '.ts']);

/** Patterns that are BANNED in RTL UI code. Each entry is a regex. */
const BANNED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\bml-\S+/,      message: 'ml-* → use ms-* (margin-inline-start)' },
  { pattern: /\bmr-\S+/,      message: 'mr-* → use me-* (margin-inline-end)' },
  { pattern: /\bpl-\S+/,      message: 'pl-* → use ps-* (padding-inline-start)' },
  { pattern: /\bpr-\S+/,      message: 'pr-* → use pe-* (padding-inline-end)' },
  { pattern: /\btext-left\b/, message: 'text-left → use text-start' },
  { pattern: /\btext-right\b/,message: 'text-right → use text-end' },
  { pattern: /\bleft-\[/,     message: 'left-[...] → use start-[...]' },
  { pattern: /\bright-\[/,    message: 'right-[...] → use end-[...]' },
  { pattern: /\bleft-\d/,     message: 'left-N → use start-N' },
  { pattern: /\bright-\d/,    message: 'right-N → use end-N' },
  { pattern: /\bborder-l\b/,  message: 'border-l → use border-s' },
  { pattern: /\bborder-r\b/,  message: 'border-r → use border-e' },
  { pattern: /\brounded-l\b/, message: 'rounded-l → use rounded-s' },
  { pattern: /\brounded-r\b/, message: 'rounded-r → use rounded-e' },
  { pattern: /\bfloat-left\b/,message: 'float-left → use float-start' },
  { pattern: /\bfloat-right\b/,message: 'float-right → use float-end' },
];

// These file substrings are excluded from scanning (generated code, snapshots)
const EXCLUDE_PATHS = ['node_modules', '.next', '__snapshots__', 'dist'];

// ─── Scanner ──────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  column: number;
  text: string;
  message: string;
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    for (const { pattern, message } of BANNED_PATTERNS) {
      const match = pattern.exec(line);
      if (match !== null) {
        violations.push({
          file: filePath,
          line: lineNumber,
          column: match.index + 1,
          text: line.trim(),
          message,
        });
      }
    }
  }

  return violations;
}

function* walkDir(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (EXCLUDE_PATHS.some((ex) => fullPath.includes(ex))) continue;
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

async function checkRequiredPatterns(): Promise<Violation[]> {
  const issues: Violation[] = [];

  // Verify dir="rtl" in root layout
  const layoutPath = path.join(SCAN_ROOT, 'app/layout.tsx');
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf-8');
    if (!content.includes('dir="rtl"')) {
      issues.push({
        file: layoutPath,
        line: 0,
        column: 0,
        text: '',
        message: 'CRITICAL: Missing dir="rtl" on <html> element in root layout.tsx',
      });
    }
  } else {
    issues.push({
      file: layoutPath,
      line: 0,
      column: 0,
      text: '',
      message: 'CRITICAL: apps/web/app/layout.tsx not found',
    });
  }

  // Verify mobile RTL force
  const mobileLayoutPath = path.resolve(__dirname, '../apps/mobile/app/_layout.tsx');
  if (fs.existsSync(mobileLayoutPath)) {
    const content = fs.readFileSync(mobileLayoutPath, 'utf-8');
    if (!content.includes('forceRTL')) {
      issues.push({
        file: mobileLayoutPath,
        line: 0,
        column: 0,
        text: '',
        message: 'CRITICAL: Missing I18nManager.forceRTL(true) in mobile _layout.tsx',
      });
    }
  }

  return issues;
}

async function main(): Promise<void> {
  console.log(`\nFitGrade RTL Compliance Audit`);
  console.log(`Scanning: ${SCAN_ROOT}\n`);

  const allViolations: Violation[] = [];

  // Scan all files
  for (const filePath of walkDir(SCAN_ROOT)) {
    const violations = await scanFile(filePath);
    allViolations.push(...violations);
  }

  // Check required patterns
  const requiredIssues = await checkRequiredPatterns();
  allViolations.push(...requiredIssues);

  if (allViolations.length === 0) {
    console.log('✓ RTL audit passed — no violations found.\n');
    process.exit(0);
  }

  console.error(`✗ RTL audit FAILED — ${allViolations.length} violation(s):\n`);
  for (const v of allViolations) {
    const loc = v.line > 0 ? `:${v.line}:${v.column}` : '';
    console.error(`  ${v.file}${loc}`);
    console.error(`    → ${v.message}`);
    if (v.text) console.error(`    ${v.text}`);
    console.error('');
  }

  process.exit(1);
}

main().catch((err: unknown) => {
  console.error('Audit script error:', err);
  process.exit(1);
});
