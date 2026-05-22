import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';
import { Semester } from '@prisma/client';
import { getHebrewGradeLabel } from '@fitgrade/types';
import { ReportsService } from '../reports/reports.service';
import type { ReportRowDto } from '../reports/dto/report-row.dto';

// ─── Font resolution ───────────────────────────────────────────────────────────
// pdfkit's built-in fonts (Helvetica, Courier, Times-Roman) are Latin-only.
// DejaVu Sans covers Hebrew (U+0590–05FF) and is available on most Linux
// Docker images when fonts-dejavu-core is installed (apt-get install fonts-dejavu-core).

const HEBREW_FONT_CANDIDATES: readonly string[] = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  '/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  '/Library/Fonts/Arial Unicode MS.ttf',
] as const;

function resolveHebrewFont(): string | undefined {
  return HEBREW_FONT_CANDIDATES.find((p) => fs.existsSync(p));
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

const GENDER_HE: Record<string, string> = { MALE: 'זכר', FEMALE: 'נקבה' };
const SEMESTER_HE: Record<string, string> = { A: "סמסטר א'", B: "סמסטר ב'" };

// ─── Column definitions ────────────────────────────────────────────────────────

const EXCEL_COLUMNS: { header: string; width: number }[] = [
  { header: 'שם מלא',           width: 22 },
  { header: 'קוד תלמיד',       width: 12 },
  { header: 'ממוצע כושר',      width: 14 },
  { header: 'ציון התנהגות',    width: 16 },
  { header: 'ציון סיום מומלץ', width: 18 },
  { header: 'ציון מורה',       width: 14 },
  { header: 'היעדרויות',       width: 12 },
  { header: 'הערה מילולית',    width: 40 },
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Builds a real .xlsx workbook for the given class and semester.
   * Returns a Buffer ready to stream as a download response.
   */
  async buildExcel(
    classId: string,
    teacherId: string,
    semester: Semester | undefined,
  ): Promise<{ buffer: Buffer; className: string }> {
    const [rows, className] = await Promise.all([
      this.reportsService.getClassReport(classId, teacherId, semester),
      this.reportsService.getClassName(classId, teacherId),
    ]);

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('דוח כיתה', {
      views: [{ rightToLeft: true }],
    });
    worksheet.columns = EXCEL_COLUMNS;
    for (const r of rows) {
      worksheet.addRow(this.toExcelRow(r));
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(arrayBuffer), className };
  }

  /**
   * Builds a .pdf file for the given class and semester using pdfkit.
   * Hebrew text requires DejaVu Sans or another Unicode font to be installed
   * on the host system (apt-get install fonts-dejavu-core on Debian/Ubuntu).
   * Falls back to Helvetica (Latin glyphs only) when no suitable font is found.
   */
  async buildPdf(
    classId: string,
    teacherId: string,
    semester: Semester | undefined,
  ): Promise<{ buffer: Buffer; className: string }> {
    const [rows, className] = await Promise.all([
      this.reportsService.getClassReport(classId, teacherId, semester),
      this.reportsService.getClassName(classId, teacherId),
    ]);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fontPath = resolveHebrewFont();
      if (fontPath) {
        doc.font(fontPath);
      } else {
        this.logger.warn(
          'No Hebrew font found — PDF will render Hebrew as boxes. ' +
          'Install fonts-dejavu-core (apt-get install fonts-dejavu-core) for Hebrew support.',
        );
      }

      const semLabel = semester ? (SEMESTER_HE[semester] ?? semester) : 'שנה שלמה';

      // ── Title ──────────────────────────────────────────────────────────────
      doc.fontSize(18).text(`דוח סיום — ${className} — ${semLabel}`, {
        align: 'right',
      });
      doc.fontSize(10).fillColor('#64748b').text(
        `תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`,
        { align: 'right' },
      );
      doc.fillColor('#000000').moveDown(1.2);

      // ── Table header ───────────────────────────────────────────────────────
      const tableHeaders = [
        'שם מלא', 'ממוצע כושר', 'ציון התנהגות', 'מומלץ', 'ציון מורה', 'היעדרויות',
      ];
      const colWidths = [160, 72, 88, 60, 72, 72];
      const pageWidth = 515; // A4 width minus margins
      const startX = 40;

      this.drawPdfRow(doc, tableHeaders, colWidths, startX, pageWidth, true, fontPath);

      // ── Data rows ──────────────────────────────────────────────────────────
      for (const row of rows) {
        const effectiveFinal = row.teacherFinalGrade ?? row.recommendedFinalGrade;
        const cells = [
          `${row.firstName} ${row.lastName}`,
          getHebrewGradeLabel(row.fitnessAvg),
          getHebrewGradeLabel(row.conductScore),
          getHebrewGradeLabel(row.recommendedFinalGrade),
          row.teacherFinalGrade !== null ? getHebrewGradeLabel(effectiveFinal) : '—',
          String(row.unexcusedAbsences),
        ];
        this.drawPdfRow(doc, cells, colWidths, startX, pageWidth, false, fontPath);
      }

      doc.end();
    }).then((buffer) => ({ buffer, className }));
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private toExcelRow(r: ReportRowDto): (string | number)[] {
    const effectiveFinal = r.teacherFinalGrade ?? r.recommendedFinalGrade;
    return [
      `${r.firstName} ${r.lastName}`,
      r.studentCode,
      getHebrewGradeLabel(r.fitnessAvg),
      getHebrewGradeLabel(r.conductScore),
      getHebrewGradeLabel(r.recommendedFinalGrade),
      r.teacherFinalGrade !== null ? getHebrewGradeLabel(effectiveFinal) : '—',
      r.unexcusedAbsences,
      r.verbalComment ?? '',
    ];
  }

  private drawPdfRow(
    doc: InstanceType<typeof PDFDocument>,
    cells: string[],
    colWidths: number[],
    startX: number,
    pageWidth: number,
    isHeader: boolean,
    fontPath: string | undefined,
  ): void {
    const rowHeight = 20;
    const y = doc.y;

    if (isHeader) {
      doc.rect(startX, y, pageWidth, rowHeight).fill('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(9);
    } else {
      doc.fillColor('#334155').fontSize(8.5);
    }

    // Render RTL: start from the right side and go left
    let xRight = startX + pageWidth;
    for (let i = 0; i < cells.length; i++) {
      const w = colWidths[i] ?? 60;
      xRight -= w;
      doc.text(cells[i] ?? '', xRight, y + 5, {
        width: w - 4,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.moveTo(startX, y + rowHeight).lineTo(startX + pageWidth, y + rowHeight).stroke('#e2e8f0');
    doc.moveDown(0);
    doc.y = y + rowHeight;
  }
}
