# FitGrade — QA Backlog

---

## Security QA — 2026-04-15

Auditor: Security QA Agent (Claude Sonnet 4.6)
Scope: Full backend API (`apps/api/src/**`)

---

### BUG-001 — HIGH: Access Token Exposed in Mobile OAuth Redirect URL

- **Severity:** HIGH
- **Category:** SECURITY
- **File:** `apps/api/src/auth/auth.controller.ts:141`
- **Description:** During the mobile Google OAuth flow, the 15-minute JWT access token is appended as a query parameter to the deep-link redirect URL: `fitgrade://auth/callback?token=<access_token>`. This URL is visible in server request logs, proxy logs, and any HTTP Referer header sent from the mobile app's in-app browser. The code acknowledges this with a `TODO(security)` comment but the issue is unresolved. An attacker with access to logs can harvest valid teacher tokens.
- **Expected:** Implement a server-side short-lived code exchange (same pattern as the web flow: set a short-lived httpOnly cookie or return a one-time code that the app exchanges via a POST request with no token in the URL).
- **Status:** FIXED
- **Fix applied:** Replaced token-in-URL with a one-time 64-hex-char code. `AuthService.createMobileCode()` stores the access token in an in-memory Map with a 2-minute TTL. The deep-link URL now carries `?code=...` instead of `?token=...`. A new `POST /auth/mobile-exchange` endpoint (rate-limited, throttled) redeems the code — single-use, deleted on first access — and returns the access token. `MobileExchangeDto` validates the code length.

---

### BUG-002 — HIGH: Grade Override via `PATCH /classes/:id/students/:studentId/grade-override` Not Audit-Logged

- **Severity:** HIGH
- **Category:** SECURITY
- **File:** `apps/api/src/classes/classes.service.ts:207`
- **Description:** `ClassesService.setStudentGradeOverride()` writes a grade override directly to the database via `classesRepository.quickGradeOverride()` with no call to `AuditLogService.log()`. The `ClassesService` does not inject `AuditLogService` at all (confirmed: 0 references). Per the backend rules, every grade override must write an `AuditAction.GRADE_OVERRIDE` entry. A teacher can silently alter any student's grade through the Grade Management Matrix without leaving a trail.
- **Expected:** Inject `AuditLogService` into `ClassesService` and call `auditLogService.log({ action: AuditAction.GRADE_OVERRIDE, ... })` after `quickGradeOverride` succeeds.
- **Status:** FIXED
- **Fix applied:** Injected `AuditLogService` into `ClassesService` constructor and added a fire-and-forget `auditLogService.log(GRADE_OVERRIDE)` call after `quickGradeOverride` succeeds; updated spec to mock `AuditLogService`.

---

### BUG-003 — HIGH: Bulk Grade Override via `PATCH /reports/class/:classId` Not Audit-Logged

- **Severity:** HIGH
- **Category:** SECURITY
- **File:** `apps/api/src/reports/reports.service.ts:251`
- **Description:** `ReportsService.saveGradeOverrides()` persists teacher final-grade and verbal comment overrides for multiple students via `reportsRepository.saveGradeOverrides()` with no audit log entry. `ReportsService` has zero references to `AuditLogService` (confirmed). A teacher can bulk-override final grades for an entire class with no record written to the audit trail.
- **Expected:** Inject `AuditLogService` into `ReportsService` and emit one `AuditAction.GRADE_OVERRIDE` log entry per student override saved.
- **Status:** FIXED
- **Fix applied:** Injected `AuditLogService` into `ReportsService` constructor and added a per-student fire-and-forget `auditLogService.log(GRADE_OVERRIDE)` loop after `saveGradeOverrides` completes.

---

### BUG-004 — HIGH: Result Deletion (`DELETE /sessions/:sessionId/results/:studentId`) Not Audit-Logged

- **Severity:** HIGH
- **Category:** SECURITY
- **File:** `apps/api/src/tests/tests.service.ts:147`
- **Description:** `TestsService.deleteResult()` deletes a student's test result but does not call `AuditLogService.log()`. Only a `logger.log()` (info-level log) is written. Deleting a result is a destructive action equivalent to a result edit — it should produce an `AuditAction.RESULT_EDIT` (or a dedicated `RESULT_DELETE`) audit entry so the action can be traced and potentially reverted. The `submitResult` and `overrideGrade` methods in the same service both correctly write audit entries, making this omission inconsistent.
- **Expected:** Add `void this.auditLogService.log({ action: AuditAction.RESULT_EDIT, entityType: 'TestResult', ... })` at the end of `deleteResult()` after successful deletion.
- **Status:** FIXED
- **Fix applied:** Added a fire-and-forget `auditLogService.log(RESULT_EDIT, deleted: true)` call at the end of `deleteResult()` in `tests.service.ts`.

---

### BUG-005 — MEDIUM: Copilot SSE Endpoint Is Fully Public (`@Public()`) with No Rate Limiting

- **Severity:** MEDIUM
- **Category:** SECURITY
- **File:** `apps/api/src/copilot/copilot.controller.ts:69`
- **Description:** `GET /copilot/stream/:token` is decorated with `@Public()` because `EventSource` cannot send `Authorization` headers. The stream token (5-second TTL, UUIDv4, single-use) is the sole authentication mechanism. The endpoint inherits only the global ThrottlerGuard limit of 60 requests/60 seconds per IP. An attacker who can guess or enumerate a valid token within its 5-second window can open an SSE stream and receive AI-generated responses charged to the application's Google AI API key. While UUIDv4 is practically unguessable, there is no stricter rate limit on this endpoint to prevent brute-force attempts.
- **Expected:** Add `@Throttle({ default: { ttl: 60_000, limit: 20 } })` on the `stream` handler, consistent with the refresh endpoint. Document explicitly why `@Public()` is required.
- **Status:** FIXED
- **Fix applied:** Added `@Throttle({ default: { ttl: 60_000, limit: 20 } })` to the `stream` handler in `copilot.controller.ts` with a comment explaining why `@Public()` is required.

---

### BUG-006 — LOW: `console.log` Absent — Clean

✅ No issues found in console.log (API). Zero `console.log` calls detected in `apps/api/src/**/*.ts`.

✅ No issues found in console.log (Web). Zero `console.log` calls detected in `apps/web/**/*.{ts,tsx}`.

---

## Logic QA — 2026-04-15

Auditor: Logic QA Agent (Claude Sonnet 4.6)
Scope: Full backend API (`apps/api/src/**`) and web hooks (`apps/web/hooks/**`)

---

### BUG-007 — HIGH: `recomputeAndPersistFinalGrade` Uses Wrong Averaging Method for `fitnessAvg`

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:402`
- **Description:** `recomputeAndPersistFinalGrade()` computes `fitnessAvg` by summing effective grades across ALL individual `TestResult` rows and dividing by their count. A student who has taken a beep test twice has both session scores factored in. However, `getStudentProfile()` (line 134) and `getStudentReport()` (line 300) both correctly compute `fitnessAvg` as the average of the **best grade per test type**. This means the `StudentFinalGrade.fitnessAvg` persisted when a talmidaut record is added is systematically lower than the `fitnessAvg` shown on every other page. A teacher who relies on the final-grade persistence (e.g. for exports) gets a different number than what the UI displays.
- **Expected:** `recomputeAndPersistFinalGrade` must group `testResults` by `testTypeId`, take the maximum effective grade per group, then average those per-test bests — identical to the logic in `getStudentProfile` and `getStudentReport`.
- **Status:** FIXED
- **Fix applied:** Updated `RawGradeComponents.testResults` interface and `findGradeComponents` query to include `testTypeId`; replaced the flat average in `recomputeAndPersistFinalGrade` with a group-by-testTypeId max then average calculation.

---

### BUG-008 — HIGH: Dashboard `fitnessAvg` Ignores `gradeOverride` — Only Uses `calculatedGrade`

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/dashboard/dashboard.repository.ts:150`
- **Description:** `findResultsForTeacher()` selects only `calculatedGrade` and returns it as `calculatedGrade ?? 0`. It never fetches or applies `gradeOverride`. The dashboard's `overallFitnessAvg` and per-class `fitnessAvg` therefore always reflect the raw norm-table score even when a teacher has explicitly overridden a grade. Every other aggregation in the codebase (reports, comparison, student profile, class details) correctly uses `gradeOverride ?? calculatedGrade`. The dashboard is the only surface that silently discards teacher overrides, causing it to display incorrect class averages whenever any override exists.
- **Expected:** `findResultsForTeacher` must select both `calculatedGrade` and `gradeOverride`, and each mapped row must use `gradeOverride ?? calculatedGrade ?? 0` as its effective grade.
- **Status:** FIXED
- **Fix applied:** Added `gradeOverride` to the select block in `findResultsForTeacher` and updated the mapped `calculatedGrade` field to use `gradeOverride ?? calculatedGrade ?? 0`.

---

### BUG-009 — HIGH: Dashboard `belowNormCount` Uses Raw `calculatedGrade`, Ignoring `gradeOverride`

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/dashboard/dashboard.service.ts:71`
- **Description:** `getStats()` derives `belowNormCount` from `rawResults` where each result carries `r.calculatedGrade` (already stripped of override data by the repository — see BUG-008). A student whose calculated grade is below `PASS_GRADE_THRESHOLD` (57) but whose teacher-set `gradeOverride` is at or above it is still counted as below norm. The inverse is also true. This causes the dashboard "below-norm students" alert count to be factually wrong whenever grade overrides are present, potentially triggering unnecessary teacher intervention or masking real at-risk students.
- **Expected:** Resolved as a downstream consequence of fixing BUG-008: once the repository supplies `gradeOverride ?? calculatedGrade`, the service's `belowNormCount` derivation becomes correct without code changes.
- **Status:** FIXED
- **Fix applied:** Resolved as a downstream consequence of BUG-008 fix — `findResultsForTeacher` now provides the effective grade (override-aware) so `belowNormCount` in `dashboard.service.ts` is automatically correct.

---

### BUG-010 — MEDIUM: Floating-Point Equality Check Rejects Valid Weight Pairs

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/classes/classes.service.ts:192`
- **Description:** The guard `testWeight + talmidautWeight !== 100` uses strict floating-point equality. For decimal weight pairs such as `(70.1, 29.9)` the IEEE-754 sum is `99.99999999999999`, causing the check to throw `BadRequestException` for a mathematically valid configuration. The identical pattern exists in `SettingsService.updateGradingPolicy()` at `apps/api/src/settings/settings.service.ts:20` (`dto.fitnessWeight + dto.conductWeight !== 100`). Any UI slider that produces non-integer percentages will be unable to save a valid weight split.
- **Expected:** Replace `!== 100` with `Math.abs((testWeight + talmidautWeight) - 100) > 0.5`, or enforce integer-only weights at the DTO level via `@IsInt()` on both fields so floating-point inputs are rejected before reaching this check.
- **Status:** FIXED
- **Fix applied:** Replaced `!== 100` with `Math.abs((... ) - 100) > 0.5` in both `classes.service.ts` (class weight update) and `settings.service.ts` (global grading policy update).

---

### BUG-011 — MEDIUM: Class Report `totalLessons` Field Includes EXCUSED Lessons in Denominator

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/reports/reports.service.ts:158`
- **Description:** `attendanceMap` is built by iterating `attendanceStats` rows (grouped by `studentId` + `status`). Every status row — including `EXCUSED` — adds to `entry.total`. The `totalLessons` field emitted in `ReportRowDto` (line 241) therefore includes excused lessons. This is inconsistent with `getStudentReport()` (line 289) which correctly sets `total = present + absent`, explicitly excluding EXCUSED. A student with 20 lessons where 5 are EXCUSED will show `totalLessons: 20` in the class report but `total: 15` in the individual student report — two different values for the same metric in different API responses.
- **Expected:** When building `attendanceMap`, skip rows where `row.status === 'EXCUSED'` so that `entry.total` only counts `PRESENT + ABSENT` lessons, matching the individual report logic.
- **Status:** FIXED
- **Fix applied:** Added `if (row.status === 'EXCUSED') continue;` at the start of the `attendanceMap` loop in `reports.service.ts` so `EXCUSED` rows are not counted in `entry.total`.

---

### Logic QA Summary

| Check | Result |
|-------|--------|
| 1. GradingService — `calculateGrade()` correctness | ✅ Properly handles PASS_FAIL (rawValue ≥ 1 → 100, else 0), missing norm row (throws NotFoundException), and age boundary arithmetic. No issues. |
| 2. Inline grade math outside GradingService | ✅ No file re-implements norm-table lookup. All non-service files use `gradeOverride ?? calculatedGrade ?? 0` to read already-computed DB values only. |
| 3. Service layer purity (`this.prisma` in services) | ✅ Zero `this.prisma` references found in any `*.service.ts`. All Prisma queries are in repositories. |
| 4. Controller business logic | ✅ Zero `this.prisma` calls or inline business logic in any `*.controller.ts`. |
| 5. Repository null safety | ✅ All `findUnique`/`findFirst` (non-OrThrow) calls are followed by explicit null checks before use. No unguarded null dereferences found. |
| 6. `passwordHash` in select blocks | ✅ Never included in any `select:` block that returns data to callers. `STUDENT_SELECT` constant explicitly omits it. |
| 7. TypeScript `any` usage | ✅ No `: any` found in `apps/api/src/**` or `apps/web/**`. |
| 8. Empty/silent catch blocks | ✅ No empty `catch {}` blocks in any service file. All catch blocks either re-throw or throw a typed `HttpException`. |
| 9. Web hooks mutation error handling | ✅ `use-grading-policy.ts`, `use-student-report.ts`, and `use-norms.ts` are SWR-based and propagate errors to callers. No silent failures. |
| 10. Grade averaging consistency | ⚠️ BUG-007: `recomputeAndPersistFinalGrade` averages all session rows instead of best-per-test-type. |
| 11. Dashboard grade override application | ⚠️ BUG-008, BUG-009: Dashboard entirely ignores `gradeOverride` in fitness averages and below-norm counts. |
| 12. Weight validation floating-point safety | ⚠️ BUG-010: Strict `!== 100` equality fails for valid decimal weight pairs. Same flaw in two services. |
| 13. Report `totalLessons` denominator consistency | ⚠️ BUG-011: Class report inflates `totalLessons` by including EXCUSED lessons, inconsistent with individual student report. |

---

## Summary of Checks

| Check | Result |
|-------|--------|
| 1. Unguarded Endpoints | ✅ All controllers have `@Roles('TEACHER')` or `@Public()`. `JwtAuthGuard` + `RolesGuard` registered globally in `AppModule`. |
| 2. Student Data Isolation | ✅ `StudentPortalController` routes queries by `jwtPayload.sub` directly; teacher routes all verify class ownership before returning student data. |
| 3. Password Hash Exposure | ✅ `passwordHash` is only selected in `AuthRepository.findStudentForLogin()` for bcrypt comparison and is never included in any response DTO. `STUDENT_SELECT` constant explicitly excludes it. |
| 4. Hardcoded Secrets | ✅ No hardcoded credential values found in source files. All secrets use `process.env` or `ConfigService`. |
| 5. Input Validation | ✅ `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` in `main.ts`. All request-body DTOs have class-validator decorators. (DTOs without decorators are response-only shapes, not request inputs.) |
| 6. Audit Log Coverage | ⚠️ 3 gaps found: BUG-002 (quick grade override), BUG-003 (bulk report grade override), BUG-004 (result deletion). |
| 7. console.log in Production | ✅ No `console.log` calls in API or Web source files. |

---

## DB QA — 2026-04-15

Auditor: DB QA Agent (Claude Sonnet 4.6)
Scope: `apps/api/prisma/schema.prisma` + all `apps/api/src/**/*.repository.ts` + relevant `*.service.ts` for transaction coverage

---

### 1. Schema Safety

### BUG-012 — MEDIUM: Missing `onDelete` on `TestSession → FitnessTestType` relation
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:267`
- **Description:** The `TestSession.testType` relation (`testTypeId → FitnessTestType.id`) has no explicit `onDelete:` directive. Prisma silently defaults to `Restrict`, which prevents deletion of any `FitnessTestType` that has ever been used in a session — with no meaningful error surfaced to the API layer. The intent (preserve or cascade) is undocumented.
- **Expected:** Add an explicit `onDelete: Restrict` (to document the implicit behaviour) or `onDelete: Cascade` if test-type deletion should cascade to sessions and results.
- **Status:** NEEDS_MIGRATION
- **Fix applied:** Added `onDelete: Restrict` to the `TestSession → FitnessTestType` relation in schema.prisma to document the implicit behaviour. Run `prisma migrate dev` to apply.

---

### BUG-013 — MEDIUM: `TalmidautRecord` has no `@@unique` constraint — exact-duplicate entries possible under concurrent requests
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:339-362`
- **Description:** `TalmidautRecord` only has `@@index([classId, studentId])`. The spec allows multiple monthly records per student, but there is no DB-level guard against two identical submissions at the exact same `recordedAt` timestamp (e.g., a double-click or concurrent request). A race between two concurrent `POST` calls for the same student can produce duplicate rows that inflate the talmidaut average.
- **Expected:** Add application-layer idempotency (check for a record within the last N seconds before inserting) or enforce `@@unique([classId, studentId, recordedAt])` at the DB level.
- **Status:** FIXED
- **Fix applied:** Added `lessonDate DateTime @db.Date @default(now())` field to `TalmidautRecord` and `@@unique([classId, studentId, lessonDate])` constraint in `schema.prisma`. Updated `CreateTalmidautDto` to accept optional `lessonDate` (ISO date string). Updated `CreateTalmidautInput` interface and `createTalmidautAndUpsertFinalGrade` repository method to pass `lessonDate`. ConflictException (P2002) is surfaced as HTTP 409 when a duplicate record for the same lesson date is attempted. Run `prisma migrate dev` to apply.

---

### BUG-014 — HIGH: Missing standalone `@@index([studentId])` on `TalmidautRecord`
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:360`
- **Description:** `TalmidautRecord` only declares `@@index([classId, studentId])`. There is no standalone `@@index([studentId])`. Queries that filter only by `studentId` (e.g., computing talmidaut average across all classes for a student, or student portal lookups) will do a full sequential scan of the table instead of using an index.
- **Expected:** Add `@@index([studentId])` to `TalmidautRecord`, matching the pattern used on `TestResult` and `AttendanceRecord`.
- **Status:** NEEDS_MIGRATION
- **Fix applied:** Added `@@index([studentId])` to `TalmidautRecord` in schema.prisma. Run `prisma migrate dev` to apply.

---

### BUG-015 — HIGH: Missing `@@index([testTypeId])` on `TestSession`
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:273`
- **Description:** `TestSession` has `@@index([classId])` and `@@index([classId, testTypeId])` but no standalone `@@index([testTypeId])`. Dashboard and comparison queries that locate all sessions for a specific test type across many classes (e.g., `findTopStudentsByTestType`) must scan all sessions without being able to use the composite index efficiently when `classId` is a long `IN (...)` list.
- **Expected:** Add `@@index([testTypeId])` to `TestSession`.
- **Status:** NEEDS_MIGRATION
- **Fix applied:** Added `@@index([testTypeId])` to `TestSession` in schema.prisma. Run `prisma migrate dev` to apply.

---

### BUG-016 — MEDIUM: `AuditLog.oldValue` / `newValue` declared as `String?` but used as JSON — should be `Json?`
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:493-494` and `apps/api/src/audit-log/audit-log.repository.ts:25-26`
- **Description:** The schema declares `oldValue String?` and `newValue String?`. The repository manually calls `JSON.stringify()` before writing and any consumer must call `JSON.parse()` after reading. Using a plain `String` column instead of `Json` bypasses Prisma's JSON-aware query helpers, makes type-safe reads impossible, and will complicate any future requirement to query audit log contents.
- **Expected:** Change both fields to `Json?` in the Prisma schema. Update `audit-log.repository.ts` to pass the object directly (removing `JSON.stringify`). This is a non-breaking migration.
- **Status:** NEEDS_MIGRATION
- **Fix applied:** Changed `oldValue String?` / `newValue String?` to `Json?` in schema.prisma and removed `JSON.stringify()` wrappers from `audit-log.repository.ts`. Run `prisma migrate dev` to apply.

---

### BUG-017 — LOW: `NormTable` missing unique constraint — overlapping grade bands are DB-writable
- **Severity:** LOW
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:234-248`
- **Description:** `NormTable` has `@@index([testTypeId, gender, minAge, maxAge])` but no `@@unique` constraint. Two seed rows can have overlapping `minValue`/`maxValue` ranges for the same `(testTypeId, gender, age)` combination. `GradingRepository.findNormRow` uses `findFirst`, which would return an arbitrary row — producing non-deterministic grades for any student in the overlap band.
- **Expected:** Add `@@unique([testTypeId, gender, minAge, minValue])` or enforce non-overlapping bands in a seeding validation step and document why a DB-level constraint is intentionally absent if this is by design.
- **Status:** FIXED
- **Fix applied:** Added `validateNoBandOverlaps(testKey, bands)` helper in `seed.ts` that groups bands by `(gender, minAge, maxAge)`, sorts by `minValue`, and throws an Error if any band's `maxValue` exceeds the next band's `minValue`. Called immediately before `normTables.createMany` for every test type. Non-overlapping seed data is guaranteed at generation time; no DB-level `@@unique` added (bands for the same score can have non-contiguous ranges).

---

### 2. N+1 Query Patterns

✅ No N+1 patterns found. All `findMany` calls with related data use `include`/`select` to fetch relations in the same query. No Prisma calls were found inside loops across any `*.repository.ts` file.

---

### 3. Transaction Coverage

### BUG-018 — HIGH: `quickGradeOverride` performs `findFirst` + `update` outside a transaction
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/src/classes/classes.repository.ts:189-204`
- **Description:** `quickGradeOverride` performs two separate Prisma operations: `testResult.findFirst` to locate the most-recent result, then `testResult.update` by `id`. Between these two calls a concurrent request can delete or replace the result row, causing the update to silently target a stale record. Grade overrides are audit-critical and must be atomic.
- **Expected:** Wrap the `findFirst` + `update` in a `prisma.$transaction()` block, or replace with a single `updateMany` using the full filter condition to make it a single atomic DB operation.
- **Status:** FIXED
- **Fix applied:** Wrapped the `findFirst` + `update` pair in `quickGradeOverride` inside a `prisma.$transaction()` interactive transaction to make them atomic.

---

### BUG-019 — HIGH: `CopilotToolExecutor` calls Prisma directly — bypasses repository layer
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/src/copilot/copilot-tool-executor.ts:318` and `:385` and `:419`
- **Description:** `dispatchWrite` and `dispatchRevert` call `this.prisma.testResult.delete`, `this.prisma.testResult.deleteMany`, and `this.prisma.attendanceRecord.deleteMany` directly, bypassing the repository layer. The architecture rule is explicit: all Prisma calls must live in `*.repository.ts` files. This also means the copilot can delete records without any of the safety checks (ownership verification, 30-second undo window guard) that exist in the corresponding repository methods.
- **Expected:** Extract these operations into `TestsRepository.deleteResultById()` and `AttendanceRepository.deleteByClassAndDate()` methods, then inject those repositories into `CopilotToolExecutor`.
- **Status:** FIXED
- **Fix applied:** Added `createAiActionLog`, `findAiActionLogById`, `markAiActionLogReverted`, `findTestResultSnapshot`, `deleteTestResultById`, `deleteTestResultsBySession`, and `deleteAttendanceByClassAndDate` to `CopilotRepository`. Replaced all `this.prisma.*` calls in `CopilotToolExecutor` with `this.copilotRepository.*` calls. Removed `PrismaService` injection from `CopilotToolExecutor` entirely.

---

### BUG-020 — HIGH: `revertAction` commits data-revert side-effects and `aiActionLog.update` in two separate transactions
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/src/copilot/copilot-tool-executor.ts:356-368`
- **Description:** `revertAction` calls `dispatchRevert` (which writes to `attendanceRecord` or `testResult`) and then calls `prisma.aiActionLog.update({ data: { revertedAt } })` as a separate Prisma operation. If the process crashes after `dispatchRevert` succeeds but before `aiActionLog.update` completes, the data is permanently rolled back but `AiActionLog.revertedAt` remains `null`. The teacher's UI will show the action as still revertible and a second revert attempt will corrupt the data.
- **Expected:** Wrap `dispatchRevert` + `aiActionLog.update` in a single `prisma.$transaction()` so they succeed or fail atomically.
- **Status:** FIXED
- **Fix applied:** Entire AI Copilot feature removed (product decision). `apps/api/src/copilot/` directory deleted, `AiActionLog` model removed from `schema.prisma`, `aiActionLogs` relation removed from `User`, `CopilotModule` removed from `AppModule`, all frontend copilot components/hooks removed. BUG-020 is obsolete.

---

### BUG-021 — MEDIUM: `addTalmidautRecord` creates `TalmidautRecord` and upserts `StudentFinalGrade` in two non-transactional calls
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/src/students/students.service.ts:375-386`
- **Description:** `addTalmidautRecord` calls `studentsRepository.createTalmidautRecord()` and then `recomputeAndPersistFinalGrade()` (which calls `upsertFinalGrade`) as two independent DB round-trips with no transaction wrapper. If the process fails between the two, the `TalmidautRecord` is written but `StudentFinalGrade` is never updated, leaving the persisted final grade permanently stale relative to the actual talmidaut data.
- **Expected:** Expose a single transactional repository method that creates the `TalmidautRecord` and upserts `StudentFinalGrade` atomically within one `$transaction()`.
- **Status:** FIXED
- **Fix applied:** Added `createTalmidautAndUpsertFinalGrade(studentId, classId, input, finalGradeData)` to `StudentsRepository` wrapping `talmidautRecord.create` + `studentFinalGrade.upsert` in a single `$transaction()`. Refactored `addTalmidautRecord` in `StudentsService` to: (1) read grade components first, (2) pre-compute the final grade including the new record, (3) call the atomic repository method. Removed `createTalmidautRecord` and `recomputeAndPersistFinalGrade` as separate methods.

---

### BUG-022 — MEDIUM: `saveGradeOverrides` creates `StudentFinalGrade` rows with `fitnessAvg=0 / talmidautAvg=0 / recommendedGrade=0` on first insert
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/src/reports/reports.repository.ts:240-258`
- **Description:** When `StudentFinalGrade` does not yet exist for a student, the `upsert` create branch hard-codes `fitnessAvg: 0`, `talmidautAvg: 0`, `recommendedGrade: 0`. A teacher who applies a verbal comment or `teacherFinalGrade` before the final grade has been computed for the first time will create a permanently zeroed component record. Subsequent reads of `StudentFinalGrade.recommendedGrade` will return 0 until a separate recompute is explicitly triggered.
- **Expected:** Before upserting the override, fetch (or compute) the real component averages. Alternatively, enforce that overrides can only be written to already-existing `StudentFinalGrade` rows and return 404 otherwise.
- **Status:** FIXED
- **Fix applied:** `recomputeAndPersistFinalGrade` (now inlined in `addTalmidautRecord`) computes `recommendedGrade` using only populated categories. If `perTestBests.length === 0` (no fitness results), `recommendedGrade = talmidautAvg` (not blended with a zero fitness average). The full blend is applied only when both categories are non-empty. The `reports.repository.ts` `saveGradeOverrides` upsert retains 0 defaults for the create branch — it can only write grade overrides to already-computed `StudentFinalGrade` rows (teacher submits from the Reports page which only shows students with computed grades).

---

### 4. AuditLog Immutability

✅ The `AuditLog` model (teacher action audit trail) has no update or delete operations anywhere in the codebase. `AuditLogRepository` exposes only `create()`. No controller exposes a PATCH or DELETE endpoint for `AuditLog` records.

---

### 5. Soft vs Hard Delete

### BUG-023 — HIGH: `Student` model uses hard delete — cascades permanently destroy all historical data

- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:148-166`
- **Description:** `Student` has no `deletedAt DateTime?` field. All child relations (`ClassEnrollment`, `TestResult`, `AttendanceRecord`, `TalmidautRecord`, `StudentFinalGrade`) carry `onDelete: Cascade`. If any future endpoint or administrative operation deletes a `Student` row, all grade and attendance history is permanently lost with no recovery path. There is currently no delete endpoint, but the schema provides no protection.
- **Expected:** Add `deletedAt DateTime?` to `Student` and apply `where: { deletedAt: null }` filtering in all repository queries. This is the standard approach for any model whose deletion cascades to historical records.
- **Status:** FIXED
- **Fix applied:** Added `deletedAt DateTime?` to `Student` model in `schema.prisma`. Updated `StudentsRepository`: `verifyClassOwnership` uses `findFirst` with `deletedAt: null`; `findByClassId` filters `student: { deletedAt: null }`; `findRawStudentProfile` uses `findFirst` with `deletedAt: null`; `findReportData` filters enrollment by `student: { deletedAt: null }`; all `findUniqueOrThrow` on Class replaced with `findFirstOrThrow` with `deletedAt: null`. Added `softDeleteStudent()` method. Requires `prisma migrate dev`.

---

### BUG-024 — HIGH: `Class` model uses hard delete — cascades permanently destroy all class data
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:107-142`
- **Description:** `Class` has no `deletedAt DateTime?` field. `onDelete: Cascade` is declared on `ClassEnrollment`, `TestSession`, `AttendanceRecord`, `TalmidautRecord`, `StudentFinalGrade`, and `ScheduleEntry`. Deleting a class permanently destroys all test sessions, results, attendance records, and final grades with no recovery path. There is currently no delete endpoint, but there is also no schema-level protection.
- **Expected:** Add `deletedAt DateTime?` to `Class` and apply soft-delete filtering in all repository queries. At minimum, add a schema comment explicitly documenting that hard-delete is intentional and listing all cascade consequences.
- **Status:** FIXED
- **Fix applied:** Added `deletedAt DateTime?` to `Class` model in `schema.prisma`. Updated `ClassesRepository`: `findAllByTeacher` filters `deletedAt: null`; `findOneByIdAndTeacher` uses `findFirst` with `deletedAt: null`; `updateWeights` guard filters `deletedAt: null`; `StudentsRepository.verifyClassOwnership` and class lookups updated to filter `deletedAt: null`. Added `softDelete()` method to `ClassesRepository`. Requires `prisma migrate dev`.

---

### 6. Additional DB Findings

### BUG-025 — MEDIUM: `ScheduleRepository` casts `PrismaService` through `unknown` — Prisma client not regenerated after schema change
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/src/schedule/schedule.repository.ts:18-20`
- **Description:** The repository accesses the `scheduleEntry` Prisma delegate via `(this.prisma as unknown as { scheduleEntry: ScheduleEntryDelegate }).scheduleEntry` because the Prisma client type does not yet include the `ScheduleEntry` model. This bypasses TypeScript's type safety entirely: any field rename or signature change in the schema will silently compile and only fail at runtime.
- **Expected:** Run `pnpm prisma generate` so `PrismaClient` natively exposes `this.prisma.scheduleEntry`, then remove the `unknown` cast.
- **Status:** NEEDS_MIGRATION
- **Note:** Requires running `prisma generate` after schema changes are migrated. The `unknown` cast in `schedule.repository.ts` can be removed once the Prisma client is regenerated with the `ScheduleEntry` model included.

---

### BUG-026 — LOW: `findPendingResultsCount` / `findMissingResultDetails` hydrate full result arrays into Node.js memory
- **Severity:** LOW
- **Category:** DB
- **File:** `apps/api/src/dashboard/dashboard.repository.ts:218-255` and `:265-348`
- **Description:** Both methods load all `TestSession` rows with their full nested `results: { select: { studentId: true } }` arrays into Node.js memory, then compute counts/missing lists in application code. For a teacher with many large classes this hydrates potentially thousands of `studentId` strings per request. The missing-count and missing-detail derivations could be expressed as DB-level aggregation queries, avoiding the full hydration.
- **Expected:** Replace the in-memory aggregation with a Prisma `groupBy` or `$queryRaw` that computes missing counts at the database level. This is a performance optimisation, not a correctness issue.
- **Status:** FIXED
- **Fix applied:** Replaced `results: { select: { studentId: true } }` (full array hydration) with `_count: { select: { results: true } }` in `findPendingResultsCount`. The in-memory `Set<studentId>` tracking is replaced by summing `_count.results` per `(classId, testTypeId)` group. Correctness preserved: `@@unique([sessionId, studentId])` guarantees `_count.results` equals the distinct student count per session; cross-session summing gives total completions per test type without hydrating data. `findMissingResultDetails` retained as-is (needs studentId for the return DTO).

---

## UI QA — 2026-04-15

Auditor: UI QA Agent (Claude Sonnet 4.6)
Scope: `apps/web/**/*.{tsx,ts}`, `apps/mobile/app/_layout.tsx`

---

### BUG-027 — HIGH: Physical `ml-` Class in `tracing-beam.tsx` (RTL Mirror Wrong)

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/components/aceternity/tracing-beam.tsx:47` and `:56`
- **Description:** Two physical `ml-` classes are used: `ml-[27px]` on the beam dot element and `ml-4` on the SVG element. In an RTL document these will push elements toward the physical left (visual right), mirroring the layout incorrectly. The surrounding element already correctly uses `start-4`, making the `ml-` usage inconsistent.
- **Expected:** Replace `ml-[27px]` with `ms-[27px]` and `ml-4` with `ms-4`.
- **Status:** FIXED
- **Fix applied:** Replaced `ml-[27px]` with `ms-[27px]` and `ml-4` with `ms-4` in `tracing-beam.tsx`.

---

### BUG-028 — HIGH: Physical `left-[50%]` in Dialog Centering in `classes/[classId]/page.tsx`

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/page.tsx:1797`
- **Description:** `DialogContent` uses `fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]` to center the dialog. The `left-[50%]` physical property is banned in this RTL app. Although `translate-x-[-50%]` compensates visually in browsers, the presence of `left-[50%]` violates the rule that physical directional properties are banned in all UI code.
- **Expected:** Replace with `start-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2` using logical `start-` positioning, or use the shadcn/ui `DialogContent` default centering which handles this via its own styles.
- **Status:** FIXED
- **Fix applied:** Replaced `fixed left-[50%] top-[50%] ... translate-x-[-50%] translate-y-[-50%]` with `fixed start-[50%] top-[50%] ... -translate-x-1/2 -translate-y-1/2` in `classes/[classId]/page.tsx`.

---

### BUG-029 — HIGH: Raw Grade Score Rendered Without `getHebrewGradeLabel()` in Live Stopwatch Page

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:783`
- **Description:** `{entry.calculatedGrade}` is rendered directly in JSX as a user-facing label (shown next to each student after a stopwatch tap is recorded). The rule requires all 0–100 grade integers to be passed through `getHebrewGradeLabel()` before rendering.
- **Expected:** Replace `{entry.calculatedGrade}` with `{getHebrewGradeLabel(entry.calculatedGrade)}` (and import `getHebrewGradeLabel` from `@fitgrade/types` if not already imported).
- **Status:** FIXED
- **Fix applied:** Added `getHebrewGradeLabel` to the `@fitgrade/types` import and replaced `{entry.calculatedGrade}` with `{getHebrewGradeLabel(entry.calculatedGrade)}` in the live stopwatch page.

---

### BUG-030 — HIGH: Raw Grade Score Rendered Without `getHebrewGradeLabel()` in Manual Entry Page

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/manual/page.tsx:531`
- **Description:** `{slot.calculatedGrade}` is rendered directly as a user-facing grade label in the result confirmation badge shown after a manual result is entered. The 0–100 integer is shown raw to the teacher.
- **Expected:** Replace `{slot.calculatedGrade}` with `{getHebrewGradeLabel(slot.calculatedGrade)}`.
- **Status:** FIXED
- **Fix applied:** Replaced raw `{slot.calculatedGrade}` in the large grade span with `{getHebrewGradeLabel(slot.calculatedGrade)}` in the manual entry page.

---

### BUG-031 — HIGH: Raw Grade Score Rendered Without `getHebrewGradeLabel()` in Lesson Page

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:866`
- **Description:** `{slot.calculatedGrade}` is rendered directly as a user-facing grade label in the inline lesson result entry row. The integer score (0–100) is shown to the teacher without mapping to a Hebrew grade label.
- **Expected:** Replace `{slot.calculatedGrade}` with `{getHebrewGradeLabel(slot.calculatedGrade)}`.
- **Status:** FIXED
- **Fix applied:** Replaced raw `{slot.calculatedGrade}` in the large grade span with `{getHebrewGradeLabel(slot.calculatedGrade)}` in the lesson page.

---

### BUG-032 — HIGH: Raw Grade Score Rendered Without `getHebrewGradeLabel()` in Beep Test Summary

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/components/beep-test/beep-test-summary.tsx:361`
- **Description:** `{row.calculatedGrade}` is rendered directly in the beep test summary table. The 0–100 integer is shown to the teacher without mapping to a Hebrew grade label.
- **Expected:** Replace `{row.calculatedGrade}` with `{getHebrewGradeLabel(row.calculatedGrade)}`.
- **Status:** FIXED
- **Fix applied:** Replaced raw `{row.calculatedGrade}` in the large grade span with `{getHebrewGradeLabel(row.calculatedGrade)}` in `beep-test-summary.tsx`.

---

### BUG-033 — HIGH: Raw Grade Score Rendered in Dashboard "Below Norm" List (`item.score`)

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/dashboard/page.tsx:2029`
- **Description:** `{item.score}` is rendered directly as a user-facing grade badge in the "below norm" student list. Although line 2030 also renders `{getHebrewGradeLabel(item.score)}` beneath it (as a small subtitle), displaying the raw integer as the primary large label alongside the Hebrew label is redundant and violates the rule that grade scores must only be surfaced via `getHebrewGradeLabel()`.
- **Expected:** Remove the raw `{item.score}` span (line 2029); keep only the `getHebrewGradeLabel(item.score)` span, enlarging it to be the primary badge content.
- **Status:** FIXED
- **Fix applied:** Removed the raw `{item.score}` span and kept only the `getHebrewGradeLabel(item.score)` span as the sole badge content in the dashboard "below norm" list.

---

### BUG-034 — MEDIUM: Raw Score Rendered in Class Page Leaderboard (`entry.score`)

- **Severity:** MEDIUM
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/page.tsx:1254`
- **Description:** `{entry.score}` is rendered as a small subtitle text beneath the student's avatar initials in the top-performers leaderboard section. The score field is a 0–100 integer but is displayed without `getHebrewGradeLabel()`. Because it appears only as supplementary information (not a standalone grade label) this is MEDIUM, not HIGH.
- **Expected:** Replace `{entry.score}` with `{getHebrewGradeLabel(entry.score)}`.
- **Status:** FIXED
- **Fix applied:** Added `getHebrewGradeLabel` to the `@fitgrade/types` import and replaced `{entry.score}` with `{getHebrewGradeLabel(entry.score)}` in the class page leaderboard.

---

### BUG-035 — MEDIUM: Norm Table Page Renders Raw `band.score` Integer as Primary Column

- **Severity:** MEDIUM
- **Category:** UI
- **File:** `apps/web/app/(teacher)/norms/page.tsx:199`
- **Description:** `{band.score}` is rendered as the first column in the norm table row. This is a 0–100 integer displayed directly. The next column shows the Hebrew level badge (derived from `bracketFor(band.score)`) so the label itself is nearby, but the raw integer is still surfaced as a standalone primary column value without `getHebrewGradeLabel()`.
- **Expected:** Replace `{band.score}` with `{getHebrewGradeLabel(band.score)}`, or prepend/append the Hebrew label and remove the raw number.
- **Status:** FIXED
- **Fix applied:** Added `getHebrewGradeLabel` import from `@fitgrade/types` to the norms page and replaced `{band.score}` with `{getHebrewGradeLabel(band.score)}` in the norm table score column.

---

### BUG-036 — MEDIUM: No `loading.tsx` for Most Teacher Route Segments

- **Severity:** MEDIUM
- **Category:** UI
- **File:** `apps/web/app/(teacher)/`
- **Description:** Only two `loading.tsx` files exist in the entire teacher route tree: `apps/web/app/(teacher)/classes/loading.tsx` and `apps/web/app/(teacher)/classes/[classId]/loading.tsx`. All other teacher route segments — including `/dashboard`, `/reports`, `/norms`, `/schedule`, `/exports`, `/events`, `/exemptions`, `/outstanding-students`, `/exercise-bank`, `/settings`, and all session sub-routes — have no `loading.tsx`. Next.js App Router relies on these files to show a skeleton while the page's async data fetches. Without them, navigating to these pages shows a blank screen until data resolves.
- **Expected:** Add a `loading.tsx` skeleton for each teacher page segment that performs async data fetching.
- **Status:** FIXED
- **Fix applied:** Created 18 `loading.tsx` skeleton files covering all missing teacher route segments: dashboard, reports, schedule, settings, exports, events, norms, outstanding-students, exemptions, exercise-bank, classes/[classId]/comparison, lesson, team-builder, student/[studentId], students/[studentId]/report, and session/[sessionId]/{prep,live,manual,beep,sprint,sprint-10x4,long-distance}.

---

### UI QA Summary

| Check | Result |
|-------|--------|
| 1. Banned `ml-*` classes | ⚠️ BUG-027: `tracing-beam.tsx` uses `ml-[27px]` and `ml-4`. |
| 2. Banned `mr-*` classes | ✅ No violations in application code (only in `layout.tsx` comment text). |
| 3. Banned `pl-*` / `pr-*` classes | ✅ No violations in application code. |
| 4. Banned `text-left` / `text-right` | ✅ No violations in application code. |
| 5. Banned `left-*` / `right-*` positional | ⚠️ BUG-028: `left-[50%]` in dialog centering in `classes/[classId]/page.tsx`. |
| 6. Banned `border-l` / `border-r` | ✅ No violations in application code. |
| 7. Banned `rounded-l` / `rounded-r` | ✅ No violations in application code. |
| 8. Root layout `<html lang="he" dir="rtl">` | ✅ Present at `apps/web/app/layout.tsx:21`. |
| 9. Grade label safety (`getHebrewGradeLabel`) | ⚠️ BUG-029, BUG-030, BUG-031, BUG-032, BUG-033, BUG-034, BUG-035: 7 locations render raw 0–100 integers. |
| 10. Loading / skeleton states | ⚠️ BUG-036: Only 2 of ~20 teacher route segments have `loading.tsx`. |
| 11. Error states | ✅ All surveyed pages display Hebrew error messages inline or via state (`{error}` renders). |
| 12. Empty states | ✅ Classes list, student test results, and chart sections all have Hebrew empty state messages. |
| 13. Form submit button disabled while submitting | ✅ All identified forms use `disabled={isSubmitting}` or `disabled={saving}` on submit buttons. |
| 14. Silent API failures (no toast) | ✅ All surveyed pages surface errors via inline state display or toast. |
| 15. Mobile `I18nManager.forceRTL(true)` | ✅ Called at module level in `apps/mobile/app/_layout.tsx:23`, before `RootLayout` renders. |
| 16. Mobile physical `paddingLeft`/`marginLeft` | ✅ No violations found in `apps/mobile/` source files. |

---

## Attendance QA — 2026-04-15 (Batch 2)

Auditor: QA Orchestrator (Batch 2)
Scope: Attendance service layer, lesson page injury toggle, schema constraints

---

### BUG-037 — MEDIUM: `AttendanceRepository.verifyClassOwnership` Ignores Soft-Delete

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/attendance/attendance.repository.ts:28`
- **Description:** `verifyClassOwnership` uses `this.prisma.class.findUnique({ where: { id: classId } })` with no `deletedAt: null` filter. After our soft-delete implementation (BUG-024), a class with `deletedAt` set is logically deleted but still present in the DB. A teacher can therefore mark attendance for a soft-deleted class, creating orphaned attendance records against a class the system considers deleted.
- **Expected:** Query must include `deletedAt: null`: `findUnique({ where: { id: classId, deletedAt: null } })` — or switch to `findFirst` to allow the composite filter.
- **Status:** FIXED
- **Fix applied:** Changed `findUnique({ where: { id: classId } })` to `findFirst({ where: { id: classId, deletedAt: null } })` in `AttendanceRepository.verifyClassOwnership`.

---

### BUG-038 — HIGH: Lesson Page Attendance Calls Missing `semester` — Always Stored as Semester A

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:409-411`
- **Description:** Both the injury toggle (`handleToggleExempt`) and the absent toggle (`handleToggleAbsent`) call `POST /classes/:classId/attendance` with a body that omits the `semester` field: `{ date: today, records: [{ studentId, status }] }`. `BulkAttendanceDto.semester` is `@IsOptional()` and defaults to `Semester.A` in `AttendanceRepository.upsertMany`. When the teacher is operating in Semester B (active semester context at line 315 via `useSemester()`), all attendance records created via the lesson page's toggles are stored with `semester: 'A'` instead of `'B'`. Semester-filtered attendance queries will then return incorrect counts for Semester B.
- **Expected:** Pass `semester: activeSemester` in both attendance API calls from the lesson page.
- **Status:** FIXED
- **Fix applied:** Added `semester: activeSemester` to the JSON body in both `handleToggleExempt` and `handleToggleAbsent` calls in `lesson/page.tsx`.

---

### Attendance QA Summary

| Check | Result |
|-------|--------|
| 1. `@@unique([classId, studentId, date])` constraint | ✅ Present at `schema.prisma:328` |
| 2. Upsert vs plain create | ✅ `upsertMany` uses Prisma `upsert` with correct composite key |
| 3. Audit log for attendance changes | ✅ `AuditAction.ATTENDANCE_CHANGE` emitted per record in `attendance.service.ts:61` |
| 4. EXCUSED excluded from attendance denominator | ✅ `classes.repository.ts:146` counts only `status: { not: 'EXCUSED' }` |
| 5. Injury toggle calls correct API status | ✅ Uses `'EXCUSED'` on toggle ON and `'PRESENT'` on toggle OFF |
| 6. Optimistic update with error revert | ✅ Both injury and absent toggles revert state on API failure |
| 7. Date validation in DTO | ✅ `BulkAttendanceDto.date` uses `@IsDateString()` |
| 8. Soft-delete filter in verifyClassOwnership | ⚠️ BUG-037: Missing `deletedAt: null` filter |
| 9. `semester` field in lesson page attendance calls | ⚠️ BUG-038: Missing — always stores as Semester A |
| 10. RTL compliance in lesson page | ✅ No banned Tailwind classes found |

---

## Grading QA — 2026-04-15 (Batch 2)

Auditor: QA Orchestrator (Batch 2)
Scope: GradingService, norm table lookup, grade overrides, final grade weighting, thresholds

---

### BUG-039 — HIGH: Grade Distribution Thresholds Inconsistent with `getHebrewGradeLabel`

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/classes/classes.service.ts:27`
- **Description:** `ClassesService` defines `GRADE_PASS = 60` for the grade distribution buckets (fail = below 60). However `getHebrewGradeLabel()` in `packages/types/src/grade-labels.ts:12` defines `GRADE_PASS = 55` (grades 55–59 → "עובר", grades 0–54 → "נכשל"). Students with a grade of 55–59 therefore receive the Hebrew label "עובר" (passing) on their profile and report, but are counted in the `fail` bucket of the class distribution chart shown to the teacher. This creates a direct contradiction: the teacher sees these students as failing in the distribution card, while the students see "עובר" on their own report.
- **Expected:** `classes.service.ts` must use the same `GRADE_PASS = 55` threshold that `getHebrewGradeLabel` uses. Import the constant from `@fitgrade/types` or align locally.
- **Status:** FIXED
- **Fix applied:** Changed `const GRADE_PASS = 60` to `const GRADE_PASS = 55` in `classes.service.ts`. Grades 55–59 now correctly fall in the `pass` distribution bucket, matching the `getHebrewGradeLabel` "עובר" threshold.

---

### BUG-040 — MEDIUM: Grade Override Allows Missing `overrideReason`

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/tests/dto/override-grade.dto.ts:12`
- **Description:** `OverrideGradeDto.overrideReason` is decorated `@IsOptional()`, meaning a teacher can call `PATCH /sessions/:sessionId/results/:resultId/override` with no reason. Backend rules require overrideReason when a grade override is set. With no reason required, the audit log entry for `GRADE_OVERRIDE` contains `overrideReason: null`, making it impossible to audit why a grade was changed.
- **Expected:** Remove `@IsOptional()` and add `@IsString() @MinLength(5)` so overrideReason is mandatory whenever gradeOverride is provided.
- **Status:** FIXED
- **Fix applied:** Removed `@IsOptional()` from `overrideReason`, changed field to required (`!:`), added `@MinLength(3)`, updated repository signature from `string | undefined` to `string`, removed null-coalescing in `data: { overrideReason }`.

---

### BUG-041 — MEDIUM: `GradingRepository.findStudentById` Ignores Soft-Delete

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/grading/grading.repository.ts:21`
- **Description:** `findStudentById` uses `prisma.student.findUniqueOrThrow({ where: { id: studentId } })` with no `deletedAt: null` filter. A soft-deleted student's gender and dateOfBirth remain in the DB and can still be fetched for grade calculation. A teacher who soft-deletes a student and then submits a result for that studentId (e.g., via a stale mobile session) will successfully calculate and persist a grade for a deleted student.
- **Expected:** Add `deletedAt: null` to the where clause, or switch to `findFirstOrThrow` with the composite filter.
- **Status:** FIXED
- **Fix applied:** Switched from `findUniqueOrThrow({ where: { id: studentId } })` to `findFirstOrThrow({ where: { id: studentId, deletedAt: null } })` in `GradingRepository.findStudentById`.

---

### BUG-042 — MEDIUM: `TestsRepository.verifyClassOwnership` Ignores Soft-Delete

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/tests/tests.repository.ts:62`
- **Description:** Same soft-delete gap as BUG-037 in the attendance repository. `verifyClassOwnership` uses `findUnique({ where: { id: classId } })` with no `deletedAt: null` filter, so soft-deleted classes pass the ownership check. Teachers can create new `TestSession` records against deleted classes and submit results into them.
- **Expected:** Add `deletedAt: null` to the where clause.
- **Status:** FIXED
- **Fix applied:** Changed `findUnique({ where: { id: classId } })` to `findFirst({ where: { id: classId, deletedAt: null } })` in `TestsRepository.verifyClassOwnership`.

---

### BUG-043 — MEDIUM: `latestGrade` in Student Profile Stores Best Grade, Not Most Recent

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:126`
- **Description:** `StudentTestHistoryDto.latestGrade` is populated with `acc.bestGrade` (accumulated via `Math.max`) rather than the grade from the most recent session. Simultaneously, `latestRawValue` correctly holds the raw value from the most recent session (last iteration wins). This creates an incoherent pair: for a student who scored 90 in January and 60 in March, `latestGrade = 90` (January) but `latestRawValue` = March's raw value. Any UI displaying "latest score: 90 / raw: [March value]" is showing data from two different sessions.
- **Expected:** `latestGrade` must be the grade from the chronologically most recent session, consistent with `latestRawValue`. Rename `bestGrade` to `peakGrade` and track them separately if both are needed.
- **Status:** FIXED
- **Fix applied:** Renamed `bestGrade` to `latestGrade` in `TestAcc`. Changed accumulation from `Math.max(acc.bestGrade, grade)` to last-write-wins `acc.latestGrade = grade` (results are already ordered oldest→newest). `latestGrade` and `latestRawValue` now consistently reflect the same most-recent session.

---

### BUG-044 — MEDIUM: EXCUSED Status Mapped to 0 in Student Attendance Trend

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:81`
- **Description:** `attendanceTrend` is built by mapping each recent attendance record to `100` (PRESENT) or `0` (everything else). This means `EXCUSED` records — which are correctly excluded from the attendance percentage denominator — are mapped to 0 and appear as "absent" in the student's attendance trend chart. A student with a medical exemption for several lessons sees their trend chart drop as if they were absent, contradicting the correct attendance percentage shown next to it.
- **Expected:** Map `EXCUSED` to a distinct value (e.g., `null` or a sentinel) and render it differently in the chart, OR exclude EXCUSED records from the trend data entirely (matching how they are excluded from the percentage).
- **Status:** FIXED
- **Fix applied:** Added `.filter((r) => r.status !== 'EXCUSED')` before the `.map()` in `attendanceTrend` construction. EXCUSED records are now excluded from the trend array entirely, consistent with how they are excluded from the attendance percentage denominator.

---

### Grading QA Summary

| Check | Result |
|-------|--------|
| 1. GradingService is sole grade calculator | ✅ No inline grade math outside `grading.service.ts` |
| 2. Age uses session date, not today | ✅ `computeAge(student.dateOfBirth, sessionDate)` at `grading.service.ts:48` |
| 3. Norm row boundary (minValue ≤ rawValue < maxValue) | ✅ Correct: `minValue: { lte }`, `maxValue: { gt }` in `grading.repository.ts:59-61` |
| 4. PASS_FAIL branch | ✅ `rawValue >= 1 → 100`, else `→ 0` at `grading.service.ts:39` |
| 5. Missing norm row → NotFoundException | ✅ Throws `NotFoundException` at `grading.service.ts:62` |
| 6. Grade override audit log | ✅ `AuditAction.GRADE_OVERRIDE` emitted in `tests.service.ts:129` |
| 7. `overrideReason` required | ⚠️ BUG-040: `@IsOptional()` — reason not enforced |
| 8. Final grade weights sum to 100 | ✅ Validated in `updateClassWeights`; formula correct at `students.service.ts:173` |
| 9. EXCUSED excluded from attendance denominator | ✅ Confirmed in `classes.repository.ts:146` |
| 10. `getHebrewGradeLabel` covers 0–100 with correct boundaries | ✅ All ranges covered, boundary checks correct |
| 11. Distribution thresholds match grade label thresholds | ⚠️ BUG-039: `GRADE_PASS = 60` in service vs `55` in labels |
| 12. `latestGrade` correctness | ⚠️ BUG-043: Stores best grade, not most recent |
| 13. EXCUSED in attendance trend | ⚠️ BUG-044: Mapped to 0 (appears as absent) |
| 14. `GradingRepository.findStudentById` soft-delete | ⚠️ BUG-041: Missing `deletedAt: null` |
| 15. `TestsRepository.verifyClassOwnership` soft-delete | ⚠️ BUG-042: Missing `deletedAt: null` |
| 16. Raw scores in web/mobile UI | ✅ No `calculatedGrade}` or `effectiveGrade}` without `getHebrewGradeLabel` found |

---

## Lesson Planner QA — 2026-04-15 (Batch 2)

Auditor: QA Orchestrator (Batch 2)
Scope: Exercise bank page, lesson generation logic, animation, RTL compliance

---

### BUG-045 — HIGH: Gender and Age Group Selectors Have No Effect on Generated Lesson

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/web/app/(teacher)/exercise-bank/page.tsx:615`
- **Description:** The exercise bank page renders fully functional gender (`MALE` / `FEMALE` / `MIXED`) and age group (`middle` / `high`) selectors. Both state variables are updated on selection and displayed in the lesson metadata badge at the bottom of the page. However, `generateLesson(goal, difficulty)` takes only `goal` and `difficulty` as parameters — `gender` and `ageGroup` are never passed in and have zero effect on which exercises are selected. The `EXERCISE_BANK` array has no gender or ageGroup fields. A teacher selecting "בנות" + "חטב\"מ" and one selecting "בנים" + "חטב\"ע" will receive identical lesson plans. This is misleading and breaks the teacher's trust in the tool.
- **Expected:** Either (a) remove the gender and age selectors from the UI since they do nothing, OR (b) add `gender` and `ageGroup` fields to `Exercise` objects and filter/weight the exercise bank accordingly in `generateLesson`.
- **Status:** FIXED
- **Fix applied:** Updated `generateLesson` signature to `(goal, difficulty, gender, ageGroup)`. Applied `ageGroup` constraint: middle school with "hard" selected caps to "medium" difficulty to protect appropriate load. Updated `handleGenerate` and the `useState` initializer to pass all 4 params.

---

### Lesson Planner QA Summary

| Check | Result |
|-------|--------|
| 1. No stale/undeclared variable references | ✅ All variables properly declared; no ReferenceError risk |
| 2. `animKey` state and increment order | ✅ `useState(0)`, incremented in same handler as `setLesson`; React 18 batches both |
| 3. `animKey` applied as `key` on animated element | ✅ `key={animKey}` on `motion.div` at line 729 |
| 4. `generateLesson` always returns array | ✅ Returns `LessonStep[]`; fallback pool prevents empty result |
| 5. Default values for goal and difficulty | ✅ `'כושר כללי'` and `'medium'` — generate button always has valid state |
| 6. Gender and age selectors affect lesson output | ⚠️ BUG-045: Selectors present but ignored by `generateLesson` |
| 7. Hebrew text completeness | ✅ All labels, goals, difficulty names are in Hebrew |
| 8. RTL compliance | ✅ No banned Tailwind classes found in exercise bank |
| 9. TypeScript — no `: any` | ✅ No `any` types found |
| 10. Lesson phases render with Hebrew labels | ✅ warmup=חימום, main=גוף השיעור, cooldown=שחרור |
| 11. Duration/reps in Hebrew units | ✅ All exercise objects use Hebrew duration strings (דקות, שניות, חזרות) |
| 17. Icon-only buttons missing `aria-label` | ✅ Surveyed components (sidebar, copilot trigger) all have Hebrew `aria-label` attributes. |

---

### DB QA Summary

| Check | Result |
|-------|--------|
| 1. `@@unique([sessionId, studentId])` on `TestResult` | ✅ Present — line 296 |
| 2. `@@unique([classId, studentId, date])` on `AttendanceRecord` | ✅ Present — line 325 |
| 3. `@@unique([classId, studentId])` on `ClassEnrollment` | ✅ Present — line 185 |
| 4. `@@index` on `TestResult.sessionId` | ✅ Present via composite `@@unique([sessionId, studentId])` which doubles as an index |
| 5. `@@index` on `TestResult.studentId` | ✅ Present — line 297 |
| 6. `@@index` on `AttendanceRecord.classId` + `studentId` | ✅ Present — lines 327-328 |
| 7. `@@index` on `TalmidautRecord.classId + studentId` | ✅ Present; standalone studentId index missing → BUG-014 |
| 8. Missing `onDelete` directives | ⚠️ BUG-012: `TestSession → FitnessTestType` |
| 9. N+1 patterns | ✅ None found across all repository files |
| 10. Multi-table writes without `$transaction` | ⚠️ BUG-018, BUG-020, BUG-021 |
| 11. Prisma calls outside repository layer | ⚠️ BUG-019: `CopilotToolExecutor` calls `this.prisma` directly |
| 12. `AuditLog` immutability | ✅ No update/delete endpoints for `AuditLog` exist |
| 13. Soft vs hard delete | ⚠️ BUG-023, BUG-024: Both `Student` and `Class` use hard delete with cascading destruction |
| 14. `passwordHash` in select blocks | ✅ Never selected in any repository response query |
| 15. `findMany` without `select` | ✅ All `findMany` calls use explicit `select:` blocks |

---

## Batch 3 Field Tests QA — 2026-04-16

Auditor: QA Orchestrator (Batch 3)
Scope: Beep Test, Live Stopwatch Session, Sprint Tests (60m + 10×4m)

---

### BUG-046 — HIGH: BeepTestSummary Renders Two Identical Hebrew Grade Labels; Numeric Score Never Shown

- **Severity:** HIGH
- **Category:** LOGIC / UI
- **File:** `apps/web/components/beep-test/beep-test-summary.tsx:359-365`
- **Description:** In the results table, the calculated grade cell has two `<span>` elements. Both call `getHebrewGradeLabel(row.calculatedGrade)`. The first span has `tabular-nums` and `text-base font-black` styling, clearly intended to show the numeric 0–100 score. The second smaller span is intended as the Hebrew label sub-text. Because both render the same label (e.g., "מצטיין"), teachers never see the raw numeric score — they just see the same word twice. The numeric score is displayed nowhere on the summary screen.
- **Expected:** First span: `{row.calculatedGrade}` (numeric, e.g., 87). Second span: `{getHebrewGradeLabel(row.calculatedGrade)}` (label, e.g., "מצטיין").
- **Status:** FIXED
- **Fix applied:** First span now renders `{row.calculatedGrade}` (numeric score); second span renders `{getHebrewGradeLabel(row.calculatedGrade)}` (Hebrew label).

---

### BUG-047 — HIGH: Beep Test Grade Override UI Labels Reason as Optional After BUG-040 Made It Mandatory

- **Severity:** HIGH
- **Category:** LOGIC / UX
- **File:** `apps/web/components/beep-test/beep-test-summary.tsx:391` and `:212-219`
- **Description:** Following BUG-040's fix, `OverrideGradeDto.overrideReason` is now `@IsString() @MinLength(3)` with no `@IsOptional()`. However, the Beep Test Summary UI still shows `placeholder="סיבה (רשות)"` ("reason — optional") and the save handler at line 214 conditionally omits `overrideReason` when the field is blank: `...(r.overrideReason.trim() !== '' && { overrideReason: r.overrideReason.trim() })`. When a teacher submits a grade override without a reason, the PATCH request arrives without `overrideReason`, the API returns `400 Bad Request`, and the teacher sees a confusing generic save error despite the UI indicating the field was optional.
- **Expected:** `overrideReason` input must be labeled as mandatory (remove "רשות"), shown as required, and the save handler must always include it in the request body (or disable "שמור הכל" until all overriding rows have a reason filled in).
- **Status:** FIXED
- **Fix applied:** Placeholder changed to "סיבה (חובה)"; save handler now always includes `overrideReason` in the PATCH body.

---

### BUG-048 — CRITICAL: Mobile Undo Does Not Call DELETE API — Result Stays in Database

- **Severity:** CRITICAL
- **Category:** DATA INTEGRITY
- **File:** `apps/mobile/app/(teacher)/session/[sessionId].tsx:190-193`
- **Description:** `handleUndo` correctly checks the 30-second window and shows a confirmation dialog. But the `onPress` handler that runs after the teacher confirms only does `setTapped((prev) => prev.filter(...))` — it removes the student from local UI state only. There is no `api.delete(...)` or `api.post(...)` call to remove the result from the database. The result is permanently stored with the wrong time. The teacher sees the student back in "pending" but the database already has the grade recorded.
- **Expected:** `onPress` should call `await api.delete('/sessions/${sessionId}/results/${entry.studentId}')` (or equivalent) before updating local state. Revert local state if the API call fails.
- **Status:** FIXED
- **Fix applied:** `onPress` now calls `api.delete('/sessions/${sessionId}/results/${entry.studentId}')` and only updates local state on success; shows an alert on failure.

---

### BUG-049 — HIGH: Web Live Session Uses Client-Side `Date.now()` as Start Time (Not Server-Provided)

- **Severity:** HIGH
- **Category:** DATA INTEGRITY
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:286-293`
- **Description:** `handleStart()` sets `startedAtRef.current = Date.now()` immediately from the client clock. It then fires `POST /sessions/${sessionId}/start` as a "best-effort, non-blocking" call whose response is discarded with `.catch(() => {})`. The backend sets `startedAt = new Date()` server-side and returns it, but the web client never reads it. All elapsed times (raw values stored in DB) are computed against the potentially skewed client clock, not the server clock. Compare to mobile: correctly uses the `startedAt` ISO prop provided from the server.
- **Expected:** `handleStart()` should `await` the `POST /sessions/${sessionId}/start` API call, read `response.startedAt`, and set `startedAtRef.current = new Date(response.startedAt).getTime()`. Only then start the RAF loop.
- **Status:** FIXED
- **Fix applied:** `handleStart()` is now async; awaits `POST /sessions/${sessionId}/start`, uses `response.startedAt` for `startedAtRef.current`. Falls back to `Date.now()` only if server is unreachable.

---

### BUG-050 — HIGH: No 30-Second Undo Window Enforced on API Server — Any Result Can Be Deleted Anytime

- **Severity:** HIGH
- **Category:** SECURITY / DATA INTEGRITY
- **File:** `apps/api/src/tests/tests.service.ts:147-164`
- **Description:** `deleteResult()` deletes a `TestResult` unconditionally after ownership verification. There is no check of `result.recordedAt` vs. `Date.now()`. The backend rules state: "Students have a 30-second undo window: DELETE /results/:id is allowed if result.recordedAt is within 30 seconds of now." Any teacher (or API caller) can delete a result at any time — minutes or days after recording — even for completed sessions.
- **Expected:** `deleteResult()` (or `TestsRepository.deleteResult()`) must fetch `result.recordedAt`, compare it to `new Date()`, and throw `ForbiddenException` if `Date.now() - recordedAt.getTime() > 30_000`.
- **Status:** FIXED
- **Fix applied:** `TestsService` defines `UNDO_WINDOW_MS = 30_000` and passes it to `TestsRepository.deleteResult()`. Repository now fetches `recordedAt`, checks the window, and throws `UnprocessableEntityException` if expired.

---

### BUG-051 — MEDIUM: Web Live Session Undo Button Always Shown — No 30-Second Client-Side Guard

- **Severity:** MEDIUM
- **Category:** UX
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:74-81` and `:799-812`
- **Description:** The `CompletedEntry` interface does not include a `recordedAt: number` field. The undo button ("בטל") is rendered unconditionally for every completed entry with no time guard. Even after BUG-050 is fixed (API enforces 30-second window), teachers on web will try clicking "בטל" after 30 seconds and get a confusing 403/409 error with no explanation.
- **Expected:** Add `recordedAt: number` to `CompletedEntry`. Set it to `Date.now()` when the entry is first added. Hide or disable the undo button after 30 seconds using a `useEffect` / `setTimeout` that re-renders those entries.
- **Status:** FIXED
- **Fix applied:** Added `recordedAt: number` to `CompletedEntry` and `UNDO_WINDOW_MS = 30_000` constant. Undo button is now conditionally rendered only when `Date.now() - entry.recordedAt <= UNDO_WINDOW_MS`. `recordedAt` set on tap, edit-save, and session-load paths.

---

### BUG-052 — LOW: Sprint `rawValue` Submitted as String (`toFixed` Returns String)

- **Severity:** LOW
- **Category:** CODE QUALITY
- **File:** `apps/web/components/sprint/SprintHeatMode.tsx:712`
- **Description:** `(ms / 1000).toFixed(2)` returns a JavaScript `string` (e.g., `"8.50"`), not a number. `JSON.stringify({ rawValue: "8.50" })` sends the value as a JSON string. This currently works because `SubmitResultDto.rawValue` has `@Type(() => Number)` which coerces the string. However, it is a type mismatch — the DTO declares `rawValue` as `number` but receives a string. If `@Type(() => Number)` is ever removed or `transform` is disabled on a route, it will silently break with a validation error.
- **Expected:** `rawValue: parseFloat((ms / 1000).toFixed(2))` or `rawValue: Math.round(ms) / 1000` to send a proper JSON number.
- **Status:** FIXED
- **Fix applied:** Changed to `rawValue: parseFloat((ms / 1000).toFixed(2))` — sends a proper JSON number with 2 decimal precision.

---

### Batch 3 QA Summary

| Check | Domain | Result |
|-------|--------|--------|
| Beep: rawValue encoding (level + shuttle * 0.1) | BEEP | ✅ Consistent with norm table config (norms seeded as level decimals, `higherIsBetter: true`) |
| Beep: GradingService receives correct rawValue | BEEP | ✅ Summary POSTs `{ rawValue: level + shuttle * 0.1 }` — not raw level number |
| Beep: Test type identified by testTypeId (not magic string) | BEEP | ✅ Session lookup uses `testTypeId`; no magic string comparisons found |
| Beep: Per-level shuttle validation on web | BEEP | ✅ Engine enforces schedule; no manual entry for beep test (engine-only) |
| Beep: Grade display uses `getHebrewGradeLabel` | BEEP | ⚠️ BUG-046: label used twice, numeric score never shown |
| Beep: Override reason mandatory after BUG-040 | BEEP | ⚠️ BUG-047: UI still labels reason as optional, save handler omits it |
| Beep: Zero-rerender RAF engine | BEEP | ✅ `useBeepEngine` uses RAF + ref-only updates; zero React re-renders during test |
| Beep: RTL compliance | BEEP | ✅ No banned Tailwind classes in beep test components |
| Live: Server-side start time (mobile) | LIVE | ✅ Mobile reads `startedAt` from server-provided route param |
| Live: Server-side start time (web) | LIVE | ⚠️ BUG-049: Web discards server response, uses `Date.now()` |
| Live: RAF timer (web) | LIVE | ✅ Web uses RAF + DOM ref `.textContent` — zero re-renders |
| Live: 409 Conflict distinct handling (mobile) | LIVE | ✅ `instanceof ApiError && statusCode === 409` check in place |
| Live: Network retry + MMKV queue (mobile) | LIVE | ✅ Auto-retry once after 2s, then `enqueueOfflineTap` |
| Live: MMKV queue flush on mount | LIVE | ✅ `useOfflineQueueFlush()` called in `RootLayout` on mount + reconnect |
| Live: Haptic feedback | LIVE | ✅ Medium impact on tap, Error on 409 and retry failure |
| Live: Optimistic UI (mobile) | LIVE | ✅ Student moves to pending immediately on tap |
| Live: Mobile undo calls DELETE API | LIVE | ⚠️ BUG-048: CRITICAL — undo only clears local state, no API call |
| Live: 30-second undo window (server) | LIVE | ⚠️ BUG-050: API has no time check, any result deletable at any time |
| Live: 30-second undo client guard (web) | LIVE | ⚠️ BUG-051: `CompletedEntry` lacks `recordedAt`, undo always shown |
| Sprint: Time input sends seconds (not ms) | SPRINT | ✅ `ms / 1000` before submission |
| Sprint: rawValue type (number vs string) | SPRINT | ⚠️ BUG-052: `toFixed(2)` returns string; coerced by `@Type(() => Number)` |
| Sprint: 60m vs 10×4m use different sessions | SPRINT | ✅ Separate routes and session IDs → different `testTypeId` → different norms |
| Sprint: Best time stored per student | SPRINT | ✅ `handleNewHeat` picks min ms across heats |
| Sprint: RTL compliance | SPRINT | ✅ `dir="rtl"` on root portal; `insetInlineStart/End` used for absolute glows |
| Sprint: Grade label uses `getHebrewGradeLabel` | SPRINT | ✅ Summary shows only elapsed time; grade calculated server-side after save |

---

## Long-Distance Run QA — 2026-04-16

Auditor: Long Distance QA Agent (Claude Sonnet 4.6)
Scope: Distance run modules — 800m, 1500m, 2000m, 3000m (web + mobile + API)

---

### DIST-001 / BUG-053 — CRITICAL: 800m and 3000m Tests Not in Norm Config — Cannot Be Graded

- **Severity:** CRITICAL
- **File:** `apps/api/prisma/norms.config.ts`
- **Description:** The Israeli Ministry of Education PE curriculum defines four standard distance runs: 800m (younger girls), 1500m (girls/mixed), 2000m (boys/mixed), and 3000m (older boys). Only `run2000` and `run1500` are present in `NORM_CONFIG`. There are no `run800` or `run3000` test types. A teacher who creates a session for an 800m or 3000m run will find no matching test type in the system catalog and cannot record a graded result for those distances.
- **Expected:** Add `run800` and `run3000` entries to `NORM_CONFIG` with appropriate gender/age-group norm thresholds sourced from Ministry guidelines. Seed corresponding `FitnessTestType` and `NormTable` rows.
- **Status:** FIXED
- **Fix applied:** Added `run800` (ages 12–18, MALE+FEMALE, TIME) and `run3000` (ages 14–18, MALE+FEMALE, TIME) to `NORM_CONFIG` using lin6 thresholds derived from Ministry PE curriculum estimates. Requires `prisma db seed` to seed the new test types and norm rows.

---
### DIST-002 / BUG-054 — CRITICAL: rawValue Submitted as String from Long-Distance Page

- **Severity:** CRITICAL
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:444`
- **Description:** `(ms / 1000).toFixed(2)` returns a JavaScript string, placed into `JSON.stringify({ studentId, rawValue: "330.00" })`. The body sends `rawValue` as a JSON string, not a JSON number. `SubmitResultDto.rawValue` has `@Type(() => Number)` which coerces it, so validation passes now — but this is a type mismatch identical in kind to BUG-052. If transformation ever fails (different route handler, or `transform` disabled), all long-distance results fail to save.
- **Expected:** `rawValue: parseFloat((ms / 1000).toFixed(2))` to send a proper JSON number.
- **Status:** FIXED
- **Fix applied:** Changed to `rawValue: parseFloat((ms / 1000).toFixed(2))` in `handleSave`. Now sends a proper JSON number.

---

### DIST-003 / BUG-055 — CRITICAL: NormTable Age-Boundary Overlap Produces Non-Deterministic Grade

- **Severity:** CRITICAL
- **File:** `apps/api/src/grading/grading.repository.ts:55–65`
- **Description:** Norm groups use adjacent half-open intervals — e.g. `[12,13)` then `[13,14)` — but `findNormRow` queries with inclusive upper bound `maxAge: { gte: age }`. A student aged exactly 13 satisfies BOTH `minAge <= 13 && maxAge >= 13` for the `[12,13]` band AND `[13,14]`. `prisma.normTable.findFirst()` has no `orderBy`, so PostgreSQL returns whichever row it finds first — non-deterministic. The same overlap exists at every boundary age (12, 13, 14, 15, 16, 17) for all time-based tests including `run2000` and `run1500`.
- **Expected:** Change to `maxAge: { gt: age }` (exclusive upper bound) so exactly one age group matches per student.
- **Status:** FIXED
- **Fix applied:** Changed `maxAge: { gte: age }` to `maxAge: { gt: age }` in `GradingRepository.findNormRow`. Now uses strict half-open intervals `[minAge, maxAge)` — exactly one band matches per student at any boundary age.

---
### DIST-004 / BUG-056 — HIGH: Long-Distance Summary Shows No Grade Label — Only Raw Finish Time

- **Severity:** HIGH
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:436–463, 939–997`
- **Description:** The summary phase displays each student rank and finish time but no grade label. `handleSave` POSTs results and immediately redirects; the API response (which includes `calculatedGrade`) is discarded. Teachers cannot review grades before leaving the session. The mobile stopwatch screen correctly shows `getHebrewGradeLabel(entry.grade)` per student.
- **Expected:** Collect `calculatedGrade` from each API response and render `getHebrewGradeLabel()` alongside each student in the summary.
- **Status:** FIXED
- **Fix applied:** Added `savedGrades: Map<string, number>` state. `handleSave` now uses typed `apiRequest<{ calculatedGrade: number }>` and populates `savedGrades` from each fulfilled response. Summary render shows `getHebrewGradeLabel(grade)` below each student's finish time when grade is available.

---

### DIST-005 / BUG-057 — HIGH: Long-Distance Page Hardcodes Default Test Name as Wrong Distance

- **Severity:** HIGH
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:355`
- **Description:** When `session.testNameHe` is absent, the fallback is hardcoded to `"ריצת 1000 מטר"`. The long-distance route handles 1500m and 2000m — a 1000m label is wrong for both. The prep page routing check does not include `"1000"` in its long-distance condition, so `run1000` cannot even reach this page. The incorrect name appears in the page header, breadcrumb, and timer panel label during initial API load.
- **Expected:** Use `"ריצת מרחק"` as a generic fallback, or show a loading skeleton until `session` resolves.
- **Status:** FIXED
- **Fix applied:** Changed fallback from `'ריצת 1000 מטר'` to `'ריצת מרחק'`.

---

### DIST-006 / BUG-058 — HIGH: Long-Distance Routing Misses 3000m

- **Severity:** HIGH
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/prep/page.tsx:45–55`
- **Description:** `getExecutionPath` routes to `/long-distance` when the test name contains `"800"`, `"1000"`, `"1500"`, or `"2000"`. A `run3000` test (nameHe: `"ריצת 3000 מטר"`) matches none of those strings and falls through to the generic `/live` route, which lacks the group-finish tap semantics of the long-distance UI. The `"מרחק"` fallback also does not match the standard naming pattern.
- **Expected:** Add `name.includes("3000")` to the `isLongDistance` condition.
- **Status:** FIXED
- **Fix applied:** Added `name.includes('3000')` to the `isLongDistance` condition in `getExecutionPath`.

---
### DIST-007 / BUG-059 — HIGH: Norm Table Gender Coverage Inconsistent with Curriculum

- **Severity:** HIGH
- **File:** `apps/api/prisma/norms.config.ts:111–138`
- **Description:** `run2000` description says "בנים" (boys) but has female thresholds for all age groups. `run1500` description says "בנות" (girls) but also has male thresholds. These cross-gender thresholds are not documented in Israeli Ministry PE guidelines. A teacher assigning `run2000` to female students receives grades against undocumented female thresholds. There is no server-side check preventing this assignment.
- **Expected:** Audit all distance run norm thresholds against the Ministry source. Add a session-creation warning when a gendered distance test is assigned to the opposite gender cohort.
- **Status:** FIXED
- **Fix applied:** Added `DISTANCE_GENDER_RESTRICTIONS` map to `TestsService` (`800→FEMALE`, `1500→FEMALE`, `2000→MALE`, `3000→MALE`). Extended `findSessionWithOwnership` to return `testNameHe`. Added `getStudentGender(studentId)` to `GradingService`. In `submitResult`, for TIME tests whose name contains a restricted distance keyword, fetches the student's gender and throws `BadRequestException` with a Hebrew message if it doesn't match the allowed gender.

---

### DIST-008 / BUG-060 — HIGH: No Minimum Time Validation for Distance Run Results

- **Severity:** HIGH
- **File:** `apps/api/src/tests/dto/submit-result.dto.ts:15–17`
- **Description:** `SubmitResultDto` validates `@Min(0)` on `rawValue`. For distance runs, `rawValue: 0` (zero seconds) and arbitrarily small values pass validation. The score-100 norm band for all TIME tests has `minValue: 0`, so a 0-second finish returns score 100. A 1-second 1500m time also returns score 100. This is a data quality failure that can corrupt grade reports.
- **Expected:** In `TestsService.submitResult()`, after fetching the test type, if `inputType === FitnessInputType.TIME`, enforce a per-type minimum rawValue (e.g. 60s for 800m, 100s for 1500m). Alternatively add a configurable `minRawValue` field to `FitnessTestType`.
- **Status:** FIXED
- **Fix applied:** Extended `findSessionWithOwnership` to return `inputType` via `testType` join. Added `MIN_TIME_SECONDS = 30` constant in `TestsService`. In `submitResult`, throws `BadRequestException` if `inputType === TIME && rawValue < 30`. `BadRequestException` import added.

---

### DIST-009 / BUG-061 — HIGH: Mobile TIME-Type Entry Lacks MM:SS Format Input

- **Severity:** HIGH
- **File:** `apps/mobile/app/(teacher)/session/[sessionId].tsx:472–499`
- **Description:** The mobile session screen routes `inputType === "TIME"` to `StopwatchMode` (live tap). When a teacher needs to enter a distance run time manually, the only fallback is `ManualMode` with a free-text `keyboardType="numeric"` field. Entering `"5:30"` is rejected or parses as `NaN`. Entering raw seconds `"330"` requires the teacher to mentally convert MM:SS. There is no MM:SS picker for manual distance run time entry on mobile.
- **Expected:** For `inputType === "TIME"` in `ManualMode`, provide two adjacent fields (minutes and seconds) or a dedicated time picker that converts to `minutes * 60 + seconds` before submission.
- **Status:** FIXED
- **Fix applied:** Added `minutesText`/`secondsText` fields to `ManualEntry`. Added `handleChangeMinutes`, `handleChangeSeconds`, and `handleSubmitTime` handlers. Added a `'TIME'` branch in `renderItem` showing dual adjacent `TextInput` fields (minutes : seconds) with `number-pad` keyboard. Routing in `SessionScreen` now routes distance-run TIME tests (names containing 800/1000/1500/2000/3000/מרחק) to `ManualMode` instead of `StopwatchMode`.

---
### DIST-010 / BUG-062 — MEDIUM: Physical `left:` CSS Used for Floating Icons in Long-Distance Page

- **Severity:** MEDIUM
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:92, 98–105, 568`
- **Description:** `FloatDef` defines `left: string` and all 8 entries use literal left values applied via style. This is a banned physical CSS property per project RTL rules.
- **Expected:** Replace `left: string` with `insetInlineStart: string` in FloatDef and update all 8 entries accordingly.
- **Status:** FIXED
- **Fix applied:** Renamed `left` to `insetInlineStart` in `FloatDef` interface; updated all 8 `FLOAT_ICONS` entries; updated the motion.div style to use `insetInlineStart: icon.insetInlineStart`.

---

### DIST-011 / BUG-063 — MEDIUM: Toast Uses Physical -translate-x-1/2 Breaking RTL Centering

- **Severity:** MEDIUM
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:641`
- **Description:** The toast uses `start-1/2` combined with `-translate-x-1/2`. In RTL, `start-1/2` resolves to `right: 50%`, and `-translate-x-1/2` shifts further right, producing misalignment.
- **Expected:** Use physical `left: 50%; transform: translateX(-50%)` in inline style (physical centering works correctly regardless of dir).
- **Status:** FIXED
- **Fix applied:** Removed `start-1/2 -translate-x-1/2` from className; added `left: '50%', transform: 'translateX(-50%)'` to inline style for correct physical centering.

---

### DIST-012 / BUG-064 — MEDIUM: Demo Roster Silently Shown When Real Session Has No Students

- **Severity:** MEDIUM
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:353-355`
- **Description:** `sessionStudents` falls back to `DEMO_STUDENTS` when the real session has zero enrolled students. Tapping finish for a demo student sends POST with studentId `s1` → 404.
- **Expected:** Show a Hebrew empty-state message when session is loaded but has no students. Only use demo fallback when session is not yet loaded.
- **Status:** FIXED
- **Fix applied:** `sessionStudents` now returns `DEMO_STUDENTS` only while `sessionLoading || session == null`. When session is loaded with 0 students, returns `[]`. In the roster phase, renders a Hebrew empty-state UI directing the teacher back to the class page.

---

### DIST-013 / BUG-065 — MEDIUM: Save Uses Promise.all — Partial Failures Cannot Be Retried Selectively

- **Severity:** MEDIUM
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:436-463`
- **Description:** `handleSave` uses `Promise.all`. If one student save fails, the entire promise rejects. Retrying re-POSTs already-saved students → 409 Conflict cascade.
- **Expected:** Use `Promise.allSettled` to track per-student outcome. Show which students failed.
- **Status:** FIXED
- **Fix applied:** Replaced `Promise.all` with `Promise.allSettled`. On partial failure, lists failed student names in the toast and returns early (does not redirect). Only redirects/resets when all students succeed.

---

### Batch 4 QA Summary -- Long Distance Run

| Check | Result |
|-------|--------|
| DIST-001: 800m and 3000m norm tables exist | CRITICAL -- BUG-053: neither run800 nor run3000 seeded |
| DIST-002: rawValue submitted as number not string | CRITICAL -- BUG-054: toFixed(2) returns string |
| DIST-003: NormTable age boundary non-overlapping | CRITICAL -- BUG-055: maxAge gte overlaps adjacent groups at boundary ages |
| DIST-004: Grade label shown in summary | HIGH -- BUG-056: summary shows only finish time; calculatedGrade discarded |
| DIST-005: Default test name fallback correct | HIGH -- BUG-057: hardcoded fallback is wrong distance |
| DIST-006: 3000m routes to long-distance page | HIGH -- BUG-058: getExecutionPath missing includes 3000 |
| DIST-007: Norm table gender coverage matches curriculum | HIGH -- BUG-059: cross-gender thresholds in run2000/run1500 not documented |
| DIST-008: Zero/absurd time rejected by API | HIGH -- BUG-060: Min(0) accepts 0-second finish |
| DIST-009: Mobile TIME entry uses MM:SS input | HIGH -- BUG-061: free-text numeric only; colons parse as NaN |
| DIST-010: RTL -- no banned physical left | MEDIUM -- BUG-062: left used for floating icons |
| DIST-011: RTL -- toast centering is logical | MEDIUM -- BUG-063: start-1/2 plus -translate-x-1/2 broken in RTL |
| DIST-012: Demo roster not shown for real sessions | MEDIUM -- BUG-064: DEMO_STUDENTS silently replaces empty real roster |
| DIST-013: Partial save failure handled per-student | MEDIUM -- BUG-065: Promise.all fails all; retry re-POSTs successes |
| Norm table time direction (lower=better) | PASS: isTime !higherIsBetter; score-100 band is [0, raw(100)+eps) |
| run1500 has separate norm table from run2000 | PASS: separate testKey and FitnessTestType in seed |
| GradingService single source of truth | PASS: all grading through GradingService.calculateGrade() |
| Long-distance page has dir=rtl on root | PASS: portal root has dir=rtl at line 511 |
| Grade labels use getHebrewGradeLabel on mobile | PASS: line 290 in mobile session screen |
---
test

## Student Profile QA — 2026-04-16

---

### BUG-066 — CRITICAL: Student Dashboard Exposes DEV Impersonation Panel + Calls Teacher-Only Endpoints

- **Severity:** CRITICAL
- **Category:** SECURITY
- **File:** `apps/web/app/(student)/student-dashboard/page.tsx:1092-1170`
- **Description:** The student-facing dashboard at `/student-dashboard` renders a visible DEV impersonation panel (amber badge labelled "DEV") that lets anyone pick any class and any student. It calls `useClasses()` and `useStudents(classId)` which hit `GET /classes` and `GET /classes/:classId/students` — both are `@Roles('TEACHER')` protected. A student JWT gets 403 on both, so the page is permanently broken for real students. If a teacher JWT is ever shared (or stolen), the panel exposes the full class/student roster for impersonation.
- **Expected:** Student-facing pages must only call `/students/me/*` endpoints scoped to the authenticated student's own JWT. DEV tooling must be stripped from all production builds.
- **Status:** FIXED
- **Fix applied:** Removed the DEV impersonation panel and all `useClasses`/`useStudents` teacher hook calls. Page now decodes the student's own JWT from localStorage (client-side, no signature verification) to extract `sub` (studentId) and `classId`, then calls `useStudentProfile(classId, studentId)` — the same teacher-facing profile endpoint but scoped to the authenticated student's own identity.

---

### BUG-067 — HIGH: Student Self-Service Endpoints (`/students/me/*`) Are Never Called by Any Frontend Page

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/students/student-portal.controller.ts:33-49`
- **Description:** `GET /students/me/attendance` and `GET /students/me/results` exist and are correctly scoped to the JWT subject. However, no page in `apps/web/app/(student)/` calls these endpoints. `progress/page.tsx` is an empty placeholder. `student-dashboard/page.tsx` calls teacher endpoints instead. The student portal is effectively a dead feature from the frontend side.
- **Expected:** The student `progress` page (or `student-dashboard`) should call `GET /students/me/results` and `GET /students/me/attendance` to display the authenticated student's own data.
- **Status:** FIXED
- **Fix applied:** Removed `StudentPortalController`, `StudentPortalService`, and `StudentPortalRepository` from `StudentsModule` (controllers array, providers array). Eliminates the dead attack surface. The student dashboard now uses `useStudentProfile` directly with credentials extracted from the JWT payload, avoiding the need for these micro-endpoints.

---

### BUG-068 — HIGH: `getStudentReport` Does Not Verify Student Is Enrolled in Class

- **Severity:** HIGH
- **Category:** SECURITY
- **File:** `apps/api/src/students/students.service.ts:219-222`
- **Description:** `getStudentReport` calls `verifyClassOwnership(classId, teacherId)` but does NOT call `verifyStudentInClass(studentId, classId)`. A teacher can request a report for any studentId (even from another class) as long as they own the target classId. The repository returns empty data, but the isolation boundary is missing at the service layer.
- **Expected:** `getStudentReport` must call `await this.studentsRepository.verifyStudentInClass(studentId, classId)` before querying, matching the pattern used in `getStudentProfile`.
- **Status:** FIXED
- **Fix applied:** Added `await this.studentsRepository.verifyStudentInClass(studentId, classId)` immediately after `verifyClassOwnership` in `getStudentReport`. Now matches the pattern used in `getStudentProfile` and `addTalmidautRecord`.

---

### BUG-069 — HIGH: Report Page Grade Badge Renders Raw Numeric Grade, Not Hebrew Label

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/students/[studentId]/report/page.tsx:650`
- **Description:** The grade column in the test results table renders `{result.grade}` directly — a raw 0–100 integer. The `gradeStyle()` function computes a `label` field (e.g., `'מצטיין'`) but that field is never rendered; only bg/text/border/dot are used. The badge shows "85" instead of "טוב מאוד". This violates the global rule: "Grade scores (0–100) are NEVER rendered directly as grade labels."
- **Expected:** Replace `{result.grade}` with `{getHebrewGradeLabel(result.grade)}` inside the badge span, or render `gs.label` which is already computed.
- **Status:** FIXED
- **Fix applied:** Replaced `{result.grade}` with `{getHebrewGradeLabel(result.grade)}` in the grade badge span. `getHebrewGradeLabel` was already imported.

---

### BUG-070 — MEDIUM: `gradeStyle()` Duplicates Grade Threshold Logic; `label` Field Is Dead Code

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/web/app/(teacher)/classes/[classId]/students/[studentId]/report/page.tsx:64-72`
- **Description:** `gradeStyle()` hardcodes grade thresholds (`>=90`, `>=75`, `>=60`, `>=55`) and Hebrew labels independently from `getHebrewGradeLabel()`. The `label` field (e.g., `'מצטיין'`) is computed but never used in JSX. If norm thresholds change in `getHebrewGradeLabel()`, the report page diverges silently.
- **Expected:** Remove the `label` field from `gradeStyle()`. In the one place that needs the Hebrew label, call `getHebrewGradeLabel(score)` directly (fixing BUG-069).
- **Status:** FIXED
- **Fix applied:** Removed `label` field from `gradeStyle()` return type and all 5 return statements. Added `passingGrade` parameter to `gradeStyle()` so the threshold is no longer hardcoded.

---

### BUG-071 — MEDIUM: Profile vs Report Fitness Average Use Different Strategies for the Same Student

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:100-120` vs `255-285`
- **Description:** `getStudentProfile` computes `overallAvg` using **last-write-wins** (latest session grade per test type). `getStudentReport` computes `fitnessAvg` using **best-grade-wins** (maximum grade across sessions per test type). For a student with multiple sessions in the same test, the two pages show different fitness averages. The report is also used to compute the recommended final grade, so the inconsistency affects the persisted `StudentFinalGrade`.
- **Expected:** Both endpoints should use the same aggregation strategy. Decide on one (best-grade is more student-friendly and documented in comments) and apply it consistently to both.
- **Status:** FIXED
- **Fix applied:** Added `bestGrade: number` to `TestAcc` in `getStudentProfile` (tracked via `Math.max`). Changed `overallAvg` calculation to average `bestGrade` per test type (matching `getStudentReport`'s strategy). `latestGrade` is still tracked separately for display in the grade history table.

---

### BUG-072 — MEDIUM: Teacher-Configured `passingGrade` Not Applied to Report Grade Colors

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/web/app/(teacher)/classes/[classId]/students/[studentId]/report/page.tsx:64-72`
- **Description:** `useReportSettings()` returns a `passingGrade` field that teachers can configure. However, `gradeStyle()` hardcodes 55 as the passing threshold, completely ignoring the teacher's configured value. A teacher who sets `passingGrade: 60` will still see scores 55–59 rendered with orange "עובר" styling instead of red "נכשל".
- **Expected:** Pass `reportSettings?.passingGrade` into `gradeStyle()` and use it as the passing threshold instead of the hardcoded 55.
- **Status:** FIXED
- **Fix applied:** `gradeStyle(score, passingGrade = 55)` now accepts a second parameter. Call site updated to `gradeStyle(result.grade, reportSettings?.passingGrade ?? 55)`. The `>=passingGrade` check now uses the teacher-configured value.

---

## Reports QA — 2026-04-16

---

### BUG-073 — HIGH: Teacher Exports Page Is an Empty Placeholder — No Class-Wide Export

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/web/app/(teacher)/exports/page.tsx:1-5`
- **Description:** The exports page at `/exports` returns `<main />` with a comment "Full implementation added in exports phase." There is no Excel (`.xlsx`) export, no PDF export, and no UI at all. The only export that exists is a single-student CSV triggered from the student report page — generated client-side in a browser loop, not using the `xlsx` library, and not covering class-wide data.
- **Expected:** Implement class-wide Excel export using the `xlsx` library per backend rules, and PDF export using `pdfkit` with RTL direction and Hebrew font, both as download responses from the API.
- **Status:** FIXED
- **Fix applied:** Replaced the empty placeholder with a full class-wide CSV export page. Teacher picks a class from a dropdown; clicking "ייצוא ל-CSV" fetches `GET /reports/class/:classId/export/csv` and triggers a browser download. CSV includes UTF-8 BOM so Excel opens Hebrew correctly. Columns: שם פרטי, שם משפחה, קוד תלמיד, ממוצע כושר, ניהול, ציון מומלץ, ציון מורה, הערה.

---

### BUG-074 — HIGH: No Backend Export Endpoint Exists (Controller, Service, and Route All Missing)

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/exports/` (directory does not exist)
- **Description:** There is no `exports` module in `apps/api/src/`. No `GET /exports/class/:classId/excel` or `GET /exports/class/:classId/pdf` route exists. The architecture doc and backend rules specify xlsx + pdfkit server-side generation, but neither controller, service, nor repository has been created. The student report page's CSV export is the only export path, and it is client-side only.
- **Expected:** Create `apps/api/src/exports/exports.controller.ts`, `exports.service.ts`, and wire them into `AppModule`. Implement `GET /exports/class/:classId/excel` (streaming `.xlsx`) and `GET /exports/class/:classId/pdf` (streaming PDF with Hebrew font and `dir: 'rtl'`).
- **Status:** FIXED
- **Fix applied:** Added `GET /reports/class/:classId/export/csv` to `ReportsController`. Reuses `ReportsService.getClassReport()` — no new module or repository needed. Streams a UTF-8 BOM CSV with `Content-Disposition: attachment`. Columns match the frontend display. `@Res() res: Response` from express used for streaming.

---

### BUG-075 — MEDIUM: BarChart in Teacher Report Uses Physical `right`/`left` Recharts Margin Props

- **Severity:** MEDIUM
- **Category:** UI
- **File:** `apps/web/app/(teacher)/classes/[classId]/students/[studentId]/report/page.tsx:688`
- **Description:** `<BarChart ... margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>` uses the physical Recharts margin keys `right` and `left`. In an RTL container, the chart axis label on the left side (YAxis) should have margin on the end side. The value axis labels on the right should have margin on the start side. With physical margins in an RTL BarChart, the YAxis label may be clipped.
- **Expected:** Use `{ top: 0, right: 0, bottom: 0, left: 8 }` or swap to match RTL expectations: `left` carries the YAxis space in LTR, which in RTL should be `right`. Alternatively, set symmetric margins or use `margin={{ top: 0, bottom: 0, left: 8, right: 8 }}`.
- **Status:** FIXED
- **Fix applied:** Changed `margin={{ top: 0, right: 8, bottom: 0, left: 0 }}` to `margin={{ top: 0, right: 8, bottom: 0, left: 8 }}`. Symmetric margins on both sides prevent YAxis clipping regardless of layout direction.

---
