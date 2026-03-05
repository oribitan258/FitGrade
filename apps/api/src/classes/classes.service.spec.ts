import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Semester } from '../common/prisma-enums';
import { ClassesService } from './classes.service';
import { ClassesRepository } from './classes.repository';
import type { ClassResponseDto } from './dto/class-response.dto';
import type { CreateClassDto } from './dto/create-class.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEACHER_ID = 'teacher-abc';

const mockClass: ClassResponseDto = {
  id: 'class-1',
  name: "כיתה י' 1",
  academicYear: '2024-2025',
  semester: Semester.A,
  joinCode: 'AB3X7Q',
  joinCodeExpiresAt: new Date('2025-01-08'),
  studentCount: 0,
  createdAt: new Date('2025-01-01'),
};

const createDto: CreateClassDto = {
  name: "כיתה י' 1",
  academicYear: '2024-2025',
  semester: Semester.A,
};

// ─── Mock repository ──────────────────────────────────────────────────────────

const mockClassesRepository = {
  findAllByTeacher: jest.fn(),
  findOneByIdAndTeacher: jest.fn(),
  create: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClassesService', () => {
  let service: ClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: ClassesRepository, useValue: mockClassesRepository },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
    jest.clearAllMocks();
  });

  // ── getMyClasses ─────────────────────────────────────────────────────────

  describe('getMyClasses', () => {
    it('returns the list from the repository', async () => {
      mockClassesRepository.findAllByTeacher.mockResolvedValue([mockClass]);

      const result = await service.getMyClasses(TEACHER_ID);

      expect(result).toEqual([mockClass]);
      expect(mockClassesRepository.findAllByTeacher).toHaveBeenCalledWith(
        TEACHER_ID,
      );
    });

    it('returns an empty array when the teacher has no classes', async () => {
      mockClassesRepository.findAllByTeacher.mockResolvedValue([]);

      const result = await service.getMyClasses(TEACHER_ID);

      expect(result).toEqual([]);
    });
  });

  // ── getClassById ─────────────────────────────────────────────────────────

  describe('getClassById', () => {
    it('returns the class when found', async () => {
      mockClassesRepository.findOneByIdAndTeacher.mockResolvedValue(mockClass);

      const result = await service.getClassById('class-1', TEACHER_ID);

      expect(result).toEqual(mockClass);
      expect(mockClassesRepository.findOneByIdAndTeacher).toHaveBeenCalledWith(
        'class-1',
        TEACHER_ID,
      );
    });

    it('propagates NotFoundException from the repository', async () => {
      mockClassesRepository.findOneByIdAndTeacher.mockRejectedValue(
        new NotFoundException('כיתה לא נמצאה'),
      );

      await expect(
        service.getClassById('no-such-class', TEACHER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createClass ──────────────────────────────────────────────────────────

  describe('createClass', () => {
    it('creates and returns a class on the happy path', async () => {
      mockClassesRepository.create.mockResolvedValue(mockClass);

      const result = await service.createClass(createDto, TEACHER_ID);

      expect(result).toEqual(mockClass);
      expect(mockClassesRepository.create).toHaveBeenCalledTimes(1);
      // Verify the correct DTO fields are forwarded
      const callArg = mockClassesRepository.create.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg['name']).toBe(createDto.name);
      expect(callArg['teacherId']).toBe(TEACHER_ID);
      expect(typeof callArg['joinCode']).toBe('string');
      expect((callArg['joinCode'] as string).length).toBe(6);
    });

    it('retries on ConflictException (join code collision) and succeeds', async () => {
      mockClassesRepository.create
        .mockRejectedValueOnce(new ConflictException('collision'))
        .mockResolvedValueOnce(mockClass);

      const result = await service.createClass(createDto, TEACHER_ID);

      expect(result).toEqual(mockClass);
      expect(mockClassesRepository.create).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictException after exhausting all retry attempts', async () => {
      mockClassesRepository.create.mockRejectedValue(
        new ConflictException('collision'),
      );

      await expect(
        service.createClass(createDto, TEACHER_ID),
      ).rejects.toThrow(ConflictException);
    });
  });
});
