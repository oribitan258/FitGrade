import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * List-view DTO for the History tab. The raw `snapshot` field is excluded
 * from list responses to keep payloads small; it's returned on demand for
 * the expand-row detail view.
 */
export class AiActionLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'save_attendance' })
  toolName!: string;

  @ApiProperty({ example: 'שמירת נוכחות ל-15 תלמידים בכיתה י׳' })
  summary!: string;

  @ApiProperty({ description: 'Params passed to the tool (shown in expand detail view)' })
  params!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'null = action is active; ISO string = has been reverted',
    nullable: true,
  })
  revertedAt!: string | null;

  @ApiProperty()
  createdAt!: string;
}

/** Detail view (expand) also includes the pre-write snapshot. */
export class AiActionLogDetailDto extends AiActionLogDto {
  @ApiProperty({ description: 'State captured before the write (for rollback audit)' })
  snapshot!: Record<string, unknown>;
}
