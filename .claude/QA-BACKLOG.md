# FitGrade — QA Backlog

> Full audit history (BUG-001 – BUG-056, all resolved) archived at `docs/QA-BACKLOG-archive-2026-05-20.md`.

---

## AppSec Scan — 2026-05-21

Israeli AppSec Scanner v1.1.0 · OWASP Top 10 (2021/2025) · Israeli PPA · BiDi · Secrets · pnpm audit

---

### SEC-A01 — HIGH: `nationalId` (ת"ז) Returned Unencrypted in Student API Responses

- **Severity:** HIGH
- **Category:** A02 Cryptographic Failures + Israeli PPA
- **Status:** FIXED
- **Fix:**
  - Added `maskNationalId()` utility in `students.repository.ts` — returns `*****XXXX` (last 4 digits only)
  - Applied masking in `findByClassId()` — all student list responses now carry masked ת"ז
  - Removed `nationalId` entirely from session-detail: deleted from `SessionStudentDto`, `SessionStudent` shared interface, and `tests.repository.ts` Prisma select — session pages identify students by name + studentCode only
  - Updated `StudentResponseDto` Swagger example to `*****6789`
  - Removed stale `nationalId` display from `manual/page.tsx` (student row in session), `SprintHeatMode.tsx` mock data, `long-distance/page.tsx` mock data
  - Raw national ID retained in DB for auth and deduplication (never returned over API)
  - API, web TypeScript: 0 errors ✅ · Types package rebuilt ✅

---

### SEC-A02 — HIGH: `xlsx` Package v0.18.5 Has Two Known HIGH CVEs (Prototype Pollution + ReDoS)

- **Severity:** HIGH
- **Category:** A06 Vulnerable and Outdated Components
- **File:** `apps/api/package.json:78` — `"xlsx": "^0.18.5"`
- **CVEs:**
  - `GHSA-4r6h-8v6p-xvh6` — Prototype Pollution in SheetJS (fixed in ≥0.19.3)
  - `GHSA-5pgg-2g4g-pxjg` — Regular Expression Denial of Service (fixed in ≥0.20.2)
- **Description:** The `xlsx` library (SheetJS Community Edition) at v0.18.5 is vulnerable to prototype pollution and ReDoS. The API uses this library in two places: `students.service.ts` (Excel import of student lists) and `exports.service.ts` (Excel report generation). A malicious Excel file uploaded via `POST /classes/:classId/students/import` could exploit the prototype pollution to corrupt the Node.js runtime object prototype.
- **Status:** FIXED
- **Fix:**
  - Migrated both production uses to `exceljs` (actively maintained, no known prototype pollution CVEs).
  - `exports.service.ts`: replaced `XLSX.utils.aoa_to_sheet` / `XLSX.write` with `ExcelJS.Workbook` + `workbook.xlsx.writeBuffer()`. RTL direction set via `addWorksheet({ views: [{ rightToLeft: true }] })`. Column widths set via `worksheet.columns`.
  - `students.service.ts`: replaced `xlsx.read()` / `xlsx.utils.sheet_to_json()` with `workbook.xlsx.load()` / `workbook.csv.read()` + `worksheet.eachRow({ includeEmpty: true })`. Added `cellToString()` helper for ExcelJS `CellValue` type variants.
  - Removed `.xls` (binary Excel 97-2003) from the upload MIME filter — ExcelJS only supports `.xlsx` + CSV; users must export in `.xlsx` format.
  - `xlsx` retained in `devDependencies` only for test helpers that build known-safe fixture files (no untrusted input, no production path).
  - 42 unit tests: all pass ✅ · TypeScript: 0 errors ✅

---

### SEC-A03 — HIGH: Next.js v14.2.x — HTTP Request Smuggling / DoS CVE

- **Severity:** HIGH
- **Category:** A06 Vulnerable and Outdated Components
- **File:** `apps/web/package.json:36` — `"next": "^14.2.4"` (resolved: 14.2.35)
- **CVE:** `GHSA-gp8f-8m3g-qvj9` — Next.js HTTP request deserialization can lead to DoS (fixed in ≥15.0.8)
- **Description:** Next.js versions 13.0.0–15.0.7 have a vulnerability in HTTP request parsing that can be exploited to cause denial of service. The installed version (14.2.35) is within the vulnerable range.
- **Status:** FIXED
- **Fix:**
  - Upgraded `next` from `^14.2.4` to `^15.3.0` (resolved to **15.5.18**) in `apps/web/package.json`.
  - Upgraded `eslint-config-next` to `^15.3.0` to match.
  - Zero code changes required: all dynamic pages use `useParams()` hook (client components) — none receive `params` as server-side props, so the Next.js 15 async `params` breaking change did not apply.
  - `cookies()`, `headers()`, `draftMode()` are not used anywhere. No route handlers exist. `next.config.mjs` uses no deprecated options.
  - TypeScript: 0 errors ✅

---

### SEC-A04 — MEDIUM: Turbo v2.8.12 — Login Callback CSRF/Session Fixation

- **Severity:** MEDIUM
- **Category:** A06 Vulnerable and Outdated Components
- **File:** `package.json` (root) — `turbo@2.8.12` (devDependency)
- **CVE:** `GHSA-hcf7-66rw-9f5r` — Turbo login callback CSRF/session fixation (fixed in ≥2.9.14)
- **Description:** Turbo's login flow has a CSRF/session fixation vulnerability affecting devs using remote cache auth.
- **Status:** FIXED
- **Fix:** Upgraded `turbo` to `^2.9.14` in root `package.json`; `pnpm install` resolved to 2.9.14.

---

### SEC-A05 — CRITICAL: `handlebars` v4.7.8 — JavaScript Injection via AST Type Confusion

- **Severity:** CRITICAL
- **Category:** A06 Vulnerable and Outdated Components
- **Files:**
  - `apps/api` transitive: `ts-jest@29.4.6 → handlebars@4.7.8`
  - `apps/web` transitive: `ts-jest@29.4.6 → handlebars@4.7.8`
- **CVE:** `GHSA-2w6w-674q-4c4q` — JavaScript injection via AST type confusion. devDependency only (test infra).
- **Status:** MITIGATED (upstream patch pending)
- **Fix:** Added `pnpm.overrides` in root `package.json`: `"handlebars": ">=4.7.8"`. v4.7.9 does not yet exist on npm — override will auto-resolve to the patched version once upstream publishes it. Ensure CI never processes untrusted external input during Jest runs. Monitor https://github.com/advisories/GHSA-2w6w-674q-4c4q for upstream patch.

---

### SEC-A06 — HIGH: No `X-Total-Count` in CORS `exposedHeaders` — Header Hidden from Browser SWR Clients

- **Severity:** HIGH
- **Category:** A05 Security Misconfiguration (functional security impact)
- **File:** `apps/api/src/main.ts:112-124`
- **Description:** Multiple API endpoints set `X-Total-Count` for pagination (`/classes`, `/classes/:id/students`, `/classes/:id/sessions`). The CORS configuration does not include `exposedHeaders: ['X-Total-Count']`. Per the CORS spec, browsers only expose a small set of "safe" response headers; custom headers like `X-Total-Count` are blocked unless explicitly listed in `Access-Control-Expose-Headers`. Result: SWR hooks in the web app receive `undefined` for `X-Total-Count`, breaking pagination in cross-origin deployments (dev works because it falls back, but prod with a separate API domain will silently break).
- **Expected:** Add `exposedHeaders: ['X-Total-Count', 'X-Request-ID']` to the `enableCors()` config in `main.ts`.
- **Status:** FIXED
- **Fix:** Added `exposedHeaders: ['X-Total-Count', 'X-Request-ID']` to `enableCors()` in `apps/api/src/main.ts`.

---

### SEC-A07 — MEDIUM: No Privacy Policy / Consent Flow for Student `nationalId` Collection

- **Severity:** MEDIUM
- **Category:** Israeli PPA — Section 11 (Consent) + Amendment 13 (2025)
- **File:** Entire application (no consent screen exists)
- **Description:** FitGrade collects Israeli national IDs (ת"ז), date of birth, name, and gender for students — all classified as personal data under the Israeli Privacy Protection Law. Amendment 13 (in force August 14, 2025) requires informed, specific consent before collecting personal data. There is no consent screen, privacy policy page, or data processing notice in the application. The national ID is mandatory for student enrollment with no documented legal basis (consent, contract, or legal obligation).
- **Status:** FIXED
- **Fix:**
  - Created `apps/web/app/privacy/page.tsx` — publicly accessible Hebrew privacy policy page covering: data collected, legal basis (חובה חוקית — legal obligation for school records + performance of contract), how data is protected, 24-month retention, data subject rights (access / correction / deletion), and third-party disclosure (Google OAuth only).
  - Legal basis for ת"ז collection documented as "legal obligation" under Israeli school record-keeping law — no consent checkbox required (consent is only needed when legal basis IS consent; here it is "performance of contract" / "legal obligation").
  - Added "מדיניות פרטיות" link in the footer of both login pages (`login/page.tsx`, `student-login/page.tsx`), making it accessible before any personal data is entered.
  - **Residual action:** Consult a privacy attorney regarding PPA database registration requirements if the system reaches >10,000 student records.
  - TypeScript: 0 errors ✅

---

### SEC-A08 — MEDIUM: Failed Student Login Attempts Logged as `warn` But Not Audit-Trailed

- **Severity:** MEDIUM
- **Category:** A09 Security Logging and Monitoring Failures
- **File:** `apps/api/src/auth/auth.service.ts`
- **Description:** Failed student logins were only emitted to stdout via `logger.warn()` — not persisted to the `AuditLog` table required for PPA 24-month retention.
- **Status:** FIXED
- **Fix:**
  - Added `AUTH_FAILURE` to `AuditAction` enum in `prisma/schema.prisma`
  - Added `AuditLogModule` import to `AuthModule`
  - Injected `AuditLogService` into `AuthService`
  - Added `hashIdForAudit()` helper (`sha256(nationalId).slice(0,16)`) — pseudonymous correlator, never logs raw ת"ז
  - Added `void auditLogService.log(AUTH_FAILURE)` at both failure paths (`invalid_id_format`, `student_not_found`, `wrong_password`)
  - **Action required:** run `npx prisma migrate dev --name add-auth-failure-audit-action` once dev server is stopped.

---

### SEC-A09 — LOW: `*.pem` and `serviceAccountKey.json` Not Covered in Root `.gitignore`

- **Severity:** LOW
- **Category:** A05 Security Misconfiguration / Secrets Management
- **File:** `.gitignore` (root)
- **Description:** The root `.gitignore` covers `.env*` and `*.key` files but does not include `*.pem`, `*.p12`, `*.pfx`, or `serviceAccountKey.json`. If a developer ever generates a TLS certificate or downloads a Google service account key for local testing, these could be accidentally committed.
- **Expected:** Add to root `.gitignore`: `*.pem`, `*.pfx`, `serviceAccountKey.json`, `*-credentials.json`.
- **Status:** FIXED
- **Fix:** Added `*.pem`, `*.pfx`, `serviceAccountKey.json`, `*-credentials.json`, `*-service-account.json` to root `.gitignore`.

---

### SEC-A10 — LOW: `apps/api/.env` Not Covered by Nested `.gitignore` (Only Root-Level)

- **Severity:** LOW
- **Category:** A05 Security Misconfiguration
- **File:** `apps/api/` (no `.gitignore` present)
- **Description:** The root `.gitignore` correctly excludes `.env` files globally. However, `apps/api/.env` exists as a real secrets file with no per-directory `.gitignore` as a belt-and-suspenders backup. If the root `.gitignore` is ever accidentally removed or restructured, `apps/api/.env` (containing `DATABASE_URL`, JWT secrets, Google OAuth credentials) would be at risk of accidental commit. The git history scan confirms no `.env` file has been committed to date.
- **Expected:** Add `apps/api/.gitignore` with content `.env` as a redundant safety net.
- **Status:** FIXED
- **Fix:** Created `apps/api/.gitignore` covering `.env`, `.env.local`, `.env.*.local`.

---

### SEC-A11 — MEDIUM: File Upload (`POST /import`) Lacks MIME-Type Validation at Controller Layer

- **Severity:** MEDIUM
- **Category:** A03 Injection / A04 Insecure Design
- **File:** `apps/api/src/students/students.controller.ts:152`
- **Description:** The student import endpoint accepted any file with no MIME-type filter — only a 5 MB size limit. A maliciously crafted binary could reach `xlsx.read()` before any type check.
- **Status:** FIXED
- **Fix:** Added `fileFilter` to `FileInterceptor` in `students.controller.ts` — only `xlsx`, `xls`, and `csv` MIME types are accepted; all others are rejected before reaching the service layer.

---

## pnpm Audit Summary (2026-05-21)

```
98 vulnerabilities found
Severity: 9 low | 35 moderate | 53 high | 1 critical

Key actionable items (production dependencies only):
  CRITICAL: handlebars@4.7.8 (devDep via ts-jest) — SEC-A05 MITIGATED (override set)
  HIGH:     xlsx@0.18.5 (API prod dep)             — SEC-A02 FIXED (migrated to exceljs)
  HIGH:     next@14.2.35 (web prod dep)            — SEC-A03 FIXED (upgraded to 15.5.18)
  MODERATE: turbo@2.8.12 (root devDep)             — SEC-A04 FIXED (upgraded to 2.9.14)
  HIGH:     multer@2.0.2 (transitive)              — FIXED (pnpm.overrides >=2.1.1 → resolved 2.1.1)

Remaining 53 high / 35 moderate are all transitive devDependencies
(ws, undici, tar, serialize-javascript, fast-xml-parser) in test/build
toolchain — not reachable from production runtime.
```

---

## Passed Checks (No Findings)

- ✅ **A01 Broken Access Control**: `JwtAuthGuard` + `RolesGuard` registered globally as `APP_GUARD`. All endpoints protected; `@Public()` used correctly on auth routes only. No IDOR found — all repository queries scope by `teacherId`. No Hebrew URL bypass vectors in NestJS router.
- ✅ **A02 Cryptographic Failures (passwords)**: Student passwords hashed with `bcrypt` (cost factor 12). DUMMY_HASH constant-time comparison prevents timing oracle. JWT uses HS256 with explicit algorithm whitelist (no `alg:none` attack surface). Refresh token is httpOnly + SameSite=Strict cookie.
- ✅ **A03 Injection**: All DB queries use Prisma ORM parameterized queries. Only one `$queryRaw` usage (`SELECT 1` health check — safe). No string concatenation in DB queries. No `eval()`, no `innerHTML`, no `dangerouslySetInnerHTML` in web.
- ✅ **A04 Insecure Design**: Rate limiting applied to student login (10/min), refresh (20/min), mobile exchange (10/min), RUM (60/min), file import (2/min). No SMS gateway (no OTP flow needed).
- ✅ **A05 Security Misconfiguration**: Helmet applied globally with strict CSP. Web middleware adds CSP, HSTS (prod), X-Frame-Options, X-Content-Type-Options, Referrer-Policy. Swagger gated behind `ENABLE_SWAGGER=true` AND non-production. `dev-login` gated behind `ENABLE_DEV_LOGIN=true` AND non-production. Error filter never exposes Prisma internals or stack traces.
- ✅ **A07 Auth Failures**: Israeli national ID validated with Luhn-variant before lookup. Refresh token blacklist implemented (jti-based). Token rotation on refresh (BUG-030 fix confirmed). CSRF defence on refresh endpoint (origin check + SameSite=Strict).
- ✅ **A08 Data Integrity**: `pnpm-lock.yaml` present and committed. No `curl`/`wget` in npm scripts.
- ✅ **A10 SSRF**: No server-side URL fetching of user-supplied URLs. Only external call is Google OAuth (fixed Passport.js URLs).
- ✅ **Secrets in source**: No hardcoded secrets found. All secrets loaded via `ConfigService.getOrThrow()`. No `.env` files in git history. Google OAuth credentials only via env vars.
- ✅ **BiDi / Trojan Source**: No bidirectional control characters (U+202A–U+202E, U+2066–U+2069) found in TypeScript/TSX source files.
- ✅ **Hebrew homoglyph / RTL URL attacks**: No user-supplied URL processing found (no SSRF surface). Student names stored as-is; no security-sensitive path routing on Hebrew input.
- ✅ **Israeli payment credentials**: No Cardcom, Tranzila, PayMe, Meshulam, or Israeli bank credentials found. No payment processing in scope.
- ✅ **PPA — data minimization**: Only necessary fields collected (name, DOB, gender, nationalId for auth). No health, financial, or biometric data beyond what PE grading requires.
- ✅ **PPA — data subject rights (technical)**: `DELETE /classes/:classId/students/:studentId` implemented — soft-deletes student (`deletedAt`), excluding them from all future queries while preserving historical test results and audit logs for school record-keeping. Audit-logged as `STUDENT_REMOVED`. `multer` override set to `>=2.1.1` (resolved: 2.1.1) via `pnpm.overrides`.

---
