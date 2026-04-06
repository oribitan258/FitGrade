import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GradingPolicyData {
  fitnessWeight: number;
  conductWeight: number;
}

export interface ReportSettingsData {
  passingGrade: number;
  teacherName: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  teacherSignature: string | null;
}

/** Fields from UpdateReportSettingsDto that are safe to pass through to Prisma. */
export type ReportSettingsPatch = Partial<ReportSettingsData>;

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the teacher's global grading policy defaults. */
  async getGradingPolicy(teacherId: string): Promise<GradingPolicyData> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: { defaultFitnessWeight: true, defaultConductWeight: true },
    });
    return {
      fitnessWeight: user.defaultFitnessWeight,
      conductWeight: user.defaultConductWeight,
    };
  }

  /** Persists new global grading policy defaults for the teacher. */
  async updateGradingPolicy(
    teacherId: string,
    fitnessWeight: number,
    conductWeight: number,
  ): Promise<GradingPolicyData> {
    const updated = await this.prisma.user.update({
      where: { id: teacherId },
      data: { defaultFitnessWeight: fitnessWeight, defaultConductWeight: conductWeight },
      select: { defaultFitnessWeight: true, defaultConductWeight: true },
    });
    return {
      fitnessWeight: updated.defaultFitnessWeight,
      conductWeight: updated.defaultConductWeight,
    };
  }

  /** Returns the teacher's report & grading-presentation settings. */
  async getReportSettings(teacherId: string): Promise<ReportSettingsData> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: {
        passingGrade: true,
        teacherName: true,
        schoolName: true,
        schoolLogoUrl: true,
        teacherSignature: true,
      },
    });
  }

  /** Persists a partial update to the teacher's report settings. */
  async updateReportSettings(
    teacherId: string,
    patch: ReportSettingsPatch,
  ): Promise<ReportSettingsData> {
    return this.prisma.user.update({
      where: { id: teacherId },
      data: patch,
      select: {
        passingGrade: true,
        teacherName: true,
        schoolName: true,
        schoolLogoUrl: true,
        teacherSignature: true,
      },
    });
  }
}
