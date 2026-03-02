# FitGrade — Backend Rules (`apps/api`)

Stack: **NestJS + Prisma + PostgreSQL + Jest**

Read these rules before writing any backend code. See also [`CLAUDE.md`](../CLAUDE.md) for global rules.

---

## Architecture: Controller → Service → Repository

Strictly enforce this three-layer pattern. No exceptions.

```
Controller   → validates input, calls service, returns DTO
Service      → business logic, orchestration, calls repository
Repository   → all Prisma queries (no business logic here)
```

- **Controllers** contain: input validation (via class-validator DTO), calling the service, mapping results to response DTOs. Nothing else.
- **Services** contain: all business logic, cross-service calls, transaction orchestration, error throwing.
- **Repositories** contain: all Prisma queries. One repository per domain model.

```ts
// CORRECT
@Post()
async create(@Body() dto: CreateResultDto, @CurrentUser() user: JwtPayload) {
  return this.resultsService.create(dto, user.sub);
}

// WRONG — business logic in controller
@Post()
async create(@Body() dto: CreateResultDto) {
  const student = await this.prisma.student.findUnique(...); // NO
  const grade = calculateGrade(student, dto.rawValue);      // NO
  return this.prisma.testResult.create({ data: { grade } }); // NO
}
```

---

## DTOs and Validation

- Every request body, query param group, and path param that needs validation gets a DTO class.
- All DTOs use `class-validator` decorators.
- `ValidationPipe` is registered globally in `main.ts` with:
  ```ts
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  ```
- Use `@Type(() => Number)` from `class-transformer` for numeric query params.
- Response DTOs use `@Exclude()` to hide sensitive fields (e.g., `passwordHash`).
- Register `ClassSerializerInterceptor` globally so `@Exclude()` is applied on every response.

```ts
// apps/api/src/students/dto/create-student.dto.ts
import { IsString, IsDateString, IsEnum, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @MinLength(2)
  studentCode: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

---

## GradingService — Single Source of Truth

**All grade calculation logic lives exclusively in `results/grading.service.ts`.** No other file calculates grades.

```ts
// CORRECT — call GradingService
const score = await this.gradingService.calculate({
  testTypeId,
  rawValue,
  gender,
  dateOfBirth,
  sessionDate,
});

// WRONG — inline grade logic anywhere else
const score = normRows.find(r => rawValue >= r.minValue && rawValue < r.maxValue)?.score;
```

`GradingService.calculate()` signature:
```ts
async calculate(params: {
  testTypeId: string;
  rawValue: Decimal;
  gender: Gender;
  dateOfBirth: Date;
  sessionDate: Date;
}): Promise<number>  // Returns 0–100
```

Internally it:
1. Computes age from `dateOfBirth` at `sessionDate`
2. Queries `NormTable` for matching row
3. Returns `score` (0–100) or throws `NotFoundException` if no norm row matches

---

## Prisma Rules

- **All Prisma calls are in `*.repository.ts` files only.** Never call `this.prisma.*` directly in a service.
- **Always use `select` or `include` explicitly.** Never return the full Prisma model object unfiltered.
- **Never return `passwordHash`** — exclude it in every `select: {}` block that returns student/user data.
- Use `$transaction()` for any operation that writes to multiple tables.

```ts
// CORRECT
async findById(id: string): Promise<StudentSummary> {
  return this.prisma.student.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      dateOfBirth: true,
      // passwordHash is intentionally excluded
    },
  });
}

// WRONG — returns everything including passwordHash
async findById(id: string) {
  return this.prisma.student.findUnique({ where: { id } });
}
```

- Use `findUniqueOrThrow` and `findFirstOrThrow` instead of `findUnique`/`findFirst` + manual null check.
- Use `Prisma.TransactionClient` type for transaction-scoped Prisma calls.

---

## Authentication & Authorization

- All routes are protected by `JwtAuthGuard` globally (registered in `AppModule`).
- Public routes (e.g., `/auth/*`, Swagger) use the `@Public()` decorator.
- Role-based access uses `@Roles('TEACHER')` decorator + `RolesGuard`.
- **Student data isolation**: Students may only access their own data. Enforce in the service:
  ```ts
  if (jwtPayload.role === 'STUDENT' && result.studentId !== jwtPayload.sub) {
    throw new ForbiddenException();
  }
  ```

---

## Swagger Documentation

Every controller endpoint must have:

```ts
@ApiOperation({ summary: 'Enter a test result for a student' })
@ApiResponse({ status: 201, description: 'Result created', type: TestResultResponseDto })
@ApiResponse({ status: 400, description: 'Invalid input' })
@ApiResponse({ status: 403, description: 'Not a teacher' })
@ApiBearerAuth()
```

Global Swagger config in `main.ts` sets the API title, version, and security scheme. Swagger is available at `/api/docs`.

---

## Logging

- Use `NestJS Logger` — **no `console.log`**.
- Inject logger per module: `private readonly logger = new Logger(ResultsService.name);`
- Log at these levels:
  - `logger.log()` — successful operations (info level)
  - `logger.warn()` — unexpected but recoverable situations
  - `logger.error()` — exceptions with full stack trace
- **Never log sensitive data**: JWT tokens, passwords, `googleId`, or raw `DATABASE_URL`.

---

## Error Handling

- Throw typed NestJS HTTP exceptions from services:
  ```ts
  throw new NotFoundException(`TestResult with id ${id} not found`);
  throw new ConflictException('Student already enrolled in this class');
  throw new ForbiddenException();
  ```
- Register a global `HttpExceptionFilter` to standardize error response shape.
- Unexpected errors (non-`HttpException`) are caught by the filter and return 500 with a generic Hebrew-safe message. **Never expose Prisma error details or stack traces to clients.**

---

## Audit Logging

Any of the following actions must write an `AuditLog` entry:
- Grade override set or changed (`GRADE_OVERRIDE`)
- Test result raw value edited after initial entry (`RESULT_EDIT`)
- Attendance status changed (`ATTENDANCE_CHANGE`)
- Student enrolled or removed (`STUDENT_ENROLLED`, `STUDENT_REMOVED`)

Use `AuditLogInterceptor` or call `AuditLogService.log()` at the end of the service method after a successful transaction.

```ts
await this.auditLogService.log({
  action: AuditAction.GRADE_OVERRIDE,
  entityType: 'TestResult',
  entityId: result.id,
  actorId: teacherId,
  oldValue: { grade: result.calculatedGrade },
  newValue: { gradeOverride: dto.gradeOverride, reason: dto.overrideReason },
});
```

---

## Testing

- **Unit tests** (`*.service.spec.ts`): mock repositories with `jest.fn()`, never use real Prisma client.
- **E2E tests** (`test/*.e2e-spec.ts`): use a dedicated test database, seed before each test suite, clean up after.
- Use this helper pattern for mock repositories:
  ```ts
  const mockResultsRepository = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  ```
- Every service method has at least: happy path test + error path test (not found, forbidden, etc.).
- `GradingService` must have tests for: boundary values in norm tables, PASS_FAIL type, missing norm table row.

---

## Stopwatch Mode

- `POST /results/stopwatch/start { sessionId }` — sets `TestSession.startedAt = new Date()` server-side. Client cannot provide this timestamp.
- `POST /results/stopwatch/tap { sessionId, studentId }` — computes `elapsedMs = Date.now() - session.startedAt.getTime()`, converts to seconds, calls `GradingService.calculate()`.
- A tap for an already-tapped student (result exists) is rejected with `409 Conflict`.
- Students have a 30-second undo window: `DELETE /results/:id` is allowed if `result.recordedAt` is within 30 seconds of now.

---

## Exports (`apps/api/src/exports/`)

- Excel export: use `xlsx` library. One worksheet per class, one row per student. Hebrew column headers.
- PDF export: use `pdfkit` with explicit RTL text direction. Set font to a Hebrew-supporting font (e.g., Arial or a bundled Hebrew font).
- Both exports are generated on-the-fly (no file storage) and streamed as download responses.
- Set correct `Content-Type` and `Content-Disposition` headers.

```ts
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="fitgrade-report.xlsx"`);
```
