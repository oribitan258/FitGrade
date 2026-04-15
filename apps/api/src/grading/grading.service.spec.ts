import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { GradingService } from './grading.service';
import { GradingRepository } from './grading.repository';

// ─── Mock repository ──────────────────────────────────────────────────────────

const mockGradingRepository = {
  findStudentById: jest.fn(),
  findNormRow: jest.fn(),
  findTestTypeInputType: jest.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fixed session date used across all calculateGrade tests. */
const SESSION_DATE = new Date('2025-09-01');

/** Returns a Date representing a person who is exactly `age` years old at SESSION_DATE. */
function dobForAge(age: number): Date {
  const d = new Date(SESSION_DATE);
  d.setFullYear(d.getFullYear() - age);
  return d;
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

  // ── calculateGrade ──────────────────────────────────────────────────────────

  describe('calculateGrade', () => {
    beforeEach(() => {
      // Default: norm-based test type (not PASS_FAIL)
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: 'REPS',
      });
    });

    it('returns the score from the matching norm row (happy path)', async () => {
      mockGradingRepository.findStudentById.mockResolvedValue({
        gender: 'MALE',
        dateOfBirth: dobForAge(16),
      });
      mockGradingRepository.findNormRow.mockResolvedValue({ score: 80 });

      const result = await service.calculateGrade('student-1', 'test-1', 500, SESSION_DATE);

      expect(result).toBe(80);
      expect(mockGradingRepository.findStudentById).toHaveBeenCalledWith(
        'student-1',
      );
      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith(
        'test-1',
        'MALE',
        16,
        new Prisma.Decimal(500),
      );
    });

    it('passes correct age for a female student (push-ups scenario)', async () => {
      mockGradingRepository.findStudentById.mockResolvedValue({
        gender: 'FEMALE',
        dateOfBirth: dobForAge(15),
      });
      mockGradingRepository.findNormRow.mockResolvedValue({ score: 65 });

      const result = await service.calculateGrade('student-2', 'pushups', 15, SESSION_DATE);

      expect(result).toBe(65);
      expect(mockGradingRepository.findNormRow).toHaveBeenCalledWith(
        'pushups',
        'FEMALE',
        15,
        new Prisma.Decimal(15),
      );
    });

    it('throws NotFoundException when student does not exist', async () => {
      mockGradingRepository.findStudentById.mockRejectedValue(
        new NotFoundException('Student not found'),
      );

      await expect(
        service.calculateGrade('no-such-student', 'test-1', 300, SESSION_DATE),
      ).rejects.toThrow(NotFoundException);

      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no norm row covers the raw value', async () => {
      mockGradingRepository.findStudentById.mockResolvedValue({
        gender: 'MALE',
        dateOfBirth: dobForAge(16),
      });
      mockGradingRepository.findNormRow.mockResolvedValue(null);

      await expect(
        service.calculateGrade('student-1', 'test-1', 99999, SESSION_DATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no norm row covers the student age', async () => {
      // Student is 30 — outside any seeded age range
      mockGradingRepository.findStudentById.mockResolvedValue({
        gender: 'MALE',
        dateOfBirth: dobForAge(30),
      });
      mockGradingRepository.findNormRow.mockResolvedValue(null);

      await expect(
        service.calculateGrade('student-1', 'test-1', 480, SESSION_DATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 100 for PASS_FAIL test when rawValue is 1 (pass)', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: 'PASS_FAIL',
      });

      const result = await service.calculateGrade('student-1', 'pf-test', 1, SESSION_DATE);

      expect(result).toBe(100);
      expect(mockGradingRepository.findStudentById).not.toHaveBeenCalled();
      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });

    it('returns 0 for PASS_FAIL test when rawValue is 0 (fail)', async () => {
      mockGradingRepository.findTestTypeInputType.mockResolvedValue({
        inputType: 'PASS_FAIL',
      });

      const result = await service.calculateGrade('student-1', 'pf-test', 0, SESSION_DATE);

      expect(result).toBe(0);
      expect(mockGradingRepository.findStudentById).not.toHaveBeenCalled();
      expect(mockGradingRepository.findNormRow).not.toHaveBeenCalled();
    });
  });

  // ── computeAge ──────────────────────────────────────────────────────────────

  describe('computeAge', () => {
    it('returns correct age when birthday has passed this year', () => {
      const dob = new Date(2008, 0, 1); // 1 Jan 2008
      const ref = new Date(2025, 5, 1); // 1 Jun 2025
      expect(service.computeAge(dob, ref)).toBe(17);
    });

    it('returns correct age when birthday has not yet occurred this year', () => {
      const dob = new Date(2008, 11, 31); // 31 Dec 2008
      const ref = new Date(2025, 5, 1);  // 1 Jun 2025
      expect(service.computeAge(dob, ref)).toBe(16);
    });

    it('returns correct age on the exact birthday', () => {
      const dob = new Date(2008, 5, 1); // 1 Jun 2008
      const ref = new Date(2025, 5, 1); // 1 Jun 2025
      expect(service.computeAge(dob, ref)).toBe(17);
    });

    it('returns 0 for a newborn (same day)', () => {
      const today = new Date(2025, 5, 1);
      expect(service.computeAge(today, today)).toBe(0);
    });

    it('returns 0 when just under one year old', () => {
      const dob = new Date(2025, 0, 2); // 2 Jan 2025
      const ref = new Date(2025, 0, 1); // 1 Jan 2025 — birthday tomorrow
      // ref is before dob? That should not happen in practice but age should be -1 or 0.
      // More realistic: dob one day before a full year
      const dob2 = new Date(2024, 5, 2); // 2 Jun 2024
      const ref2 = new Date(2025, 5, 1); // 1 Jun 2025 — one day short of a full year
      expect(service.computeAge(dob2, ref2)).toBe(0);
    });
  });
});
