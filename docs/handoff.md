# FitGrade — Session Handoff: Test History & Grade Mutation

> Cold-start brief. Read end-to-end before any code.

---

## 1. Project Snapshot

**FitGrade** — Hebrew RTL PE grading SaaS for Israeli schools.
- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/web` — Next.js 14 App Router + Tailwind + SWR + Framer Motion
- `apps/mobile` — Expo (teachers only, field use)
- `packages/types` — shared interfaces + `getHebrewGradeLabel()`

**Locked stack** (`.claude/CLAUDE.md` is ground truth — read it). RTL mandatory: logical Tailwind only (`ms-/me-/ps-/pe-/text-start/text-end`); physical classes banned. Three-layer API (Controller → Service → Repository) strictly enforced. All grade computation lives in `GradingService.calculateGrade()`.

---

## 2. Current State

**Status: Bug-Zero + full SaaS security audit shipped.** Latest commits:
- `3bec5d8` security: full SaaS audit — P0/P1/P2/P3 fixes (39 files)
- `e5132e3` zero-bug milestone reached
- TypeScript clean across all three apps.

**Recently added infrastructure relevant to the new feature:**
- `PaginationQueryDto` at `apps/api/src/common/dto/pagination-query.dto.ts` (`take` max 100, default 50; `skip` default 0) — reuse.
- In-memory access token + silent refresh in `apps/web/lib/api-client.ts`.
- `web/middleware.ts` enforces CSP (allows `unsafe-inline`+`unsafe-eval` in dev for Next.js HMR).
- API `main.ts`: CORS multi-origin, CORP `cross-origin`, uncaughtException handlers, X-Request-ID.
- Schema: `onDelete: Restrict` on all Student-referencing FKs except `TestResult.sessionId` (still Cascade — required for session delete to cleanup results).

---

## 3. THE PLAN — Test History & Grade Mutation

Build `/classes/[id]/history` so teachers can browse past sessions, inline-edit raw values, override grades, delete individual results, and delete entire sessions. Mutations must cascade-invalidate every dependent SWR key.

### 3.1 User-confirmed design decisions

| Question | Decision |
|----------|----------|
| 30s undo window for history edits? | **Dedicated history endpoints, no undo window.** Live stopwatch flow keeps existing 30s safety. |
| Session-delete confirmation UX? | **Simple glass dialog showing "X תוצאות עבור Y תלמידים" + irreversible warning.** |
| Editable fields in history view? | **All three: raw value (recalcs grade), grade override (+ reason), delete single result.** |

### 3.2 Phase 1 — Backend & Data Flow

**New endpoints (4):**
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/classes/:classId/sessions` | Paginated session history (reuses `PaginationQueryDto`, `X-Total-Count` header) |
| `PATCH` | `/sessions/:sessionId/results/:resultId/raw-value` | Edit raw value → recalc grade via `GradingService` |
| `DELETE` | `/sessions/:sessionId/results/:resultId/history` | History delete (no undo window) |
| `DELETE` | `/sessions/:sessionId` | Cascade: `TestResult`s deleted (FK Cascade), `AttendanceRecord.sessionId` → NULL (FK SetNull). Audit log: new `SESSION_DELETED` action. |

**Reused as-is:**
- `PATCH /sessions/:sessionId/results/:resultId` — existing override path (gradeOverride + overrideReason)
- `GET /sessions/:sessionId` — existing session-detail endpoint

**Repository methods (in `apps/api/src/tests/tests.repository.ts`):**
- `findSessionsByClass(classId, teacherId, take, skip)` → `[rows, total]` via `$transaction([findMany, count])`. Select: `id, testTypeId, testNameHe, conductedAt, semester, isStopwatch, completedAt, _count.results`. ORDER BY conductedAt DESC.
- `updateResultRawValue(resultId, sessionId, rawValue, calculatedGrade)` — `updateMany({ where: { id, sessionId } })` (SEC-001 cross-session-injection guard).
- `deleteResultByIdInHistory(resultId, sessionId)` — same pattern, no time check.
- `deleteSession(sessionId, teacherId)` — `$transaction`: verify ownership, count results, delete (cascade fires), return `{ deletedResultCount }`.

**Service methods (in `apps/api/src/tests/tests.service.ts`):**
- `getSessionsByClass(classId, teacherId, pagination)` — verifyClassOwnership → repo.
- `editResultRawValue(resultId, sessionId, newRawValue, teacherId)` — findSessionWithOwnership → load result for studentId/testTypeId → re-validate (MIN_TIME_SECONDS, gender restrictions per existing `submitResult`) → `gradingService.calculateGrade()` → repo update → `auditLog.RESULT_EDIT` with `{ oldValue, newValue }`.
- `deleteResultInHistory(resultId, sessionId, teacherId)` — ownership → snapshot → delete → `auditLog.RESULT_EDIT { deleted: true, history: true }`.
- `deleteSession(sessionId, teacherId)` — repo.deleteSession → `auditLog.SESSION_DELETED { resultCount, conductedAt }`.

**Schema change:**
- `AuditAction` enum: add `SESSION_DELETED`.
- Migration: `apps/api/prisma/migrations/20260518000003_add_session_deleted_audit_action/migration.sql`.

**New DTOs:**
- `apps/api/src/tests/dto/edit-result-raw-value.dto.ts` — `{ rawValue: number }` with `@IsNumber() @Min(0)`.
- `apps/api/src/tests/dto/session-history-row.dto.ts` — response shape.

**Security posture preserved:**
- All routes `@Roles('TEACHER')` (class-level decorator on `TestsController`).
- All ownership checks via `findSessionWithOwnership` (404 vs 403 distinction).
- All updates `updateMany({ where: { id, sessionId } })` (SEC-001).
- Audit log on every mutation.
- History deletes have NO undo — confirmation dialog is the safety gate.

### 3.3 Phase 2 — State Management & Reactivity

**New hooks:**
- `apps/web/hooks/use-class-sessions.ts` — `useClassSessions(classId, take, skip)` → key `/classes/${classId}/sessions?take=${t}&skip=${s}`.
- `apps/web/hooks/use-result-mutations.ts` — exposes `editRawValue / overrideGrade / deleteResult / deleteSession` with built-in invalidation.

**Reused: `useTestSession(sessionId)`** at `apps/web/hooks/use-test-session.ts` → key `/sessions/${sessionId}` (already has `revalidateOnFocus: false`).

**Cache invalidation** — single source-of-truth function at `apps/web/lib/cache-invalidation.ts`:
```ts
invalidateAfterMutation(classId, sessionId)
  → mutate predicate against ALL of:
    1. /dashboard/*                         (string prefix)
    2. /classes/${classId}/details*         (prefix, any semester)
    3. /classes/${classId}/sessions*        (this feature's list)
    4. /classes/${classId}/comparison*
    5. /sessions/${sessionId}
    6. ['/class-report', classId, ...]      (array-key predicate)
    7. ['/student-report', classId, ...]    (array-key predicate)
    8. /classes/${classId}/students/*/profile
```

**Optimistic update policy:**
- Edit raw value → **NO optimistic** (client can't predict GradingService output). Show inline spinner.
- Override grade → **YES** (`effectiveGrade = override ?? calculated` — client knows result).
- Delete single result → **YES** (remove from list, rollback on error).
- Delete session → **YES** (remove from list, router.push back, rollback on error).

All optimistic updates use `mutate(key, optimisticData, { rollbackOnError: true, revalidate: true })`.

**Critical ordering:** for delete session — `router.push('/classes/[id]/history')` BEFORE invalidating `/sessions/${sessionId}`, else SWR error toast fires on unmounting detail page.

### 3.4 Phase 3 — Frontend Routing & UI

**Routes:**
```
apps/web/app/(teacher)/classes/[classId]/history/
├── loading.tsx
├── page.tsx                       # session list, grouped by date
└── [sessionId]/
    ├── loading.tsx
    └── page.tsx                   # detail view with editable rows
```

**Class detail tab integration:** add "היסטוריה" link to the existing class header in `apps/web/app/(teacher)/classes/[classId]/page.tsx` alongside Overview / Lesson / Comparison / Teams.

**Component tree (list page):**
- `<PageEnterWrapper variants={PAGE_ENTER}>` — reuses variants from `classes/[classId]/page.tsx` lines 134-158
- `<SessionHistoryHeader>`
- `<SessionGroupList>` — groups by date (Today/Yesterday/Hebrew dates)
  - `<DateGroupCard>` — glass card per date
    - `<SessionRow>` × N
- `<EmptyState>` — "אין היסטוריית מבחנים בכיתה זו"

**Component tree (detail page):**
- `<SessionDetailHeader>` + `<DeleteSessionButton>`
- `<ResultsTable>` — glass table
  - `<ResultRow>` × N
    - student name + initials avatar
    - `<RawValueCell editable>` — debounced 300ms save, spinner on save, green flash on success
    - `<GradeCell>` — `getHebrewGradeLabel(effectiveGrade)`
    - `<OverrideButton>` → opens `<GradeOverrideDialog>`
    - `<DeleteResultButton>` → opens `<DeleteResultConfirmDialog>`
- `<DeleteSessionConfirmDialog>` — "מחיקת מבחן: X תוצאות עבור Y תלמידים · פעולה זו אינה ניתנת לשחזור"
- `<GradeOverrideDialog>` — grade input + reason textarea (reason required when override non-null)

**Glassmorphism canon (match exactly):**
```
background: rgba(255,255,255,0.78)
backdropFilter: blur(24px) saturate(180%)
border: 1px solid rgba(255,255,255,0.70)
borderRadius: 1.5rem (rounded-3xl)
boxShadow: 0 2px 16px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.80)
```
Existing examples to mirror: `apps/web/app/(teacher)/classes/[classId]/page.tsx` student search bar (lines 207-220); `apps/web/components/ui/dialog.tsx` (already glassmorphic — reuse).

**Framer Motion:** reuse `PAGE_ENTER / ITEM / ROW_STAGGER / ROW_ITEM` variants from `classes/[classId]/page.tsx`. Wrap row lists in `<AnimatePresence mode="popLayout">` so deleted rows animate out and remaining ones slide up.

### 3.5 File Manifest

**API (modify):**
- `apps/api/prisma/schema.prisma` — `AuditAction` enum
- `apps/api/src/tests/tests.controller.ts` — 4 new routes
- `apps/api/src/tests/tests.service.ts` — 4 new methods
- `apps/api/src/tests/tests.repository.ts` — 4 new methods

**API (new):**
- `apps/api/prisma/migrations/20260518000003_add_session_deleted_audit_action/migration.sql`
- `apps/api/src/tests/dto/edit-result-raw-value.dto.ts`
- `apps/api/src/tests/dto/session-history-row.dto.ts`

**Web (new):**
- `apps/web/hooks/use-class-sessions.ts`
- `apps/web/hooks/use-result-mutations.ts`
- `apps/web/lib/cache-invalidation.ts`
- `apps/web/app/(teacher)/classes/[classId]/history/loading.tsx`
- `apps/web/app/(teacher)/classes/[classId]/history/page.tsx`
- `apps/web/app/(teacher)/classes/[classId]/history/[sessionId]/loading.tsx`
- `apps/web/app/(teacher)/classes/[classId]/history/[sessionId]/page.tsx`
- `apps/web/components/history/SessionRow.tsx`
- `apps/web/components/history/ResultRow.tsx`
- `apps/web/components/history/RawValueCell.tsx`
- `apps/web/components/history/DeleteSessionConfirmDialog.tsx`
- `apps/web/components/history/DeleteResultConfirmDialog.tsx`
- `apps/web/components/history/GradeOverrideDialog.tsx`

**Web (modify):**
- `apps/web/app/(teacher)/classes/[classId]/page.tsx` — add History tab link

**Tests:** unit test each of the 4 new service methods with mock repositories (existing pattern in `tests.service.spec.ts`).

**Totals:** 15 new files · 4 modified · 1 migration.

---

## 4. Execution Order (sequential — typecheck clean before advancing)

1. **Schema + migration** → run `npx prisma migrate dev` in `apps/api`.
2. **API DTOs → repository → service → controller.**
3. **API unit tests** for the 4 new service methods.
4. **Web hooks** (`use-class-sessions`, `use-result-mutations`, `cache-invalidation`).
5. **History list page** (`/classes/[id]/history`) — read-only first, then wire delete-session.
6. **History detail page** (`/classes/[id]/history/[sessionId]`) — wire all three edits + delete result.
7. **Add History tab link** in class detail header.
8. Run `npx tsc --noEmit` in both `apps/api` and `apps/web` — must be clean.
9. Manual smoke test: edit raw value → grade recalcs → dashboard refreshes; delete result → list updates; delete session → cascade verified; comparison page reflects changes.

---

## 5. First Actions on Session Start

```powershell
git status                                              # confirm clean
cd apps\api ; npx prisma migrate status                 # check pending migrations
```

Read in order: this file → `.claude/CLAUDE.md` → `apps/api/src/tests/tests.service.ts` (existing patterns) → `apps/web/app/(teacher)/classes/[classId]/page.tsx` (glass canon + variants).

Begin with Phase 1 (schema + migration). Do not skip ahead.

---

## 6. Working Rules (carry over from prior sessions)

- User is senior engineer + PM. Terse responses. Act, don't narrate.
- Hebrew stays Hebrew in user-facing strings. English in code/comments.
- No alternatives to locked stack.
- TypeScript strict always. No `any`. Explicit return types on public methods.
- After every code change: `npx tsc --noEmit` in affected app → must be clean before reporting done.
- Plan only for multi-file features. Single-file fixes: just do it.
- Locked architecture: Controller → Service → Repository. No business logic in controllers, no Prisma in services.

**Ready for new feature work. No known bugs. Bug-Zero milestone holds.**
