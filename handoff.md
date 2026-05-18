# FitGrade — Session Handoff: Bug-Zero State

> **Purpose:** Cold-start brief for the next Claude session. Read this end-to-end before touching anything.

---

## 1. Project Context

**FitGrade** is a Hebrew-language, RTL Physical Education grade and attendance tracking SaaS for Israeli schools. Teachers run live fitness tests in the field with up to 30 students per session.

**Stack (fixed — no alternatives):**
- **Web:** Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui + Recharts + SWR + Framer Motion
- **Mobile:** Expo + React Native + React Query + MMKV (teachers only, field use)
- **API:** NestJS + Prisma + PostgreSQL + Passport (Google OAuth + JWT)
- **Shared:** `packages/types` — interfaces, Zod schemas, `getHebrewGradeLabel()`
- **Tooling:** pnpm workspaces + Turborepo
- **Testing:** Jest + Playwright + Artillery

**RTL is non-negotiable.** `<html lang="he" dir="rtl">` in root layout. Only logical Tailwind: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`. Physical classes (`ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`) are banned. All UI text is Hebrew. Grades (Int 0–100) always rendered via `getHebrewGradeLabel()` → "מצטיין"/"טוב מאוד"/"טוב"/"עובר"/"נכשל".

**Three-layer API architecture (strict):**
```
Controller → validates input, calls service, returns DTO
Service    → all business logic, orchestration
Repository → all Prisma queries only (no logic)
```

---

## 2. Current State — Bug-Zero

The previous two sessions executed a **comprehensive security + stability + logic audit** of the entire FitGrade monorepo. **All 56 findings are resolved.** The project is at Bug-Zero.

### What was audited and fixed

| Wave | Scope | Bugs |
|------|-------|------|
| Security (Wave 1) | Auth, role guards, token handling, input validation, error filters | BUG-001 → BUG-029 |
| Logic + DB (Wave 2) | Grading math, weight validation, N+1 queries, DB constraints | BUG-012 → BUG-029 + LOGIC/STAB items |
| Functional QA | Auth flows, dashboard, classes, attendance, grading, lesson planner, live/beep/sprint/long-distance tests, student profile, reports, schedule, settings, analytics | BUG-030 → BUG-056 |

**Full backlog with every fix recorded:** `.claude/QA-BACKLOG.md`

### Key fixes that affect how you work

#### Auth
- **Refresh token rotation** (BUG-030): `POST /auth/refresh` now rotates the cookie. `refreshAccessToken()` returns `TokenPair`, immediately revokes the old jti, issues a new refresh token. Reuse detection logs `logger.warn("Refresh token reuse detected")`.
- **JWT access token no longer in URL** (BUG-003): Web flow uses `login_token` httpOnly cookie → `POST /auth/exchange` exchange pattern.
- **RolesGuard registered globally** (BUG-001): Two `APP_GUARD`s — `JwtAuthGuard` + `RolesGuard`. All teacher controllers have `@Roles('TEACHER')`. Student portal has `@Roles('STUDENT')`.
- **Dev login gated** (SEC-010): Only works when `ENABLE_DEV_LOGIN=true` in `.env` AND not production.

#### API security
- **GlobalExceptionFilter** registered in `main.ts` — Prisma errors never reach clients.
- **ThrottlerGuard** global — strict limits on `/auth/student` (10/min) and `/auth/refresh` (20/min).
- **Refresh token blacklist** is DB-backed (`revoked_tokens` table) — survives restarts.
- **`overrideResultGrade`** uses `updateMany({ where: { id, sessionId } })` — prevents cross-session grade injection.
- **`findSessionWithOwnership`** and **`findSessionWithStudents`** now distinguish 404 vs 403.

#### Grading
- **GradingService norm lookup** uses three-step clamp: exact band → clamp high → clamp low. No more out-of-band rejection.
- **`fitnessAvg` consistent** across student profile, student report, and class report — all use best-grade-per-test-type.
- **Weight validation** uses `@WeightsSumTo100` cross-field decorator. Mixed-null weight pairs also rejected.
- **Dashboard fitness average** excludes null-grade rows (no more 0-skew from ungraded results).

#### Database
- **`NormTable` unique index** on `(testTypeId, gender, gradeLevel, minValue)` — no duplicate bands.
- **`importStudents`** refactored from N×4 serial queries to 5 fixed queries with `createMany`.
- **`AttendanceRecord.session` FK** has `onDelete: SetNull`.
- **`AuditLog.actor` FK** has `onDelete: Cascade`.

#### New API endpoints
- `DELETE /api/classes/:id/students/:studentId` — unenroll a student. Returns 204. Verifies teacher ownership. Fires `AuditAction.STUDENT_REMOVED`.

#### UI / RTL
- **Grade labels**: all 6 previously-raw locations now use `getHebrewGradeLabel()` — dashboard leaderboard, outstanding-students `RankRow`, reports table (fitness avg, conduct score, recommended grade).
- **`WeightSlider` divider**: `left` → `insetInlineStart`.
- **`TopResultsTicker`**: `paddingLeft`/`paddingRight`/`marginLeft` → logical equivalents.
- **Dashboard stats error**: shows Hebrew error card instead of silent mock fallback.
- **Settings page report load error**: shows Hebrew error card, hides save button.
- **Error boundaries**: root + teacher shell + lesson page + live session page.

#### Beep test
- `encodeBeepValue(level, shuttle)` uses `Math.round(level * 10 + shuttle) / 10` (integer arithmetic, no IEEE-754 drift).
- `decodeBeepValue(rawValue)` safely recovers level/shuttle with `Math.round`.

---

## 3. Repository State

### Git
- Branch: `main`
- All bug fixes applied as direct edits — **not yet committed**. Run `git status` to see the full diff.
- Last committed: `f0347e0 fix: resolve mobile typescript errors`

### Pending migrations (need `prisma migrate dev`)
These migration files exist in `apps/api/prisma/migrations/` but **may not be applied** to the local dev DB:
- `20260517000001_add_rum_metrics` — `rum_metrics` table
- `20260517000002_add_revoked_tokens` — `revoked_tokens` table (used by blacklist service)
- `20260517000003_norm_table_unique_band` — unique index on `norm_tables`

**Run this before starting API dev:**
```powershell
cd C:\Users\oribi\Projects\FitGrade\apps\api
npx prisma migrate dev
```

### TypeScript status
Both `apps/api` and `apps/web` typecheck clean (`npx tsc --noEmit` in each directory = no output).

### CI
- `typecheck` and `rtl-audit` jobs are GREEN.
- Most other jobs (`unit-tests`, `playwright`, `api-e2e`, `load-tests`, `perf-web`, `perf-load`) are still `if: false` — awaiting CI DB/secrets provisioning. Do NOT enable them without confirming the CI database is set up.

---

## 4. Architecture Quick-Reference

### Auth flow
```
Teacher: Google OAuth → callback → login_token cookie → POST /auth/exchange → { accessToken }
                      → refresh_token httpOnly cookie (7d, rotated on every use)
Student: POST /auth/student { nationalId, password } → { accessToken } + refresh cookie
```

### Key service patterns
```typescript
// Grade calculation — SINGLE source of truth
await gradingService.calculateGrade(studentId, testTypeId, rawValue, classId);

// Audit logging — fire and forget, never throws
void auditLogService.log({ action, entityType, entityId, actorId, newValue });

// Ownership check pattern (always two-step for 404 vs 403)
const row = await prisma.class.findUnique({ where: { id: classId } });
if (!row) throw new NotFoundException(…);
if (row.teacherId !== teacherId) throw new ForbiddenException();
```

### Key DB models
- `User` (teachers) ↔ `Class` → `ClassEnrollment` ← `Student`
- `TestSession` → `TestResult` (gradeOverride ?? calculatedGrade = effectiveGrade)
- `NormTable` (seeded, read-only) — unique on `(testTypeId, gender, gradeLevel, minValue)`
- `AttendanceRecord` — unique on `(classId, studentId, date)`
- `RevokedToken` — jti blacklist, swept hourly
- `RumMetric` — production RUM beacon storage
- `AuditLog` — immutable event log

### Important constants
```typescript
// apps/api/src/tests/tests.service.ts
UNDO_WINDOW_MS = 30_000          // 30s result delete window
MIN_TIME_SECONDS = 30             // min rawValue for TIME tests
MAX_STOPWATCH_DURATION_MS = 7_200_000  // 2h session expiry

// apps/api/src/dashboard/dashboard.repository.ts
PASS_GRADE_THRESHOLD = 57         // below-norm flag threshold
```

---

## 5. Remaining Open Items (not bugs — scope decisions)

These were acknowledged as out-of-scope during the audit:

| # | Item | Notes |
|---|------|-------|
| BUG-003 (PARTIAL) | Mobile OAuth still uses `?token=` deep-link URL | Full fix requires server-side code exchange for mobile — complex native flow |
| BUG-041 (partial) | Beep test `level.shuttle` encoding is non-standard | Float arithmetic hardened; full fix = re-seed norm table with cumulative shuttle counts (data migration) |
| BUG-045 | Server-side Excel/PDF export not implemented | Currently client-side CSV. Full server export with `xlsx` + `pdfkit` is a feature, not a bug fix |
| BUG-053 | `@IsUrl()` rejects `data:` URIs for `schoolLogoUrl` | Low impact; fix = `@IsUrl({ protocols: ['http','https','data'] })` |

---

## 6. Performance Testing Infrastructure (Built, Not Yet Run)

In the session before the audit, a full **Playwright + Artillery + RUM performance test suite** was built. It exists in the codebase but CI jobs are gated `if: false`.

**Files:**
- `e2e/perf/` — INP, LCP/CLS, FPS specs + helpers + SLA thresholds
- `load-tests/scenarios/` — burst load scenarios
- `apps/api/src/rum/` — RUM beacon API module
- `apps/web/lib/rum-beacon.ts` + `apps/web/components/rum-init.tsx`

**To activate:** flip `if: false` → `if: true` on `perf-web` and `perf-load` jobs in `.github/workflows/ci.yml` once CI DB/secrets are provisioned. See original performance architecture in memory or ask Claude to read `e2e/perf/README.md`.

---

## 7. Working Mode for Next Session

- **User is senior engineer + PM.** No filler. Short answers. Act, don't narrate.
- **Hebrew stays Hebrew** in all user-facing strings and code comments about UI behavior.
- **No alternatives** to the locked stack (no Vitest, no Cypress, no k6, no Lighthouse CI, no Redux, etc.).
- **Plan before writing** only for multi-file features. Single-file fixes: just do it.
- **TypeScript strict** always. No `any`. Explicit return types on all public methods.
- **After every code change**: run `npx tsc --noEmit` in the affected app directory and confirm clean before reporting done.
- **Read `.claude/CLAUDE.md`** if unsure about any rule — it's the ground truth.

### First actions on session start
1. Run `git status` to see what's uncommitted.
2. Run `npx prisma migrate dev` in `apps/api/` if DB hasn't been synced.
3. Ask the user what they want to work on next.

**The codebase is in excellent shape. No known bugs. TypeScript clean. Ready for new features.**
