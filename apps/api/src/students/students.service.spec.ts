// bcrypt.hash is slow (12 rounds) — mock it before any imports to keep tests fast
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mocked-hash'),
}));

import * as XLSX from 'xlsx';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { StudentResponseDto } from './dto/student-response.dto';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { ParsedStudentRow } from './dto/import-students.dto';

// ─── Luhn-verified Israeli national IDs ──────────────────────────────────────
// Algorithm: positions 0,2,4,6,8 × 1 ; positions 1,3,5,7 × 2 ; val > 9 → val − 9
// sum % 10 === 0 → valid

const ID_VALID    = '123456782'; // sum = 40 ✓
const ID_VALID_2  = '039337423'; // sum = 40 ✓
const ID_SHORT    = '18';        // pads to '000000018', sum = 10 ✓
const ID_INVALID  = '123456789'; // sum = 47 ✗ — used for rejection tests

// ─── Excel builder (for importFromFile unit tests) ────────────────────────────

function buildExcel(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function studentRow(
  nationalId: string,
  firstName: string,
  lastName: string,
  gender = 'זכר',
): Record<string, string> {
  return { 'מספר זהות': nationalId, 'שם פרטי': firstName, 'שם משפחה': lastName, 'מין': gender };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLASS_ID   = 'class-1';
const TEACHER_ID = 'teacher-1';

const baseDto: CreateStudentDto = {
  firstName:  'ישראל',
  lastName:   'ישראלי',
  gender:     Gender.MALE,
  nationalId: ID_VALID,
};

const mockStudentResponse: StudentResponseDto = {
  id:          'student-1',
  firstName:   'ישראל',
  lastName:    'ישראלי',
  studentCode: '6782',
  nationalId:  ID_VALID,
  gender:      Gender.MALE,
  dateOfBirth: null,
  createdAt:   new Date('2025-01-01'),
};

// ─── Mock repository ──────────────────────────────────────────────────────────

const mockStudentsRepository = {
  verifyClassOwnership:              jest.fn(),
  findByClassId:                     jest.fn(),
  findClassGenderType:               jest.fn(),
  enrollStudent:                     jest.fn(),
  verifyStudentInClass:              jest.fn(),
  findRawStudentProfile:             jest.fn(),
  findReportData:                    jest.fn(),
  findGradeComponents:               jest.fn(),
  findTeacherWeightDefaults:         jest.fn(),
  createTalmidautAndUpsertFinalGrade: jest.fn(),
  importStudents:                    jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

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

    // Sensible defaults — individual tests override only what they care about
    mockStudentsRepository.verifyClassOwnership.mockResolvedValue(undefined);
    mockStudentsRepository.findClassGenderType.mockResolvedValue('MIXED');
    mockStudentsRepository.enrollStudent.mockResolvedValue({
      student: mockStudentResponse,
      reEnrolled: false,
    });
  });

  // ─── getStudentsByClass ────────────────────────────────────────────────────

  describe('getStudentsByClass', () => {
    it('verifies class ownership then returns the student list', async () => {
      mockStudentsRepository.findByClassId.mockResolvedValue([[mockStudentResponse], 1]);

      const result = await service.getStudentsByClass(CLASS_ID, TEACHER_ID, 50, 0);

      expect(result).toEqual([[mockStudentResponse], 1]);
      expect(mockStudentsRepository.verifyClassOwnership).toHaveBeenCalledWith(CLASS_ID, TEACHER_ID);
      expect(mockStudentsRepository.findByClassId).toHaveBeenCalledWith(CLASS_ID, 50, 0);
    });

    it('throws NotFoundException when teacher does not own the class', async () => {
      mockStudentsRepository.verifyClassOwnership.mockRejectedValue(
        new NotFoundException('כיתה לא נמצאה'),
      );

      await expect(service.getStudentsByClass(CLASS_ID, 'wrong-teacher', 50, 0)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStudentsRepository.findByClassId).not.toHaveBeenCalled();
    });

    it('returns empty array for a class with no students', async () => {
      mockStudentsRepository.findByClassId.mockResolvedValue([[], 0]);

      expect(await service.getStudentsByClass(CLASS_ID, TEACHER_ID, 50, 0)).toEqual([[], 0]);
    });
  });

  // ─── addStudentToClass — National ID (Israeli Luhn) validation ───────────

  describe('addStudentToClass — nationalId validation', () => {
    it('accepts a 9-digit Luhn-valid ID and enrolls successfully', async () => {
      const result = await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      expect(result.student).toEqual(mockStudentResponse);
      expect(result.reEnrolled).toBe(false);
    });

    it('rejects Luhn-invalid ID "123456789" (checksum sum=47)', async () => {
      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, nationalId: ID_INVALID }, TEACHER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockStudentsRepository.enrollStudent).not.toHaveBeenCalled();
    });

    it('error message is the correct Hebrew string', async () => {
      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, nationalId: ID_INVALID }, TEACHER_ID),
      ).rejects.toThrow('מספר זהות לא תקין');
    });

    it('Luhn check runs before DB calls — invalid ID skips enrollStudent entirely', async () => {
      await service.addStudentToClass(CLASS_ID, { ...baseDto, nationalId: ID_INVALID }, TEACHER_ID)
        .catch(() => {});

      expect(mockStudentsRepository.enrollStudent).not.toHaveBeenCalled();
    });

    it('short ID "18" is padded to "000000018" and accepted (sum=10)', async () => {
      const result = await service.addStudentToClass(
        CLASS_ID, { ...baseDto, nationalId: ID_SHORT }, TEACHER_ID,
      );

      expect(result).toBeDefined();
      expect(mockStudentsRepository.enrollStudent).toHaveBeenCalled();
    });

    it('enrollStudent receives padded 9-digit nationalId, not the raw short form', async () => {
      await service.addStudentToClass(CLASS_ID, { ...baseDto, nationalId: ID_SHORT }, TEACHER_ID);

      const passedPayload = mockStudentsRepository.enrollStudent.mock.calls[0][1] as { nationalId: string };
      expect(passedPayload.nationalId).toBe('000000018');
      expect(passedPayload.nationalId).toHaveLength(9);
    });

    it('rejects 1-digit ID "1" padded to "000000001" (sum=1, not divisible by 10)', async () => {
      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, nationalId: '1' }, TEACHER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts all-zero ID "000000000" (sum=0, divisible by 10 — algorithm edge case)', async () => {
      const result = await service.addStudentToClass(
        CLASS_ID, { ...baseDto, nationalId: '000000000' }, TEACHER_ID,
      );

      expect(result).toBeDefined();
    });

    it('accepts a second valid Luhn ID (039337423)', async () => {
      const result = await service.addStudentToClass(
        CLASS_ID, { ...baseDto, nationalId: ID_VALID_2 }, TEACHER_ID,
      );

      expect(result).toBeDefined();
    });

    it('studentCode passed to enrollStudent is the last 4 digits of the padded nationalId', async () => {
      await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      const payload = mockStudentsRepository.enrollStudent.mock.calls[0][1] as { studentCode: string };
      expect(payload.studentCode).toBe('6782'); // last 4 of '123456782'
    });

    it('passwordHash passed to enrollStudent is the bcrypt hash, not the raw ID', async () => {
      await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      const payload = mockStudentsRepository.enrollStudent.mock.calls[0][1] as { passwordHash: string };
      expect(payload.passwordHash).toBe('$2b$12$mocked-hash');
      expect(payload.passwordHash).not.toBe(ID_VALID);
    });
  });

  // ─── addStudentToClass — Gender mismatch enforcement ─────────────────────

  describe('addStudentToClass — gender mismatch', () => {
    it('rejects FEMALE student in a BOYS class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('BOYS');

      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.FEMALE }, TEACHER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('BOYS class rejection message is Hebrew: "לא ניתן להוסיף תלמידה נקבה לכיתת בנים"', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('BOYS');

      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.FEMALE }, TEACHER_ID),
      ).rejects.toThrow('לא ניתן להוסיף תלמידה נקבה לכיתת בנים');
    });

    it('rejects MALE student in a GIRLS class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('GIRLS');

      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.MALE }, TEACHER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('GIRLS class rejection message is Hebrew: "לא ניתן להוסיף תלמיד זכר לכיתת בנות"', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('GIRLS');

      await expect(
        service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.MALE }, TEACHER_ID),
      ).rejects.toThrow('לא ניתן להוסיף תלמיד זכר לכיתת בנות');
    });

    it('gender mismatch → enrollStudent is never called', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('BOYS');

      await service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.FEMALE }, TEACHER_ID)
        .catch(() => {});

      expect(mockStudentsRepository.enrollStudent).not.toHaveBeenCalled();
    });

    it('accepts MALE in a BOYS class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('BOYS');

      const result = await service.addStudentToClass(
        CLASS_ID, { ...baseDto, gender: Gender.MALE }, TEACHER_ID,
      );
      expect(result).toBeDefined();
    });

    it('accepts FEMALE in a GIRLS class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('GIRLS');

      const result = await service.addStudentToClass(
        CLASS_ID, { ...baseDto, gender: Gender.FEMALE }, TEACHER_ID,
      );
      expect(result).toBeDefined();
    });

    it('accepts MALE in a MIXED class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('MIXED');

      expect(
        await service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.MALE }, TEACHER_ID),
      ).toBeDefined();
    });

    it('accepts FEMALE in a MIXED class', async () => {
      mockStudentsRepository.findClassGenderType.mockResolvedValue('MIXED');

      expect(
        await service.addStudentToClass(CLASS_ID, { ...baseDto, gender: Gender.FEMALE }, TEACHER_ID),
      ).toBeDefined();
    });
  });

  // ─── addStudentToClass — Enrollment outcomes ─────────────────────────────

  describe('addStudentToClass — enrollment outcomes', () => {
    it('new enrollment returns reEnrolled: false', async () => {
      mockStudentsRepository.enrollStudent.mockResolvedValue({
        student: mockStudentResponse,
        reEnrolled: false,
      });

      const result = await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      expect(result.reEnrolled).toBe(false);
    });

    it('cross-class re-enrollment returns reEnrolled: true with student data', async () => {
      mockStudentsRepository.enrollStudent.mockResolvedValue({
        student: mockStudentResponse,
        reEnrolled: true,
      });

      const result = await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      expect(result.reEnrolled).toBe(true);
      expect(result.student).toEqual(mockStudentResponse);
    });

    it('same-class duplicate → ConflictException propagated (409)', async () => {
      mockStudentsRepository.enrollStudent.mockRejectedValue(
        new ConflictException('תלמיד עם תעודת זהות זו כבר רשום בכיתה'),
      );

      await expect(service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('class not owned by teacher → NotFoundException, enrollStudent never called', async () => {
      mockStudentsRepository.verifyClassOwnership.mockRejectedValue(
        new NotFoundException('כיתה לא נמצאה'),
      );

      await expect(
        service.addStudentToClass(CLASS_ID, baseDto, 'wrong-teacher'),
      ).rejects.toThrow(NotFoundException);

      expect(mockStudentsRepository.enrollStudent).not.toHaveBeenCalled();
    });

    it('fires an AuditLog STUDENT_ENROLLED entry after successful enrollment', async () => {
      await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID);

      // AuditLog.log is fire-and-forget (void) — flush the microtask queue
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action:    'STUDENT_ENROLLED',
          actorId:   TEACHER_ID,
          entityType: 'ClassEnrollment',
        }),
      );
    });

    it('does NOT fire AuditLog when ownership verification fails', async () => {
      mockStudentsRepository.verifyClassOwnership.mockRejectedValue(new NotFoundException());

      await service.addStudentToClass(CLASS_ID, baseDto, TEACHER_ID).catch(() => {});
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ─── importFromFile — parsing and row validation ──────────────────────────

  describe('importFromFile', () => {
    const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    beforeEach(() => {
      mockStudentsRepository.importStudents.mockResolvedValue({
        added: 0, existing: 0, reEnrolled: 0,
      });
    });

    it('valid Excel with 2 students → calls importStudents, returns added: 2', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({
        added: 2, existing: 0, reEnrolled: 0,
      });
      const file = buildExcel([
        studentRow(ID_VALID,   'ישראל', 'ישראלי', 'זכר'),
        studentRow(ID_VALID_2, 'שרה',   'כהן',    'נקבה'),
      ]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.added).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockStudentsRepository.importStudents).toHaveBeenCalledTimes(1);
    });

    it('Luhn-invalid ID → row lands in errors[], importStudents called with 0 valid rows', async () => {
      const file = buildExcel([studentRow(ID_INVALID, 'פלוני', 'אלמוני')]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.reason).toContain('ספרת ביקורת');
      // Service calls importStudents even when validRows=[] (early-return only fires when errors=[])
      // The invalid row must NOT appear in the rows passed to the repository
      if (mockStudentsRepository.importStudents.mock.calls.length > 0) {
        const passedRows = mockStudentsRepository.importStudents.mock.calls[0][1] as ParsedStudentRow[];
        expect(passedRows).toHaveLength(0);
        const passedIds = passedRows.map((r) => r.nationalId);
        expect(passedIds).not.toContain(ID_INVALID);
      }
    });

    it('10-digit ID (too long) → lands in errors[]', async () => {
      const file = buildExcel([studentRow('1234567890', 'פלוני', 'אלמוני')]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.errors).toHaveLength(1);
    });

    it('short valid ID "18" padded to "000000018" is accepted', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 1, existing: 0, reEnrolled: 0 });
      const file = buildExcel([studentRow('18', 'ישראל', 'ישראלי')]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.added).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('importStudents receives the padded (9-digit) nationalId for short IDs', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 1, existing: 0, reEnrolled: 0 });
      const file = buildExcel([studentRow('18', 'ישראל', 'ישראלי')]);

      await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      const passedRows = mockStudentsRepository.importStudents.mock.calls[0][1] as ParsedStudentRow[];
      expect(passedRows[0]?.nationalId).toBe('000000018');
    });

    it('missing "מספר זהות" column → throws BadRequestException(400)', async () => {
      const ws = XLSX.utils.json_to_sheet([{ 'שם פרטי': 'ישראל', 'שם משפחה': 'ישראלי' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'S');
      const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      await expect(service.importFromFile(CLASS_ID, TEACHER_ID, buf, MIME))
        .rejects.toThrow(BadRequestException);
    });

    it('header-only file (no data rows) → throws BadRequestException(400)', async () => {
      const ws = XLSX.utils.aoa_to_sheet([['מספר זהות', 'שם פרטי', 'שם משפחה', 'מין']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'S');
      const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      await expect(service.importFromFile(CLASS_ID, TEACHER_ID, buf, MIME))
        .rejects.toThrow(BadRequestException);
    });

    it('blank rows are skipped — only valid rows passed to importStudents', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 1, existing: 0, reEnrolled: 0 });
      const file = buildExcel([
        studentRow(ID_VALID, 'ישראל', 'ישראלי'),
        { 'מספר זהות': '', 'שם פרטי': '', 'שם משפחה': '', 'מין': '' }, // blank
      ]);

      await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      const passedRows = mockStudentsRepository.importStudents.mock.calls[0][1] as ParsedStudentRow[];
      expect(passedRows).toHaveLength(1);
    });

    it('all-blank rows → returns zeroed counters without touching DB', async () => {
      const file = buildExcel([
        { 'מספר זהות': '', 'שם פרטי': '', 'שם משפחה': '', 'מין': '' },
      ]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result).toEqual({ added: 0, existing: 0, reEnrolled: 0, errors: [] });
      expect(mockStudentsRepository.importStudents).not.toHaveBeenCalled();
    });

    it('mix of valid and invalid rows: valid sent to DB, invalid in errors[]', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 1, existing: 0, reEnrolled: 0 });
      const file = buildExcel([
        studentRow(ID_VALID,   'ישראל', 'ישראלי'),  // valid
        studentRow(ID_INVALID, 'פלוני', 'אלמוני'),  // Luhn fail
      ]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.added).toBe(1);
      expect(result.errors).toHaveLength(1);
      // importStudents received only the valid row
      const passedRows = mockStudentsRepository.importStudents.mock.calls[0][1] as ParsedStudentRow[];
      expect(passedRows).toHaveLength(1);
      expect(passedRows[0]?.nationalId).toBe(ID_VALID);
    });

    it('missing first name in otherwise-valid row → lands in errors[]', async () => {
      const file = buildExcel([
        { 'מספר זהות': ID_VALID, 'שם פרטי': '', 'שם משפחה': 'ישראלי', 'מין': 'זכר' },
      ]);

      const result = await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.reason).toContain('שם פרטי');
    });

    it('fires AuditLog STUDENT_ENROLLED after successful import with at least 1 added', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 1, existing: 0, reEnrolled: 0 });
      const file = buildExcel([studentRow(ID_VALID, 'ישראל', 'ישראלי')]);

      await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STUDENT_ENROLLED', actorId: TEACHER_ID }),
      );
    });

    it('does NOT fire AuditLog when added=0 and reEnrolled=0', async () => {
      mockStudentsRepository.importStudents.mockResolvedValue({ added: 0, existing: 2, reEnrolled: 0 });
      const file = buildExcel([
        studentRow(ID_VALID, 'ישראל', 'ישראלי'),
        studentRow(ID_VALID_2, 'שרה', 'כהן', 'נקבה'),
      ]);

      await service.importFromFile(CLASS_ID, TEACHER_ID, file, MIME);

      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });
});
