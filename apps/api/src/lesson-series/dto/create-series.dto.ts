import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from '../../lessons/lessons.constants.js';

export const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateSeriesDto {
  @IsUUID()
  studentId!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Matches(HHMM)
  startTime!: string;

  @IsInt()
  @Min(MIN_DURATION_MIN)
  @Max(MAX_DURATION_MIN)
  durationMin!: number;

  @Matches(YMD)
  startsOn!: string;

  @IsOptional()
  @Matches(YMD)
  endsOn?: string;
}
