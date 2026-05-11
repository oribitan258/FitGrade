import { ApiProperty } from '@nestjs/swagger';

export class TeacherProfileDto {
  @ApiProperty({ description: 'User ID (cuid)' })
  declare id: string;

  @ApiProperty({ description: 'Email address' })
  declare email: string;

  @ApiProperty({ description: 'Full name from Google profile' })
  declare name: string;

  @ApiProperty({ description: 'School / institution name', nullable: true })
  declare school: string | null;

  @ApiProperty({ description: 'Google profile avatar URL', nullable: true })
  declare avatarUrl: string | null;

  @ApiProperty({
    description: 'false until the teacher finishes the welcome tour + setup form',
    example: true,
  })
  declare isOnboardingComplete: boolean;

  @ApiProperty({
    description: 'Test type IDs preferred for MALE/BOYS classes (empty = system defaults)',
    type: [String],
    example: [],
  })
  declare defaultMaleTestIds: string[];

  @ApiProperty({
    description: 'Test type IDs preferred for FEMALE/GIRLS classes (empty = system defaults)',
    type: [String],
    example: [],
  })
  declare defaultFemaleTestIds: string[];
}
