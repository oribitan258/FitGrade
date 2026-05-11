import { Injectable } from '@nestjs/common';
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
   * Surfaces onboarding state and default test preferences so the web layout
   * can decide whether to redirect to the onboarding flow.
   */
  async findTeacherById(id: string): Promise<TeacherProfileRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        school: true,
        avatarUrl: true,
        isOnboardingComplete: true,
        defaultMaleTestIds: true,
        defaultFemaleTestIds: true,
      },
    });
  }

  /**
   * Marks onboarding as complete for the given teacher.
   * Idempotent — safe to call multiple times.
   */
  async setOnboardingComplete(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnboardingComplete: true },
    });
  }

  /**
   * Persists the teacher's default test type IDs for boys/girls classes.
   * Both arrays are written atomically. Caller must validate IDs exist.
   */
  async setDefaultTestPreferences(
    userId: string,
    defaultMaleTestIds: string[],
    defaultFemaleTestIds: string[],
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { defaultMaleTestIds, defaultFemaleTestIds },
    });
  }

  /**
   * Resets onboarding state to incomplete — dev-only, used to re-test the tour.
   */
  async resetOnboardingState(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnboardingComplete: false },
    });
  }

  /**
   * Returns the subset of input IDs that exist in FitnessTestType.
   * Used by the service layer to validate onboarding preference payloads.
   */
  async findExistingTestTypeIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.fitnessTestType.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Finds the student+class record for national-ID login.
   * Resolves by nationalId alone; returns the most recently enrolled active class.
   * Returns null if no matching enrollment is found — caller throws generic 401.
   */
  async findStudentForNationalIdLogin(
    nationalId: string,
  ): Promise<StudentLoginRecord | null> {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: {
        student: { nationalId, deletedAt: null },
      },
      orderBy: { enrolledAt: 'desc' },
      select: {
        classId: true,
        student: { select: { id: true, passwordHash: true } },
      },
    });

    if (enrollment === null) return null;

    return {
      studentId: enrollment.student.id,
      classId: enrollment.classId,
      passwordHash: enrollment.student.passwordHash,
    };
  }
}
