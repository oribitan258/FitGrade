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
- **Status:** NEEDS_REVIEW
- **Note:** Requires architectural change to the mobile OAuth flow (one-time code exchange). Too large a change for a minimal fix — requires product decision on flow design.

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
- **Status:** NEEDS_REVIEW
- **Note:** `recordedAt` uses `@default(now())` so a DB-level `@@unique` on timestamp would break legitimate multiple-per-day entries. Application-layer idempotency (e.g., check for duplicate within last 5 seconds) is the correct fix but requires a product decision on the deduplication window.

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
- **Status:** NEEDS_REVIEW
- **Note:** Adding `@@unique([testTypeId, gender, minAge, minValue])` is a schema+migration change. However the seed data should be validated first to ensure no existing rows violate the constraint before applying it.

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
- **Status:** NEEDS_REVIEW
- **Note:** Requires injecting multiple repositories into `CopilotToolExecutor` and adding new repository methods. Non-trivial refactor touching the copilot tool dispatch system — deferred for a dedicated copilot architecture pass.

---

### BUG-020 — HIGH: `revertAction` commits data-revert side-effects and `aiActionLog.update` in two separate transactions
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/src/copilot/copilot-tool-executor.ts:356-368`
- **Description:** `revertAction` calls `dispatchRevert` (which writes to `attendanceRecord` or `testResult`) and then calls `prisma.aiActionLog.update({ data: { revertedAt } })` as a separate Prisma operation. If the process crashes after `dispatchRevert` succeeds but before `aiActionLog.update` completes, the data is permanently rolled back but `AiActionLog.revertedAt` remains `null`. The teacher's UI will show the action as still revertible and a second revert attempt will corrupt the data.
- **Expected:** Wrap `dispatchRevert` + `aiActionLog.update` in a single `prisma.$transaction()` so they succeed or fail atomically.
- **Status:** NEEDS_REVIEW
- **Note:** Blocked on BUG-019 — `dispatchRevert` currently calls `this.prisma` directly. Once extracted to repository methods, the transaction wrapper can be applied cleanly.

---

### BUG-021 — MEDIUM: `addTalmidautRecord` creates `TalmidautRecord` and upserts `StudentFinalGrade` in two non-transactional calls
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/src/students/students.service.ts:375-386`
- **Description:** `addTalmidautRecord` calls `studentsRepository.createTalmidautRecord()` and then `recomputeAndPersistFinalGrade()` (which calls `upsertFinalGrade`) as two independent DB round-trips with no transaction wrapper. If the process fails between the two, the `TalmidautRecord` is written but `StudentFinalGrade` is never updated, leaving the persisted final grade permanently stale relative to the actual talmidaut data.
- **Expected:** Expose a single transactional repository method that creates the `TalmidautRecord` and upserts `StudentFinalGrade` atomically within one `$transaction()`.
- **Status:** NEEDS_REVIEW
- **Note:** Wrapping the two calls requires the repository to accept a `TransactionClient` or exposing a combined method that does both in one `$transaction()`. This is safe to do but involves a moderate restructure of `addTalmidautRecord` to pass the tx down.

---

### BUG-022 — MEDIUM: `saveGradeOverrides` creates `StudentFinalGrade` rows with `fitnessAvg=0 / talmidautAvg=0 / recommendedGrade=0` on first insert
- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/src/reports/reports.repository.ts:240-258`
- **Description:** When `StudentFinalGrade` does not yet exist for a student, the `upsert` create branch hard-codes `fitnessAvg: 0`, `talmidautAvg: 0`, `recommendedGrade: 0`. A teacher who applies a verbal comment or `teacherFinalGrade` before the final grade has been computed for the first time will create a permanently zeroed component record. Subsequent reads of `StudentFinalGrade.recommendedGrade` will return 0 until a separate recompute is explicitly triggered.
- **Expected:** Before upserting the override, fetch (or compute) the real component averages. Alternatively, enforce that overrides can only be written to already-existing `StudentFinalGrade` rows and return 404 otherwise.
- **Status:** NEEDS_REVIEW
- **Note:** Requires a product decision: either enforce pre-existing `StudentFinalGrade` rows (simpler) or compute real averages on-the-fly before the upsert (more robust). Both options have non-trivial implications for the reports flow.

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
- **Status:** NEEDS_MIGRATION
- **Note:** Requires schema migration + updating all `StudentRepository` queries to filter `deletedAt: null`. Large surface area — deferred as a dedicated soft-delete pass.

---

### BUG-024 — HIGH: `Class` model uses hard delete — cascades permanently destroy all class data
- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:107-142`
- **Description:** `Class` has no `deletedAt DateTime?` field. `onDelete: Cascade` is declared on `ClassEnrollment`, `TestSession`, `AttendanceRecord`, `TalmidautRecord`, `StudentFinalGrade`, and `ScheduleEntry`. Deleting a class permanently destroys all test sessions, results, attendance records, and final grades with no recovery path. There is currently no delete endpoint, but there is also no schema-level protection.
- **Expected:** Add `deletedAt DateTime?` to `Class` and apply soft-delete filtering in all repository queries. At minimum, add a schema comment explicitly documenting that hard-delete is intentional and listing all cascade consequences.
- **Status:** NEEDS_MIGRATION
- **Note:** Same scope as BUG-023 — deferred for the same soft-delete migration pass.

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
- **Status:** NEEDS_REVIEW
- **Note:** Performance optimisation with no correctness impact — deferred. Can be addressed when dashboard performance becomes a measured bottleneck.

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
- **Status:** NEEDS_REVIEW
- **Note:** Creating ~18 skeleton files is a significant UI task that requires design decisions for each page's skeleton layout. Deferred as a dedicated loading-states pass.

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
