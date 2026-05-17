import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One web-vitals observation from the client beacon. */
export class RumMetricEntryDto {
  @IsIn(['INP', 'LCP', 'CLS', 'FCP', 'TTFB'])
  declare metricName: string;

  @IsNumber()
  @Min(0)
  @Max(60_000)
  declare value: number;

  @IsIn(['good', 'needs-improvement', 'poor'])
  declare rating: string;

  @IsIn(['navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore'])
  declare navigationType: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: false })
  declare pageUrl: string;
}

/** Request body: batch of up to 10 metric entries per beacon call. */
export class CreateRumBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RumMetricEntryDto)
  declare metrics: RumMetricEntryDto[];
}
