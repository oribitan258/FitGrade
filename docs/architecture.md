# FitGrade — System Architecture

## Overview

FitGrade replaces manual grading and attendance tracking for Physical Education (PE) teachers in Israeli schools. It consists of a **pnpm monorepo** (with Turborepo) containing three independent applications that share a common TypeScript type/schema layer and communicate through a single REST API.

- **Language**: All UI is in **Hebrew**. RTL layout is mandatory from day one.
- **Primary users**: PE teachers (non-tech-savvy, mobile-first), students (read-only web view).
- **Design philosophy**: Extreme simplicity, large touch targets, error forgiveness, offline resilience on mobile.

---

## Monorepo Structure

```
fitgrade/
├── apps/
│   ├── web/                    # Next.js 14 (App Router) — Teacher web dashboard + Student read-only view
│   ├── mobile/                 # Expo (React Native) — Teacher field app (mobile-first)
│   └── api/                    # NestJS — REST backend, Swagger docs, business logic
├── packages/
│   └── types/                  # Shared TypeScript interfaces, Zod schemas, grade utilities
├── docs/
│   ├── architecture.md         # This file
│   └── database-schema.md      # Prisma schema design
├── .claude/
│   ├── CLAUDE.md               # Master Claude Code rules
│   └── rules/
│       ├── backend.md
│       ├── web-frontend.md
│       └── mobile.md
├── package.json                # pnpm workspace root
├── pnpm-workspace.yaml         # Workspace package definitions
├── turbo.json                  # Turborepo pipeline (build, dev, test, lint)
└── .env.example                # Root environment variable template
```

---

## Application Responsibilities

| App | Users | Stack | Core Responsibility |
|-----|-------|-------|---------------------|
| `apps/web` | Teachers + Students | Next.js 14, Tailwind, shadcn/ui, Recharts | Class management, grade entry, progress charts, Excel/PDF exports |
| `apps/mobile` | Teachers only | Expo SDK, React Native, TypeScript | Field data entry: attendance, stopwatch mode, quick test results |
| `apps/api` | All (REST) | NestJS, Prisma, PostgreSQL | Auth, all business logic, data persistence, export generation |
| `packages/types` | Consumed by all | TypeScript, Zod | Shared interfaces, Zod validation schemas, `getHebrewGradeLabel()` utility |

> **Important**: `apps/mobile` is **teacher-only**. Students access their data exclusively via the web app.

---

## Authentication Flows

### Teacher — Google OAuth 2.0

```
Teacher → clicks "כניסה עם Google"
  → Web/Mobile redirects to GET /auth/google
  → API redirects to Google OAuth consent screen
  → Google redirects back to GET /auth/google/callback
  → API validates token, upserts User record
  → API issues: accessToken (JWT, 15min) + refreshToken (httpOnly cookie, 7 days)
  → Teacher is redirected to dashboard
```

### Student — Class Code + Password

```
Student → enters join code + personal password on web login page
  → POST /auth/student { classCode, studentCode, password }
  → API validates classCode exists, finds Student, verifies bcrypt password
  → API issues: accessToken (JWT, 15min, role=STUDENT, studentId embedded)
  → Student lands on read-only personal progress page
```

### JWT Payload Structure

```ts
interface JwtPayload {
  sub: string;          // userId (teacher) or studentId (student)
  role: 'TEACHER' | 'STUDENT';
  email?: string;       // teachers only
  classId?: string;     // students only — restricts data access
  iat: number;
  exp: number;
}
```

---

## Data Flow

```
┌─────────────────────┐      ┌──────────────────────┐
│  Teacher Mobile App  │      │  Teacher Web Dashboard │
│  (Expo/RN)           │      │  (Next.js)             │
│                      │      │                        │
│  • Attendance        │      │  • Class management    │
│  • Stopwatch mode    │      │  • Grade review        │
│  • Quick entry       │      │  • Reports / exports   │
└──────────┬───────────┘      └───────────┬────────────┘
           │ REST (JWT Bearer)             │ REST (JWT Bearer)
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────┐
│                   NestJS REST API                     │
│                   apps/api                            │
│                                                       │
│  /auth    /classes   /students   /results             │
│  /tests   /attendance  /exports                       │
└──────────────────────────┬───────────────────────────┘
                           │ Prisma ORM
                           ▼
              ┌────────────────────────┐
              │   PostgreSQL Database   │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Student Web View       │
              │  (Next.js — read-only) │
              └────────────────────────┘
```

**Rule**: Apps never communicate with each other or the database directly. All data access goes through the API.

---

## Key Domain Flows

### Fitness Test Grading (Automatic)

```
1. Teacher opens TestSession for a class
2. Teacher inputs raw result per student (time in seconds / rep count / pass-fail)
3. API receives: POST /results { sessionId, studentId, rawValue }
4. GradingService (single source of truth):
     a. Fetches student's age and gender
     b. Looks up NormTable rows for (testTypeId, gender, ageGroup)
     c. Finds matching row where minValue ≤ rawValue < maxValue
     d. Returns score (Int 0–100)
5. TestResult saved: { rawValue, calculatedGrade: score }
6. Teacher may set gradeOverride (Int 0–100) + overrideReason (logged in AuditLog)
7. Web/Mobile display: score → getHebrewGradeLabel(score) → "מצטיין" etc.
```

### Stopwatch Mode (Running Tests)

```
1. Teacher starts StopwatchSession (POST /results/stopwatch/start { sessionId })
2. API records sessionStartTime server-side (not trusted from client)
3. Teacher sees list of enrolled students on mobile screen
4. Teacher taps a student's name as they cross the finish line
5. Mobile sends: POST /results/stopwatch/tap { sessionId, studentId }
6. API records: tapReceivedAt - sessionStartTime = elapsedSeconds
7. GradingService grades elapsed time against NormTable
8. Result immediately visible on screen with undo available for 30 seconds
9. Haptic feedback on mobile confirms the tap was registered
```

### Attendance

```
1. Teacher opens class → Attendance tab
2. Default: all students marked PRESENT
3. Teacher unchecks exceptions (ABSENT / LATE / EXCUSED)
4. Each toggle: PATCH /attendance/:id { status } — saved immediately
5. Optimistic UI: toggle is instant, error reverts state + shows toast
6. Undo available within 10 seconds via toast action
```

### Student Progress View

```
1. Student logs in (classCode + password)
2. Web fetches: GET /students/me/results?semester=A and semester=B
3. Recharts renders side-by-side bar charts (semester A vs B per test type)
4. Framing: positive language only — improvements highlighted, no raw failure labels
5. Grade displayed as Hebrew categorical label (מצטיין, טוב, עובר, etc.)
```

---

## API Module Structure (NestJS)

```
apps/api/src/
├── auth/
│   ├── auth.controller.ts        # /auth/google, /auth/google/callback, /auth/student, /auth/refresh
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── google.strategy.ts    # Passport Google OAuth2
│   │   └── jwt.strategy.ts       # Passport JWT
│   └── guards/
│       ├── jwt.guard.ts
│       └── roles.guard.ts
├── users/
│   ├── users.controller.ts       # GET /users/me, PATCH /users/me
│   ├── users.service.ts
│   └── users.repository.ts
├── classes/
│   ├── classes.controller.ts     # CRUD /classes, POST /classes/:id/join-code
│   ├── classes.service.ts
│   └── classes.repository.ts
├── students/
│   ├── students.controller.ts    # CRUD /students, GET /students/me/results
│   ├── students.service.ts
│   └── students.repository.ts
├── tests/
│   ├── tests.controller.ts       # GET /test-types (catalog, system-seeded)
│   ├── tests.service.ts
│   └── norm-tables.repository.ts
├── results/
│   ├── results.controller.ts     # POST /results, PATCH /results/:id, stopwatch endpoints
│   ├── results.service.ts
│   ├── grading.service.ts        # SOLE location of grade calculation logic
│   └── results.repository.ts
├── attendance/
│   ├── attendance.controller.ts  # GET/PATCH /attendance
│   ├── attendance.service.ts
│   └── attendance.repository.ts
├── exports/
│   ├── exports.controller.ts     # GET /exports/excel, GET /exports/pdf
│   ├── exports.service.ts        # Uses xlsx + pdfkit
│   └── templates/                # PDF layout templates
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts    # @Roles('TEACHER')
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── audit-log.interceptor.ts
│   └── pipes/
│       └── validation.pipe.ts
├── prisma/
│   ├── prisma.service.ts
│   └── prisma.module.ts
└── main.ts                       # Bootstrap: ValidationPipe, Swagger, CORS, cookie-parser
```

---

## Security Model

| Concern | Approach |
|---------|----------|
| Route protection | Global `JwtAuthGuard` on all routes except `/auth/*` |
| Role enforcement | `@Roles('TEACHER')` decorator + `RolesGuard` on write endpoints |
| Student isolation | `StudentOwnershipGuard` — students can only access their own `studentId` data |
| Passwords | `bcrypt` with cost factor 12 for student passwords |
| Tokens | Access token: JWT 15min. Refresh token: httpOnly Secure cookie, 7 days |
| Join codes | 6-char alphanumeric, expire in 7 days, single-use per student |
| Input validation | `ValidationPipe` globally with `whitelist: true, forbidNonWhitelisted: true` |
| Secret exposure | `class-transformer` `@Exclude()` on `passwordHash` in all User/Student responses |

---

## packages/types — Shared Layer

```
packages/types/src/
├── index.ts                  # Re-exports everything
├── grade-labels.ts           # getHebrewGradeLabel(score: number): string
├── schemas/
│   ├── auth.schema.ts        # Zod: StudentLoginDto, RefreshTokenDto
│   ├── class.schema.ts       # Zod: CreateClassDto, UpdateClassDto
│   ├── result.schema.ts      # Zod: CreateResultDto, UpdateResultDto
│   └── attendance.schema.ts  # Zod: UpdateAttendanceDto
└── types/
    ├── api.types.ts          # API response shapes (PaginatedResponse<T>, ApiError)
    ├── auth.types.ts         # JwtPayload, UserRole
    └── domain.types.ts       # Grade categories, TestType enum mirror
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/fitgrade"

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# App URLs
WEB_URL=http://localhost:3000
API_URL=http://localhost:3001

# Env
NODE_ENV=development
```

---

## Turborepo Pipeline

```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev":   { "cache": false, "persistent": true },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {}
  }
}
```

Run all apps: `pnpm turbo dev`
Run API only: `pnpm turbo dev --filter=api`
