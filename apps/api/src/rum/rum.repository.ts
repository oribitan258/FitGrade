import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RumMetricEntryDto } from './dto/create-rum.dto';

@Injectable()
export class RumRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(entries: RumMetricEntryDto[]): Promise<void> {
    await this.prisma.rumMetric.createMany({
      data: entries.map((e) => ({
        metricName:     e.metricName,
        value:          e.value,
        rating:         e.rating,
        navigationType: e.navigationType,
        pageUrl:        e.pageUrl,
      })),
      skipDuplicates: false,
    });
  }
}
