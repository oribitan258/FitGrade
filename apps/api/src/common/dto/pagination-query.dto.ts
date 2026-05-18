import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Maximum items a single paginated request may return. */
export const PAGINATION_MAX_TAKE = 100;
/** Default page size when the client omits ?take. */
export const PAGINATION_DEFAULT_TAKE = 50;

/**
 * Shared query-param DTO for paginated list endpoints.
 * Usage: add `@Query() pagination: PaginationQueryDto` to a controller method.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: `Maximum number of items to return (1–${PAGINATION_MAX_TAKE}). Defaults to ${PAGINATION_DEFAULT_TAKE}.`,
    minimum: 1,
    maximum: PAGINATION_MAX_TAKE,
    default: PAGINATION_DEFAULT_TAKE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_TAKE)
  take: number = PAGINATION_DEFAULT_TAKE;

  @ApiPropertyOptional({
    description: 'Number of items to skip (0-based offset). Defaults to 0.',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;
}
