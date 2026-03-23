import { Module } from '@nestjs/common';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';
import { TestsRepository } from './tests.repository';
import { GradingModule } from '../grading/grading.module';

@Module({
  imports: [GradingModule], // GradingModule exports GradingService for grade calculation
  controllers: [TestsController],
  providers: [TestsService, TestsRepository],
  exports: [TestsService], // CopilotModule imports TestsService
})
export class TestsModule {}
