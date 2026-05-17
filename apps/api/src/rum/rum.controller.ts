import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RumService } from './rum.service';
import { CreateRumBatchDto } from './dto/create-rum.dto';

@ApiTags('rum')
@Controller('rum')
export class RumController {
  constructor(private readonly rumService: RumService) {}

  /**
   * Receive a batch of web-vitals observations from the production web app.
   *
   * Public (no auth required) — the beacon fires from any page, including
   * the login screen before the teacher authenticates.
   *
   * Rate-limited strictly: 60 batches / 60 s per IP.
   * A normal page view generates at most 5 metrics (INP, LCP, CLS, FCP, TTFB).
   * At 10 metrics/batch this allows ~120 page views/minute per IP, well above
   * any realistic single-user load.
   *
   * Always returns 204 — RUM writes are best-effort and errors are swallowed
   * in the service layer so a DB hiccup never leaks to the browser.
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Ingest a batch of web-vitals RUM metrics' })
  @ApiResponse({ status: 204, description: 'Accepted (best-effort write)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async ingest(@Body() dto: CreateRumBatchDto): Promise<void> {
    await this.rumService.ingest(dto.metrics);
  }
}
