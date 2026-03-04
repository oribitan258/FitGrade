import { ApiProperty } from '@nestjs/swagger';

/**
 * Returned in the response body after successful authentication.
 * The refresh token is NOT included here — it is set as an httpOnly cookie
 * on the response so JavaScript cannot read it (XSS protection).
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT access token (15 min). Include as Authorization: Bearer <token>.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;
}
