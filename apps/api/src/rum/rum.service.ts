import { Injectable, Logger } from '@nestjs/common';
import { RumRepository } from './rum.repository';
import type { RumMetricEntryDto } from './dto/create-rum.dto';

const MAX_BATCH_SIZE = 10;

@Injectable()
export class RumService {
  private readonly logger = new Logger(RumService.name);

  constructor(private readonly rumRepository: RumRepository) {}

  async ingest(entries: RumMetricEntryDto[]): Promise<void> {
    // Clamp batch size — the DTO already validates this, but defence in depth
    const safe = entries.slice(0, MAX_BATCH_SIZE);

    try {
      await this.rumRepository.createMany(safe);
      this.logger.log(`RUM: ingested ${safe.length} metric(s)`);
    } catch (err) {
      // RUM writes are best-effort — log but never surface errors to the client.
      // A failed beacon should never break the user's session.
      this.logger.error('RUM: batch write failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
