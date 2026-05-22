import { computeGeneralGradesMap } from '../utils';

describe('computeGeneralGradesMap', () => {
  it('returns empty map for empty testSummaries', () => {
    const result = computeGeneralGradesMap([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map when all effectiveGrades are 0', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 0 }] },
    ]);
    expect(result.has('s1')).toBe(false);
  });

  it('single test, single student — grade passes through directly', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 80 }] },
    ]);
    expect(result.get('s1')).toBe(80);
  });

  it('multiple tests, same student — averages and rounds', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 80 }] },
      { studentGrades: [{ studentId: 's1', effectiveGrade: 90 }] },
    ]);
    expect(result.get('s1')).toBe(85);
  });

  it('Math.round(85.5) → 86 (banker rounding not used)', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 80 }] },
      { studentGrades: [{ studentId: 's1', effectiveGrade: 91 }] },
    ]);
    // (80 + 91) / 2 = 85.5 → Math.round → 86
    expect(result.get('s1')).toBe(86);
  });

  it('grade=0 entries are excluded from the average', () => {
    // Student has grades [0, 80] — zero is skipped, average is just 80
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 0 }] },
      { studentGrades: [{ studentId: 's1', effectiveGrade: 80 }] },
    ]);
    expect(result.get('s1')).toBe(80);
  });

  it('student with all-zero grades is absent from the map', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 0 }] },
      { studentGrades: [{ studentId: 's1', effectiveGrade: 0 }] },
    ]);
    expect(result.has('s1')).toBe(false);
  });

  it('two students are computed independently', () => {
    const result = computeGeneralGradesMap([
      {
        studentGrades: [
          { studentId: 's1', effectiveGrade: 60 },
          { studentId: 's2', effectiveGrade: 90 },
        ],
      },
      {
        studentGrades: [
          { studentId: 's1', effectiveGrade: 80 },
          { studentId: 's2', effectiveGrade: 100 },
        ],
      },
    ]);
    expect(result.get('s1')).toBe(70);
    expect(result.get('s2')).toBe(95);
  });

  it('student present in only one of several tests is still included', () => {
    const result = computeGeneralGradesMap([
      { studentGrades: [{ studentId: 's1', effectiveGrade: 75 }] },
      { studentGrades: [{ studentId: 's2', effectiveGrade: 85 }] }, // s1 absent from this test
    ]);
    expect(result.get('s1')).toBe(75);
    expect(result.get('s2')).toBe(85);
  });
});
