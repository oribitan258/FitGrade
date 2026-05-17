import { Module } from '@nestjs/common';
import { RumController } from './rum.controller';
import { RumService } from './rum.service';
import { RumRepository } from './rum.repository';

@Module({
  controllers: [RumController],
  providers: [RumService, RumRepository],
})
export class RumModule {}
