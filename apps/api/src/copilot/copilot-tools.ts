import { SchemaType } from '@google/generative-ai';
import type { Tool } from '@google/generative-ai';

// ─────────────────────────────────────────────
// Tool Name Registry
// ─────────────────────────────────────────────

export type ToolName =
  | 'get_class_summary'
  | 'get_student_profile'
  | 'get_below_norm_students'
  | 'get_missing_results'
  | 'get_class_report'
  | 'save_attendance'
  | 'generate_exercise_plan'
  | 'submit_test_result';

export type ToolCategory = 'READ' | 'WRITE';

/** Maps each tool to its execution category. */
export const TOOL_CATEGORIES: Record<ToolName, ToolCategory> = {
  get_class_summary: 'READ',
  get_student_profile: 'READ',
  get_below_norm_students: 'READ',
  get_missing_results: 'READ',
  get_class_report: 'READ',
  save_attendance: 'WRITE',
  generate_exercise_plan: 'WRITE',
  submit_test_result: 'WRITE',
};

/** Hebrew display names shown in the UI (tool badges and HITL card headers). */
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
  get_class_summary: 'סיכום כיתה',
  get_student_profile: 'פרופיל תלמיד',
  get_below_norm_students: 'תלמידים מתחת לנורמה',
  get_missing_results: 'תוצאות חסרות',
  get_class_report: 'דוח ציונים',
  save_attendance: 'שמירת נוכחות',
  generate_exercise_plan: 'יצירת תוכנית אימון',
  submit_test_result: 'הוספת תוצאה',
};

export function getToolCategory(name: string): ToolCategory | null {
  return (TOOL_CATEGORIES as Record<string, ToolCategory>)[name] ?? null;
}

// ─────────────────────────────────────────────
// Gemini Tool Definitions (8 tools)
// ─────────────────────────────────────────────

export const GEMINI_TOOLS: Tool[] = [
  {
    functionDeclarations: [

      // ── READ TOOLS ────────────────────────────────────────────────────────

      {
        name: 'get_class_summary',
        description:
          'Returns a summary of a class: student count, attendance percentage, test summaries, and grade distribution. Use when the teacher asks about the overall state of a class.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            classId: {
              type: SchemaType.STRING,
              description: 'The ID of the class to summarise.',
            },
          },
          required: ['classId'],
        },
      },
      {
        name: 'get_student_profile',
        description:
          'Returns the full profile of a student: test history, attendance trend, talmidaut records, and final grade. Use when the teacher asks about a specific student.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            classId: {
              type: SchemaType.STRING,
              description: 'The class the student belongs to.',
            },
            studentId: {
              type: SchemaType.STRING,
              description: 'The ID of the student.',
            },
          },
          required: ['classId', 'studentId'],
        },
      },
      {
        name: 'get_below_norm_students',
        description:
          "Returns all students across the teacher's classes whose fitness grade is below the passing threshold (grade < 60). Use when the teacher asks who is struggling or failing.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'get_missing_results',
        description:
          'Returns a list of students who have test sessions without recorded results. Use when the teacher asks about missing or pending test results.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'get_class_report',
        description:
          'Returns the full grade report for a class: one row per student with fitness average, talmidaut score, and recommended final grade. Use when the teacher asks for a class report or grade overview.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            classId: {
              type: SchemaType.STRING,
              description: 'The ID of the class to generate a report for.',
            },
          },
          required: ['classId'],
        },
      },

      // ── WRITE TOOLS ───────────────────────────────────────────────────────

      {
        name: 'save_attendance',
        description:
          "Saves or updates attendance records for a class on a given date. IMPORTANT: Always confirm the teacher's intent before calling this. Propose the attendance data and wait for confirmation.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            classId: {
              type: SchemaType.STRING,
              description: 'The class to record attendance for.',
            },
            date: {
              type: SchemaType.STRING,
              description: 'The attendance date in YYYY-MM-DD format.',
            },
            records: {
              type: SchemaType.ARRAY,
              description: 'One entry per student.',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  studentId: { type: SchemaType.STRING },
                  studentName: {
                    type: SchemaType.STRING,
                    description: 'Student full name for the preview.',
                  },
                  status: {
                    type: SchemaType.STRING,
                    description: 'One of: PRESENT, ABSENT, LATE, EXCUSED.',
                  },
                  notes: { type: SchemaType.STRING },
                  exemptionReason: { type: SchemaType.STRING },
                },
                required: ['studentId', 'studentName', 'status'],
              },
            },
          },
          required: ['classId', 'date', 'records'],
        },
      },
      {
        name: 'generate_exercise_plan',
        description:
          "Generates a personalised multi-week exercise plan for a student based on their fitness profile. IMPORTANT: Always confirm the teacher's intent before calling this.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            studentId: { type: SchemaType.STRING },
            classId: { type: SchemaType.STRING },
            studentName: {
              type: SchemaType.STRING,
              description: 'Student full name for the preview.',
            },
            trackName: {
              type: SchemaType.STRING,
              description: 'The fitness track or area to focus on, e.g. "שיפור ריצה".',
            },
            week1Focus: {
              type: SchemaType.STRING,
              description: "Hebrew description of the first week's training focus.",
            },
            planDetails: {
              type: SchemaType.STRING,
              description: 'Full Hebrew plan text with weekly breakdown.',
            },
          },
          required: ['studentId', 'classId', 'studentName', 'trackName', 'week1Focus', 'planDetails'],
        },
      },
      {
        name: 'submit_test_result',
        description:
          "Submits a raw test result for a student in an existing session. The grade is automatically calculated from norm tables. IMPORTANT: Always confirm the teacher's intent before calling this.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            sessionId: { type: SchemaType.STRING },
            studentId: { type: SchemaType.STRING },
            studentName: {
              type: SchemaType.STRING,
              description: 'Student full name for the preview.',
            },
            testTypeNameHe: {
              type: SchemaType.STRING,
              description: 'Hebrew name of the test type.',
            },
            rawValue: {
              type: SchemaType.NUMBER,
              description: 'The raw measurement value.',
            },
            rawValueFormatted: {
              type: SchemaType.STRING,
              description: 'Human-readable value with unit, e.g. "12.4 שניות".',
            },
          },
          required: ['sessionId', 'studentId', 'studentName', 'testTypeNameHe', 'rawValue', 'rawValueFormatted'],
        },
      },
    ],
  },
];
