/**
 * Property-Based Tests — GradingService
 *
 * Uses fast-check to throw thousands of random inputs at the grading engine,
 * proving that mathematical invariants hold across the full input space.
 * Each property is a theorem that must be true for ALL inputs in the domain.
 *
 * Run with: pnpm test --filter=api -- --testPathPattern=grading.property
 */

import fc from 'fast-check';
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

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Any finite JS number (no NaN, no Infinity — these are caught at DTO layer) */
const finiteDouble = fc.double({ noNaN: true, noDefaultInfinity: true });

/** Any number >= 1 (maps to PASS_FAIL "pass" outcome) */
const passingRawValue = finiteDouble.filter((v) => v >= 1);

/** Any number < 1 (maps to PASS_FAIL "fail" outcome) */
const failingRawValue = finiteDouble.filter((v) => v < 1);

/** Valid norm score in the system's domain */
const normScore = fc.integer({ min: 0, max: 100 });

/** Valid grade levels seeded in the system */
const gradeLevel = fc.integer({ min: 7, max: 12 });

/** All genders in the system */
const gender = fc.constantFrom<Gender>(Gender.MALE, Gender.FEMALE);

/** All non-PASS_FAIL input types (go through norm table) */
const normBasedInputType = fc.constantFrom<FitnessInputType>(
  FitnessInputType.REPS,
  FitnessInputType.TIME,
  FitnessInputType.GENERAL,
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GradingService — Property-Based Tests', () => {
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

  // ─── Property 1 ─────────────────────────────────────────────────────────────
  // PASS_FAIL: for ANY rawValue >= 1, the result is ALWAYS exactly 100.

  it('Property 1a: PASS_FAIL — any rawValue >= 1 always returns exactly 100', async () => {
    await fc.assert(
      fc.asyncProperty(passingRawValue, async (rawValue) => {
        mockGradingRepository.findTestTypeInputType.mockResolvedValue({
          inputType: FitnessInputType.PASS_FAIL,
        });

        const score = await service.calculateGrade('s', 'pf', rawValue, 'c');
        return score === 100;
      }),
      { numRuns: 200, verbose: true },
    );
  });

  // ─── Property 1b ─────────────────────────────────────────────────────────────
  // PASS_FAIL: for ANY rawValue < 1, the result is ALWAYS exactly 0.

  it('Property 1b: PASS_FAIL — any rawValue < 1 always returns exactly 0', async () => {
    await fc.assert(
      fc.asyncProperty(failingRawValue, async (rawValue) => {
        mockGradingRepository.findTestTypeInputType.mockResolvedValue({
          inputType: FitnessInputType.PASS_FAIL,
        });

        const score = await service.calculateGrade('s', 'pf', rawValue, 'c');
        return score === 0;
      }),
      { numRuns: 200, verbose: true },
    );
  });

  // ─── Property 2 ─────────────────────────────────────────────────────────────
  // Score pass-through: whatever score the norm table returns (0–100),
  // the service must return that exact value — no transformation applied.

  it('Property 2: norm-table score is passed through unchanged for any valid score (0–100)', async () => {
    await fc.assert(
      fc.asyncProperty(
        normScore,
        normBasedInputType,
        gradeLevel,
        gender,
        async (score, inputType, level, g) => {
          mockGradingRepository.findTestTypeInputType.mockResolvedValue({ inputType });
          mockGradingRepository.findStudentById.mockResolvedValue({ gender: g });
          mockGradingRepository.findClassGradeLevel.mockResolvedValue(level);
          mockGradingRepository.findNormRow.mockResolvedValue({ score });

          const result = await service.calculateGrade('s', 't', 50, 'c');
          return result === score;
        },
      ),
      { numRuns: 500, verbose: true },
    );
  });

  // ─── Property 3 ─────────────────────────────────────────────────────────────
  // Missing norm row: whenever findNormRow returns null, the service ALWAYS
  // throws BadRequestException — regardless of student gender, grade level, or rawValue.

  it('Property 3: null norm row always throws BadRequestException', async () => {
    await fc.assert(
      fc.asyncProperty(
        finiteDouble,
        gradeLevel,
        gender,
        normBasedInputType,
        async (rawValue, level, g, inputType) => {
          mockGradingRepository.findTestTypeInputType.mockResolvedValue({ inputType });
          mockGradingRepository.findStudentById.mockResolvedValue({ gender: g });
          mockGradingRepository.findClassGradeLevel.mockResolvedValue(level);
          mockGradingRepository.findNormRow.mockResolvedValue(null);

          try {
            await service.calculateGrade('s', 't', rawValue, 'c');
            return false; // Must have thrown — if we reach here, the property is violated
          } catch (e) {
            return e instanceof BadRequestException;
          }
        },
      ),
      { numRuns: 300, verbose: true },
    );
  });

  // ─── Property 4 ─────────────────────────────────────────────────────────────
  // Null gradeLevel: whenever findClassGradeLevel returns null, the service
  // ALWAYS throws BadRequestException AND never calls findNormRow.

  it('Property 4: null gradeLevel always throws BadRequestException and skips norm lookup', async () => {
    await fc.assert(
      fc.asyncProperty(
        finiteDouble,
        gender,
        normBasedInputType,
        async (rawValue, g, inputType) => {
          mockGradingRepository.findTestTypeInputType.mockResolvedValue({ inputType });
          mockGradingRepository.findStudentById.mockResolvedValue({ gender: g });
          mockGradingRepository.findClassGradeLevel.mockResolvedValue(null);
          jest.clearAllMocks();
          // Re-set after clearAllMocks so they return correct values
          mockGradingRepository.findTestTypeInputType.mockResolvedValue({ inputType });
          mockGradingRepository.findStudentById.mockResolvedValue({ gender: g });
          mockGradingRepository.findClassGradeLevel.mockResolvedValue(null);

          try {
            await service.calculateGrade('s', 't', rawValue, 'c');
            return false;
          } catch (e) {
            const threw = e instanceof BadRequestException;
            const skippedNorm = mockGradingRepository.findNormRow.mock.calls.length === 0;
            return threw && skippedNorm;
          }
        },
      ),
      { numRuns: 200, verbose: true },
    );
  });

  // ─── Property 5 ─────────────────────────────────────────────────────────────
  // PASS_FAIL never touches student or class repos: for any PASS_FAIL input,
  // findStudentById and findClassGradeLevel are NEVER called.

  it('Property 5: PASS_FAIL path never calls student or class repositories', async () => {
    await fc.assert(
      fc.asyncProperty(finiteDouble, async (rawValue) => {
        jest.clearAllMocks();
        mockGradingRepository.findTestTypeInputType.mockResolvedValue({
          inputType: FitnessInputType.PASS_FAIL,
        });

        await service.calculateGrade('s', 'pf', rawValue, 'c');

        const studentCalls = mockGradingRepository.findStudentById.mock.calls.length;
        const classCalls = mockGradingRepository.findClassGradeLevel.mock.calls.length;
        const normCalls = mockGradingRepository.findNormRow.mock.calls.length;

        return studentCalls === 0 && classCalls === 0 && normCalls === 0;
      }),
      { numRuns: 200, verbose: true },
    );
  });

  // ─── Property 6 ─────────────────────────────────────────────────────────────
  // Determinism: same inputs always produce the same output (no randomness
  // or side-effects in the service's calculation logic).

  it('Property 6: calculateGrade is deterministic — same inputs always return same score', async () => {
    await fc.assert(
      fc.asyncProperty(
        normScore,
        gradeLevel,
        gender,
        async (score, level, g) => {
          const setup = (): void => {
            mockGradingRepository.findTestTypeInputType.mockResolvedValue({
              inputType: FitnessInputType.REPS,
            });
            mockGradingRepository.findStudentById.mockResolvedValue({ gender: g });
            mockGradingRepository.findClassGradeLevel.mockResolvedValue(level);
            mockGradingRepository.findNormRow.mockResolvedValue({ score });
          };

          setup();
          const result1 = await service.calculateGrade('s', 't', 50, 'c');
          setup();
          const result2 = await service.calculateGrade('s', 't', 50, 'c');

          return result1 === result2 && result1 === score;
        },
      ),
      { numRuns: 300, verbose: true },
    );
  });
});
