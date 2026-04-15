# FitGrade — Claude Code Master Rules

## Project Overview

**FitGrade** is a Hebrew-language, RTL Physical Education grade and attendance tracking system for Israeli schools. It replaces manual paper-based grading with a digital system optimized for non-tech-savvy PE teachers.

**Key files to understand the system:**
- [`docs/architecture.md`](../docs/architecture.md) — System design, data flow, auth flows
- [`docs/database-schema.md`](../docs/database-schema.md) — Full Prisma schema with all models

**Three applications, one API:**

| App | Path | Users |
|-----|------|-------|
| Web dashboard | `apps/web/` | Teachers + Students (read-only) |
| Mobile field app | `apps/mobile/` | Teachers only |
| REST API | `apps/api/` | Backend for all apps |
| Shared types | `packages/types/` | Consumed by all three apps |

---

## Fixed Tech Stack — No Alternatives

These are the only libraries allowed. Do not suggest, install, or use alternatives.

| Concern | Library |
|---------|---------|
| Web framework | Next.js 14 (App Router) |
| Mobile framework | Expo + React Native |
| Backend framework | NestJS |
| Database | PostgreSQL via Prisma ORM |
| Styling (web) | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Mobile state | React Query (TanStack Query) |
| Web data fetching | SWR (client) / fetch (server) |
| Validation | Zod + class-validator |
| Testing | Jest + React Testing Library |
| Exports | xlsx (Excel), pdfkit (PDF) |
| Auth | Passport.js (Google OAuth2 + JWT) |

---

## Monorepo Navigation Rules

- **Never import from one `apps/*` package into another.** Only `packages/types` is shared.
- `packages/types` contains: shared TypeScript interfaces, Zod schemas, and the `getHebrewGradeLabel()` utility.
- All business logic lives in `apps/api`. Frontend apps are dumb clients.
- Run from workspace root with Turborepo: `pnpm turbo dev`, `pnpm turbo test`, `pnpm turbo build`.
- To run a single app: `pnpm turbo dev --filter=api` or `--filter=web` or `--filter=mobile`.

---

## TypeScript Rules

- **`strict: true`** in all `tsconfig.json` files — no exceptions.
- **No `any`** — use `unknown` and narrow with type guards, or define proper types.
- Explicit return types on all public functions and class methods.
- Prefer `interface` over `type` for object shapes; use `type` for unions and utility types.
- Use `const` by default; only use `let` when mutation is necessary.
- No non-null assertions (`!`) except where Prisma guarantees a field is present and you can prove it.
- Import types with `import type { }` to avoid runtime imports of type-only symbols.

---

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| React components | PascalCase | `StudentCard.tsx` |
| Hooks | camelCase, `use` prefix | `useStudentResults.ts` |
| Files/directories | kebab-case | `grade-labels.ts` |
| NestJS classes | PascalCase | `GradingService` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_JOIN_CODE_LENGTH` |
| Database models | PascalCase (Prisma convention) | `TestResult` |
| Env variables | SCREAMING_SNAKE_CASE | `JWT_ACCESS_SECRET` |
| API endpoints | REST convention, kebab-case paths | `/test-results/:id` |

---

## Language & Direction — CRITICAL

This is a **Hebrew-only application**. RTL layout is mandatory everywhere.

### Rules (apply to ALL apps)
1. **All user-facing text is in Hebrew.** No English strings visible to end users.
2. **Grade scores (0–100 Int) are NEVER rendered directly as grade labels.** Always pass through `getHebrewGradeLabel(score)` from `packages/types`.
3. Physical directional properties (`left`, `right`, `ml-`, `mr-`) are **BANNED** in UI code.

### Web-specific (`apps/web`)
- `<html lang="he" dir="rtl">` must be set in root `layout.tsx`.
- Use **Tailwind logical properties exclusively**: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `start-`, `end-`, `border-s`, `border-e`, `rounded-s`, `rounded-e`.
- Banned Tailwind classes: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`, `left-*`, `right-*`, `border-l`, `border-r`, `rounded-l`, `rounded-r`.

### Mobile-specific (`apps/mobile`)
- `I18nManager.allowRTL(true)` AND `I18nManager.forceRTL(true)` must be called in `app/_layout.tsx` before NavigationContainer renders.
- Use `start`/`end` in `StyleSheet` instead of `left`/`right`.

**Detailed rules:** see `.claude/rules/web-frontend.md` and `.claude/rules/mobile.md`.

---

## Error Handling

- **Never swallow errors silently.** Either handle them explicitly or let them propagate.
- **Never expose raw database or internal errors to API clients.** Map to typed `HttpException` responses.
- API error responses follow this shape:
  ```json
  { "statusCode": 400, "message": "Descriptive error", "error": "Bad Request" }
  ```
- HTTP status code map:
  - `400` — invalid input (caught by ValidationPipe)
  - `401` — not authenticated (missing/expired JWT)
  - `403` — authenticated but wrong role or accessing another student's data
  - `404` — resource not found
  - `409` — conflict (e.g., student already enrolled)
  - `500` — unexpected server error (log but do not expose details)
- On the frontend, all API errors must show a user-facing Hebrew toast/alert — never silently fail.

---

## Code Style

- **No magic numbers.** Extract to named constants with Hebrew comments explaining their meaning.
- **No dead code.** Remove unused imports, variables, and functions immediately.
- **No `TODO` comments in committed code.** Either fix it or create a GitHub issue.
- **No `console.log` in production code.** Use NestJS `Logger` on the backend; omit logging on the frontend (rely on error boundaries and toasts).
- Functions should do one thing. If a function name contains "and", split it.
- Maximum function length: ~40 lines. If longer, extract helper functions.

---

## Security Rules

1. **Never log secrets** — no JWT secrets, passwords, Google credentials, or database URLs in logs.
2. **Never return `passwordHash`** from any API endpoint. Use `@Exclude()` on the field and `ClassSerializerInterceptor` globally.
3. **Validate all user input at the API boundary** using class-validator DTOs. Frontend validation is UX-only, not a security control.
4. **Students can only access their own data.** Enforce `studentId === jwtPayload.sub` in the service layer, not just in the guard.
5. **Join codes are single-use per student.** Invalidate or mark as used upon successful enrollment.
6. **No raw SQL** unless Prisma ORM cannot express the query. Document why with a comment.

---

## Testing Requirements

- **Every `*.service.ts` method** must have a corresponding unit test in `*.service.spec.ts`.
- **Every API endpoint** must have an e2e test in `test/*.e2e-spec.ts`.
- Unit tests must use mock repositories — never hit the real database.
- Frontend components must have snapshot or interaction tests for non-trivial UI (forms, stopwatch).
- Coverage targets: services ≥ 80%, controllers ≥ 60%.

---

## Specific Rule Files

For app-specific coding rules, always consult:

- **Backend**: [`.claude/rules/backend.md`](rules/backend.md)
- **Web Frontend**: [`.claude/rules/web-frontend.md`](rules/web-frontend.md)
- **Mobile**: [`.claude/rules/mobile.md`](rules/mobile.md)

When implementing a feature, **read the relevant rule file first** before writing any code.

---

## Token & Context Rules

### 1. Strict Output Reduction (Zero Fluff)
- No introductory, conversational, or concluding filler phrases ("Here is the code", "Let me know what you think", etc.).
- Output ONLY the direct answer or the requested code.
- NEVER rewrite entire files unless explicitly instructed. Output only the specific lines/functions being modified with minimal surrounding context.

### 2. Plan Before Executing
- For complex tasks, output a brief bulleted action plan first.
- STOP and WAIT for explicit approval before writing any code. Do not assume approval.

### 3. Language & Communication
- Keep all responses as short and concise as possible.
- Conversations may be in Hebrew; use English for internal reasoning, variable naming, and rule documentation.

### 4. Proactive Context Management
- If asked to read a massive file when only a fraction is needed, suggest providing only the relevant snippet.
- If chat history grows too long, proactively advise using `/compact` or starting a new session for micro-tasks.
- If given a complex task or asked to read heavy files, remind of token-saving best practices.
