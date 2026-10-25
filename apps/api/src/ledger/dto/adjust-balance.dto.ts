import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../../students/dto/create-student.dto.js';
import { MAX_ADJUSTMENT, MAX_COMMENT_LENGTH } from '../ledger.constants.js';

export class AdjustBalanceDto {
  @IsInt()
  @Min(-MAX_ADJUSTMENT)
  @Max(MAX_ADJUSTMENT)
  delta!: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_COMMENT_LENGTH)
  comment!: string;
}
