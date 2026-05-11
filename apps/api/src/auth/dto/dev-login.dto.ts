import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class DevLoginDto {
  @ApiPropertyOptional({
    description: 'When true, resets isOnboardingComplete to false so the tour can be re-tested.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFirstLogin?: boolean;
}
