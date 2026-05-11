# FitGrade — QA Backlog

---

## Security QA — 2026-04-06T00:00:00Z

### Audit Scope
Full security audit of `apps/api/src/` (all controllers, services, repositories, guards, DTOs) and partial review of `apps/web/` and `apps/mobile/`. Covers all 13 checklist categories.

---

### BUG-001 — CRITICAL: No RolesGuard Registered — Students Reach All Teacher Endpoints

- **Severity:** CRITICAL
- **Category:** SECURITY — Broken Access Control / Role Separation
- **File:** `apps/api/src/app.module.ts:44`
- **Description:** `JwtAuthGuard` is registered globally as `APP_GUARD`, which correctly requires a valid JWT on every non-`@Public()` route. However, **no `RolesGuard` exists anywhere in the codebase** and no `@Roles('TEACHER')` decorator is applied to any controller method. The backend rules document and architecture both require role-based separation, but the implementation relies solely on business-logic ownership checks (e.g., `verifyClassOwnership(classId, user.sub)`). A student who obtains a valid JWT (via `POST /auth/student`) can send requests to every teacher-only endpoint — `POST /classes`, `POST /classes/:classId/sessions`, `PATCH /sessions/:sessionId/complete`, `GET /dashboard/stats`, `GET /reports/class/:classId`, `POST /sessions/:sessionId/results`, `PATCH /classes/:id/grading-policy`, `PATCH /classes/:id/students/:studentId/grade-override`, `POST /copilot/chat`, and every settings, schedule, and comparison endpoint. While FK constraints and ownership checks prevent most data leakage, the role boundary is entirely absent. Any future endpoint that forgets an ownership check becomes immediately accessible to students.
- **Exploit path:** `POST /api/auth/student` with valid credentials → receive student JWT → call `POST /api/classes` — Prisma raises FK constraint error (student ID is not in the `User` table), which leaks schema information. Call `GET /api/dashboard/stats` with student JWT — returns empty arrays (no data leak but unintended access, and any new bug in business logic becomes exploitable). Call `POST /api/copilot/chat` with student JWT — the AI runs with the student's ID as `teacherId` (see BUG-002).
- **Expected:** A `RolesGuard` should be registered as a second `APP_GUARD` in `AppModule`. All teacher-only controllers/routes should carry `@Roles('TEACHER')`. The guard should read `jwtPayload.role` and throw `ForbiddenException` when a student JWT attempts to reach a teacher-only route.
- **Status:** FIXED
- **Fix applied:** Created `roles.decorator.ts` and `roles.guard.ts` (which also respects `@Public()`), registered `RolesGuard` as the second `APP_GUARD` in `AppModule`, and added `@Roles('TEACHER')` at the class level to all 11 teacher-only controllers.

---

### BUG-002 — CRITICAL: Student JWT Reaches Copilot AI — Abuses Google AI API Under Teacher's Quota

- **Severity:** CRITICAL
- **Category:** SECURITY — Broken Access Control
- **File:** `apps/api/src/copilot/copilot.controller.ts:43`
- **Description:** `POST /copilot/chat` has no `@Roles('TEACHER')` decorator and no role check in the service. Any student with a valid JWT can call this endpoint. The controller passes `user.sub` (the student's `studentId`) as `teacherId` to `CopilotService.initChat()`. The service then passes this to `buildSystemPrompt()` which calls `prisma.user.findUnique({ where: { id: teacherId } })` — students are in the `Student` table, not `User`, so this returns `null` and the AI prompt displays "מורה" as the teacher name. The AI session then runs with the student ID as the actor for all READ tool calls. This allows a student to: (a) consume the school's Google AI API quota/budget by making unlimited AI requests; (b) potentially cause the AI to execute READ tools scoped to the student's ID, which may return unexpected data depending on tool implementation.
- **Exploit path:** Login as student → call `POST /api/copilot/chat` with valid student JWT and any message body → AI session starts with student ID as actor → repeated calls drain Google AI API quota.
- **Expected:** `POST /copilot/chat` must require `role === 'TEACHER'` (enforced by `RolesGuard` + `@Roles('TEACHER')`). Students have no legitimate use of the Copilot feature.
- **Status:** FIXED
- **Fix applied:** Resolved by BUG-001 fix — `@Roles('TEACHER')` added at the `CopilotController` class level covers all non-`@Public()` routes including `POST /copilot/chat`.

---

### BUG-003 — CRITICAL: JWT Access Token Exposed in OAuth Redirect URL

- **Severity:** CRITICAL
- **Category:** SECURITY — Token Exposure
- **File:** `apps/api/src/auth/auth.controller.ts:126`
- **Description:** After successful Google OAuth, the callback handler redirects the browser to `${webUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`. The 15-minute JWT access token is placed in the URL query string. This causes the token to appear in: (1) browser address bar and browser history on both teacher and student devices; (2) web server and reverse proxy access logs; (3) `Referer` HTTP headers sent to any third-party resource loaded by the `/auth/callback` page (analytics, CDN assets, etc.); (4) any browser extension that reads URL history. An attacker with access to server logs or a malicious extension can extract a valid teacher JWT without ever interacting with Google OAuth. The mobile variant at line 126 has the same issue with the `fitgrade://auth/callback?token=...` deep link.
- **Exploit path:** Obtain access to web server access logs (e.g., via a compromised DevOps account, log aggregation service, or shared hosting) → grep for `GET /auth/callback?token=` → decode and use the JWT immediately (valid for 15 minutes).
- **Expected:** The access token should be passed via a short-lived, single-use server-side code that the client exchanges for the token over a POST request (PKCE pattern), **or** set as an httpOnly cookie. The refresh token is already set as an httpOnly cookie — extend this pattern to the access token delivery for the initial OAuth callback.
- **Status:** FIXED (web) / PARTIAL (mobile)
- **Fix applied:** Web flow now stores the access token in a 2-minute httpOnly `login_token` cookie scoped to `/api/auth/exchange` and redirects to `/auth/callback` with no query string. A new `POST /auth/exchange` (public) endpoint reads and clears the cookie, returning `{ accessToken }` in the JSON body. `apps/web/app/(auth)/callback/callback-handler.tsx` updated to call `POST /api/auth/exchange` (with `credentials: 'include'`) and read `accessToken` from the JSON response — token no longer appears in the URL. Mobile deep-link flow still uses `?token=` in the URL — full fix requires migrating to a server-side code exchange flow (noted as TODO in code comment).

---

### BUG-004 — HIGH: Copilot `cancelAction` — No Ownership Check, Any Authenticated User Can Cancel Any Pending Action

- **Severity:** HIGH
- **Category:** SECURITY — Missing Authorization Check
- **File:** `apps/api/src/copilot/copilot.controller.ts:120`
- **Description:** `DELETE /copilot/actions/:actionId` does not accept `@CurrentUser()` and calls `this.copilotService.deletePendingAction(actionId)` directly with no ownership verification. The underlying `PendingActionStore.deletePendingAction()` deletes by key without checking `entry.teacherId`. Any authenticated user (teacher or student) who knows or guesses a valid `actionId` UUID can cancel another teacher's pending WRITE action before it is confirmed. Since action IDs are generated with `randomUUID()` they are not easily guessable, but in a multi-user school environment with shared network logging, or if a student observed network traffic, this is exploitable.
- **Exploit path:** Sniff/observe a teacher's pending action UUID (e.g., via MITM on school network, shared proxy logs) → call `DELETE /api/copilot/actions/:actionId` with a student JWT → the teacher's pending grade-override or attendance action is silently cancelled.
- **Expected:** Pass `@CurrentUser() user: JwtPayload` into `cancelAction()`, then call `copilotService.cancelActionForOwner(actionId, user.sub)` which checks `entry.teacherId === teacherId` before deleting.
- **Status:** FIXED
- **Fix applied:** Added `cancelActionForOwner(actionId, teacherId)` to `CopilotService` — calls `pendingStore.getPendingAction()` first, throws `ForbiddenException` if `entry.teacherId !== teacherId`, then deletes. Updated `cancelAction` in controller to inject `@CurrentUser()` and call the new method. Also added `ForbiddenException` import to service and `403` response doc to the controller endpoint.

---

### BUG-005 — HIGH: Copilot `deleteConversation` — No Ownership Check, Any Authenticated User Can Delete Any Teacher's Conversation History

- **Severity:** HIGH
- **Category:** SECURITY — Missing Authorization Check
- **File:** `apps/api/src/copilot/copilot.controller.ts:163`
- **Description:** `DELETE /copilot/conversations/:conversationId` does not accept `@CurrentUser()` and calls `this.copilotService.deleteConversation(conversationId)` with no ownership verification. `ConversationHistoryStore.delete(conversationId)` removes by key without checking who owns it. Any authenticated user can delete any teacher's in-memory conversation history by guessing or observing a `conversationId` UUID.
- **Exploit path:** Observe a teacher's `conversationId` UUID (it's sent by the client in `POST /copilot/chat` body and could be observed via network sniffing or logs) → call `DELETE /api/copilot/conversations/:conversationId` → the teacher's AI conversation context is wiped mid-session.
- **Expected:** Pass `@CurrentUser()` into `deleteConversation()`, store `teacherId` alongside each conversation in `ConversationHistoryStore`, and verify ownership before deletion.
- **Status:** FIXED
- **Fix applied:** Added `teacherId` field to `HistoryEntry` in `ConversationHistoryStore`; updated `set()` signature to accept and persist `teacherId`; added `getTeacherId()` lookup method. Added `deleteConversationForOwner(conversationId, teacherId)` to `CopilotService` — checks `getTeacherId()` and throws `ForbiddenException` if owner mismatch (passes through silently if conversation is already expired/absent, matching cancel-action behaviour). Updated `historyStore.set()` call in `runStream()` to pass `payload.teacherId`. Updated controller `deleteConversation` to inject `@CurrentUser()` and call the new service method.

---

### BUG-006 — HIGH: No Rate Limiting on Authentication Routes — Brute Force Vulnerability

- **Severity:** HIGH
- **Category:** SECURITY — Missing Rate Limiting
- **File:** `apps/api/src/main.ts:1` / `apps/api/src/app.module.ts:1`
- **Description:** Neither `main.ts` nor `AppModule` registers `@nestjs/throttler` or any rate-limiting middleware. The student login endpoint `POST /auth/student` has no limit on request frequency. An attacker can make unlimited guesses of `password` for a known `classCode` + `studentCode` combination. Because bcrypt with 12 rounds is used, each comparison takes ~250ms, but at scale (distributed attack) this is bypassed. Similarly, `POST /auth/refresh` has no rate limit — an attacker can probe for valid refresh tokens. The computationally expensive Copilot, Reports, and Comparison endpoints are also unguarded against DoS via high request volume.
- **Exploit path:** Enumerate `password` values against `POST /api/auth/student` with a known `classCode` and `studentCode` (student codes are typically predictable, e.g., sequential numbers) → gain student account access.
- **Expected:** Install `@nestjs/throttler` and configure global throttling with strict limits on `POST /auth/*` routes (e.g., 5 attempts per minute per IP). Add tighter per-route `@Throttle()` decorators on login, refresh, and Copilot chat endpoints.
- **Status:** FIXED
- **Fix applied:** Installed `@nestjs/throttler` in the `api` package. Registered `ThrottlerModule.forRoot` in `AppModule` with a permissive global limit (60 req / 60 s) and `ThrottlerGuard` as a third `APP_GUARD`. Applied `@Throttle({ default: { ttl: 60_000, limit: 10 } })` on `POST /auth/student` (10 attempts/min) and `@Throttle({ default: { ttl: 60_000, limit: 20 } })` on `POST /auth/refresh` (20 attempts/min). Added `429` response docs to both endpoints.

---

### BUG-007 — HIGH: No Global Exception Filter — Prisma Errors Exposed to Clients

- **Severity:** HIGH
- **Category:** SECURITY — Verbose Error Disclosure
- **File:** `apps/api/src/main.ts:1`
- **Description:** There is no `@Catch()` exception filter registered anywhere in the application. NestJS's built-in behavior forwards unhandled non-`HttpException` errors (including `PrismaClientKnownRequestError`, `PrismaClientUnknownRequestError`, etc.) to the default exception handler, which may return a 500 response containing the raw error message. Prisma error messages include: the Prisma error code (e.g., `P2002`, `P2003`), model and field names, and constraint names. For example, calling `POST /api/classes` with a student JWT triggers a `P2003` foreign key constraint error that exposes the `User` model reference. This is an information disclosure vulnerability that reveals DB schema details.
- **Exploit path:** Send a student JWT to `POST /api/classes` with a valid class creation body → receive a 500 with Prisma error details including model and field names.
- **Expected:** Register a global `HttpExceptionFilter` (`@Catch()`) that: (1) catches all `HttpException` subclasses and returns the structured `{ statusCode, message, error }` shape; (2) catches all other `Error` instances (including Prisma errors), logs them internally with `logger.error()`, and returns a generic `{ statusCode: 500, message: 'שגיאה פנימית בשרת' }` with no internal detail.
- **Status:** FIXED
- **Fix applied:** Created `apps/api/src/common/filters/http-exception.filter.ts` (`AllExceptionsFilter` — `@Catch()` with no selector catches everything). `HttpException` subclasses are forwarded as-is. All other errors are logged with full stack trace via `NestJS Logger` and return `{ statusCode: 500, message: 'שגיאה פנימית בשרת', error: 'Internal Server Error' }` — no Prisma model/constraint details reach the client. Registered via `app.useGlobalFilters(new AllExceptionsFilter())` in `main.ts` before the validation pipe.

---

### BUG-008 — HIGH: Audit Logging Not Implemented — Grade Overrides, Attendance Changes, and Enrollment Events Are Untracked

- **Severity:** HIGH
- **Category:** SECURITY — Missing Audit Log
- **File:** `apps/api/src/tests/tests.service.ts:108`, `apps/api/src/attendance/attendance.service.ts:33`, `apps/api/src/students/students.service.ts:384`, `apps/api/src/classes/classes.service.ts` (grade override)
- **Description:** The backend architecture document and `CLAUDE.md` rules require that grade overrides (`GRADE_OVERRIDE`), result edits (`RESULT_EDIT`), attendance status changes (`ATTENDANCE_CHANGE`), and student enrollment/removal events (`STUDENT_ENROLLED`, `STUDENT_REMOVED`) all call `AuditLogService.log()`. No `AuditLogService` exists anywhere in the codebase. Searching for `AuditLog` and `auditLog` returns zero matches in `apps/api/src/`. The `overrideGrade`, `saveAttendance`, `addStudentToClass`, and `setStudentGradeOverride` methods all execute their writes with no audit trail. There is no way to detect unauthorized data changes or reconstruct what happened in a dispute.
- **Expected:** Implement `AuditLogService` backed by a persistent `AuditLog` DB table. Call `auditLogService.log()` at the end of every successful write in the above-listed service methods. Capture: `action`, `entityType`, `entityId`, `actorId`, `oldValue`, `newValue`, `timestamp`.
- **Status:** FIXED
- **Fix applied:** Created `apps/api/src/audit-log/audit-log.repository.ts` (Prisma write), `audit-log.service.ts` (fire-and-forget `log()` — errors caught+logged, never propagated), and `audit-log.module.ts` (`@Global()` so no consumer needs explicit imports). Registered `AuditLogModule` in `AppModule`. Injected `AuditLogService` into `TestsService` (`GRADE_OVERRIDE` on `overrideGrade`, `GRADE_ENTRY` on `submitResult`), `AttendanceService` (`ATTENDANCE_CHANGE` per record in `saveAttendance`), and `StudentsService` (`STUDENT_ENROLLED` in `addStudentToClass`). Updated `students.service.spec.ts` with mock `AuditLogService` provider. No schema migration needed — `AuditLog` model and `AuditAction` enum were already present.

---

### BUG-009 — HIGH: Failed Student Login Attempts Not Logged — Brute Force Is Undetectable

- **Severity:** HIGH
- **Category:** SECURITY — Missing Security Logging
- **File:** `apps/api/src/auth/auth.service.ts:46`
- **Description:** `AuthService.validateStudentLogin()` calls `bcrypt.compare()` and throws `UnauthorizedException` on failure, but never calls `this.logger.warn()` before the throw. Failed login attempts (wrong password, invalid class/student code) are silently discarded with no log entry. This makes brute force attacks completely invisible in server logs. Combined with BUG-006 (no rate limiting), an attacker can make thousands of password attempts per hour with no alert or evidence. Similarly, role escalation attempts (students reaching teacher endpoints and receiving 403/404) are not explicitly logged.
- **Expected:** Add `this.logger.warn(`Failed login attempt: classCode=${classCode} studentCode=${studentCode}`)` before throwing in `validateStudentLogin()`. Log all 403 responses from access control checks using `logger.warn()` with the attempted route and JWT role. These events should feed into a security monitoring dashboard.
- **Status:** FIXED
- **Fix applied:** In `auth.service.ts`, wrapped `authRepository.findStudentForLogin()` in a try/catch that logs `logger.warn()` with `classCode` and `studentCode` before rethrowing `UnauthorizedException` (covers not-found path). Added a second `logger.warn()` with the same identifiers immediately before the password-mismatch throw. Both warn messages follow the format `Failed student login — <reason>: classCode=X studentCode=Y` to enable log-based brute-force detection.

---

### BUG-010 — MEDIUM: `BulkAttendanceDto.records` Has No Maximum Array Size — DoS Vector

- **Severity:** MEDIUM
- **Category:** SECURITY — Unbounded Input / DoS Vector
- **File:** `apps/api/src/attendance/dto/bulk-attendance.dto.ts:27`
- **Description:** `BulkAttendanceDto.records` is decorated with `@IsArray()` and `@ValidateNested({ each: true })` but has no `@ArrayMaxSize()` constraint. A single `POST /classes/:classId/attendance` request can include an arbitrarily large `records` array. Each record triggers an `upsert` in the repository. Sending a payload with tens of thousands of records would cause a cascade of DB upserts in a single request, potentially exhausting DB connection pool resources and causing denial of service for other users. Teachers typically have at most 40 students per class, so any reasonable limit (e.g., 200) would not impact legitimate use.
- **Expected:** Add `@ArrayMaxSize(200)` (or a named constant `MAX_ATTENDANCE_RECORDS_PER_REQUEST = 200`) to the `records` field in `BulkAttendanceDto`.
- **Status:** FIXED
- **Fix applied:** Added `@ArrayMaxSize(200)` decorator to `records` field in `BulkAttendanceDto`, imported from `class-validator`. Added a Hebrew inline comment explaining the bound (max Israeli class size). `ValidationPipe` with `whitelist: true` will now reject any payload with more than 200 records with a `400 Bad Request` before it reaches the service or repository.

---

### BUG-011 — MEDIUM: Students Receive 404 (Not Found) Instead of 403 (Forbidden) When Accessing Teacher Resources — Resource Existence Disclosure

- **Severity:** MEDIUM
- **Category:** SECURITY — Information Disclosure
- **File:** `apps/api/src/students/students.repository.ts:153`, `apps/api/src/attendance/attendance.repository.ts:27`
- **Description:** The ownership verification pattern used throughout the codebase (`verifyClassOwnership`, `findOneByIdAndTeacher`) throws `NotFoundException` when a class is not found **or** when it doesn't belong to the caller. This is correct for teachers accidentally referencing a non-existent class. However, for a student JWT calling a teacher endpoint with a real class ID (e.g., `GET /api/classes/[realId]/students`), the response is `404 Not Found` rather than `403 Forbidden`. A student can distinguish between: (a) a class ID that doesn't exist → `404`; (b) a class ID that exists but belongs to a different teacher → also `404`; (c) their own fake class → different behavior. This reveals class ID existence to students. Correct behavior for an unauthorized role is always `403 Forbidden`, regardless of whether the resource exists.
- **Expected:** Once `RolesGuard` is implemented (BUG-001), students will receive `403` before any service method runs. As a defense-in-depth measure, the ownership check helper should be parameterized to throw `ForbiddenException` (not `NotFoundException`) when invoked with a student-role JWT, so the error is meaningful even without the guard.
- **Status:** FIXED
- **Fix applied:** In all four repositories (`students`, `attendance`, `tests`, `reports`), replaced the single `findFirst({ where: { id, teacherId } })` pattern with `findUnique({ where: { id } })` followed by two explicit checks: (1) `cls === null` → `NotFoundException` (class truly does not exist); (2) `cls.teacherId !== teacherId` → `ForbiddenException` (class exists but caller doesn't own it). Added `ForbiddenException` to imports in all four files. Also cleaned up the dynamic `await import('@nestjs/common')` in `reports.repository.ts`, replacing it with a static top-level import.

---

## Audit Category Summary

| # | Category | Result |
|---|----------|--------|
| 1 | Unguarded Endpoints | ❌ CRITICAL — No `RolesGuard` registered; all teacher endpoints reachable by students (BUG-001) |
| 2 | Broken Access Control / Role Separation | ❌ CRITICAL — No role enforcement; Copilot accessible by students (BUG-001, BUG-002) |
| 3 | Password Hash Exposure | ✅ No issues found — `passwordHash` is excluded from all selects via `STUDENT_SELECT` constant |
| 4 | Frontend API Key Exposure | ✅ No `NEXT_PUBLIC_SECRET/KEY/TOKEN/PASSWORD/JWT/DATABASE/PRIVATE` variables found |
| 5 | Hardcoded Secrets in Source | ✅ No issues found — all secrets read from `ConfigService`/env |
| 6 | Input Validation / Injection Prevention | ✅ `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` is set; DTOs use `class-validator` |
| 7 | Rate Limiting / DoS Prevention | ❌ HIGH — No `ThrottlerModule` configured; auth endpoints unprotected (BUG-006) |
| 8 | Unbounded Queries / DoS Vectors | ❌ MEDIUM — `BulkAttendanceDto.records` has no max size (BUG-010) |
| 9 | Secure Password Reset | ✅ No password reset flow found (students use class/student code + password; no reset mechanism exposed) |
| 10 | Verbose Error Handling / Info Disclosure | ❌ HIGH — No global exception filter; Prisma errors reach clients (BUG-007) |
| 11 | Security Logging & Monitoring | ❌ HIGH — Failed logins not logged; role escalation not logged (BUG-009) |
| 12 | Audit Log Coverage | ❌ HIGH — `AuditLogService` not implemented; no audit trail for any write action (BUG-008) |
| 13 | Console.log in Production | ✅ No issues found — `NestJS Logger` used consistently; no `console.log` calls |

---

## Logic QA — 2026-04-08T00:00:00Z

### Audit Scope
Full logic audit of `apps/api/src/` (GradingService, all services, all repositories) and `apps/web/hooks/`. Covers all checklist categories: grade math correctness, service layer purity, repository safety, TypeScript strictness, error handling, and web hook mutation safety.

---

### BUG-012 — HIGH: `CopilotService` Calls `this.prisma.*` Directly — Architecture Violation

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/copilot/copilot.service.ts:261`, `apps/api/src/copilot/copilot.service.ts:308`, `apps/api/src/copilot/copilot.service.ts:341`
- **Description:** `CopilotService` injects `PrismaService` directly and calls `this.prisma.aiActionLog.findMany()` (line 261), `this.prisma.class.findFirst()` (line 308), and `this.prisma.user.findUnique()` (line 341) inside service methods. The architecture rule mandates that all Prisma calls live exclusively in `*.repository.ts` files. A service method that queries Prisma directly bypasses the repository boundary, making the code untestable in isolation (real DB is required to test), and spreads query logic across two layers. The `buildSystemPrompt` method (line 308) has a silent `catch {}` that swallows all exceptions from the `class.findFirst` call, hiding database errors.
- **Expected:** All three Prisma calls should be extracted into a `CopilotRepository` or delegated to existing repositories (`ClassesRepository`, a new `AiActionLogRepository`). The `buildSystemPrompt` catch block should log the error via `this.logger.warn()` before the silent continue.
- **Status:** FIXED
- **Fix applied:** Created `apps/api/src/copilot/copilot.repository.ts` with `findAiActionLogs`, `findClassNameForTeacher`, and `findTeacherName` methods; replaced all three `this.prisma.*` calls in `CopilotService` with repository calls; replaced silent `catch {}` with `catch (err) { this.logger.warn(...) }`; registered `CopilotRepository` in `CopilotModule`.

---

### BUG-013 — HIGH: `ClassesRepository.findOneByIdAndTeacher` Uses `findFirst` — Incorrect Error on Cross-Teacher Access

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/classes/classes.repository.ts:103`
- **Description:** `findOneByIdAndTeacher` uses `this.prisma.class.findFirst({ where: { id: classId, teacherId } })`. When a class with `classId` exists but belongs to a different teacher, Prisma returns `null` (no row matches both conditions), and the method throws `NotFoundException`. The correct exception is `ForbiddenException` — the resource exists but the caller does not own it. BUG-011 fixed this pattern in `students`, `attendance`, `tests`, and `reports` repositories but missed `ClassesRepository`. This method is the primary ownership gate for `GET /classes/:classId`, `GET /classes/:classId/details`, `PATCH /classes/:classId/grading-policy`, `POST /classes/:classId/grade-override`, and the comparison availability/detail endpoints — all of which will incorrectly return 404 instead of 403 when a teacher attempts to access another teacher's class.
- **Expected:** Replace the combined `findFirst({ where: { id, teacherId } })` with `findUnique({ where: { id } })` followed by an explicit `if (row === null) throw NotFoundException` and `if (row.teacherId !== teacherId) throw ForbiddenException`. This matches the pattern already applied to the other four repositories.
- **Status:** FIXED
- **Fix applied:** Replaced `findFirst({ where: { id: classId, teacherId } })` with `findUnique({ where: { id: classId } })`, added explicit `ForbiddenException` when `row.teacherId !== teacherId`, destructured `teacherId` out before passing `rest` to `toClassResponse`, and added `ForbiddenException` to the `@nestjs/common` import.

---

### BUG-014 — HIGH: `StudentsRepository.recalculateFinalGrade` Contains Business Logic — Architecture Violation

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.repository.ts:313`
- **Description:** `recalculateFinalGrade` in `StudentsRepository` (lines 313–368) performs substantial business logic: it fetches test results and talmidaut records, computes `fitnessAvg`, `talmidautAvg`, applies weight fallback constants, calculates `recommendedGrade`, and upserts `StudentFinalGrade`. The architecture rule is strict: repositories contain Prisma queries only — no business logic. This method is 55 lines long (more than the 40-line limit), making it the longest method in the repository layer. Additionally, the `DEFAULT_TEST_WEIGHT = 55` and `DEFAULT_TALMIDAUT_WEIGHT = 45` constants are hardcoded here instead of being sourced from the teacher's `defaultFitnessWeight`/`defaultConductWeight` DB fields, so if a teacher changes their global defaults, the `recalculateFinalGrade` call (triggered by `addTalmidautRecord`) will use stale hardcoded values rather than the teacher's saved preferences.
- **Expected:** Move all computation logic into `StudentsService` (or a dedicated `FinalGradeService`). The repository should only expose: `fetchTalmidautRecords()`, `fetchTestResultsForStudent()`, `fetchClassWeights()`, and `upsertFinalGrade()`. The service orchestrates them and performs the arithmetic. Fetch teacher's global defaults from DB and pass them as fallback to avoid the hardcoded-constant problem.
- **Status:** FIXED
- **Fix applied:** Removed `recalculateFinalGrade` and its constants from the repository; replaced with `findGradeComponents` (data-only fetch) and `upsertFinalGrade` (data-only write); changed `createTalmidautRecord` to return `void`; added private `recomputeAndPersistFinalGrade` to `StudentsService` containing all grade arithmetic; updated `addTalmidautRecord` to call `createTalmidautRecord` then `recomputeAndPersistFinalGrade`; updated mock repository in spec.

---

### BUG-015 — HIGH: `fitnessAvg` Computed Inconsistently Across Three Endpoints — Students Receive Different Grades Depending on Which Page They Are Viewed From

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:139`, `apps/api/src/students/students.service.ts:300`, `apps/api/src/reports/reports.service.ts:187`
- **Description:** Three different endpoints compute the student's overall fitness average using different aggregation strategies, producing different numbers for the same student:
  1. **Student profile** (`getStudentProfile`, line 139): `overallAvg` = simple average of `latestGrade` per test type (the most recent result's grade for each test type).
  2. **Student report** (`getStudentReport`, line 300): `fitnessAvg` = simple average of `latestGrade` per test type after sorting deduplicated results best-first — same shape as (1) but the deduplicated `testResults` list is sorted descending before reduction, making the "latest" entry (the last-overwrite wins pattern) actually the best grade, not the most recent.
  3. **Class report** (`ReportsService.getClassReport`, line 187): `fitnessAvg` = average of the **best** grade per test type (`Math.max(...grades)` across all sessions for that test type).

  This means a student who took the 100m sprint twice (score 70 in semester A, score 80 in semester B) will have: profile shows 80 (latest), student report shows 80 (latest surviving overwrite), class report shows 80 (best). These happen to agree for the common case, but if order differs they diverge. More critically, the `recommendedFinalGrade` on the formal student PDF report uses the class-report `fitnessAvg` logic (best-per-type) while the student profile card shows the latest-per-type grade, leading to the grade on the report differing from the grade shown on the profile page for the same student.
- **Expected:** Standardize on a single aggregation rule (best-per-test-type is the most teacher-friendly approach as it rewards improvement) and apply it consistently in all three places. Extract a shared helper `computeFitnessAvg(results)` to enforce this.
- **Status:** FIXED
- **Fix applied:** `getStudentProfile` — added `bestGrade: number` to `TestAcc`, updated accumulator to track `Math.max(acc.bestGrade, grade)`, and replaced the last-history-entry lookup with `acc.bestGrade`. `getStudentReport` — renamed `latestGrade` → `bestGrade` in `TestAcc`, changed accumulator to `Math.max(existing?.bestGrade ?? 0, grade)`, removed the descending grade sort (which was a workaround). `getClassReport` — already used `Math.max(...grades)` correctly; no change needed.

---

### BUG-016 — MEDIUM: Weight Validation Gap in `updateClassWeights` — Mixed-Null Pair Not Validated

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/classes/classes.service.ts:185`
- **Description:** `updateClassWeights` validates the sum-to-100 constraint only when **both** `testWeight` and `talmidautWeight` are non-null: `if (testWeight !== null && talmidautWeight !== null) { if (sum !== 100) throw }`. When exactly one value is null and the other is non-null (e.g., `testWeight=80, talmidautWeight=null`), the validation is skipped and the class is saved with an inconsistent weight pair. At query time, the fallback logic `cls.testWeight ?? DEFAULT_TEST_WEIGHT` will mix the teacher's per-class override (80) with the hardcoded global default (45) to produce a final grade weighted at 125% — a mathematical error that silently overcounts the grade. The DB schema comment says "testWeight + talmidautWeight must sum to 100" but the service allows this invariant to be violated.
- **Expected:** The validation should enforce: either both weights are null (reset to global defaults), or both are non-null and sum to 100. Any other combination (one null, one non-null) should throw `BadRequestException('יש לספק את שני המשקלים יחד או לאפס אותם יחד')`.
- **Status:** FIXED
- **Fix applied:** Added an `onlyOneIsNull` check before the existing sum-to-100 guard; throws `BadRequestException('יש לאפס את שני המשקלים יחד, או לספק ערך לשניהם')` when exactly one weight is null.

---

### BUG-017 — MEDIUM: `ClassesService.updateClassWeights` Uses Dynamic `import()` Instead of Static Import

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/classes/classes.service.ts:184`
- **Description:** `const { BadRequestException } = await import('@nestjs/common')` inside `updateClassWeights` uses a dynamic async import to obtain `BadRequestException`. This is the only dynamic import in the entire service layer. Dynamic imports in NestJS service methods add unnecessary async overhead to every call of this method (Node.js caches the module after the first call, but the await still suspends the micro-task queue unnecessarily). More importantly, it is a code style violation — `@nestjs/common` is a static dependency already imported at the top of the file (`import { ConflictException, Injectable, Logger }`), so `BadRequestException` should simply be added to that import list.
- **Expected:** Add `BadRequestException` to the existing static import on line 1 and remove the `await import()` call.
- **Status:** FIXED
- **Fix applied:** Added `BadRequestException` to the static `@nestjs/common` import on line 1; removed the `const { BadRequestException } = await import('@nestjs/common')` line from `updateClassWeights`. Fixed together with BUG-016 as both were in the same method.

---

### BUG-018 — MEDIUM: `DEFAULT_TEST_WEIGHT`/`DEFAULT_TALMIDAUT_WEIGHT` Hardcoded Constants Diverge From Teacher's Saved Global Defaults

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.service.ts:24`, `apps/api/src/students/students.repository.ts:124`
- **Description:** `students.service.ts` and `students.repository.ts` both define `DEFAULT_TEST_WEIGHT = 55` and `DEFAULT_TALMIDAUT_WEIGHT = 45` as module-level constants. These are used as the fallback when a class has no per-class weight override (`cls.testWeight ?? DEFAULT_TEST_WEIGHT`). The teacher's global defaults are stored in `User.defaultFitnessWeight` (default 55) and `User.defaultConductWeight` (default 45) in the DB — but the student profile and talmidaut-recalculation code paths never fetch these and instead use hardcoded values. If a teacher updates their global defaults via `PATCH /settings/grading-policy` (e.g., to fitness=60, conduct=40), those new defaults are only respected in `ReportsService.getClassReport` (which explicitly queries `findTeacherGradingDefaults()`). The student profile (`getStudentProfile`), student report PDF (`getStudentReport`), and final grade recalculation (`recalculateFinalGrade`) all silently ignore the teacher's saved preferences and use 55/45. A teacher who changes their global policy will see consistent grades in the class report but stale grades in individual student profiles.
- **Expected:** Remove the hardcoded constants. Instead, fetch `User.defaultFitnessWeight` / `User.defaultConductWeight` from the DB in each code path that resolves fallback weights (or pass them as parameters from the service layer where the teacher context is available). Centralise the fallback resolution into a single shared function.
- **Status:** FIXED
- **Fix applied:** Removed `DEFAULT_TEST_WEIGHT`/`DEFAULT_TALMIDAUT_WEIGHT` constants from `students.service.ts`. Added `findTeacherWeightDefaults(teacherId)` to `StudentsRepository`. All three code paths (`getStudentProfile`, `getStudentReport`, `recomputeAndPersistFinalGrade`) now fetch teacher defaults from DB when class weights are null. `teacherId` threaded into private `recomputeAndPersistFinalGrade` method.

---

### BUG-019 — LOW: `createWithEnrollment` Uniqueness Check Has TOCTOU Race Condition

- **Severity:** LOW
- **Category:** LOGIC
- **File:** `apps/api/src/students/students.repository.ts:495`
- **Description:** `createWithEnrollment` first does `findFirst({ where: { classId, student: { studentCode } } })` to check uniqueness, then proceeds with `$transaction` to create the student. Between the read and the write, a concurrent request could insert a student with the same `studentCode` in the same class, bypassing the check. The schema does not have a unique constraint on `(classId, studentCode)` — uniqueness is enforced only at the service layer, making this a classic TOCTOU (time-of-check/time-of-use) race condition. Under concurrent load (e.g., two browser tabs submitting the same form), duplicate students can be created.
- **Expected:** Add a Prisma schema-level `@@unique([classId, studentCode])` index on `ClassEnrollment` (or move the studentCode uniqueness constraint to the student-creation level). The application-layer check can remain as an early exit for better error messages, but the DB constraint is the real guard.
- **Status:** FIXED
- **Fix applied:** Added `studentCode String` field to `ClassEnrollment` model in `schema.prisma` with `@@unique([classId, studentCode])`. Updated `createWithEnrollment` to store `studentCode` on the enrollment row and wrapped the transaction in a `P2002` catch that throws `ConflictException`. ⚠️ Requires migration: `pnpm prisma migrate dev --name add_enrollment_studentcode_unique`

---

## Logic QA — Audit Category Summary

| # | Category | Result |
|---|----------|--------|
| 1 | GradingService correctness | ✅ No issues — `calculateGrade` correctly throws `NotFoundException` on missing norm row; `computeAge` handles birthday edge cases correctly; no inline grade math found outside `GradingService` |
| 2 | Service layer purity | ❌ HIGH — `CopilotService` calls `this.prisma.*` directly (BUG-012); `StudentsRepository.recalculateFinalGrade` contains business logic (BUG-014) |
| 3 | Repository safety (null derefs) | ❌ HIGH — `ClassesRepository.findOneByIdAndTeacher` uses `findFirst` with combined filter, returns NotFoundException instead of ForbiddenException on cross-teacher access (BUG-013); TOCTOU race in `createWithEnrollment` (BUG-019) |
| 4 | Repository safety (passwordHash exposure) | ✅ No issues — `STUDENT_SELECT` constant excludes `passwordHash` in all student queries |
| 5 | TypeScript strictness | ✅ No `any` usage found in `apps/api/src/**/*.ts` or `apps/web/**/*.ts(x)` |
| 6 | Error handling (empty catch) | ⚠️ LOW — `copilot.service.ts:315` has a silent `catch {}` for class-name enrichment (intentional, non-critical, but undocumented); all service catch blocks otherwise log before re-throwing |
| 7 | Grade calculation consistency | ❌ HIGH — `fitnessAvg` computed differently across student profile, student report, and class report endpoints (BUG-015) |
| 8 | Weight validation logic | ❌ MEDIUM — Mixed-null weight pair bypasses sum-to-100 validation (BUG-016); hardcoded fallback constants ignore teacher global defaults (BUG-018) |
| 9 | Dynamic import in service | ❌ MEDIUM — `BadRequestException` dynamically imported in `updateClassWeights` (BUG-017) |
| 10 | Web hooks mutation safety | ✅ No issues — all mutation hooks in `apps/web/hooks/` propagate errors by returning rejected Promises from `apiRequest`; no silent swallowing found |


---

## DB QA — 2026-04-09

### BUG-020 — HIGH: `AttendanceRecord.session` Nullable FK Missing `onDelete: SetNull`

- **Severity:** HIGH
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:321`
- **Description:** `AttendanceRecord.sessionId` is an optional FK to `TestSession` with no `onDelete:` directive. Prisma defaults to `NoAction`, meaning the database enforces a foreign key constraint with no cascade. If a teacher deletes a `TestSession` that has linked `AttendanceRecord` rows (e.g., injury/EXCUSED records written during that session), the delete will fail with a PostgreSQL FK violation error at runtime. The constraint is silent until triggered.
- **Expected:** `session TestSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)` — this nullifies `sessionId` on child rows when the parent session is deleted, preserving the attendance record while removing the stale reference.
- **Status:** FIXED
- **Fix applied:** Added `onDelete: SetNull` to `AttendanceRecord.session` relation in `schema.prisma:322`; created and applied migration `20260409000002_add_attendance_session_on_delete_set_null` which drops the old FK and re-adds it with `ON DELETE SET NULL ON UPDATE CASCADE`.

---

### BUG-021 — MEDIUM: `AuditLog.actor` Relation Missing `onDelete:` Blocks Teacher Account Deletion

- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:496`
- **Description:** `AuditLog.actorId` references `User` with no `onDelete:` directive. Prisma defaults to `NoAction`/`Restrict`, so any attempt to delete a `User` who owns `AuditLog` rows will fail with a FK constraint violation. All other `User` child relations (Classes, Events, AiActionLogs, ScheduleEntries) have `onDelete: Cascade`, so they would cascade cleanly — but the `AuditLog` relation would block the entire delete.
- **Expected:** Add `onDelete: Cascade` to `AuditLog.actor` relation (deleting a teacher removes their audit trail, consistent with all other `User` cascades) — OR make `actorId` nullable with `onDelete: SetNull` if audit log preservation is required after account deletion. Given the rest of the schema uses Cascade for user relations, Cascade is the consistent choice.
- **Status:** FIXED
- **Fix applied:** Added `onDelete: Cascade` to `AuditLog.actor` relation in `schema.prisma:496`; created and applied migration `20260409000003_add_audit_log_actor_on_delete_cascade`.

---

### BUG-022 — MEDIUM: `AttendanceRecord` Missing `@@index([studentId])`

- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:304`
- **Description:** `AttendanceRecord` has `@@index([classId, date])` and `@@index([classId, semester])`, plus a composite unique on `(classId, studentId, date)`. However, `student-portal.repository.ts:findAttendanceSummary` queries `attendanceRecord.findMany({ where: { studentId } })` — `studentId` alone as the WHERE clause. None of the existing indexes have `studentId` as the leading column, so this query performs a full table scan. As attendance data grows (multiple classes, full school year), this becomes increasingly expensive for every student portal page load.
- **Expected:** Add `@@index([studentId])` to `AttendanceRecord` in `schema.prisma`.
- **Status:** FIXED
- **Fix applied:** Added `@@index([studentId])` to `AttendanceRecord` in `schema.prisma`; created and applied migration `20260410000001_add_attendance_record_student_id_index` which creates index `attendance_records_studentId_idx`.

---

### BUG-023 — MEDIUM: `TestSession` Missing `@@index([testTypeId])`

- **Severity:** MEDIUM
- **Category:** DB
- **File:** `apps/api/prisma/schema.prisma:254`
- **Description:** `TestSession` has only `@@index([classId])`. `dashboard.repository.ts:findTopStudentsByTestType` calls `testSession.findMany({ where: { classId: { in: classIds }, testTypeId, ... } })` — filtering on both `classId` and `testTypeId`. The existing `@@index([classId])` partially helps, but filtering a potentially large result set by `testTypeId` within each classId has no index support. As sessions accumulate across many test types, this scan grows.
- **Expected:** Add `@@index([classId, testTypeId])` to `TestSession` in `schema.prisma` to support the (classId, testTypeId) filter used in top-students-by-test-type queries.
- **Status:** FIXED
- **Fix applied:** Added `@@index([classId, testTypeId])` to `TestSession` in `schema.prisma`; created and applied migration `20260410000002_add_test_session_class_testtype_index` which creates index `test_sessions_classId_testTypeId_idx`.

---

### BUG-024 — LOW: TODO Comment in Production Code (`auth.repository.ts`)

- **Severity:** LOW
- **Category:** DB
- **File:** `apps/api/src/auth/auth.repository.ts:51`
- **Description:** `findTeacherById` contains a multi-line TODO-style comment instructing developers to run `prisma generate && prisma migrate dev` after adding the `school` field, and manually casts `(row as Record<string, unknown>)['school']` to work around the stale Prisma client. `CLAUDE.md` explicitly bans TODO comments in committed code. The workaround is also fragile — if the Prisma client is regenerated without the field, the cast silently returns `null` with no type error.
- **Expected:** The `school` field exists in the current `schema.prisma` (`User.school String?`) and Prisma has been re-run, so the cast is now unnecessary. Remove the TODO comment and use the typed `select: { ..., school: true }` directly.
- **Status:** FIXED
- **Fix applied:** Removed stale TODO comment and unsafe `Record<string, unknown>` cast from `auth.repository.ts:findTeacherById`; added `school: true` to the Prisma `select` and simplified the method to a direct `return` (no intermediate `row` variable needed).

---

## DB QA — Audit Category Summary

| # | Category | Result |
|---|----------|--------|
| 1 | Schema `@@unique` constraints | ✅ All required constraints present: `TestResult(sessionId, studentId)`, `AttendanceRecord(classId, studentId, date)`, `ClassEnrollment(classId, studentId)`, `ClassEnrollment(classId, studentCode)` |
| 2 | `@@index` coverage | ❌ MEDIUM — `AttendanceRecord` missing `@@index([studentId])` (BUG-022); `TestSession` missing `@@index([classId, testTypeId])` (BUG-023) |
| 3 | `onDelete:` cascade definitions | ❌ HIGH — `AttendanceRecord.session` optional FK missing `onDelete: SetNull` (BUG-020); ❌ MEDIUM — `AuditLog.actor` missing `onDelete:` blocks User deletion (BUG-021) |
| 4 | N+1 query patterns | ✅ No N+1 patterns found — all dashboard fan-outs are bounded multi-step aggregations, not per-row loops |
| 5 | `findMany` without `select:` | ✅ All repository `findMany` calls use explicit `select:` |
| 6 | Transaction coverage | ✅ All multi-table writes use `$transaction()`: student enrollment, attendance upsert, grade override batch saves |
| 7 | AuditLog immutability | ✅ No update or delete endpoint for AuditLog records found across all controllers |
| 8 | Soft vs hard delete | ✅ Hard delete on `Student`/`Class` is intentional; all relations have `onDelete: Cascade` — data removal is consistent |
| 9 | passwordHash in select | ✅ No `passwordHash: true` found in any `select:` block other than `auth.repository.ts:findStudentForLogin` (legitimately required for bcrypt verification) |
| 10 | Production TODO comments | ❌ LOW — `auth.repository.ts:findTeacherById` has stale TODO comment and unsafe cast (BUG-024) |

---

## Mobile UI QA — 2026-04-11

### Audit Scope
Full UI QA audit of `apps/mobile` (Expo + React Native). Covers all 10 checklist categories per mobile rules.

---

### BUG-025 — HIGH: Duplicate Tap (409 Conflict) Not Handled in Stopwatch

- **Severity:** HIGH
- **Category:** MOBILE-UI
- **File:** `apps/mobile/app/(teacher)/session/[sessionId].tsx:97-137`
- **Description:** The `handleStudentTap` function in stopwatch mode uses optimistic updates and prevents double-tap client-side with `if (tappedIds.has(student.id) || pendingIds.has(student.id)) return;`. However, this guard is not 100% reliable in high-latency or race-condition scenarios. When a duplicate tap triggers a 409 Conflict response from the backend, the generic catch block fires without any special handling. Per mobile.md rules, a duplicate tap must trigger haptic error plus Hebrew "כבר נרשם" toast. Currently the app shows only generic "רישום הזמן נכשל. נסה שוב." alert.
- **Expected:** The catch block should inspect `error.statusCode === 409` and show a specific Hebrew toast "כבר נרשם" with error haptics, distinct from network failures (which show "רישום הזמן נכשל. נסה שוב.").
- **Status:** FIXED
- **Fix applied:** Imported `ApiError` (class, not type) from `@fitgrade/types` in the session screen. Rewrote the `handleStudentTap` catch logic: a 409 response now immediately fires error haptic + `Alert.alert('כבר נרשם', ...)` without retrying or queuing; all other errors follow the existing 2 s retry → MMKV queue path. The same 409 check is applied to the retry attempt to handle cross-device race conditions.

---

### BUG-026 — HIGH: No Offline Network Detection / NetInfo Integration

- **Severity:** HIGH
- **Category:** MOBILE-UI
- **File:** `apps/mobile/package.json` (dependencies), entire app structure
- **Description:** Per mobile.md rule "Offline Resilience": an offline indicator (persistent banner at top of screen when `NetInfo.isConnected === false`) must be shown. Teachers use this app in gyms/fields with poor connectivity. The package.json does not include `@react-native-community/netinfo` dependency, and no NetInfo integration exists in the codebase. No offline banner is rendered anywhere. Users offline do not get any warning that data syncing may fail.
- **Expected:** Install `@react-native-community/netinfo`, add a persistent offline banner component that renders at the top of all screens when offline, and show a Hebrew "אין חיבור לאינטרנט" message. The banner should disappear when connection restores.
- **Status:** FIXED
- **Fix applied:** Installed `@react-native-community/netinfo@^11.3.0`; created `hooks/use-network-status.ts` (NetInfo subscriber, defaults to `true`); created `components/offline-banner.tsx` (absolutely positioned red banner); rendered `<OfflineBanner />` inside `app/_layout.tsx` so it overlays all screens.

---

### BUG-027 — HIGH: Offline Queue for Stopwatch Results Not Implemented

- **Severity:** HIGH
- **Category:** MOBILE-UI
- **File:** `apps/mobile/lib/storage.ts:13` and session screen
- **Description:** The storage.ts file comments say "Full implementation (token read/write, offline queue) added in auth phase" but the offline queue is never actually implemented. Per mobile.md: "For stopwatch taps: fail visibly and loudly (haptic error + visual error state) — never silently discard a lap tap." If a stopwatch tap POST fails due to network error and is not retried, the data is lost. There is no queue mechanism to save taps locally in MMKV and retry when connection restores. The only safeguard is React Query default `retry: 1`, which may not be sufficient in poor connectivity. A teacher at an outdoor field could lose test results entirely.
- **Expected:** Implement an offline queue in MMKV that stores pending stopwatch results (studentId, rawValue, sessionId) when POST fails. On app resume or connection restore via NetInfo listener, drain the queue by re-submitting each result. Handle conflicts gracefully (409 → skip that result).
- **Status:** FIXED
- **Fix applied:** `handleStudentTap` in `session/[sessionId].tsx` now: (1) retries automatically once after 2 s on first failure; (2) if the retry also fails, marks the student row with a red "נכשל — נסה שוב" error state and calls `enqueueOfflineTap()` to persist the tap to MMKV. Tapping an error-state row clears the error and retries immediately. Queue is flushed in `_layout.tsx` via `useOfflineQueueFlush` on mount and on every reconnect event.

---

### BUG-028 — HIGH: No ErrorBoundary Wrapper on Screens

- **Severity:** HIGH
- **Category:** MOBILE-UI
- **File:** `apps/mobile/app/(teacher)/index.tsx`, `apps/mobile/app/(teacher)/classes/[id].tsx`, `apps/mobile/app/(teacher)/session/[sessionId].tsx`
- **Description:** Per mobile.md: "Wrap every screen in an `<ErrorBoundary>` component that shows a friendly Hebrew error screen with a 'נסה שוב' (retry) button." No ErrorBoundary component exists in the codebase. If any component inside a screen throws an unhandled error, the entire screen crashes and user sees a blank screen or native error overlay. There is no graceful recovery or Hebrew error message.
- **Expected:** Create a new component `components/ErrorBoundary.tsx` that is a React class component implementing `componentDidCatch`. Wrap the root of each screen or the entire (teacher) layout with `<ErrorBoundary>`. Display a Hebrew error message with a "נסה שוב" button.
- **Status:** FIXED
- **Fix applied:** Created `apps/mobile/components/error-boundary.tsx` — a React class component with `getDerivedStateFromError`, `componentDidCatch` (intentional no-op to avoid logging sensitive state), and `handleReset`. Fallback UI: dark glassmorphism overlay (rgba 88% opacity) + frosted white card with ⚠️ icon, Hebrew title/body, and full-width "נסה שוב" primary button. Wrapped the entire teacher `<Stack>` in `app/(teacher)/_layout.tsx` with `<ErrorBoundary>` so all teacher screens are covered by a single boundary.

---

### BUG-029 — MEDIUM: Offline Queue TODO Not Implemented — Comments Promise Implementation Never Delivered

- **Severity:** MEDIUM
- **Category:** MOBILE-UI
- **File:** `apps/mobile/lib/storage.ts:1-14`
- **Description:** The file header comment explicitly states: "All persistent local state (JWT token, last-used class, offline queue) is stored here — never in AsyncStorage or localStorage. Full implementation (token read/write, offline queue) added in auth phase." The offline queue is listed as a core feature but is not implemented. This is a broken promise in the codebase. The discrepancy creates confusion for future maintainers.
- **Expected:** Either (a) implement the offline queue per BUG-027, or (b) remove the "offline queue" mention from the comment and update it to say "Currently token read/write only; offline queue TODO." Be explicit about what is/isn't implemented.
- **Status:** FIXED
- **Fix applied:** Implemented the offline queue in `lib/storage.ts`: added `OFFLINE_TAP_QUEUE` storage key, `OfflineTapEntry` interface, and `getOfflineQueue` / `enqueueOfflineTap` / `dequeueOfflineTap` functions. Removed the stale "added in auth phase" comment. Queue is now fully operational (see BUG-027).

---

## Mobile UI QA — Audit Summary

| # | Checklist Item | Status | Notes |
|----|----------------|--------|-------|
| 1  | RTL Configuration | ✅ | `I18nManager.allowRTL(true)` and `forceRTL(true)` present at module level in `app/_layout.tsx` before navigation |
| 2  | Physical Directional Props | ✅ | All directional properties use `start`/`end` instead of left/right; no violations found |
| 3  | Hebrew Text & Grade Labels | ✅ | All user-facing strings in Hebrew; `getHebrewGradeLabel()` used on all grade displays; no English text |
| 4  | Touch Target Sizes | ✅ | Primary buttons use `minHeight: 56px`; stopwatch buttons use `height: 72px` full-width |
| 5  | Loading & Error States | ✅ | All screens show loading indicators and Hebrew error messages with retry buttons |
| 6  | Offline Handling | ❌ | No offline detection or offline queue (BUG-026, BUG-027) |
| 7  | Stopwatch Screen | ⚠️ | Timer uses `Date.now()` correctly, but duplicate tap not distinguished from network error (BUG-025) |
| 8  | FlatList Usage | ✅ | All lists use FlatList with keyExtractor and getItemLayout; no ScrollView wrapping |
| 9  | Haptic Feedback | ✅ | Present on stopwatch tap, attendance toggle, errors, and success states |
| 10 | Auth & Token Storage | ✅ | MMKV used correctly; 401 redirects to login; synchronous token check |

---

### Issues Summary
- **CRITICAL:** 0
- **HIGH:** 4 (BUG-025, BUG-026, BUG-027, BUG-028)
- **MEDIUM:** 1 (BUG-029)
- **LOW:** 0

All other audit categories passed. RTL, touch targets, loading states, haptics, auth, and FlatList usage are compliant.

---

## Functional QA — Batch 1 (auth-qa / dashboard-qa / classes-qa) — 2026-04-13T00:00:00Z

---

### BUG-030 — HIGH: Refresh Token Not Rotated on Use

- **Severity:** HIGH
- **Category:** SECURITY / AUTH
- **File:** `apps/api/src/auth/auth.service.ts:135`
- **Description:** `refreshAccessToken()` validates the incoming refresh token and issues a new access token, but never invalidates or rotates the refresh token itself. The same refresh token remains valid for its full 7-day TTL and can be used repeatedly — including by an attacker who obtained a copy. Stolen refresh tokens provide persistent access with no way to detect or revoke them (no token family, no DB rotation record).
- **Expected:** After issuing a new access token, the old refresh token should be invalidated (e.g., stored in a DB table with a `usedAt` field, or replaced via a token-family rotation scheme). Any attempt to reuse the old token should return 401 and ideally invalidate all tokens for that user (token reuse detection).
- **Status:** OPEN

---

### BUG-031 — HIGH: Dashboard Stats API Error Silently Falls Through to Hardcoded Mock Data

- **Severity:** HIGH
- **Category:** UI / LOGIC
- **File:** `apps/web/app/(teacher)/dashboard/page.tsx:2377`
- **Description:** `useDashboardStats()` returns `{ data: stats, error: statsError }`. The component captures `statsError` but **never references it again** — no error branch, no Hebrew toast, no fallback message. When `stats` is `undefined` (API error or first load with no data), the condition `hasRealData = Boolean(stats && stats.totalStudents > 0)` is `false`, causing the page to silently render `MOCK_STATS` (hardcoded at line 1848). A teacher whose API is down sees completely fabricated statistics (fake student counts, attendance percentages, session counts) with no indication that the data is stale or unavailable.
- **Expected:** When `statsError` is truthy, the dashboard should display a Hebrew inline error message (e.g., "שגיאה בטעינת הנתונים — נסה שוב") instead of falling back to mock data. `MOCK_STATS` should only be used as a visual placeholder during the initial loading skeleton phase, not as a silent error fallback.
- **Status:** OPEN

---

### BUG-032 — HIGH: Grade Override Missing Audit Log

- **Severity:** HIGH
- **Category:** LOGIC / AUDIT
- **File:** `apps/api/src/classes/classes.service.ts:207`
- **Description:** `setStudentGradeOverride()` calls `classesRepository.quickGradeOverride()` and returns the effective grade — but **never calls `AuditLogService.log()`**. The backend rules document explicitly lists grade overrides (`GRADE_OVERRIDE`) as a mandatory audit event. Without this log, there is no traceability for who overrode a grade, when, or what the previous value was. This violates the system's audit requirements and makes any grade dispute impossible to investigate.
- **Expected:** After a successful `quickGradeOverride()`, the service must call `this.auditLogService.log({ action: AuditAction.GRADE_OVERRIDE, entityType: 'TestResult', entityId: result.id, actorId: teacherId, oldValue: { calculatedGrade }, newValue: { gradeOverride: dto.gradeOverride } })`.
- **Status:** OPEN

---

### BUG-033 — HIGH: Physical `left-[50%]` Tailwind Class in Dialog Positioning (RTL Violation)

- **Severity:** HIGH
- **Category:** UI / RTL
- **File:** `apps/web/app/(teacher)/classes/[classId]/page.tsx:1797`
- **Description:** The AI Control Center dialog uses `className="fixed left-[50%] top-[50%] ..."` on `<DialogContent>`. `left-[50%]` is a physical directional Tailwind class, banned in this RTL codebase per `CLAUDE.md` and `web-frontend.md`. In an RTL context (`dir="rtl"`), physical `left` positions from the visual right side of the viewport, so the centering arithmetic (`translate-x-[-50%]`) may still appear visually correct in modern browsers — but this is a fragile coincidence, not a correct implementation. The correct approach uses logical CSS (`inset-inline-start`) or Tailwind's `start-1/2`.
- **Expected:** Replace `left-[50%]` with `start-1/2` (Tailwind logical class). The full correction: `className="fixed start-1/2 top-1/2 z-[9999] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 ..."`.
- **Status:** OPEN

---

### BUG-034 — MEDIUM: No Student Removal Endpoint — Cannot Unenroll a Student

- **Severity:** MEDIUM
- **Category:** LOGIC / MISSING FEATURE
- **File:** `apps/api/src/classes/classes.controller.ts` (no DELETE endpoint exists)
- **Description:** `ClassesController` has no `DELETE /classes/:id/students/:studentId` endpoint. `StudentsController` and `StudentsService` have no `removeStudent` or `unenrollStudent` method. Once a student is added to a class, there is no API-level mechanism to remove them. The `classes-qa` agent spec explicitly tests this flow. Practically: if a student transfers classes or is added by mistake, the teacher has no way to correct the roster other than direct database manipulation.
- **Expected:** A `DELETE /classes/:classId/students/:studentId` endpoint guarded by `@Roles('TEACHER')`, with class ownership verification and an `AuditLogService.log({ action: AuditAction.STUDENT_REMOVED, ... })` call. The removal should be a hard delete of the `ClassEnrollment` row (or a soft delete with `removedAt` if historical data must be preserved).
- **Status:** OPEN

---

## Functional QA Batch 1 — Audit Summary

| Domain | Agent | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| Auth | auth-qa | 0 | 1 (BUG-030) | 0 | 0 |
| Dashboard | dashboard-qa | 0 | 1 (BUG-031) | 0 | 0 |
| Classes | classes-qa | 0 | 2 (BUG-032, BUG-033) | 1 (BUG-034) | 0 |

### Auth — Passed Checks
- ✅ AppModule: Both `JwtAuthGuard` and `RolesGuard` registered as `APP_GUARD` in correct order
- ✅ `@Public()` coverage: All auth routes (`/google`, `/google/callback`, `/student`, `/refresh`, `/logout`, `/exchange`, `/dev-login`) correctly marked
- ✅ JWT secrets: Loaded from `ConfigService.getOrThrow()`, never hardcoded
- ✅ Student data isolation: `StudentsController` carries `@Roles('TEACHER')` at class level — students cannot reach any student-data endpoint
- ✅ Web layout guard: `useEffect` token check redirects to `/login`; loading skeleton prevents teacher content flash
- ✅ Mobile layout guard: Synchronous `getAccessToken()` check in `_layout.tsx` redirects to `/login`

### Dashboard — Passed Checks
- ✅ Loading skeleton: `DashboardSkeleton` component renders during `statsLoading`
- ✅ SWR pattern: `useDashboardStats` uses SWR with correct cache/dedup config
- ✅ Hebrew labels: All user-facing strings in Hebrew
- ✅ `getHebrewGradeLabel()` imported and used correctly where grades are rendered

### Classes — Passed Checks
- ✅ `passwordHash` never in select: students.repository.ts selects only safe fields
- ✅ Class ownership: `findOneByIdAndTeacher` correctly enforces `teacherId` match with `ForbiddenException`
- ✅ Teacher-only routes: `ClassesController` and `StudentsController` both carry `@Roles('TEACHER')` at class level
- ✅ Join code generation: Collision-safe retry loop with `JOIN_CODE_MAX_ATTEMPTS = 3`

---

## Functional QA Batch 2 — 2026-04-13

### Agents: attendance-qa · grading-qa · lesson-planner-qa

---

### BUG-035 — CRITICAL: ~~Student Age Computed Using Today's Date, Not Session Date~~

- **Severity:** CRITICAL
- **Category:** GRADING — Reproducibility / Correctness
- **File:** `apps/api/src/grading/grading.service.ts:35`
- **Description:** `GradingService.calculateGrade()` computes the student's age with `this.computeAge(student.dateOfBirth, new Date())` — using the current wall-clock date instead of the date the test session was conducted. The Ministry norm tables are age-banded (e.g., 12–14, 14–15, 15–18). A student who turned 15 in March will be graded under 15-year-old norms for a test conducted in January (when they were 14). Grades are non-reproducible: re-running the same result calculation one year later will produce a different score. This silently drifts every grade for every student who crosses an age boundary between test date and review date.
- **Expected:** `calculateGrade()` must accept a `sessionDate: Date` parameter and pass it to `computeAge(student.dateOfBirth, sessionDate)`. The caller in `tests.service.ts` (`submitResult`, line 176) must fetch `session.conductedAt` and pass it through.
- **Status:** FIXED
- **Fix applied:** Added `sessionDate: Date` param to `calculateGrade()`; replaced `new Date()` with `sessionDate` in `computeAge()` call. Updated `findSessionWithOwnership` to return `conductedAt`, destructured and passed it in `tests.service.ts`. Fixed `dobForAge` helper in spec to use a fixed `SESSION_DATE` and passed it to all 5 `calculateGrade` test calls.

---

### BUG-036 — HIGH: ~~GradingService Has No PASS_FAIL Branch — Silent Failure Risk~~

- **Severity:** HIGH
- **Category:** GRADING — Missing Logic Branch
- **File:** `apps/api/src/grading/grading.service.ts:28-60`
- **Description:** `GradingService.calculateGrade()` routes all test types — including `PASS_FAIL` — through the same norm table lookup (`findNormRow`). There is no `if (testType.inputType === 'PASS_FAIL')` early-return branch. PASS_FAIL tests do not have a meaningful continuous raw value; they use `rawValue: 0` (fail) or `rawValue: 1` (pass). If the seed data does not include norm table rows for PASS_FAIL test types, every PASS_FAIL submission throws `NotFoundException` silently preventing the grade from being saved. The service signature does not even receive `inputType`, making the absence of a branch an architectural gap.
- **Expected:** Add an early-return branch: `if (testType.inputType === 'PASS_FAIL') { return dto.rawValue > 0 ? 100 : 0; }`. The `testType` must be fetched before calling `calculateGrade` (or the method signature extended), so the branch can execute before the norm table query.
- **Status:** FIXED
- **Fix applied:** Added `findTestTypeInputType()` to `GradingRepository`; `calculateGrade()` now fetches `inputType` first and short-circuits for `PASS_FAIL` (rawValue ≥ 1 → 100, else 0) without touching norm tables or student data. Added 2 PASS_FAIL unit tests to spec.

---

### BUG-037 — HIGH: Raw Grade Integers Rendered Directly in UI (Multiple Locations)

- **Severity:** HIGH
- **Category:** GRADING — Display / CLAUDE.md Rule Violation
- **File:** (6 locations — see below)
- **Description:** CLAUDE.md rule: "Grade scores (0–100 Int) are NEVER rendered directly as grade labels. Always pass through `getHebrewGradeLabel(score)`." The following components render raw integer grades without this wrapper:
  1. `apps/web/app/(teacher)/dashboard/page.tsx:2029` — `{item.score}` (top-achievements widget)
  2. `apps/web/app/(teacher)/classes/[classId]/page.tsx:1254` — `{entry.score}` (class details)
  3. `apps/web/app/(teacher)/classes/[classId]/lesson/page.tsx:866` — `{slot.calculatedGrade}` (live lesson grade cell)
  4. `apps/web/components/beep-test/beep-test-summary.tsx:361` — `{row.calculatedGrade}` (beep test summary)
  5. `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:783` — `{entry.calculatedGrade}` (stopwatch result row)
  6. `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/manual/page.tsx:531` — `{slot.calculatedGrade}` (manual entry grade cell)
- **Expected:** Every grade display must use `getHebrewGradeLabel(score)` from `@fitgrade/types`, rendering Hebrew labels ("מצטיין", "טוב מאוד", "טוב", "עובר", "נכשל") instead of raw integers.
- **Status:** OPEN

---

### BUG-038 — HIGH: ~~EXCUSED Attendance Counted in Denominator — Artificially Lowers Attendance %~~

- **Severity:** HIGH
- **Category:** ATTENDANCE — Incorrect Business Logic
- **File:** `apps/api/src/classes/classes.repository.ts:145`, `apps/api/src/students/students.repository.ts:242`, `apps/api/src/students/students.service.ts:288`
- **Description:** In all three places where attendance percentage is computed, EXCUSED records are included in the denominator. `classes.repository.ts:145`: `attendanceTotal = count(ALL statuses)`. `students.repository.ts:242`: same pattern. `students.service.ts:288`: `total = present + absent + excused` → `pct = present / total`. A student with 10 PRESENT and 5 EXCUSED records shows 67% attendance instead of 100%. Spec: EXCUSED students have a legitimate exemption and must NOT count against attendance.
- **Expected:** Denominator must exclude EXCUSED: `denominator = count(WHERE status IN ('PRESENT', 'ABSENT'))`. In `students.service.ts` fix: `const total = present + absent` (remove `excused` from sum). Fix all three locations consistently.
- **Status:** FIXED
- **Fix applied:** `classes.repository.ts:145` — added `status: { not: 'EXCUSED' }` to total count query. `students.repository.ts:242` — same filter. `students.service.ts:288` — changed `total = present + absent + excused` to `total = present + absent`.

---

## Functional QA Batch 2 — Audit Summary

| Domain | Agent | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| Attendance | attendance-qa | 0 | 1 (BUG-038) | 0 | 0 |
| Grading | grading-qa | 1 (BUG-035) | 2 (BUG-036, BUG-037) | 0 | 0 |
| Lesson Planner | lesson-planner-qa | 0 | 0 | 0 | 0 |

### Attendance — Passed Checks
- ✅ Schema: `@@unique([classId, studentId, date])` exists on `AttendanceRecord`
- ✅ Upsert pattern: `AttendanceRepository.upsertMany()` uses Prisma `upsert` in `$transaction()`
- ✅ Audit log: `AuditLogService.log({ action: AuditAction.ATTENDANCE_CHANGE })` called for every record
- ✅ Date validation: `parseDate()` throws `BadRequestException` on invalid date string
- ✅ Injury toggle: lesson page calls `status: 'EXCUSED'` on toggle ON, `'PRESENT'` on toggle OFF
- ✅ `exemptionReason` required when EXCUSED: `@ValidateIf` enforces this in `AttendanceEntryDto`
- ✅ RTL: no banned Tailwind classes in attendance UI

### Grading — Passed Checks
- ✅ `getHebrewGradeLabel()` covers all 0–100 values; thresholds match spec (90/75/60/55)
- ✅ Grade override audit: `tests.service.ts:overrideGrade()` calls `AuditAction.GRADE_OVERRIDE`
- ✅ Norm row boundaries: `minValue ≤ rawValue < maxValue` (inclusive lower, exclusive upper)
- ✅ Single grade calculator: no inline grade math found outside `grading.service.ts`
- ✅ `effectiveGrade` derived (`gradeOverride ?? calculatedGrade`), not stored as DB column

### Lesson Planner — Passed Checks
- ✅ No stale variable references — `lessonKey` stale variable previously resolved
- ✅ `animKey` incremented before `setLesson()` in `handleGenerate` (line 617)
- ✅ `generateLesson()` handles all 10 goals × 3 difficulties with `'all'`-goal fallback pool
- ✅ Default values initialized at component mount — generate cannot fire with null/undefined goal
- ✅ Fully Hebrew: all labels, goal names, phase names, exercise names, difficulty labels
- ✅ RTL: no banned Tailwind classes found in exercise bank
- ✅ No API calls — entirely client-side; no loading/error state concerns

---

## Functional QA Batch 3 — 2026-04-14T00:00:00Z

Agents run: `beep-test-qa`, `live-test-qa`, `sprint-test-qa`
Continuing from BUG-038.

---

### BUG-039 — HIGH: Mobile Undo Does Not Delete Result from Server

- **Severity:** HIGH
- **Category:** LIVE TEST — Data Integrity
- **File:** `apps/mobile/app/(teacher)/session/[sessionId].tsx:180-195`
- **Description:** The `handleUndo` function in the mobile stopwatch session screen only removes the tapped entry from local React state (`setTapped(prev => prev.filter(...))`). It never calls `DELETE /api/results/:resultId`. The `entry.resultId` field is stored in `TappedEntry` but is never used in the undo path. As a result, when a teacher undoes a tap on mobile, the result appears removed on their screen but the database still contains the record. The student will receive a grade based on a result the teacher believed was cancelled.
- **Expected:** `handleUndo` must call `DELETE /sessions/${sessionId}/results/${entry.resultId}` (or equivalent) before removing from local state, and revert the optimistic local removal if the DELETE fails. Compare the correct implementation in the web live session (`apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/live/page.tsx:412-415`).
- **Status:** OPEN

---

### BUG-040 — MEDIUM: Sprint rawValue Sent as String (toFixed Returns String)

- **Severity:** MEDIUM
- **Category:** SPRINT — API Contract
- **File:** `apps/web/components/sprint/SprintHeatMode.tsx:713`
- **Description:** Sprint result submission uses `rawValue: (ms / 1000).toFixed(2)`. `Number.prototype.toFixed()` returns a **string** (e.g., `"8.50"`), not a number. The JSON payload becomes `{ "rawValue": "8.50" }` with a string value. If the backend DTO has `@IsNumber()` without `@Type(() => Number)` on `rawValue`, the `ValidationPipe` will reject it with a 400. Even if `@Type(() => Number)` is present for coercion, relying on implicit coercion for a safety-critical field is fragile.
- **Expected:** Use `rawValue: ms / 1000` (plain division yields a number) or explicitly `rawValue: parseFloat((ms / 1000).toFixed(2))` to send a numeric JSON value.
- **Status:** OPEN

---

### BUG-041 — MEDIUM: Beep Test rawValue Uses Non-Standard level.shuttle Encoding

- **Severity:** MEDIUM
- **Category:** BEEP TEST — Data Representation
- **File:** `apps/web/components/beep-test/beep-test-summary.tsx:71-72`
- **Description:** The beep test rawValue is computed as `eliminatedAt.level + eliminatedAt.shuttle * 0.1` (e.g., level 8 shuttle 3 → `8.3`). This is an opaque decimal encoding, not the internationally recognised 20m PACER measurement (total distance in meters or total shuttles completed). The norm table is seeded with integer level anchors (e.g., `9.0`, `11.0`) which happens to be consistent with this encoding, but any future norm table update assuming standard units would produce completely wrong grades. Additionally, two students at different shuttle counts within the same level (e.g., 8.3 vs 8.7) may land in the same norm band and receive the same grade despite meaningfully different performance.
- **Expected:** Store rawValue as total shuttles completed (cumulative across all levels) or total distance in meters, consistent with FITNESSGRAM/PACER standard. The norm table should be re-seeded with the corresponding unit. This ensures compatibility with external references and more granular grading within a level.
- **Status:** OPEN

---

## Functional QA Batch 3 — Audit Summary

| Domain | Agent | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| Live Test (Stopwatch) | live-test-qa | 0 | 1 (BUG-039) | 0 | 0 |
| Sprint Test | sprint-test-qa | 0 | 0 | 1 (BUG-040) | 0 |
| Beep Test | beep-test-qa | 0 | 0 | 1 (BUG-041) | 0 |

### Beep Test — Passed Checks
- ✅ PACER level data matches standard 20m PACER protocol (Level 1=7 shuttles, Level 2=8, speed increments at 0.5 km/h per level)
- ✅ GradingService called with the computed rawValue (not raw level number directly)
- ✅ HUD timer driven by RAF callbacks + DOM ref `.textContent` — zero React re-renders during test
- ✅ RTL: no banned Tailwind classes in beep test components
- ✅ Grade label: `getHebrewGradeLabel()` called alongside numeric grade in summary (line 364)
- ✅ 'use client' directive present on all beep test components
- ✅ Input (start level) validated: bounded to `BEEP_TEST_LEVELS` array (1–21)

### Live Test — Passed Checks
- ✅ Mobile: `startedAt` comes from server response (`session.startedAt` passed as route param from class screen)
- ✅ Mobile: Timer uses `Date.now() - startedAtMs.current` math (not counter-based, no drift)
- ✅ Mobile: 409 detected via `firstErr instanceof ApiError && firstErr.statusCode === 409`; correct handling (Alert + error haptic, no retry, no MMKV queue)
- ✅ Mobile: `import { ApiError }` (value import, not `import type`) — instanceof check works correctly
- ✅ Mobile: Network failure path retries once after 2 seconds, then enqueues to MMKV + shows visual error row
- ✅ Mobile: MMKV queue flushed via `useOfflineQueueFlush()` in `_layout.tsx` (runs on mount and network reconnect)
- ✅ Mobile: Haptics correct — `impactAsync(Medium)` on tap, `notificationAsync(Error)` on 409 and network failure
- ✅ Web: RAF + DOM ref timer (`timerDisplayRef.current.textContent = formatElapsed(...)`) — zero re-renders
- ✅ Web: Tap button disabled via `disabled={!isActive}` (isActive = timerState === 'running'); optimistic removal from pendingIds prevents double-submission
- ✅ Web: Undo correctly calls `DELETE /sessions/${sessionId}/results/${studentId}` and reverts on failure

### Sprint Test — Passed Checks
- ✅ SprintHeatMode uses `performance.now()` for timing — no drift, no setInterval
- ✅ RAF loop updates DOM span refs directly — zero React re-renders while race is active
- ✅ 60m sprint (`sprint60`) and 4×10m shuttle (`shuttle4x10`) have separate testKeys and separate norm tables
- ✅ Norm config has gender-separated rows (MALE/FEMALE) and per-age-group rows for both sprint types
- ✅ Sprint results displayed as `SS.cc` format (not raw decimal seconds)
- ✅ Mobile sprint uses `StopwatchMode` (TIME inputType) — correct tap-based recording, not a reps input
- ✅ RTL: no banned Tailwind classes in sprint components

---

## Functional QA Batch 4 — 2026-04-14T00:00:00Z

Agents run: `long-distance-qa`, `student-profile-qa`, `reports-qa`
Continuing from BUG-041.

---

### BUG-042 — HIGH: Long-Distance rawValue Sent as String (toFixed Returns String)

- **Severity:** HIGH
- **Category:** LONG DISTANCE — API Contract
- **File:** `apps/web/app/(teacher)/classes/[classId]/session/[sessionId]/long-distance/page.tsx:444`
- **Description:** The `handleSave` function submits results via `rawValue: (ms / 1000).toFixed(2)`. `Number.prototype.toFixed()` returns a **string** (e.g., `"95.34"`), not a number. The JSON payload becomes `{ "rawValue": "95.34" }`. If the backend `SubmitResultDto` has `@IsNumber()` on `rawValue`, the `ValidationPipe` will reject the request with 400 Bad Request, and **no distance run result will be saved** for any student in the race. This is the same class of bug as BUG-040 (sprint) but affects a different file and a different test type. Severity raised to HIGH because the long-distance run is a primary test type (2000m, 1500m) with no fallback re-entry in the same session.
- **Expected:** Change to `rawValue: ms / 1000` (plain division yields a number) or `rawValue: parseFloat((ms / 1000).toFixed(2))`.
- **Status:** OPEN

---

### BUG-043 — HIGH: Raw Grade Integer Rendered in Student Report Badge

- **Severity:** HIGH
- **Category:** PROFILE — Grade Display / CLAUDE.md Rule Violation
- **File:** `apps/web/app/(teacher)/classes/[classId]/students/[studentId]/report/page.tsx:652`
- **Description:** The per-test grade badge renders `{result.grade}` (a raw 0–100 integer) as its label. The `gradeStyle(score)` helper at line 64 computes a `label` field (`'מצטיין'`, `'טוב מאוד'`, etc.) identical to `getHebrewGradeLabel()`, but this label is **never rendered** — only the numeric `result.grade` is rendered inside the badge span. CLAUDE.md rule: "Grade scores (0–100 Int) are NEVER rendered directly as grade labels." This file is not covered by BUG-037 which lists six other locations.
- **Expected:** Replace `{result.grade}` with `{getHebrewGradeLabel(result.grade)}` (or equivalently `{gs.label}` since `gradeStyle` already computes the correct Hebrew string).
- **Status:** OPEN

---

### BUG-044 — HIGH: Reports Page Renders Raw Grade Integers in Three Summary Columns

- **Severity:** HIGH
- **Category:** REPORTS — Grade Display / CLAUDE.md Rule Violation
- **File:** `apps/web/app/(teacher)/reports/page.tsx:459,464,469`
- **Description:** The class report table renders three grade columns as raw 0–100 integers with no Hebrew grade label wrapper: (1) line 459 — `{row.fitnessAvg > 0 ? row.fitnessAvg : '—'}` (fitness average column); (2) line 464 — `{row.conductScore > 0 ? row.conductScore : '—'}` (conduct score column); (3) line 469 — `{row.recommendedFinalGrade}` (recommended final grade column). `getHebrewGradeLabel` is not imported anywhere in `reports/page.tsx`. CLAUDE.md rule: "Grade scores (0–100 Int) are NEVER rendered directly as grade labels." These columns are not covered by BUG-037.
- **Expected:** Import `getHebrewGradeLabel` from `@fitgrade/types` and render Hebrew labels alongside (or instead of) raw numbers for the three grade columns. The raw number can remain in the editable `<Input>` fields where teachers type numeric grades — that is a data entry context, not a grade label context.
- **Status:** OPEN

---

### BUG-045 — MEDIUM: Server-Side Excel/PDF Export Not Implemented — Only Client-Side CSV

- **Severity:** MEDIUM
- **Category:** REPORTS — Missing Feature / Tech Stack Violation
- **File:** `apps/api/src/` (no exports module exists)
- **Description:** CLAUDE.md mandates `xlsx` (Excel) and `pdfkit` (PDF) as the export libraries. The reports page implements a client-side CSV download (`downloadCSV` / `downloadFullYearCSV` in `reports/page.tsx:217-286`) but there is no `apps/api/src/exports/` module, no server-side route `GET /api/exports/excel/:classId` or `GET /api/exports/pdf/:classId`, and neither `xlsx` nor `pdfkit` is used anywhere in the API. The current CSV export has correct Hebrew headers and BOM prefix for Excel compatibility, but it is: (a) a CSV not a native `.xlsx` file (no cell formatting, no column widths, no formulas); (b) entirely client-side with no server-side auth check — any XHR from a browser extension could trigger a download of in-memory report data; (c) missing PDF altogether (required for printing official student reports).
- **Expected:** Implement `apps/api/src/exports/exports.controller.ts` and `exports.service.ts` with: `GET /exports/excel/:classId` streaming a real `.xlsx` file (Hebrew column headers, one row per student, correct `Content-Type` and `Content-Disposition` headers); `GET /exports/pdf/:classId` streaming a PDF with RTL text direction and a Hebrew-supporting font via pdfkit.
- **Status:** OPEN

---

## Functional QA Batch 4 — Audit Summary

| Domain | Agent | Critical | High | Medium | Low |
|--------|-------|----------|------|--------|-----|
| Long Distance | long-distance-qa | 0 | 1 (BUG-042) | 0 | 0 |
| Student Profile | student-profile-qa | 0 | 1 (BUG-043) | 0 | 0 |
| Reports | reports-qa | 0 | 2 (BUG-044) | 1 (BUG-045) | 0 |

### Long Distance — Passed Checks
- ✅ Separate testKeys and norm tables for each distance: `run300`, `run600`, `run1000`, `run1500`, `run2000`
- ✅ All distance norms: `higherIsBetter: false` (lower time = higher grade) ✅
- ✅ Gender-separated norms: MALE and FEMALE rows for every age group in every distance
- ✅ No age gaps within any single distance norm table (each covers a contiguous age range)
- ✅ Timer: RAF loop + DOM ref (`timerDisplayRef.current.textContent = formatTimer(...)`) — zero React re-renders during race
- ✅ Time display: `formatTimer()` renders `MM:SS.cc` — not raw decimal seconds
- ✅ Tap-based timing (not free-text input) — negative/zero times impossible by design
- ✅ RTL: no banned Tailwind classes in long-distance page

### Student Profile — Passed Checks
- ✅ Teacher access: `verifyClassOwnership(classId, teacherId)` + `verifyStudentInClass(studentId, classId)` called before any data is returned
- ✅ `passwordHash` excluded: `STUDENT_SELECT` constant (students.repository.ts) never includes `passwordHash`
- ✅ `effectiveGrade = gradeOverride ?? calculatedGrade` correctly used in both service methods
- ✅ Gender shown as Hebrew: `GENDER_LABELS` map `{ MALE: 'זכר', FEMALE: 'נקבה' }` (report/page.tsx:57-61)
- ✅ Date of birth shown as DD/MM/YYYY: `formatDate()` at report/page.tsx:84-87 ✅
- ✅ RTL: no banned Tailwind classes in student report page
- ✅ `getHebrewGradeLabel()` used for recommended final grade card (report/page.tsx:522)
- ✅ Attendance breakdown shows present, absent, excused counts as separate fields
- Note: Attendance pct formula bug (excused in denominator) already captured in BUG-038

### Reports — Passed Checks
- ✅ Class ownership: `ReportsRepository.verifyClassOwnership(classId, teacherId)` called in both service methods — ForbiddenException thrown if `cls.teacherId !== teacherId`
- ✅ `effectiveGrade` resolved correctly in `ReportsRepository.findAllTestResults()`: `gradeOverride ?? calculatedGrade ?? 0`
- ✅ Semester filter: `useSemester()` context drives `semesterFilter` applied to test results and attendance queries
- ✅ CSV export has Hebrew column headers with UTF-8 BOM for Excel compatibility
- ✅ No `passwordHash` in CSV export fields
- ✅ RTL: no banned Tailwind classes in reports page

---

## Functional QA Batch 5 — 2026-04-14T12:00:00Z

Agents run: `schedule-qa`, `settings-qa`, `analytics-qa`

---

### BUG-046 — HIGH: Schedule Period 16 Has Incorrect 15-Minute Duration

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/schedule/page.tsx:47`
- **Description:** Period 16 is defined with time `'19:45–20:00'` — a 15-minute slot. All other 15 periods span 45 minutes. This is a data entry error in the `PERIODS` constant.
- **Expected:** Period 16 should span a full 45-minute block consistent with all other periods (e.g., `'19:45–20:30'`).
- **Status:** OPEN

---

### BUG-047 — HIGH: Schedule Grid Day Columns Render Left-to-Right in RTL Context

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/schedule/page.tsx:362`
- **Description:** The grid uses `gridTemplateColumns: '5.5rem repeat(5, 1fr)'` and iterates `DAYS` in index order (ראשון first = leftmost column). CSS Grid with explicit `gridTemplateColumns` does NOT automatically reverse column order based on `dir="rtl"`. In a proper Hebrew RTL timetable, ראשון (Sunday) must appear as the rightmost column and חמישי (Thursday) as the leftmost.
- **Expected:** Day columns should flow right-to-left. Fix by either reversing the `DAYS` array render order or applying `direction: rtl` directly on the grid element so column placement reverses.
- **Status:** OPEN

---

### BUG-048 — MEDIUM: `overrideReason` Field Missing from `QuickGradeOverrideDto`

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/classes/dto/quick-grade-override.dto.ts:1`
- **Description:** The DTO only contains `testTypeId` and `gradeOverride`. The `overrideReason` field is absent entirely. The `TestResult` schema defines `overrideReason String?` as a companion field, and audit rules require reason capture for `GRADE_OVERRIDE` actions.
- **Expected:** A required `@IsString() @MinLength(1) overrideReason: string` field (or optional with documented justification) should be present so override reasons are captured and stored.
- **Status:** OPEN

---

### BUG-049 — MEDIUM: No Cross-Field Sum Validation in `UpdateClassWeightsDto`

- **Severity:** MEDIUM
- **Category:** LOGIC
- **File:** `apps/api/src/classes/dto/update-class-weights.dto.ts:1`
- **Description:** Per-field `@Min(0)` / `@Max(100)` exist, but there is no cross-field constraint enforcing `testWeight + talmidautWeight === 100`. The sum check is deferred entirely to the service layer. The `ValidationPipe` with `whitelist: true` cannot catch this at the DTO boundary.
- **Expected:** A class-level `@ValidatorConstraint` or `@ValidateIf`-based custom validator should enforce that when both weights are non-null, they sum to 100.
- **Status:** OPEN

---

### BUG-050 — HIGH: Grading Policy Mutations Show No Hebrew Toast on Error

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/hooks/use-grading-policy.ts:22`
- **Description:** `updateGradingPolicy()` and `updateClassGradingPolicy()` return/throw without any toast or error notification. The web rules require a Hebrew `<Toast>` on every API error. `updateClassGradingPolicy()` has no error handling at the hook level — callers receive a raw rejected Promise with no guidance.
- **Expected:** API errors from both mutation functions must trigger a shadcn/ui Hebrew `<Toast>` with a user-readable message.
- **Status:** OPEN

---

### BUG-051 — MEDIUM: Report Settings Load Failure Is Silent

- **Severity:** MEDIUM
- **Category:** UI
- **File:** `apps/web/hooks/use-grading-policy.ts:14`
- **Description:** If the report settings fetch fails, the form silently stays at its `defaultValues` (passingGrade=60, empty strings) with no indication to the teacher that settings could not be loaded. The hook exposes an `error` field but the settings page does not surface it for report settings.
- **Expected:** A visible Hebrew error message should be shown when report settings fail to load, preventing the teacher from unknowingly saving defaults over their actual settings.
- **Status:** OPEN

---

### BUG-052 — HIGH: Physical `left` CSS Property in `WeightSlider` Divider (RTL Bug)

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/components/ui/weight-slider.tsx:74`
- **Description:** The divider between weight segments uses `style={{ left: \`${fitnessWeight}%\` }}` — a physical CSS property banned by the project RTL rules. In an RTL context (`dir="rtl"` on the parent), `left` does not flip; it anchors to the physical left edge, so the divider appears at the wrong location.
- **Expected:** Replace `left` with the logical CSS property `insetInlineStart` (e.g., `style={{ insetInlineStart: \`${fitnessWeight}%\` }}`).
- **Status:** OPEN

---

### BUG-053 — HIGH: `@IsUrl()` on `schoolLogoUrl` Rejects Valid `data:` URIs

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/settings/dto/report-settings.dto.ts:50`
- **Description:** `schoolLogoUrl` is decorated with `@IsUrl()` which by default only accepts `http://` and `https://` URLs. The companion `teacherSignature` field (used in the same PDF export context) stores Base64 `data:image/png;base64,...` strings without restriction. If a teacher uploads a logo as a data URI, the validator rejects it with 400, creating an inconsistency.
- **Expected:** `schoolLogoUrl` should use `@IsUrl({ require_tld: false, protocols: ['http', 'https', 'data'] })` or a custom validator that allows both HTTP URLs and `data:image/*;base64,...` strings, consistent with `teacherSignature` handling.
- **Status:** OPEN

---

### BUG-054 — HIGH: Raw Integer Grade Rendered in Leaderboard Rank Rows Without `getHebrewGradeLabel()`

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/app/(teacher)/outstanding-students/page.tsx:206`
- **Description:** The `RankRow` component (rank 4 and below) renders `{avgGrade}` — a raw 0–100 integer — directly in the grade badge. `PodiumCard` (rank 1–3) correctly uses `getHebrewGradeLabel(avgGrade)`, but rank rows (the majority of the leaderboard) violate the project rule that grade scores must never be rendered directly.
- **Expected:** The `RankRow` grade badge should show `getHebrewGradeLabel(avgGrade)` (e.g., "מצטיין", "טוב") instead of the raw integer.
- **Status:** OPEN

---

### BUG-055 — HIGH: Dashboard Fitness Average Includes Null-Grade Results Counted as Zero

- **Severity:** HIGH
- **Category:** LOGIC
- **File:** `apps/api/src/dashboard/dashboard.repository.ts:150`
- **Description:** `findResultsForTeacher()` has no `where: { calculatedGrade: { not: null } }` filter. Line 150 converts null grades to 0 with `?? 0`. These zero-grade records are included in `DashboardService.getStats()` fitness average denominator (`rawResults.length`), artificially lowering the reported averages for students who have a result row but no calculated grade yet.
- **Expected:** Add `calculatedGrade: { not: null }` to the Prisma `where` clause in `findResultsForTeacher`, consistent with `findTopStudents` and `findMonthlyClassAverages` which already exclude null-grade rows.
- **Status:** OPEN

---

### BUG-056 — HIGH: Physical `paddingLeft`/`paddingRight`/`marginLeft` in `TopResultsTicker` Inline Styles

- **Severity:** HIGH
- **Category:** UI
- **File:** `apps/web/components/ui/top-results-ticker.tsx:144,145,174,175,225`
- **Description:** The ticker strip uses physical `paddingLeft`, `paddingRight`, and `marginLeft` in JavaScript `style` objects, violating the project's RTL ban on physical directional properties. In RTL, `paddingLeft` means "padding at the end," causing visually asymmetric spacing.
  - Lines 144–145: `paddingLeft: 28, paddingRight: 28`
  - Lines 174–175: `paddingLeft: 16, paddingRight: 16`
  - Line 225: `marginLeft: 12`
- **Expected:** Use logical CSS properties: `paddingInlineStart`/`paddingInlineEnd` and `marginInlineStart` (or `paddingInline: 16` for symmetric cases).
- **Status:** OPEN

---

## Enrollment & Import QA — 2026-04-19T20:03:00Z

### Audit Scope
Static analysis of `apps/api/src/students/students.repository.ts`, `students.service.ts`, `dto/import-students.dto.ts`, `dto/create-student.dto.ts`, and `packages/types/src/schemas.ts`. Live API tests against http://localhost:3001. E2E test suite `test/enrollment-import.e2e-spec.ts`.

---

### [HIGH] ENROLL-001: `000000000` All-Zeros National ID Passes Luhn Validation and Is Enrolled as Real Student

**Severity:** HIGH
**Area:** validation
**File:** `apps/api/src/students/students.service.ts:isValidIsraeliId`
**Status:** FALSE POSITIVE — CLOSED
**Resolution:** `000000000` is mathematically Luhn-valid: sum of all zero digits = 0, and 0 % 10 = 0. The application code is correct. The E2E test `T3.7` was using the wrong fixture (`INVALID_LUHN = '000000000'`). Fixed in `enrollment-import.e2e-spec.ts` — replaced with `'123456789'` (sum=47, genuinely Luhn-invalid).

---

### [HIGH] ENROLL-002: Excel Import Accepts Luhn-Invalid Rows When the Conflicting Student Already Exists — `errors[]` Is Empty Instead of Populated

**Severity:** HIGH
**Area:** import | validation
**File:** `apps/api/src/students/students.service.ts:importFromFile` + `apps/api/src/students/students.repository.ts:importStudents`
**Status:** FALSE POSITIVE — CLOSED
**Resolution:** Same root cause as ENROLL-001. `000000000` is Luhn-valid (sum=0), so it correctly passes into `validRows`, not `errors[]`. The test T2.2 used the wrong fixture. Fixed alongside ENROLL-001 — both tests now use `'123456789'` as the Luhn-invalid ID.

---

### [LOW] ENROLL-003: `CreateStudentInput` Interface in `students.repository.ts` Declares `nationalId` as Optional — Allows Enroll Without ID at Repository Layer

**Severity:** LOW
**Area:** validation
**File:** `apps/api/src/students/students.repository.ts:107` (`CreateStudentInput.nationalId?: string`)
**Repro:**
1. Inspect `CreateStudentInput` interface: `nationalId?: string` — optional
2. The service enforces nationalId via the DTO, but any future code path calling `enrollStudent()` directly (e.g., a new controller, a migration script) can omit it without a compile error

**Expected:** `nationalId` should be required at the repository interface level (`nationalId: string`), consistent with the DTO's non-optional `@Matches` requirement.
**Actual:** `nationalId?: string` — silently optional, inconsistent with DTO contract
**Status:** FIXED
**Resolution:** Removed `?` from `CreateStudentInput.nationalId` in `students.repository.ts:112`. Simplified `addStudentToClass` in `students.service.ts` — eliminated the `string | undefined` branch since the DTO guarantees presence. TypeScript compiles clean (`tsc --noEmit` 0 errors). All 23 E2E tests pass.

---

### [LOW] ENROLL-004: `re-enrollment path` (existing student, new class) Not Wrapped in `$transaction` — Partial Write Possible

**Severity:** LOW
**Area:** enrollment
**File:** `apps/api/src/students/students.repository.ts:enrollStudent` (lines 554–568)
**Repro:**
1. Enroll a student who already exists in DB (known `nationalId`) into a new class
2. `classEnrollment.create()` succeeds but the subsequent `student.findUniqueOrThrow()` read fails (e.g., network blip, statement timeout)
3. The enrollment row is already committed; the 500 response leaves the caller unaware of the successful enrollment

**Expected:** The re-enrollment branch (`classEnrollment.create` + `student.findUniqueOrThrow`) should be wrapped in a `$transaction` or the read should be inlined in the create's `include` so both complete atomically.
**Actual:** Two sequential unguarded Prisma calls outside any transaction
**Status:** FIXED
**Fix applied:** Wrapped the re-enrollment path (`classEnrollment.create` + `student.findUniqueOrThrow`) in a `$transaction` in `students.repository.ts:enrollStudent`.

---

### Enrollment & Import — Passed Checks
- PASS: `nationalId` has no `@IsOptional()` in `CreateStudentDto` — required at DTO layer
- PASS: `@Matches(/^\d{1,9}$/)` regex enforces numeric-only pattern in DTO
- PASS: `@Matches` message is in Hebrew ("תעודת זהות חייבת להכיל ספרות בלבד (עד 9)")
- PASS: `nationalId` in `createStudentSchema` (packages/types) has no `.optional()` call
- PASS: `createStudentSchema` uses `required_error: 'תעודת זהות חובה'` in Hebrew
- PASS: `enrollStudent` uses `findUnique({ where: { nationalId } })` — no raw SQL
- PASS: 409 branch checks `classEnrollment` existence before throwing (`findUnique` → `if enrollment !== null → throw ConflictException`)
- PASS: Re-enrollment branch uses `classEnrollment.create` WITHOUT `student.create` — no duplicate Student row
- PASS: New-student path wraps `student.create` + `classEnrollment.create` inside `$transaction`
- PASS: P2002 catch block exists as safety net in the new-student path
- PASS: `importFromFile` applies Luhn validation per-row (`isValidIsraeliId` called in loop)
- PASS: Missing required columns (nationalId, firstName, lastName) throw `BadRequestException` with Hebrew message
- PASS: Invalid Luhn in import adds row to `errors[]` (verified with `'123456789'`, sum=47)
- PASS: `reEnrolled` counter is correctly incremented for existing-student-new-class (not `added++`)
- PASS: All-blank file returns `{ added:0, existing:0, reEnrolled:0, errors:[] }` early return at line 589
- PASS: No try/catch around `xlsx.read` — malformed binary returns the NestJS global exception filter's 500; T2.4 accepts any non-2xx status for this case
- PASS: Audit log fired on enrollment (`STUDENT_ENROLLED`) — both in `addStudentToClass` and `importFromFile`
- PASS: No token → 401 (T5.1 confirmed live)
- PASS: Student-role JWT → 403 (T5.2 confirmed live)
- PASS: Same-class duplicate → 409 Hebrew conflict message (T3.2 confirmed live)
- PASS: Re-enroll into different class → 200 + `reEnrolled:true` + no duplicate Student row (T3.3/T3.4 confirmed live)
- PASS: Missing nationalId field → 400 (T3.5 confirmed live)

### Enrollment & Import — Batch Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| LOW | 2 |
| **Total** | **4** |

---

### Batch 5 — Audit Summary

| Agent | Bugs Found | CRITICAL | HIGH | MEDIUM | LOW |
|-------|-----------|----------|------|--------|-----|
| schedule-qa | 2 | 0 | 2 | 0 | 0 |
| settings-qa | 6 | 0 | 3 | 3 | 0 |
| analytics-qa | 3 | 0 | 3 | 0 | 0 |
| **Batch 5 Total** | **11** | **0** | **8** | **3** | **0** |

### Schedule — Passed Checks
- ✅ localStorage key: exactly `fitgrade-schedule-v1`
- ✅ 5-day week: ראשון–חמישי, exactly 5 days (no Friday/Saturday)
- ✅ Day-period key format: consistently zero-indexed `"${dayIdx}-${periodIdx}"`
- ✅ Period count: 16 periods defined
- ✅ Persistence: reads from localStorage on mount, writes immediately on assign/remove
- ✅ Link to lesson: navigates to `/classes/${classId}/lesson`
- ✅ Class selector: uses `useClasses()` API hook; empty state shows Hebrew message
- ✅ Clear/remove: deletes key from localStorage, persists on refresh
- ✅ No banned Tailwind classes in schedule page
- ✅ Hebrew day and period labels (ראשון, שני, etc.; numeric period labels)
- ✅ No `: any` types in schedule code

### Settings — Passed Checks
- ✅ Weight sum validation: `SettingsService` throws `BadRequestException` when weights do not sum to 100
- ✅ Weight range validation: `@IsInt()`, `@Min(0)`, `@Max(100)` on all weight fields
- ✅ Settings isolation: all reads/writes filter by `teacherId` from JWT
- ✅ Settings persistence: stored on `User` model in DB; unique by PK — one row per teacher
- ✅ Grade range validation in `QuickGradeOverrideDto`: `@IsInt() @Min(0) @Max(100)` present
- ✅ Settings applied to final grade: weights read from teacher settings, not hardcoded
- ✅ No banned Tailwind classes in settings page
- ✅ All user-facing labels in Hebrew

### Analytics — Passed Checks
- ✅ Leaderboard data isolation: `findTeacherClassMeta(teacherId)` gates all queries; no cross-teacher leak
- ✅ Leaderboard ranking: uses `avgGrade` (effectiveGrade-based average)
- ✅ Norm comparison class average: excludes students with no results (null-grade rows filtered in `ComparisonRepository`)
- ✅ Monthly chart average: `calculatedGrade: { not: null }` filter in `findMonthlyClassAverages`
- ✅ Team builder: implemented with snake-draft algorithm, fitness-based tiers, `getHebrewGradeLabel()` for averages
- ✅ Events/calendar: implemented, scoped to `teacherId`, Hebrew UI
- ✅ All Recharts components have `'use client'` directive
- ✅ Chart axis labels are in Hebrew
- ✅ No banned Tailwind classes in analytics pages
- ✅ Loading skeletons present on all analytics pages
- ✅ Hebrew empty states present on all analytics pages

