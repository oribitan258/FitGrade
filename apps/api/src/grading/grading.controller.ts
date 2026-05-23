import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { GradingRepository } from './grading.repository';

/**
 * Admin surface for the in-memory grading cache.
 *
 * NormTable + FitnessTestType are loaded at module init. After re-seeding
 * the database (e.g., after running `prisma db seed`) call this endpoint
 * to refresh the cache without restarting the process.
 *
 * Gated to TEACHER role — re-seeding requires DB access anyway, and there
 * is no admin role in the current auth model. Re-evaluate when ADMIN is added.
 */
@ApiTags('grading')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('grading')
export class GradingController {
  constructor(private readonly gradingRepository: GradingRepository) {}

  @Post('cache/refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reload NormTable + FitnessTestType caches from DB' })
  @ApiResponse({ status: 204, description: 'Cache reloaded' })
  async refreshCache(): Promise<void> {
    await this.gradingRepository.refresh();
  }
}
