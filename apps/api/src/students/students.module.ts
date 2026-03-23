import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { StudentPortalRepository } from './student-portal.repository';

@Module({
  controllers: [StudentPortalController, StudentsController],
  providers: [
    StudentsService,
    StudentsRepository,
    StudentPortalService,
    StudentPortalRepository,
  ],
  exports: [StudentsService], // CopilotModule imports StudentsService
})
export class StudentsModule {}
