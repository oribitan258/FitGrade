import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MobileExchangeDto {
  @ApiProperty({ description: 'One-time 64-hex-char code issued during mobile OAuth callback' })
  @IsString()
  @Length(64, 64)
  code!: string;
}
