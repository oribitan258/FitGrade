import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { ComparisonRepository } from './comparison.repository';

/**
 * ComparisonModule — semester A vs B analytics engine.
 *
 * Imports ClassesModule to reuse ClassesRepository for ownership validation
 * (ClassesModule already exports both ClassesService and ClassesRepository).
 * PrismaModule is @Global() so it does not need explicit import here.
 */
@Module({
  imports: [ClassesModule],
  controllers: [ComparisonController],
  providers: [ComparisonService, ComparisonRepository],
})
export class ComparisonModule {}
