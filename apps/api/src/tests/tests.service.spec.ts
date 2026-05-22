import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction, FitnessInputType } from '@prisma/client';
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
  verifyStudentEnrolled: jest.fn(),
  createResult: jest.fn(),
  submitResult: jest.fn(),
  findStudentGender: jest.fn(),
  findTestTypeNameHe: jest.fn(),
  // history endpoints
  findSessionsByClass: jest.fn(),
  findResultInSession: jest.fn(),
  updateResultRawValue: jest.fn(),
  deleteResultByIdInHistory: jest.fn(),
  deleteSession: jest.fn(),
};

const mockGrading = { calculateGrade: jest.fn() };
const mockAudit = { log: jest.fn() };

const SESSION_ID = 'session-uuid-1';
const CLASS_ID = 'class-uuid-1';
const STUDENT_ID = 'student-uuid-1';
const TEACHER_ID = 'teacher-uuid-1';
const TEST_TYPE_ID = 'tt-uuid-1';
const RESULT_ID = 'result-uuid-1';

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
      const session = {
        id: SESSION_ID,
        classId: CLASS_ID,
        testTypeId: TEST_TYPE_ID,
        inputType: FitnessInputType.REPS,
        testNameHe: 'שכיבות שמיכה',
        isStopwatch: false,
        startedAt: null,
        conductedAt: new Date(),
      };
      const result = { id: 'r1', calculatedGrade: 80 };
      mockRepo.findSessionWithOwnership.mockResolvedValue(session);
      mockRepo.verifyStudentEnrolled.mockResolvedValue(undefined);
      mockGrading.calculateGrade.mockResolvedValue(80);
      mockRepo.createResult.mockResolvedValue(result);

      const dto = { studentId: STUDENT_ID, rawValue: 25 };
      const returned = await service.submitResult(SESSION_ID, dto, TEACHER_ID);

      expect(mockGrading.calculateGrade).toHaveBeenCalled();
      expect(returned).toEqual(result);
    });

    it('propagates ConflictException when student already has result in session', async () => {
      const session = {
        id: SESSION_ID,
        classId: CLASS_ID,
        testTypeId: TEST_TYPE_ID,
        inputType: FitnessInputType.REPS,
        testNameHe: 'שכיבות שמיכה',
        isStopwatch: false,
        startedAt: null,
        conductedAt: new Date(),
      };
      mockRepo.findSessionWithOwnership.mockResolvedValue(session);
      mockRepo.verifyStudentEnrolled.mockResolvedValue(undefined);
      mockGrading.calculateGrade.mockResolvedValue(75);
      mockRepo.createResult.mockRejectedValue(new ConflictException('Duplicate result'));

      await expect(
        service.submitResult(SESSION_ID, { studentId: STUDENT_ID, rawValue: 25 }, TEACHER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── getSessionsByClass ─────────────────────────────────────────────────────

  describe('getSessionsByClass', () => {
    const ROWS = [
      {
        id: SESSION_ID,
        testTypeId: TEST_TYPE_ID,
        testNameHe: 'שכיבות שמיכה',
        conductedAt: new Date('2026-03-01'),
        semester: 'A',
        isStopwatch: false,
        completedAt: null,
        resultCount: 12,
      },
    ];

    it('verifies class ownership then returns rows and total', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.findSessionsByClass.mockResolvedValue([ROWS, 1]);

      const result = await service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 50, skip: 0 });

      expect(mockRepo.verifyClassOwnership).toHaveBeenCalledWith(CLASS_ID, TEACHER_ID);
      expect(mockRepo.findSessionsByClass).toHaveBeenCalledWith(CLASS_ID, 50, 0);
      expect(result).toEqual({ rows: ROWS, total: 1 });
    });

    it('propagates ForbiddenException when class not owned', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 50, skip: 0 }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.findSessionsByClass).not.toHaveBeenCalled();
    });
  });

  // ── editResultRawValue ─────────────────────────────────────────────────────

  describe('editResultRawValue', () => {
    const EXISTING_RESULT = {
      id: RESULT_ID,
      studentId: STUDENT_ID,
      rawValue: 45,
      calculatedGrade: 70,
    };
    const UPDATED_RESULT = { id: RESULT_ID, sessionId: SESSION_ID, studentId: STUDENT_ID, rawValue: 50, calculatedGrade: 80, gradeOverride: null, recordedAt: new Date() };

    it('recalculates grade and updates result for REPS inputType', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({
        testTypeId: TEST_TYPE_ID,
        inputType: FitnessInputType.REPS,
        testNameHe: 'שכיבות שמיכה',
        classId: CLASS_ID,
        isStopwatch: false,
        startedAt: null,
        conductedAt: new Date(),
      });
      mockRepo.findResultInSession.mockResolvedValue(EXISTING_RESULT);
      mockGrading.calculateGrade.mockResolvedValue(80);
      mockRepo.updateResultRawValue.mockResolvedValue(UPDATED_RESULT);

      const result = await service.editResultRawValue(RESULT_ID, SESSION_ID, 50, TEACHER_ID);

      expect(mockRepo.findSessionWithOwnership).toHaveBeenCalledWith(SESSION_ID, TEACHER_ID);
      expect(mockRepo.findResultInSession).toHaveBeenCalledWith(RESULT_ID, SESSION_ID);
      expect(mockGrading.calculateGrade).toHaveBeenCalledWith(STUDENT_ID, TEST_TYPE_ID, 50, CLASS_ID);
      expect(mockRepo.updateResultRawValue).toHaveBeenCalledWith(RESULT_ID, SESSION_ID, 50, 80);
      expect(result).toEqual(UPDATED_RESULT);
    });

    it('rejects TIME rawValue below MIN_TIME_SECONDS', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({
        testTypeId: TEST_TYPE_ID,
        inputType: FitnessInputType.TIME,
        testNameHe: 'ריצת 60 מטר',
        classId: CLASS_ID,
        isStopwatch: false,
        startedAt: null,
        conductedAt: new Date(),
      });

      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 10, TEACHER_ID),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.updateResultRawValue).not.toHaveBeenCalled();
    });

    it('writes RESULT_EDIT audit log on success', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({
        testTypeId: TEST_TYPE_ID,
        inputType: FitnessInputType.REPS,
        testNameHe: 'כפיפות בטן',
        classId: CLASS_ID,
        isStopwatch: false,
        startedAt: null,
        conductedAt: new Date(),
      });
      mockRepo.findResultInSession.mockResolvedValue(EXISTING_RESULT);
      mockGrading.calculateGrade.mockResolvedValue(80);
      mockRepo.updateResultRawValue.mockResolvedValue(UPDATED_RESULT);

      await service.editResultRawValue(RESULT_ID, SESSION_ID, 50, TEACHER_ID);

      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RESULT_EDIT,
          entityId: RESULT_ID,
          oldValue: expect.objectContaining({ rawValue: 45 }),
          newValue: expect.objectContaining({ rawValue: 50, calculatedGrade: 80 }),
        }),
      );
    });

    it('propagates ForbiddenException when session not owned', async () => {
      mockRepo.findSessionWithOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 50, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.updateResultRawValue).not.toHaveBeenCalled();
    });
  });

  // ── deleteResultInHistory ──────────────────────────────────────────────────

  describe('deleteResultInHistory', () => {
    const EXISTING_RESULT = { id: RESULT_ID, studentId: STUDENT_ID, rawValue: 45, calculatedGrade: 70 };

    it('verifies ownership, snapshots result, then deletes', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ classId: CLASS_ID });
      mockRepo.findResultInSession.mockResolvedValue(EXISTING_RESULT);
      mockRepo.deleteResultByIdInHistory.mockResolvedValue(undefined);

      await service.deleteResultInHistory(RESULT_ID, SESSION_ID, TEACHER_ID);

      expect(mockRepo.findSessionWithOwnership).toHaveBeenCalledWith(SESSION_ID, TEACHER_ID);
      expect(mockRepo.findResultInSession).toHaveBeenCalledWith(RESULT_ID, SESSION_ID);
      expect(mockRepo.deleteResultByIdInHistory).toHaveBeenCalledWith(RESULT_ID, SESSION_ID);
    });

    it('writes RESULT_EDIT audit log with deleted:true and history:true', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ classId: CLASS_ID });
      mockRepo.findResultInSession.mockResolvedValue(EXISTING_RESULT);
      mockRepo.deleteResultByIdInHistory.mockResolvedValue(undefined);

      await service.deleteResultInHistory(RESULT_ID, SESSION_ID, TEACHER_ID);

      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RESULT_EDIT,
          entityId: RESULT_ID,
          newValue: expect.objectContaining({ deleted: true, history: true, studentId: STUDENT_ID }),
        }),
      );
    });

    it('propagates NotFoundException when result not in session', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ classId: CLASS_ID });
      mockRepo.findResultInSession.mockRejectedValue(new NotFoundException());

      await expect(
        service.deleteResultInHistory(RESULT_ID, SESSION_ID, TEACHER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.deleteResultByIdInHistory).not.toHaveBeenCalled();
    });
  });

  // ── deleteSession ──────────────────────────────────────────────────────────

  describe('deleteSession', () => {
    it('delegates to repository and writes SESSION_DELETED audit log', async () => {
      const conductedAt = new Date('2026-03-01');
      mockRepo.deleteSession.mockResolvedValue({ deletedResultCount: 15, conductedAt });

      await service.deleteSession(SESSION_ID, TEACHER_ID);

      expect(mockRepo.deleteSession).toHaveBeenCalledWith(SESSION_ID, TEACHER_ID);
      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SESSION_DELETED,
          entityType: 'TestSession',
          entityId: SESSION_ID,
          newValue: expect.objectContaining({ resultCount: 15, conductedAt }),
        }),
      );
    });

    it('propagates NotFoundException when session not found', async () => {
      mockRepo.deleteSession.mockRejectedValue(new NotFoundException());

      await expect(service.deleteSession(SESSION_ID, TEACHER_ID)).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException when session belongs to another teacher', async () => {
      mockRepo.deleteSession.mockRejectedValue(new ForbiddenException());

      await expect(service.deleteSession(SESSION_ID, TEACHER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('audit log shows resultCount:0 when session had no results', async () => {
      const conductedAt = new Date('2026-03-01');
      mockRepo.deleteSession.mockResolvedValue({ deletedResultCount: 0, conductedAt });

      await service.deleteSession(SESSION_ID, TEACHER_ID);

      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SESSION_DELETED,
          newValue: expect.objectContaining({ resultCount: 0 }),
        }),
      );
    });
  });

  // ── getSessionsByClass — additional edge cases ─────────────────────────────

  describe('getSessionsByClass — edge cases', () => {
    it('returns empty rows and zero total when class has no sessions', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.findSessionsByClass.mockResolvedValue([[], 0]);

      const result = await service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 50, skip: 0 });

      expect(result).toEqual({ rows: [], total: 0 });
    });

    it('returns empty rows but correct total when skip is beyond the available count', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      // 3 sessions exist in DB but skip=100 so repository returns no rows
      mockRepo.findSessionsByClass.mockResolvedValue([[], 3]);

      const result = await service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 50, skip: 100 });

      expect(result).toEqual({ rows: [], total: 3 });
    });

    it('returns empty rows when take=0', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.findSessionsByClass.mockResolvedValue([[], 5]);

      const result = await service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 0, skip: 0 });

      expect(result.rows).toHaveLength(0);
      expect(result.total).toBe(5);
    });

    it('does not call findSessionsByClass when verifyClassOwnership throws', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new NotFoundException());

      await expect(
        service.getSessionsByClass(CLASS_ID, TEACHER_ID, { take: 50, skip: 0 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.findSessionsByClass).not.toHaveBeenCalled();
    });
  });

  // ── editResultRawValue — additional edge cases ─────────────────────────────

  describe('editResultRawValue — edge cases', () => {
    const SESSION_DATA_REPS = {
      testTypeId: TEST_TYPE_ID,
      inputType: FitnessInputType.REPS,
      testNameHe: 'שכיבות שמיכה',
      classId: CLASS_ID,
      isStopwatch: false,
      startedAt: null,
      conductedAt: new Date(),
    };
    const SESSION_DATA_TIME = { ...SESSION_DATA_REPS, inputType: FitnessInputType.TIME };

    it('propagates NotFoundException when resultId belongs to a different session (SEC-001)', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue(SESSION_DATA_REPS);
      // Compound WHERE (id, sessionId) finds nothing — cross-session injection blocked
      mockRepo.findResultInSession.mockRejectedValue(new NotFoundException());

      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 30, TEACHER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.updateResultRawValue).not.toHaveBeenCalled();
      expect(mockGrading.calculateGrade).not.toHaveBeenCalled();
    });

    it('TIME rawValue exactly at MIN_TIME_SECONDS boundary (30) passes validation', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue(SESSION_DATA_TIME);
      mockRepo.findResultInSession.mockResolvedValue({ id: RESULT_ID, studentId: STUDENT_ID, rawValue: 45, calculatedGrade: 70 });
      mockGrading.calculateGrade.mockResolvedValue(85);
      mockRepo.updateResultRawValue.mockResolvedValue({ id: RESULT_ID });

      // 30 is NOT below 30, so no BadRequestException should be thrown
      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 30, TEACHER_ID),
      ).resolves.not.toThrow();
      expect(mockRepo.updateResultRawValue).toHaveBeenCalled();
    });

    it('REPS rawValue=0 passes validation (no minimum for non-TIME types)', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue(SESSION_DATA_REPS);
      mockRepo.findResultInSession.mockResolvedValue({ id: RESULT_ID, studentId: STUDENT_ID, rawValue: 25, calculatedGrade: 60 });
      mockGrading.calculateGrade.mockResolvedValue(0);
      mockRepo.updateResultRawValue.mockResolvedValue({ id: RESULT_ID });

      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 0, TEACHER_ID),
      ).resolves.not.toThrow();
      expect(mockRepo.updateResultRawValue).toHaveBeenCalledWith(RESULT_ID, SESSION_ID, 0, 0);
    });

    it('does not call updateResultRawValue when GradingService throws', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue(SESSION_DATA_REPS);
      mockRepo.findResultInSession.mockResolvedValue({ id: RESULT_ID, studentId: STUDENT_ID, rawValue: 25, calculatedGrade: 60 });
      mockGrading.calculateGrade.mockRejectedValue(new Error('Norm table not found'));

      await expect(
        service.editResultRawValue(RESULT_ID, SESSION_ID, 30, TEACHER_ID),
      ).rejects.toThrow('Norm table not found');
      expect(mockRepo.updateResultRawValue).not.toHaveBeenCalled();
    });
  });

  // ── deleteResultInHistory — additional edge cases ──────────────────────────

  describe('deleteResultInHistory — edge cases', () => {
    it('propagates NotFoundException from deleteResultByIdInHistory after snapshot', async () => {
      mockRepo.findSessionWithOwnership.mockResolvedValue({ classId: CLASS_ID });
      mockRepo.findResultInSession.mockResolvedValue({ id: RESULT_ID, studentId: STUDENT_ID, rawValue: 45, calculatedGrade: 70 });
      mockRepo.deleteResultByIdInHistory.mockRejectedValue(new NotFoundException());

      await expect(
        service.deleteResultInHistory(RESULT_ID, SESSION_ID, TEACHER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not proceed when session ownership check fails', async () => {
      mockRepo.findSessionWithOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.deleteResultInHistory(RESULT_ID, SESSION_ID, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.findResultInSession).not.toHaveBeenCalled();
      expect(mockRepo.deleteResultByIdInHistory).not.toHaveBeenCalled();
    });
  });
});
