import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { trim } from '../../students/dto/create-student.dto.js';
import type { LessonStatus } from '../../generated/prisma/enums.js';
import { MAX_COMMENT_LENGTH } from '../lessons.constants.js';

export class ChangeStatusDto {
  @IsIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status!: LessonStatus;

  // Omitted: the server suggests it (cancellation policy, no-show = charged).
  @IsOptional()
  @IsBoolean()
  charged?: boolean;

  // Code of an active cancel reason, checked in the service; required for CANCELLED.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]{2,40}$/)
  reason?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;

  // Back to scheduled despite an absence or an overlap, after the user confirmed.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
