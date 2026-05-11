import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

const mockRepo = {
  findTeacherClassMeta: jest.fn(),
  findResultsForTeacher: jest.fn(),
  findAttendanceStatsByClass: jest.fn(),
  findRecentSessions: jest.fn(),
  findPendingResultsCount: jest.fn(),
  findTopStudents: jest.fn(),
  findTopStudentsPerClass: jest.fn(),
  findBelowNormDetails: jest.fn(),
  findMissingResults: jest.fn(),
  findTopAchievements: jest.fn(),
  findMonthlyAverages: jest.fn(),
};

const TEACHER_ID = 'teacher-uuid-1';

const CLASSES = [
  { id: 'class-1', name: 'כיתה ז׳1', studentCount: 30 },
  { id: 'class-2', name: 'כיתה ח׳1', studentCount: 25 },
];

describe('DashboardService', () => {
  let service: DashboardService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty data
    mockRepo.findTeacherClassMeta.mockResolvedValue(CLASSES);
    mockRepo.findResultsForTeacher.mockResolvedValue([]);
    mockRepo.findAttendanceStatsByClass.mockResolvedValue([]);
    mockRepo.findRecentSessions.mockResolvedValue([]);
    mockRepo.findPendingResultsCount.mockResolvedValue(0);
    mockRepo.findTopStudents.mockResolvedValue([]);
    mockRepo.findTopStudentsPerClass.mockResolvedValue([]);
    mockRepo.findBelowNormDetails.mockResolvedValue([]);
    mockRepo.findMissingResults.mockResolvedValue([]);
    mockRepo.findTopAchievements.mockResolvedValue([]);
    mockRepo.findMonthlyAverages.mockResolvedValue([]);
  });

  // ── getStats ────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zero values when no results or attendance exist', async () => {
      const stats = await service.getStats(TEACHER_ID);

      expect(stats.overallFitnessAvg).toBe(0);
      expect(stats.overallAttendancePct).toBe(0);
      expect(stats.classStats).toHaveLength(CLASSES.length);
    });

    it('passes semester filter to repository calls', async () => {
      await service.getStats(TEACHER_ID, 'A');

      expect(mockRepo.findResultsForTeacher).toHaveBeenCalledWith(
        expect.any(Array),
        'A',
      );
      expect(mockRepo.findAttendanceStatsByClass).toHaveBeenCalledWith(
        expect.any(Array),
        'A',
      );
    });

    it('computes overallFitnessAvg as mean of all results', async () => {
      mockRepo.findResultsForTeacher.mockResolvedValue([
        { calculatedGrade: 80, sessionClassId: 'class-1' },
        { calculatedGrade: 60, sessionClassId: 'class-1' },
        { calculatedGrade: 70, sessionClassId: 'class-2' },
      ]);

      const stats = await service.getStats(TEACHER_ID);

      expect(stats.overallFitnessAvg).toBe(70); // (80+60+70)/3
    });

    it('computes overallAttendancePct from all class attendance totals', async () => {
      mockRepo.findAttendanceStatsByClass.mockResolvedValue([
        { classId: 'class-1', present: 90, total: 100 },
        { classId: 'class-2', present: 40, total: 50 },
      ]);

      const stats = await service.getStats(TEACHER_ID);

      // (90+40) / (100+50) = 130/150 ≈ 87%
      expect(stats.overallAttendancePct).toBe(87);
    });

    it('isolates teacher data — only fetches classes belonging to teacher', async () => {
      await service.getStats(TEACHER_ID);

      expect(mockRepo.findTeacherClassMeta).toHaveBeenCalledWith(TEACHER_ID);
      const [classIds] = mockRepo.findResultsForTeacher.mock.calls[0] as [string[]];
      expect(classIds).toEqual(['class-1', 'class-2']);
    });

    it('handles teacher with no classes gracefully', async () => {
      mockRepo.findTeacherClassMeta.mockResolvedValue([]);

      const stats = await service.getStats(TEACHER_ID);

      expect(stats.overallFitnessAvg).toBe(0);
      expect(stats.classStats).toEqual([]);
    });
  });

  // ── getTopStudents ──────────────────────────────────────────────────────

  describe('getTopStudents', () => {
    it('returns top students filtered by testTypeId and semester', async () => {
      const topStudents = [
        { studentId: 's1', firstName: 'רחל', lastName: 'כהן', grade: 98 },
      ];
      mockRepo.findTopStudents.mockResolvedValue(topStudents);

      const result = await service.getTopStudents(TEACHER_ID, 'tt-1', 'A');

      expect(mockRepo.findTopStudents).toHaveBeenCalledWith(
        expect.any(Array),
        'tt-1',
        'A',
      );
      expect(result).toEqual(topStudents);
    });

    it('returns empty array when no results match', async () => {
      mockRepo.findTopStudents.mockResolvedValue([]);

      const result = await service.getTopStudents(TEACHER_ID, 'tt-1');

      expect(result).toEqual([]);
    });
  });

  // ── getBelowNormDetails ─────────────────────────────────────────────────

  describe('getBelowNormDetails', () => {
    it('returns below-norm students for teacher classes', async () => {
      const belowNorm = [{ studentId: 's1', grade: 40, testNameHe: 'שכיבות שמיכה' }];
      mockRepo.findBelowNormDetails.mockResolvedValue(belowNorm);

      const result = await service.getBelowNormDetails(TEACHER_ID, 'A');

      expect(result).toEqual(belowNorm);
    });

    it('returns empty array when all students pass', async () => {
      mockRepo.findBelowNormDetails.mockResolvedValue([]);

      const result = await service.getBelowNormDetails(TEACHER_ID);

      expect(result).toEqual([]);
    });
  });
});
