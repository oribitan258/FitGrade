import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { TestsService } from './tests.service';
import { TestsRepository } from './tests.repository';
import { GradingService } from '../grading/grading.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockRepo = {
  findAllTestTypes: jest.fn(),
  findNormBandsForTestType: jest.fn(),
  verifyClassOwnership: jest.fn(),
  verifyTestTypeExists: jest.fn(),
  createSession: jest.fn(),
  findSessionWithStudents: jest.fn(),
  findSessionWithOwnership: jest.fn(),
  startSession: jest.fn(),
  completeSession: jest.fn(),
  overrideResultGrade: jest.fn(),
  deleteResult: jest.fn(),
  submitResult: jest.fn(),
  findStudentGender: jest.fn(),
  findTestTypeNameHe: jest.fn(),
};

const mockGrading = { calculateGrade: jest.fn() };
const mockAudit = { log: jest.fn() };

const SESSION_ID = 'session-uuid-1';
const CLASS_ID = 'class-uuid-1';
const STUDENT_ID = 'student-uuid-1';
const TEACHER_ID = 'teacher-uuid-1';
const TEST_TYPE_ID = 'tt-uuid-1';

describe('TestsService', () => {
  let service: TestsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestsService,
        { provide: TestsRepository, useValue: mockRepo },
        { provide: GradingService, useValue: mockGrading },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(TestsService);
  });

  beforeEach(() => jest.clearAllMocks());

  // ── getTestTypes ────────────────────────────────────────────────────────

  describe('getTestTypes', () => {
    it('returns test types from repository', async () => {
      const types = [{ id: TEST_TYPE_ID, nameHe: 'שכיבות שמיכה' }];
      mockRepo.findAllTestTypes.mockResolvedValue(types);

      const result = await service.getTestTypes();

      expect(result).toEqual(types);
    });
  });

  // ── createSession ───────────────────────────────────────────────────────

  describe('createSession', () => {
    it('verifies ownership and test type, then creates session', async () => {
      const session = { id: SESSION_ID, testTypeId: TEST_TYPE_ID };
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.verifyTestTypeExists.mockResolvedValue(undefined);
      mockRepo.createSession.mockResolvedValue(session);

      const result = await service.createSession(
        CLASS_ID,
        { testTypeId: TEST_TYPE_ID, semester: 'A' },
        TEACHER_ID,
      );

      expect(mockRepo.verifyClassOwnership).toHaveBeenCalledWith(CLASS_ID, TEACHER_ID);
      expect(mockRepo.verifyTestTypeExists).toHaveBeenCalledWith(TEST_TYPE_ID);
      expect(result).toEqual(session);
    });

    it('propagates ForbiddenException when class not owned', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.createSession(CLASS_ID, { testTypeId: TEST_TYPE_ID, semester: 'A' }, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.createSession).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when test type not found', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.verifyTestTypeExists.mockRejectedValue(new NotFoundException());

      await expect(
        service.createSession(CLASS_ID, { testTypeId: 'nonexistent', semester: 'A' }, TEACHER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.createSession).not.toHaveBeenCalled();
    });
  });

  // ── startSession ────────────────────────────────────────────────────────

  describe('startSession', () => {
    it('sets startedAt server-side via repository', async () => {
      const session = { id: SESSION_ID, startedAt: new Date() };
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.startSession.mockResolvedValue(session);

      const result = await service.startSession(SESSION_ID, TEACHER_ID);

      expect(mockRepo.findSessionWithOwnership).toHaveBeenCalledWith(SESSION_ID, TEACHER_ID);
      expect(mockRepo.startSession).toHaveBeenCalledWith(SESSION_ID);
      expect(result.startedAt).toBeInstanceOf(Date);
    });
  });

  // ── completeSession ─────────────────────────────────────────────────────

  describe('completeSession', () => {
    it('sets completedAt via repository', async () => {
      const session = { id: SESSION_ID, completedAt: new Date() };
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.completeSession.mockResolvedValue(session);

      const result = await service.completeSession(SESSION_ID, TEACHER_ID);

      expect(mockRepo.completeSession).toHaveBeenCalledWith(SESSION_ID);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  // ── deleteResult (30s undo window) ─────────────────────────────────────

  describe('deleteResult', () => {
    it('verifies ownership then calls repository delete', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.deleteResult.mockResolvedValue(undefined);

      await service.deleteResult(SESSION_ID, STUDENT_ID, TEACHER_ID);

      expect(mockRepo.deleteResult).toHaveBeenCalledWith(SESSION_ID, STUDENT_ID, 30_000);
    });

    it('propagates ForbiddenException from repository (outside undo window)', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.deleteResult.mockRejectedValue(new ForbiddenException('30s window expired'));

      await expect(
        service.deleteResult(SESSION_ID, STUDENT_ID, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('writes audit log on successful delete', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.deleteResult.mockResolvedValue(undefined);

      await service.deleteResult(SESSION_ID, STUDENT_ID, TEACHER_ID);

      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.RESULT_EDIT }),
      );
    });
  });

  // ── overrideGrade ───────────────────────────────────────────────────────

  describe('overrideGrade', () => {
    it('applies grade override and writes audit log', async () => {
      const result = { id: 'result-1', gradeOverride: 85 };
      mockRepo.findSessionWithOwnership.mockResolvedValue({ id: SESSION_ID });
      mockRepo.overrideResultGrade.mockResolvedValue(result);

      const returned = await service.overrideGrade(SESSION_ID, 'result-1', TEACHER_ID, {
        gradeOverride: 85,
        overrideReason: 'פציעה',
      });

      expect(returned).toEqual(result);
      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.GRADE_OVERRIDE }),
      );
    });
  });

  // ── submitResult ────────────────────────────────────────────────────────

  describe('submitResult', () => {
    it('calls GradingService and persists result', async () => {
      const session = { id: SESSION_ID, classId: CLASS_ID, testTypeId: TEST_TYPE_ID };
      const result = { id: 'r1', calculatedGrade: 80 };
      mockRepo.findSessionWithOwnership.mockResolvedValue(session);
      mockGrading.calculateGrade.mockResolvedValue(80);
      mockRepo.submitResult.mockResolvedValue(result);

      const dto = { studentId: STUDENT_ID, rawValue: 25 };
      const returned = await service.submitResult(SESSION_ID, dto, TEACHER_ID);

      expect(mockGrading.calculateGrade).toHaveBeenCalled();
      expect(returned).toEqual(result);
    });

    it('propagates ConflictException when student already has result in session', async () => {
      const session = { id: SESSION_ID, classId: CLASS_ID, testTypeId: TEST_TYPE_ID };
      mockRepo.findSessionWithOwnership.mockResolvedValue(session);
      mockGrading.calculateGrade.mockResolvedValue(75);
      mockRepo.submitResult.mockRejectedValue(new ConflictException('Duplicate result'));

      await expect(
        service.submitResult(SESSION_ID, { studentId: STUDENT_ID, rawValue: 25 }, TEACHER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });
});
