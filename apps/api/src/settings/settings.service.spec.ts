import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';

const mockRepo = {
  getGradingPolicy: jest.fn(),
  updateGradingPolicy: jest.fn(),
  getReportSettings: jest.fn(),
  updateReportSettings: jest.fn(),
};

const TEACHER_ID = 'teacher-uuid-1';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  beforeEach(() => jest.clearAllMocks());

  // ── getGradingPolicy ────────────────────────────────────────────────────

  describe('getGradingPolicy', () => {
    it('returns grading policy from repository', async () => {
      const policy = { fitnessWeight: 70, conductWeight: 30 };
      mockRepo.getGradingPolicy.mockResolvedValue(policy);

      const result = await service.getGradingPolicy(TEACHER_ID);

      expect(mockRepo.getGradingPolicy).toHaveBeenCalledWith(TEACHER_ID);
      expect(result).toEqual(policy);
    });
  });

  // ── updateGradingPolicy ─────────────────────────────────────────────────

  describe('updateGradingPolicy', () => {
    it('persists valid weights that sum to 100', async () => {
      const updated = { fitnessWeight: 60, conductWeight: 40 };
      mockRepo.updateGradingPolicy.mockResolvedValue(updated);

      const result = await service.updateGradingPolicy(TEACHER_ID, { fitnessWeight: 60, conductWeight: 40 });

      expect(mockRepo.updateGradingPolicy).toHaveBeenCalledWith(TEACHER_ID, 60, 40);
      expect(result).toEqual(updated);
    });

    it('throws BadRequestException when weights do not sum to 100', async () => {
      await expect(
        service.updateGradingPolicy(TEACHER_ID, { fitnessWeight: 70, conductWeight: 40 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.updateGradingPolicy).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when weights sum to 0', async () => {
      await expect(
        service.updateGradingPolicy(TEACHER_ID, { fitnessWeight: 0, conductWeight: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts weights within 0.5 tolerance (e.g. 70.3 + 29.7 = 100.0)', async () => {
      mockRepo.updateGradingPolicy.mockResolvedValue({ fitnessWeight: 70, conductWeight: 30 });
      await expect(
        service.updateGradingPolicy(TEACHER_ID, { fitnessWeight: 70.3, conductWeight: 29.7 }),
      ).resolves.not.toThrow();
    });
  });

  // ── getReportSettings ───────────────────────────────────────────────────

  describe('getReportSettings', () => {
    it('returns report settings from repository', async () => {
      const settings = { passingGrade: 55, teacherName: 'כהן', schoolName: 'בית ספר א' };
      mockRepo.getReportSettings.mockResolvedValue(settings);

      const result = await service.getReportSettings(TEACHER_ID);

      expect(mockRepo.getReportSettings).toHaveBeenCalledWith(TEACHER_ID);
      expect(result).toEqual(settings);
    });
  });

  // ── updateReportSettings ────────────────────────────────────────────────

  describe('updateReportSettings', () => {
    it('persists partial update (only provided fields)', async () => {
      const updated = { passingGrade: 60, teacherName: 'לוי', schoolName: 'בית ספר ב' };
      mockRepo.updateReportSettings.mockResolvedValue(updated);

      const result = await service.updateReportSettings(TEACHER_ID, { passingGrade: 60 });

      expect(mockRepo.updateReportSettings).toHaveBeenCalledWith(
        TEACHER_ID,
        { passingGrade: 60 },
      );
      expect(result).toEqual(updated);
    });

    it('passes all fields when all are provided', async () => {
      mockRepo.updateReportSettings.mockResolvedValue({});
      await service.updateReportSettings(TEACHER_ID, {
        passingGrade: 55,
        teacherName: 'כהן',
        schoolName: 'בית ספר',
        schoolLogoUrl: 'https://example.com/logo.png',
        teacherSignature: 'חתימה',
      });

      const [, payload] = mockRepo.updateReportSettings.mock.calls[0] as [string, Record<string, unknown>];
      expect(payload).toMatchObject({
        passingGrade: 55,
        teacherName: 'כהן',
        schoolName: 'בית ספר',
      });
    });
  });
});
