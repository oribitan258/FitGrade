import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, AuditAction } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { AuditLogService } from '../audit-log/audit-log.service';

const mockRepo = {
  verifyClassOwnership: jest.fn(),
  findByClassAndDate: jest.fn(),
  upsertMany: jest.fn(),
};

const mockAuditLog = { log: jest.fn() };

const CLASS_ID = 'class-uuid-1';
const TEACHER_ID = 'teacher-uuid-1';
const DATE_STR = '2024-11-15';
const STUDENT_ID = 'student-uuid-1';

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: mockRepo },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();
    service = module.get(AttendanceService);
  });

  beforeEach(() => jest.clearAllMocks());

  // ── getAttendance ───────────────────────────────────────────────────────

  describe('getAttendance', () => {
    it('verifies ownership then returns records', async () => {
      const records = [{ studentId: STUDENT_ID, status: 'PRESENT' }];
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.findByClassAndDate.mockResolvedValue(records);

      const result = await service.getAttendance(CLASS_ID, DATE_STR, TEACHER_ID);

      expect(mockRepo.verifyClassOwnership).toHaveBeenCalledWith(CLASS_ID, TEACHER_ID);
      expect(result).toEqual(records);
    });

    it('propagates ForbiddenException from ownership check', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.getAttendance(CLASS_ID, DATE_STR, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.findByClassAndDate).not.toHaveBeenCalled();
    });
  });

  // ── saveAttendance ──────────────────────────────────────────────────────

  describe('saveAttendance', () => {
    const baseDto = {
      date: DATE_STR,
      semester: 'A' as const,
      records: [
        { studentId: STUDENT_ID, status: AttendanceStatus.PRESENT, notes: undefined, exemptionReason: undefined, exemptionExpiresAt: undefined },
      ],
    };

    it('upserts records and returns the saved list', async () => {
      const saved = [{ studentId: STUDENT_ID, status: 'PRESENT', date: new Date(DATE_STR) }];
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.upsertMany.mockResolvedValue(saved);

      const result = await service.saveAttendance(CLASS_ID, baseDto, TEACHER_ID);

      expect(mockRepo.upsertMany).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });

    it('logs one audit entry per record saved', async () => {
      const multiDto = {
        ...baseDto,
        records: [
          { studentId: 's1', status: AttendanceStatus.PRESENT, notes: undefined, exemptionReason: undefined, exemptionExpiresAt: undefined },
          { studentId: 's2', status: AttendanceStatus.ABSENT, notes: undefined, exemptionReason: undefined, exemptionExpiresAt: undefined },
        ],
      };
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.upsertMany.mockResolvedValue([]);

      await service.saveAttendance(CLASS_ID, multiDto, TEACHER_ID);

      // Audit log is fire-and-forget (void) — give microtasks time to flush
      await Promise.resolve();
      expect(mockAuditLog.log).toHaveBeenCalledTimes(2);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.ATTENDANCE_CHANGE }),
      );
    });

    it('maps EXCUSED record with exemptionReason to upsertMany', async () => {
      const excusedDto = {
        date: DATE_STR,
        semester: 'A' as const,
        records: [{
          studentId: STUDENT_ID,
          status: AttendanceStatus.EXCUSED,
          notes: undefined,
          exemptionReason: 'פציעה',
          exemptionExpiresAt: '2024-11-20',
        }],
      };
      mockRepo.verifyClassOwnership.mockResolvedValue(undefined);
      mockRepo.upsertMany.mockResolvedValue([]);

      await service.saveAttendance(CLASS_ID, excusedDto, TEACHER_ID);

      const [, , records] = mockRepo.upsertMany.mock.calls[0] as [string, Date, Array<{ exemptionReason: string | undefined; exemptionExpiresAt: Date | undefined }>];
      expect(records[0].exemptionReason).toBe('פציעה');
      expect(records[0].exemptionExpiresAt).toBeInstanceOf(Date);
    });

    it('propagates ForbiddenException before upserting', async () => {
      mockRepo.verifyClassOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.saveAttendance(CLASS_ID, baseDto, TEACHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRepo.upsertMany).not.toHaveBeenCalled();
    });
  });
});
