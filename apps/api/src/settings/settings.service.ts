import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsRepository } from './settings.repository';
import type { GradingPolicyResponseDto, UpdateGradingPolicyDto } from './dto/grading-policy.dto';
import type { ReportSettingsResponseDto, UpdateReportSettingsDto } from './dto/report-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getGradingPolicy(teacherId: string): Promise<GradingPolicyResponseDto> {
    return this.settingsRepository.getGradingPolicy(teacherId);
  }

  async updateGradingPolicy(
    teacherId: string,
    dto: UpdateGradingPolicyDto,
  ): Promise<GradingPolicyResponseDto> {
    if (dto.fitnessWeight + dto.conductWeight !== 100) {
      throw new BadRequestException('משקל הכושר ומשקל התלמידות חייבים לסכום ל-100');
    }
    const result = await this.settingsRepository.updateGradingPolicy(
      teacherId,
      dto.fitnessWeight,
      dto.conductWeight,
    );
    this.logger.log(
      `Teacher ${teacherId} updated global grading policy: fitness=${dto.fitnessWeight}% conduct=${dto.conductWeight}%`,
    );
    return result;
  }

  async getReportSettings(teacherId: string): Promise<ReportSettingsResponseDto> {
    return this.settingsRepository.getReportSettings(teacherId);
  }

  async updateReportSettings(
    teacherId: string,
    dto: UpdateReportSettingsDto,
  ): Promise<ReportSettingsResponseDto> {
    const result = await this.settingsRepository.updateReportSettings(teacherId, {
      ...(dto.passingGrade !== undefined && { passingGrade: dto.passingGrade }),
      ...(dto.teacherName !== undefined && { teacherName: dto.teacherName }),
      ...(dto.schoolName !== undefined && { schoolName: dto.schoolName }),
      ...(dto.schoolLogoUrl !== undefined && { schoolLogoUrl: dto.schoolLogoUrl }),
      ...(dto.teacherSignature !== undefined && { teacherSignature: dto.teacherSignature }),
    });
    this.logger.log(`Teacher ${teacherId} updated report settings`);
    return result;
  }
}
