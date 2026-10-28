import { Transform } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { trim } from '../../students/dto/create-student.dto.js';
import { MAX_DURATION_MIN, MAX_NOTES_LENGTH, MIN_DURATION_MIN } from '../lessons.constants.js';

export class UpdateLessonDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_DURATION_MIN)
  @Max(MAX_DURATION_MIN)
  durationMin?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  notes?: string;
}
