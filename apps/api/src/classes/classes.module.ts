import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassesRepository } from './classes.repository';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService, ClassesRepository],
  exports: [ClassesRepository], // StudentsModule uses ClassesRepository to verify ownership
})
export class ClassesModule {}
