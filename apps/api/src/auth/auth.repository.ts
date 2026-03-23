import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { GoogleTeacherProfile, TeacherProfileRecord, TeacherRecord, StudentLoginRecord } from './auth.types';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds an existing teacher by googleId and updates their profile data,
   * or creates a new User record if this is the first login.
   * Never returns sensitive fields.
   */
  async findOrCreateTeacher(
    profile: GoogleTeacherProfile,
  ): Promise<TeacherRecord> {
    return this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: {
        name: profile.name,
        avatarUrl: profile.avatarUrl ?? null,
      },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });
  }

  /**
   * Finds a teacher by email — used only by the dev-login bypass endpoint.
   */
  async findTeacherByEmail(email: string): Promise<TeacherRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }

  /**
   * Finds a teacher by primary key — used by GET /auth/me.
   * NOTE: After adding the `school` field to the Prisma schema, run
   *   `pnpm exec prisma generate && pnpm exec prisma migrate dev`
   * to make the field available on the Prisma client.
   */
  async findTeacherById(id: string): Promise<TeacherProfileRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (row === null) return null;
    // school is not yet in Prisma select until migration runs; default to null
    return { ...row, school: (row as Record<string, unknown>)['school'] as string | null ?? null };
  }

  /**
   * Finds the student+class record needed for credential validation.
   * Returns the passwordHash so AuthService can run bcrypt.compare.
   *
   * Throws UnauthorizedException with a generic message if the class code or
   * student code is not found — intentionally vague to prevent user enumeration.
   */
  async findStudentForLogin(
    classCode: string,
    studentCode: string,
  ): Promise<StudentLoginRecord> {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: {
        class: { joinCode: classCode },
        student: { studentCode },
      },
      select: {
        classId: true,
        student: {
          select: {
            id: true,
            passwordHash: true,
          },
        },
      },
    });

    if (enrollment === null) {
      throw new UnauthorizedException('קוד כיתה, קוד תלמיד, או סיסמה שגויים');
    }

    return {
      studentId: enrollment.student.id,
      classId: enrollment.classId,
      passwordHash: enrollment.student.passwordHash,
    };
  }
}
