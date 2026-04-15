import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { StudentResponseDto } from './dto/student-response.dto';
import type { CreateStudentDto } from './dto/create-student.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLASS_ID = 'class-1';
const TEACHER_ID = 'teacher-1';

const mockStudent: StudentResponseDto = {
  id: 'student-1',
  firstName: 'ישראל',
  lastName: 'ישראלי',
  studentCode: '301',
  gender: Gender.MALE,
  dateOfBirth: new Date('2009-03-15'),
  createdAt: new Date('2025-01-01'),
};

const createDto: CreateStudentDto = {
  firstName: 'ישראל',
  lastName: 'ישראלי',
  dateOfBirth: '2009-03-15',
  gender: Gender.MALE,
  studentCode: '301',
  password: 'securePass1',
};

// ─── Mock repository ──────────────────────────────────────────────────────────

const mockStudentsRepository = {
  verifyClassOwnership: jest.fn(),
  findByClassId: jest.fn(),
  createWithEnrollment: jest.fn(),
  verifyStudentInClass: jest.fn(),
  findRawStudentProfile: jest.fn(),
  findReportData: jest.fn(),
  createTalmidautRecord: jest.fn(),
  findGradeComponents: jest.fn(),
  upsertFinalGrade: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StudentsService', () => {
  let service: StudentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: StudentsRepository, useValue: mockStudentsRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    jest.clearAllMocks();
  });

  // ── getStudentsByClass ────────────────────────────────────────────────────

  describe('getStudentsByClass', () => {
    it('verifies ownership then returns student list', async () => {
      mockStudentsRepository.verifyClassOwnership.mockResolvedValue(undefined);
      mockStudentsRepository.findByClassId.mockResolvedValue([mockStudent]);

      const result = await service.getStudentsByClass(CLASS_ID, TEACHER_ID);

      expect(result).toEqual([mockStudent]);
      expect(mockStudentsRepository.verifyClassOwnership).toHaveBeenCalledWith(
        CLASS_ID,
        TEACHER_ID,
      );
      expect(mockStudentsRepository.findByClassId).toHaveBeenCalledWith(CLASS_ID);
    });

    it('throws NotFoundException when teacher does not own the class', async () => {
      mockStudentsRepository.verifyClassOwnership.mockRejectedValue(
        new NotFoundException('כיתה לא נמצאה'),
      );

      await expect(
        service.getStudentsByClass(CLASS_ID, 'wrong-teacher'),
      ).rejects.toThrow(NotFoundException);

      expect(mockStudentsRepository.findByClassId).not.toHaveBeenCalled();
    });

    it('returns empty array for a class with no students', async () => {
      mockStudentsRepository.verifyClassOwnership.mockResolvedValue(undefined);
      mockStudentsRepository.findByClassId.mockResolvedValue([]);

      const result = await service.getStudentsByClass(CLASS_ID, TEACHER_ID);

      expect(result).toEqual([]);
    });
  });

  // ── addStudentToClass ─────────────────────────────────────────────────────

  describe('addStudentToClass', () => {
    it('creates a student and returns the response (happy path)', async () => {
      mockStudentsRepository.verifyClassOwnership.mockResolvedValue(undefined);
      mockStudentsRepository.createWithEnrollment.mockResolvedValue(mockStudent);

      const result = await service.addStudentToClass(CLASS_ID, createDto, TEACHER_ID);

      expect(result).toEqual(mockStudent);
      expect(mockStudentsRepository.verifyClassOwnership).toHaveBeenCalledWith(
        CLASS_ID,
        TEACHER_ID,
      );
      // Verify password was NOT forwarded in plain text to the repository
      const repoCallArg = mockStudentsRepository.createWithEnrollment.mock.calls[0][1] as Record<string, unknown>;
      expect(repoCallArg['passwordHash']).toBeDefined();
      expect(repoCallArg['passwordHash']).not.toBe(createDto.password);
      // dateOfBirth was converted to a Date object
      expect(repoCallArg['dateOfBirth']).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when class does not belong to teacher', async () => {
      mockStudentsRepository.verifyClassOwnership.mockRejectedValue(
        new NotFoundException('כיתה לא נמצאה'),
      );

      await expect(
        service.addStudentToClass(CLASS_ID, createDto, 'wrong-teacher'),
      ).rejects.toThrow(NotFoundException);

      expect(mockStudentsRepository.createWithEnrollment).not.toHaveBeenCalled();
    });

    it('throws ConflictException when studentCode is already taken in the class', async () => {
      mockStudentsRepository.verifyClassOwnership.mockResolvedValue(undefined);
      mockStudentsRepository.createWithEnrollment.mockRejectedValue(
        new ConflictException('קוד תלמיד כבר קיים'),
      );

      await expect(
        service.addStudentToClass(CLASS_ID, createDto, TEACHER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });
});
