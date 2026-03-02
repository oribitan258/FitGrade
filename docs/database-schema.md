# FitGrade — Database Schema Design

## Overview

The database uses **PostgreSQL** managed via **Prisma ORM**. The schema is designed around two distinct authentication domains (teachers via Google OAuth, students via code+password), a flexible fitness test catalog with system-seeded norm tables, and full audit logging for grade changes.

**Grade scale**: All calculated grades are stored as integers (0–100). The UI maps these to Hebrew categorical labels via `getHebrewGradeLabel()` from `packages/types`.

---

## Full Prisma Schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Role {
  TEACHER
  STUDENT
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum Semester {
  A
  B
}

enum TestInputType {
  TIME       // Value in seconds (e.g., 1-mile run)
  REPS       // Integer count (e.g., push-ups)
  PASS_FAIL  // Boolean — score is 100 (pass) or 0 (fail)
  GENERAL    // Arbitrary decimal (e.g., flexibility in cm)
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

enum AuditAction {
  GRADE_OVERRIDE      // Teacher manually overrides calculated grade
  GRADE_ENTRY         // Initial grade entry
  RESULT_EDIT         // Editing a previously entered raw value
  ATTENDANCE_CHANGE   // Changing attendance status
  STUDENT_ENROLLED    // Student added to class
  STUDENT_REMOVED     // Student removed from class
}

// ─────────────────────────────────────────────
// TEACHER (Google OAuth)
// ─────────────────────────────────────────────

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  avatarUrl   String?
  googleId    String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  classes     Class[]
  auditLogs   AuditLog[]

  @@map("users")
}

// ─────────────────────────────────────────────
// CLASS
// ─────────────────────────────────────────────

model Class {
  id                 String    @id @default(cuid())
  name               String                          // e.g., "כיתה י' 1"
  academicYear       String                          // e.g., "2024-2025"
  semester           Semester
  joinCode           String    @unique               // 6-char alphanumeric
  joinCodeExpiresAt  DateTime?                       // null = never expires
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  teacherId          String
  teacher            User      @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  enrollments        ClassEnrollment[]
  testSessions       TestSession[]
  attendanceRecords  AttendanceRecord[]

  @@index([teacherId])
  @@map("classes")
}

// ─────────────────────────────────────────────
// STUDENT (Code + Password auth)
// ─────────────────────────────────────────────

model Student {
  id            String   @id @default(cuid())
  firstName     String
  lastName      String
  dateOfBirth   DateTime                       // Used for age-based norm table lookup
  gender        Gender
  studentCode   String                         // Teacher-assigned code (unique per class)
  passwordHash  String                         // bcrypt hash
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  enrollments        ClassEnrollment[]
  testResults        TestResult[]
  attendanceRecords  AttendanceRecord[]

  @@map("students")
}

// ─────────────────────────────────────────────
// CLASS ↔ STUDENT (many-to-many)
// ─────────────────────────────────────────────

model ClassEnrollment {
  id          String   @id @default(cuid())
  enrolledAt  DateTime @default(now())

  classId     String
  class       Class    @relation(fields: [classId], references: [id], onDelete: Cascade)

  studentId   String
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)

  // studentCode must be unique within the class (not globally)
  @@unique([classId, studentId])
  @@unique([classId, studentCode])  // Enforced at application layer via compound check
  @@index([classId])
  @@index([studentId])
  @@map("class_enrollments")
}

// ─────────────────────────────────────────────
// FITNESS TEST CATALOG
// ─────────────────────────────────────────────

model FitnessTestType {
  id          String        @id @default(cuid())
  nameHe      String                              // Hebrew name, e.g., "ריצה 1 ק\"מ"
  descriptionHe String?                           // Optional Hebrew description
  inputType   TestInputType
  unit        String?                             // e.g., "שניות", "חזרות", "ס\"מ"
  isGlobal    Boolean       @default(true)        // true = system-seeded, false = teacher-custom (future)
  createdAt   DateTime      @default(now())

  normTables  NormTable[]
  sessions    TestSession[]

  @@map("fitness_test_types")
}

// ─────────────────────────────────────────────
// NORM TABLES (System-seeded, read-only)
// ─────────────────────────────────────────────
// One row = one grade band for a specific (testType, gender, age range, raw value range)
// Multiple rows cover the full spectrum per test type.
// Score (0–100) maps to Hebrew label via getHebrewGradeLabel() in packages/types.
// ─────────────────────────────────────────────

model NormTable {
  id           String  @id @default(cuid())
  gender       Gender
  minAge       Int                   // Minimum age in years (inclusive)
  maxAge       Int                   // Maximum age in years (inclusive)
  minValue     Decimal               // Raw value lower bound (inclusive)
  maxValue     Decimal               // Raw value upper bound (exclusive, use Infinity via high number)
  score        Int                   // Grade awarded: 0–100

  testTypeId   String
  testType     FitnessTestType @relation(fields: [testTypeId], references: [id], onDelete: Cascade)

  @@index([testTypeId, gender, minAge, maxAge])
  @@map("norm_tables")
}

// ─────────────────────────────────────────────
// TEST SESSION (One grading session per class)
// ─────────────────────────────────────────────

model TestSession {
  id            String   @id @default(cuid())
  conductedAt   DateTime @default(now())
  notes         String?
  isStopwatch   Boolean  @default(false)    // true = stopwatch mode was used
  startedAt     DateTime?                   // Server-side stopwatch start time

  classId       String
  class         Class           @relation(fields: [classId], references: [id], onDelete: Cascade)

  testTypeId    String
  testType      FitnessTestType @relation(fields: [testTypeId], references: [id])

  results       TestResult[]
  attendanceRecords AttendanceRecord[]

  @@index([classId])
  @@map("test_sessions")
}

// ─────────────────────────────────────────────
// TEST RESULT (One row per student per session)
// ─────────────────────────────────────────────

model TestResult {
  id                String   @id @default(cuid())
  rawValue          Decimal?              // null = not yet entered (placeholder created at session start)
  calculatedGrade   Int?                  // 0–100, set by GradingService
  gradeOverride     Int?                  // 0–100, set manually by teacher
  overrideReason    String?               // Required when gradeOverride is set
  recordedAt        DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sessionId         String
  session           TestSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  studentId         String
  student           Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  // The effective grade = gradeOverride ?? calculatedGrade (resolved in application layer)

  @@unique([sessionId, studentId])
  @@index([studentId])
  @@map("test_results")
}

// ─────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────

model AttendanceRecord {
  id         String           @id @default(cuid())
  date       DateTime         @db.Date
  status     AttendanceStatus @default(PRESENT)
  notes      String?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  classId    String
  class      Class       @relation(fields: [classId], references: [id], onDelete: Cascade)

  studentId  String
  student    Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  sessionId  String?     // Optional: link to the test session this attendance was taken for
  session    TestSession? @relation(fields: [sessionId], references: [id])

  @@unique([classId, studentId, date])
  @@index([classId, date])
  @@map("attendance_records")
}

// ─────────────────────────────────────────────
// AUDIT LOG (Immutable — append-only)
// ─────────────────────────────────────────────

model AuditLog {
  id          String      @id @default(cuid())
  action      AuditAction
  entityType  String      // "TestResult" | "AttendanceRecord" | "ClassEnrollment"
  entityId    String      // ID of the affected record
  oldValue    Json?       // Snapshot before change
  newValue    Json?       // Snapshot after change
  createdAt   DateTime    @default(now())

  actorId     String      // userId (teacher) who performed the action
  actor       User        @relation(fields: [actorId], references: [id])

  @@index([entityType, entityId])
  @@index([actorId])
  @@map("audit_logs")
}
```

---

## Entity Relationship Diagram

```
User (Teacher)
  │
  └──< Class
          │
          ├──< ClassEnrollment >──── Student
          │                               │
          ├──< TestSession                │
          │        │                      │
          │        └──< TestResult >──────┘
          │
          └──< AttendanceRecord >─── Student
                   │
                   └── (optional) TestSession

FitnessTestType
  ├──< NormTable
  └──< TestSession

User
  └──< AuditLog
```

---

## Key Design Decisions

### Effective Grade Resolution
The "effective grade" shown to users is resolved in the application layer (never in SQL):
```ts
const effectiveGrade = result.gradeOverride ?? result.calculatedGrade;
```
Both fields are stored separately to preserve the audit trail.

### Stopwatch Mode
- `TestSession.isStopwatch = true` triggers stopwatch UI on mobile
- `TestSession.startedAt` is set server-side when teacher taps "Start" — client cannot forge this
- `TestResult.rawValue` receives `(tapReceivedAt - startedAt)` in seconds
- GradingService then grades this elapsed time against the TIME-type NormTable

### Student Code Uniqueness
`Student.studentCode` is unique **within a class** (not globally). The `@@unique([classId, studentCode])` on `ClassEnrollment` is enforced at the application layer since Prisma doesn't support compound unique with a field from a related table directly. The application service checks this before insert.

### Age Calculation for Norm Tables
Student age is computed at grading time (not stored):
```ts
const ageAtTest = differenceInYears(session.conductedAt, student.dateOfBirth);
```
This ensures the correct norm row is used even if a student has a birthday mid-semester.

### NormTable for PASS_FAIL Tests
For `TestInputType.PASS_FAIL`, only two NormTable rows exist per (testType, gender, age range):
- `rawValue = 1` (pass) → `score = 100`
- `rawValue = 0` (fail) → `score = 0`

### Soft Deletes
Not implemented to keep the schema simple. Instead:
- Removing a student from a class deletes the `ClassEnrollment` row (cascade preserves TestResults)
- Historical `TestResult` and `AttendanceRecord` rows are preserved even after enrollment ends

---

## Seed Data Requirements

The Prisma seed script (`apps/api/prisma/seed.ts`) must populate:

1. **FitnessTestType** rows (system-wide, `isGlobal: true`):
   - ריצה 1 ק"מ (TIME, seconds)
   - ריצת שאטל (TIME, seconds)
   - כפיפות בטן (REPS, repetitions)
   - שכיבות סמיכה (REPS, repetitions)
   - מתיחת גמישות (GENERAL, cm)
   - קפיצה לגובה (GENERAL, cm)

2. **NormTable** rows per test type, covering:
   - Gender: MALE / FEMALE
   - Age ranges: 12–13, 14–15, 16–17, 18+ (aligned with Israeli school grades)
   - Score bands: typically 5–7 rows per (testType, gender, ageGroup)

---

## Indexes Summary

| Table | Index | Rationale |
|-------|-------|-----------|
| `classes` | `teacherId` | Filter classes by teacher |
| `class_enrollments` | `classId`, `studentId` | Membership lookups |
| `norm_tables` | `testTypeId, gender, minAge, maxAge` | Grade calculation lookup |
| `test_sessions` | `classId` | Sessions per class |
| `test_results` | `studentId` | Student progress queries |
| `attendance_records` | `classId, date` | Attendance by class/date |
| `audit_logs` | `entityType, entityId` | Audit history per entity |
| `audit_logs` | `actorId` | Actions by teacher |
