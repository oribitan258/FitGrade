import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import type { CreateClassDto } from './dto/create-class.dto';
import type { ClassResponseDto } from './dto/class-response.dto';

/** Alphanumeric chars with visually ambiguous characters removed (0/O, 1/I). */
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
/** Days before a new join code expires. */
const JOIN_CODE_TTL_DAYS = 7;
/** Maximum attempts before giving up on join code generation (collision guard). */
const JOIN_CODE_MAX_ATTEMPTS = 3;

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(private readonly classesRepository: ClassesRepository) {}

  /** Returns all classes for the authenticated teacher. */
  async getMyClasses(teacherId: string): Promise<ClassResponseDto[]> {
    return this.classesRepository.findAllByTeacher(teacherId);
  }

  /**
   * Returns a single class.
   * Throws NotFoundException if the class doesn't exist or belongs to another teacher.
   */
  async getClassById(
    classId: string,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    return this.classesRepository.findOneByIdAndTeacher(classId, teacherId);
  }

  /**
   * Creates a class with a freshly generated join code.
   *
   * Retries up to JOIN_CODE_MAX_ATTEMPTS times if the generated code collides
   * with an existing one (extremely unlikely at typical school scale).
   */
  async createClass(
    dto: CreateClassDto,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    const joinCodeExpiresAt = this.buildJoinCodeExpiry();

    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      const joinCode = this.generateJoinCode();
      try {
        const created = await this.classesRepository.create({
          ...dto,
          teacherId,
          joinCode,
          joinCodeExpiresAt,
        });
        this.logger.log(
          `Class created: id=${created.id} teacher=${teacherId} code=${joinCode}`,
        );
        return created;
      } catch (e) {
        if (e instanceof ConflictException && attempt < JOIN_CODE_MAX_ATTEMPTS) {
          this.logger.warn(
            `Join code collision on attempt ${attempt}, retrying...`,
          );
          continue;
        }
        throw e;
      }
    }

    // Unreachable — loop always throws or returns, but TypeScript needs this
    throw new ConflictException('שגיאה ביצירת קוד הצטרפות — נסה שוב מאוחר יותר');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private generateJoinCode(): string {
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
    }
    return code;
  }

  private buildJoinCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + JOIN_CODE_TTL_DAYS);
    return expiry;
  }
}
