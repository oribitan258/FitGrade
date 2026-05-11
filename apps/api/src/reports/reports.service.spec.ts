import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockRepo = {
  verifyClassOwnership: jest.fn(),
  findTeacherGradingDefaults: jest.fn(),
  findStudentsInClass: jest.fn(),
  findAllTestResults: jest.fn(),
  findAllTalmidautSummaries: jest.fn(),
  findAttendanceStats: jest.fn(),
  findFinalGradeOverrides: jest.fn(),
  saveGradeOverrides: jest.fn(),
  findAttendanceReport: jest.fn(),
};

const mockAudit = { log: jest.fn() };

const CLASS_ID = 'class-uuid-1';
const TEACHER_ID = 'teacher-uuid-1';
const STUDENT_ID = 'student-uuid-1';

const STUDENT = {
  id: STUDENT_ID,
  firstName: 'דוד',
  lastName: 'לוי',
  studentCode: '1234',
  gender: 'MALE',
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: mockRepo },
        { provide: AuditLogService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  beforeEach(() => jest.clearAllMocks());

  function setupDefaults(
    testWeight: number | null = null,
    talmidautWeight: number | null = null,
  ): void {
    mockRepo.verifyClassOwnership.mockResolvedValue({
      name: 'כיתה ז׳1',
      testWeight,
      talmidautWeight,
    });
    mockRepo.findTeacherGradingDefaults.mockResolvedValue({
      defaultFitnessWeight: 70,
      defaultConductWeight: 30,
    });
    mockRepo.findStudentsInClass.mockResolvedValue([STUDENT]);
    mockRepo.findAllTestResults.mockResolvedValue([]);
    mockRepo.findAllTalmidautSummaries.mockResolvedValue([{ studentId: STUDENT_ID, compositeScores: [] }]);
    mockRepo.findAttendanceStats.mockResolvedValue([]);
    mockRepo.findFinalGradeOverrides.mockResolvedValue([]);
  }

  // ── getClassReport — student always appears ─────────────────────────────

  describe('getClassReport', () => {
    it('returns a row for every enrolled student even when no test results exist', async () => {
      setupDefaults();

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows).toHaveLength(1);
      expect(rows[0].studentId).toBe(STUDENT_ID);
      expect(rows[0].fitnessAvg).toBe(0);
      expect(rows[0].testBreakdown).toEqual([]);
    });

    it('returns empty array when class has no enrolled students', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue({ name: 'ריק', testWeight: null, talmidautWeight: null });
      mockRepo.findTeacherGradingDefaults.mockResolvedValue({ defaultFitnessWeight: 70, defaultConductWeight: 30 });
      mockRepo.findStudentsInClass.mockResolvedValue([]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows).toEqual([]);
    });

    it('uses class weight overrides when set, not teacher defaults', async () => {
      setupDefaults(80, 20); // class overrides teacher's 70/30

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].fitnessWeight).toBe(80);
      expect(rows[0].conductWeight).toBe(20);
    });

    it('falls back to teacher global defaults when class weights are null', async () => {
      setupDefaults(null, null);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].fitnessWeight).toBe(70);
      expect(rows[0].conductWeight).toBe(30);
    });

    it('computes fitnessAvg as average of best grades per test type', async () => {
      setupDefaults();
      // Two results for same test type → best (90) used; one result for another type (70)
      mockRepo.findAllTestResults.mockResolvedValue([
        { studentId: STUDENT_ID, testTypeId: 'tt1', testNameHe: 'שכיבות', effectiveGrade: 90 },
        { studentId: STUDENT_ID, testTypeId: 'tt1', testNameHe: 'שכיבות', effectiveGrade: 60 },
        { studentId: STUDENT_ID, testTypeId: 'tt2', testNameHe: 'ריצה', effectiveGrade: 70 },
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      // avg of [90, 70] = 80
      expect(rows[0].fitnessAvg).toBe(80);
    });

    it('applies unexcused absence penalty to conductScore', async () => {
      setupDefaults();
      mockRepo.findAllTalmidautSummaries.mockResolvedValue([
        { studentId: STUDENT_ID, compositeScores: [80] },
      ]);
      // 2 absences × 5 penalty = 10 deducted from talmidaut avg of 80 → 70
      mockRepo.findAttendanceStats.mockResolvedValue([
        { studentId: STUDENT_ID, status: 'ABSENT', count: 2 },
        { studentId: STUDENT_ID, status: 'PRESENT', count: 18 },
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].conductScore).toBe(70);
      expect(rows[0].unexcusedAbsences).toBe(2);
    });

    it('excludes EXCUSED records from total lesson count', async () => {
      setupDefaults();
      mockRepo.findAttendanceStats.mockResolvedValue([
        { studentId: STUDENT_ID, status: 'PRESENT', count: 15 },
        { studentId: STUDENT_ID, status: 'ABSENT',  count: 2 },
        { studentId: STUDENT_ID, status: 'EXCUSED', count: 3 }, // excluded from total
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].totalLessons).toBe(17); // 15 + 2, not 15 + 2 + 3
    });

    it('clamps conductScore to 0 when many absences (never negative)', async () => {
      setupDefaults();
      mockRepo.findAllTalmidautSummaries.mockResolvedValue([
        { studentId: STUDENT_ID, compositeScores: [50] },
      ]);
      mockRepo.findAttendanceStats.mockResolvedValue([
        { studentId: STUDENT_ID, status: 'ABSENT', count: 20 },
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].conductScore).toBe(0); // clamped, not negative
    });

    it('computes recommendedFinalGrade using effective weights', async () => {
      setupDefaults(60, 40);
      mockRepo.findAllTestResults.mockResolvedValue([
        { studentId: STUDENT_ID, testTypeId: 'tt1', testNameHe: 'שכיבות', effectiveGrade: 80 },
      ]);
      mockRepo.findAllTalmidautSummaries.mockResolvedValue([
        { studentId: STUDENT_ID, compositeScores: [100] },
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      // 80 * 0.6 + 100 * 0.4 = 48 + 40 = 88
      expect(rows[0].recommendedFinalGrade).toBe(88);
    });

    it('surfaces teacherFinalGrade override and verbalComment from override record', async () => {
      setupDefaults();
      mockRepo.findFinalGradeOverrides.mockResolvedValue([
        { studentId: STUDENT_ID, teacherFinalGrade: 95, verbalComment: 'מצוין' },
      ]);

      const rows = await service.getClassReport(CLASS_ID, TEACHER_ID);

      expect(rows[0].teacherFinalGrade).toBe(95);
      expect(rows[0].verbalComment).toBe('מצוין');
    });

    it('propagates ForbiddenException when class not owned by teacher', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.getClassReport(CLASS_ID, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── saveGradeOverrides ──────────────────────────────────────────────────

  describe('saveGradeOverrides', () => {
    it('verifies ownership and saves overrides', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue({ name: 'כיתה', testWeight: null, talmidautWeight: null });
      mockRepo.saveGradeOverrides.mockResolvedValue(undefined);

      await service.saveGradeOverrides(CLASS_ID, TEACHER_ID, [
        { studentId: STUDENT_ID, teacherFinalGrade: 90, verbalComment: 'כל הכבוד' },
      ]);

      expect(mockRepo.saveGradeOverrides).toHaveBeenCalledWith(CLASS_ID, [
        expect.objectContaining({ studentId: STUDENT_ID, teacherFinalGrade: 90 }),
      ]);
    });

    it('skips saving and does not call repo when overrides list is empty', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue({ name: 'כיתה', testWeight: null, talmidautWeight: null });

      await service.saveGradeOverrides(CLASS_ID, TEACHER_ID, []);

      expect(mockRepo.saveGradeOverrides).not.toHaveBeenCalled();
    });

    it('writes one audit log entry per override', async () => {
      mockRepo.verifyClassOwnership.mockResolvedValue({ name: 'כיתה', testWeight: null, talmidautWeight: null });
      mockRepo.saveGradeOverrides.mockResolvedValue(undefined);

      await service.saveGradeOverrides(CLASS_ID, TEACHER_ID, [
        { studentId: 's1', teacherFinalGrade: 85 },
        { studentId: 's2', teacherFinalGrade: 70 },
      ]);

      await Promise.resolve();
      expect(mockAudit.log).toHaveBeenCalledTimes(2);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.GRADE_OVERRIDE }),
      );
    });
  });

  // ── getCommentsBank ─────────────────────────────────────────────────────

  describe('getCommentsBank', () => {
    it('returns a non-empty array of Hebrew strings', () => {
      const bank = service.getCommentsBank();
      expect(Array.isArray(bank)).toBe(true);
      expect(bank.length).toBeGreaterThan(0);
      expect(typeof bank[0]).toBe('string');
    });
  });
});
