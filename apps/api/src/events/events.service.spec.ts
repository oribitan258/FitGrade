import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';

const FIXED_DATE = new Date('2026-03-22T10:00:00.000Z');

const mockRawEvent = {
  id: 'evt-1',
  title: 'יום ספורט',
  description: null,
  eventDate: FIXED_DATE,
  location: 'מגרש הספורט',
  teacherId: 'teacher-1',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
};

const mockRepository = {
  findAllByTeacher: jest.fn(),
  findNextUpcoming: jest.fn(),
  create: jest.fn(),
  findByIdAndTeacher: jest.fn(),
  deleteById: jest.fn(),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventsRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  describe('listAll', () => {
    it('returns mapped DTOs ordered by date', async () => {
      mockRepository.findAllByTeacher.mockResolvedValue([mockRawEvent]);
      const result = await service.listAll('teacher-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('evt-1');
      expect(result[0].eventDate).toBe(FIXED_DATE.toISOString());
    });
  });

  describe('getUpcoming', () => {
    it('returns the mapped DTO when an upcoming event exists', async () => {
      mockRepository.findNextUpcoming.mockResolvedValue(mockRawEvent);
      const result = await service.getUpcoming('teacher-1');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('יום ספורט');
    });

    it('returns null when no upcoming events exist', async () => {
      mockRepository.findNextUpcoming.mockResolvedValue(null);
      const result = await service.getUpcoming('teacher-1');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('calls repository and returns mapped DTO', async () => {
      mockRepository.create.mockResolvedValue(mockRawEvent);
      const dto = {
        title: 'יום ספורט',
        eventDate: FIXED_DATE.toISOString(),
        description: undefined,
        location: 'מגרש הספורט',
      };
      const result = await service.create('teacher-1', dto);
      expect(mockRepository.create).toHaveBeenCalledWith('teacher-1', dto);
      expect(result.id).toBe('evt-1');
    });
  });

  describe('remove', () => {
    it('deletes the event when it belongs to the teacher', async () => {
      mockRepository.findByIdAndTeacher.mockResolvedValue(mockRawEvent);
      await service.remove('evt-1', 'teacher-1');
      expect(mockRepository.deleteById).toHaveBeenCalledWith('evt-1');
    });

    it('throws NotFoundException when the event does not belong to the teacher', async () => {
      mockRepository.findByIdAndTeacher.mockResolvedValue(null);
      await expect(service.remove('evt-x', 'teacher-1')).rejects.toThrow(NotFoundException);
    });
  });
});
