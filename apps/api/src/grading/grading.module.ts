import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingRepository } from './grading.repository';

/**
 * GradingModule — core grade calculation engine.
 *
 * Exports GradingService so other feature modules (ResultsModule, etc.)
 * can inject it. GradingService is the single source of truth for all
 * grade calculation — no other module should contain norm-table logic.
 */
@Module({
  providers: [GradingService, GradingRepository],
  exports: [GradingService],
})
export class GradingModule {}
