import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FitnessInputType, Gender, Prisma } from '@prisma/client';
import { GradingService } from './grading.service';
import { GradingRepository } from './grading.repository';

// ─── Mock repository ──────────────────────────────────────────────────────────

const mockGradingRepository = {
  findStudentById: jest.fn(),
  findClassGradeLevel: jest.fn(),
  findNormRow: jest.fn(),
  findTestTypeInputType: jest.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupNormBasedTest(
  gender: Gender = Gender.MALE,
  gradeLevel: number = 10,
  score: number = 75,
): void {
  mockGradingRepository.findTestTypeInputType.mockResolvedValue({
    inputType: FitnessInputType.REPS,
  });
  mockGradingRepository.findStudentById.mockResolvedValue({ gender });
  mockGradingRepository.findClassGradeLevel.mockResolvedValue(gradeLevel);
  mockGradingRepository.findNormRow.mockResolvedValue({ score });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GradingService', () => {
  let service: GradingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingService,
        { provide: GradingRepository, useValue: mockGradingRepository },
      ],
    }).compile();

    service = module.get<GradingService>(GradingService);
    jest.clearAllMocks();
  });

  // ─── calculateGrade — REPS / TIME / GENERAL (norm-table path) ──────────────

  describe('calculateGrade — norm-table path', () => {
    it('returns the score from the matching norm row (happy path)', async () => {
      setupNormBasedTest(Gender.MALE, 10, 80);

      const result = await service.calculateGrade('student-1', 'test-1', 500, 'class-1');

      expect(result).toBe(80);
      expect(mockGradingRepository.findStudentById).toHaveBeenCalledWith('student-1');
      expect(mockGradingRepository.findClassGradeLevel).toHaveBeenCalledWith('class-1');
      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith(
        'test-1',
        Gender.MALE,
        10,
        new Prisma.Decimal(500),
      );
    });

    it('passes FEMALE gender to findNormRow (gender separation)', async () => {
      setupNormBasedTest(Gender.FEMALE, 9, 65);

      const result = await service.calculateGrade('student-2', 'pushups', 15, 'class-2');

      expect(result).toBe(65);
      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith(
        'pushups',
        Gender.FEMALE,
        9,
        new Prisma.Decimal(15),
      );
    });

    it('same rawValue calls findNormRow with different gender per student', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.REPS,
      });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(10);

      mockGradingRepository.findStudentById.mockResolvedValueOnce({ gender: Gender.MALE });
      mockGradingRepository.findNormRow.mockResolvedValueOnce({ score: 85 });
      const maleScore = await service.calculateGrade('male-student', 'test-1', 30, 'class-1');

      mockGradingRepository.findStudentById.mockResolvedValueOnce({ gender: Gender.FEMALE });
      mockGradingRepository.findNormRow.mockResolvedValueOnce({ score: 70 });
      const femaleScore = await service.calculateGrade('female-student', 'test-1', 30, 'class-1');

      expect(maleScore).toBe(85);
      expect(femaleScore).toBe(70);
      expect(mockGradingRepository.findNormRow).toHaveBeenNthCalledWith(1, 'test-1', Gender.MALE, 10, new Prisma.Decimal(30));
      expect(mockGradingRepository.findNormRow).toHaveBeenNthCalledWith(2, 'test-1', Gender.FEMALE, 10, new Prisma.Decimal(30));
    });

    it('returns score 0 when norm row score is exactly 0 (not treated as falsy)', async () => {
      setupNormBasedTest(Gender.MALE, 10, 0);

      const result = await service.calculateGrade('student-1', 'test-1', 1, 'class-1');

      expect(result).toBe(0);
    });

    it('returns score 100 when norm row score is exactly 100', async () => {
      setupNormBasedTest(Gender.MALE, 10, 100);

      const result = await service.calculateGrade('student-1', 'test-1', 999, 'class-1');

      expect(result).toBe(100);
    });

    it('passes rawValue as Prisma.Decimal to findNormRow', async () => {
      setupNormBasedTest(Gender.MALE, 10, 55);

      await service.calculateGrade('student-1', 'test-1', 12.5, 'class-1');

      const calledDecimal = mockGradingRepository.findNormRow.mock.calls[0][3] as Prisma.Decimal;
      expect(calledDecimal).toBeInstanceOf(Prisma.Decimal);
      expect(calledDecimal.toNumber()).toBe(12.5);
    });

    it('passes correct gradeLevel for each grade (grade 7)', async () => {
      setupNormBasedTest(Gender.MALE, 7, 60);

      await service.calculateGrade('s', 't', 100, 'c');

      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith('t', Gender.MALE, 7, new Prisma.Decimal(100));
    });

    it('TIME inputType goes through norm-table path (no special handling)', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.TIME,
      });
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.MALE });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(10);
      mockGradingRepository.findNormRow.mockResolvedValue({ score: 72 });

      const result = await service.calculateGrade('s', 'sprint-test', 8.5, 'c');

      expect(result).toBe(72);
      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith('sprint-test', Gender.MALE, 10, new Prisma.Decimal(8.5));
    });

    it('GENERAL inputType goes through norm-table path (no special handling)', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.GENERAL,
      });
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.FEMALE });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(8);
      mockGradingRepository.findNormRow.mockResolvedValue({ score: 75 });

      const result = await service.calculateGrade('s', 'general-test', 5, 'c');

      expect(result).toBe(75);
    });
  });

  // ─── calculateGrade — PASS_FAIL path ────────────────────────────────────────

  describe('calculateGrade — PASS_FAIL path', () => {
    beforeEach(() => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.PASS_FAIL,
      });
    });

    it('returns 100 for rawValue = 1 (pass)', async () => {
      expect(await service.calculateGrade('s', 'pf', 1, 'c')).toBe(100);
    });

    it('returns 0 for rawValue = 0 (fail)', async () => {
      expect(await service.calculateGrade('s', 'pf', 0, 'c')).toBe(0);
    });

    it('returns 100 for rawValue = 1.5 (>= 1 → pass)', async () => {
      expect(await service.calculateGrade('s', 'pf', 1.5, 'c')).toBe(100);
    });

    it('returns 100 for rawValue = 2 (any value >= 1)', async () => {
      expect(await service.calculateGrade('s', 'pf', 2, 'c')).toBe(100);
    });

    it('returns 0 for rawValue = 0.5 (< 1 → fail)', async () => {
      expect(await service.calculateGrade('s', 'pf', 0.5, 'c')).toBe(0);
    });

    it('returns 0 for rawValue = -1 (< 1 → fail)', async () => {
      expect(await service.calculateGrade('s', 'pf', -1, 'c')).toBe(0);
    });

    it('does NOT call findStudentById for PASS_FAIL', async () => {
      await service.calculateGrade('s', 'pf', 1, 'c');
      expect(mockGradingRepository.findStudentById).not.toHaveBeenCalled();
    });

    it('does NOT call findClassGradeLevel for PASS_FAIL', async () => {
      await service.calculateGrade('s', 'pf', 1, 'c');
      expect(mockGradingRepository.findClassGradeLevel).not.toHaveBeenCalled();
    });

    it('does NOT call findNormRow for PASS_FAIL', async () => {
      await service.calculateGrade('s', 'pf', 0, 'c');
      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });
  });

  // ─── calculateGrade — error paths ───────────────────────────────────────────

  describe('calculateGrade — error paths', () => {
    it('propagates NotFoundException when student does not exist', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.REPS,
      });
      mockGradingRepository.findStudentById.mockRejectedValue(
        new NotFoundException('Student not found'),
      );
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(7);

      await expect(
        service.calculateGrade('no-such-student', 'test-1', 300, 'class-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when class gradeLevel is null', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.REPS,
      });
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.MALE });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(null);

      await expect(
        service.calculateGrade('s', 'test-1', 300, 'class-no-grade'),
      ).rejects.toThrow(BadRequestException);

      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });

    it('throws BadRequestException with Hebrew message when gradeLevel is null', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: FitnessInputType.REPS,
      });
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.MALE });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(null);

      await expect(
        service.calculateGrade('s', 'test-1', 300, 'c'),
      ).rejects.toThrow('אין נתוני נורמה תואמים למבחן זה עבור שכבת גיל ומגדר אלו.');
    });

    it('throws BadRequestException when no norm row covers the raw value', async () => {
      setupNormBasedTest(Gender.MALE, 10, 0);
      mockGradingRepository.findNormRow.mockResolvedValue(null);

      await expect(
        service.calculateGrade('s', 'test-1', 99999, 'class-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with Hebrew message when no norm row found', async () => {
      setupNormBasedTest(Gender.MALE, 10, 0);
      mockGradingRepository.findNormRow.mockResolvedValue(null);

      await expect(
        service.calculateGrade('s', 'long-run-test', 480, 'class-grade1'),
      ).rejects.toThrow('אין נתוני נורמה תואמים למבחן זה עבור שכבת גיל ומגדר אלו.');
    });

    it('propagates NotFoundException when test type does not exist', async () => {
      mockGradingRepository.findTestTypeInputType.mockRejectedValue(
        new NotFoundException('Test type not found'),
      );

      await expect(
        service.calculateGrade('s', 'nonexistent-test', 50, 'c'),
      ).rejects.toThrow(NotFoundException);

      expect(mockGradingRepository.findStudentById).not.toHaveBeenCalled();
      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });
  });

  // ─── calculateGrade — repository call sequence ───────────────────────────────

  describe('calculateGrade — repository call sequence', () => {
    it('calls repositories in correct order for norm-based test', async () => {
      const callOrder: string[] = [];
      mockGradingRepository.findTestTypeInputType.mockImplementation(async () => {
        callOrder.push('findTestTypeInputType');
        return { inputType: FitnessInputType.REPS };
      });
      mockGradingRepository.findStudentById.mockImplementation(async () => {
        callOrder.push('findStudentById');
        return { gender: Gender.MALE };
      });
      mockGradingRepository.findClassGradeLevel.mockImplementation(async () => {
        callOrder.push('findClassGradeLevel');
        return 10;
      });
      mockGradingRepository.findNormRow.mockImplementation(async () => {
        callOrder.push('findNormRow');
        return { score: 77 };
      });

      await service.calculateGrade('s', 't', 50, 'c');

      expect(callOrder[0]).toBe('findTestTypeInputType');
      expect(callOrder[callOrder.length - 1]).toBe('findNormRow');
    });

    it('short-circuits after gradeLevel=null — skips findNormRow', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({ inputType: FitnessInputType.REPS });
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.MALE });
      mockGradingRepository.findClassGradeLevel.mockResolvedValue(null);

      await service.calculateGrade('s', 't', 50, 'c').catch(() => {});

      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });
  });

  // ─── getStudentGender ────────────────────────────────────────────────────────

  describe('getStudentGender', () => {
    it('returns MALE gender for a male student', async () => {
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.MALE });

      const gender = await service.getStudentGender('male-student');

      expect(gender).toBe(Gender.MALE);
      expect(mockGradingRepository.findStudentById).toHaveBeenCalledWith('male-student');
    });

    it('returns FEMALE gender for a female student', async () => {
      mockGradingRepository.findStudentById.mockResolvedValue({ gender: Gender.FEMALE });

      const gender = await service.getStudentGender('female-student');

      expect(gender).toBe(Gender.FEMALE);
    });

    it('propagates NotFoundException when student does not exist', async () => {
      mockGradingRepository.findStudentById.mockRejectedValue(
        new NotFoundException('Student not found'),
      );

      await expect(service.getStudentGender('no-student')).rejects.toThrow(NotFoundException);
    });
  });
});
