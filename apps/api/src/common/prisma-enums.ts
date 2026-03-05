/**
 * TypeScript enum constants for SQLite compatibility.
 *
 * Prisma does not support native enums with SQLite, so all enum fields in
 * the schema are stored as String. These constants and types provide the
 * same developer experience as Prisma-generated enums.
 *
 * Usage:
 *   import { Gender, AttendanceStatus } from '@/common/prisma-enums';
 *   // instead of:
 *   import { Gender, AttendanceStatus } from '@prisma/client';
 */

// ─── Role ────────────────────────────────────────────────────────────────────

export const Role = {
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ─── Gender ──────────────────────────────────────────────────────────────────

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

// ─── Semester ─────────────────────────────────────────────────────────────────

export const Semester = {
  A: 'A',
  B: 'B',
} as const;

export type Semester = (typeof Semester)[keyof typeof Semester];

// ─── TestInputType ────────────────────────────────────────────────────────────

export const TestInputType = {
  TIME: 'TIME',
  REPS: 'REPS',
  PASS_FAIL: 'PASS_FAIL',
  GENERAL: 'GENERAL',
} as const;

export type TestInputType = (typeof TestInputType)[keyof typeof TestInputType];

// ─── AttendanceStatus ─────────────────────────────────────────────────────────

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

// ─── AuditAction ─────────────────────────────────────────────────────────────

export const AuditAction = {
  GRADE_OVERRIDE: 'GRADE_OVERRIDE',
  GRADE_ENTRY: 'GRADE_ENTRY',
  RESULT_EDIT: 'RESULT_EDIT',
  ATTENDANCE_CHANGE: 'ATTENDANCE_CHANGE',
  STUDENT_ENROLLED: 'STUDENT_ENROLLED',
  STUDENT_REMOVED: 'STUDENT_REMOVED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
