import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StudentsRepository } from './students.repository';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { StudentResponseDto } from './dto/student-response.dto';

/** bcrypt work factor — 12 rounds is the recommended minimum for 2024. */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly studentsRepository: StudentsRepository) {}

  /**
   * Returns all students enrolled in the given class.
   * Verifies the class belongs to the teacher before querying.
   */
  async getStudentsByClass(
    classId: string,
    teacherId: string,
  ): Promise<StudentResponseDto[]> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    return this.studentsRepository.findByClassId(classId);
  }

  /**
   * Creates a new student and enrolls them in the given class.
   *
   * - Verifies the class belongs to the teacher.
   * - Hashes the password with bcrypt before storage.
   * - Enforces studentCode uniqueness within the class.
   * - Creates the Student row and ClassEnrollment in a single transaction.
   */
  async addStudentToClass(
    classId: string,
    dto: CreateStudentDto,
    teacherId: string,
  ): Promise<StudentResponseDto> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const student = await this.studentsRepository.createWithEnrollment(
      classId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        studentCode: dto.studentCode,
        passwordHash,
      },
    );

    this.logger.log(
      `Student created: id=${student.id} code=${dto.studentCode} class=${classId}`,
    );

    return student;
  }
}
