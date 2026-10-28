import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from '../../lessons/lessons.constants.js';
import { HHMM } from './create-series.dto.js';

export class SplitSeriesDto {
  @IsUUID()
  fromLessonId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @IsOptional()
  @Matches(HHMM)
  startTime?: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_DURATION_MIN)
  @Max(MAX_DURATION_MIN)
  durationMin?: number;
}
