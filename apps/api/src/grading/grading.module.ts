import { Module } from '@nestjs/common';
import { GradingController } from './grading.controller';
import { GradingService } from './grading.service';
import { GradingRepository } from './grading.repository';

/**
 * GradingModule — core grade calculation engine.
 *
 * Exports GradingService so other feature modules (ResultsModule, etc.)
 * can inject it. GradingService is the single source of truth for all
 * grade calculation — no other module should contain norm-table logic.
 *
 * GradingRepository implements OnModuleInit to preload NormTable +
 * FitnessTestType into memory at startup (see grading.repository.ts).
 */
@Module({
  controllers: [GradingController],
  providers: [GradingService, GradingRepository],
  exports: [GradingService],
})
export class GradingModule {}
