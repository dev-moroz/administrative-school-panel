import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { YMD } from '../../lesson-series/dto/create-series.dto.js';
import { MAX_COMMENT_LENGTH } from '../../lessons/lessons.constants.js';
import { trim } from '../../students/dto/create-student.dto.js';

export class UpdateAbsenceDto {
  @IsOptional()
  @Matches(YMD)
  startsOn?: string;

  @IsOptional()
  @Matches(YMD)
  endsOn?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
