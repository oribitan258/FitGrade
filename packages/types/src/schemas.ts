import { z } from 'zod';

// ─── Enum types (mirror Prisma enums, no Prisma import needed) ─────────────

export type Semester = 'A' | 'B';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

// ─── API response shapes ───────────────────────────────────────────────────

/** Mirrors ClassResponseDto returned by GET /classes and GET /classes/:id */
export interface ClassData {
  id: string;
  name: string;
  academicYear: string;
  semester: Semester;
  joinCode: string;
  joinCodeExpiresAt: string | null;
  studentCount: number;
  createdAt: string;
}

/** Mirrors StudentResponseDto returned by GET /classes/:classId/students */
export interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  gender: Gender;
  dateOfBirth: string;
  createdAt: string;
}

// ─── Form validation schemas ───────────────────────────────────────────────

/**
 * Validates the body sent to POST /classes.
 * academicYear must be in "YYYY-YYYY" format (e.g. "2024-2025").
 */
export const createClassSchema = z.object({
  name: z.string().min(1, 'שם הכיתה חובה'),
  academicYear: z.string().regex(
    /^\d{4}-\d{4}$/,
    'פורמט שנת לימודים לא תקין — לדוגמה: 2024-2025',
  ),
  semester: z.enum(['A', 'B'], { required_error: 'יש לבחור סמסטר' }),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

/**
 * Validates the body sent to POST /classes/:classId/students.
 * dateOfBirth must be a valid ISO 8601 date string.
 * password minimum 8 characters (hashed server-side by bcrypt).
 */
export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'שם פרטי חובה'),
  lastName: z.string().min(1, 'שם משפחה חובה'),
  dateOfBirth: z
    .string()
    .min(1, 'תאריך לידה חובה')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'תאריך לידה לא תקין' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'יש לבחור מין' }),
  studentCode: z
    .string()
    .min(2, 'קוד תלמיד חייב להכיל לפחות 2 תווים')
    .max(10, 'קוד תלמיד חייב להכיל לכל היותר 10 תווים'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
