import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { trim } from '../../students/dto/create-student.dto.js';
import { MAX_DURATION_MIN, MAX_NOTES_LENGTH, MIN_DURATION_MIN } from '../lessons.constants.js';

export class CreateLessonDto {
  @IsUUID()
  studentId!: string;

  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsInt()
  @Min(MIN_DURATION_MIN)
  @Max(MAX_DURATION_MIN)
  durationMin!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string;

  // Saves despite overlapping lessons (the user confirmed the warning).
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
