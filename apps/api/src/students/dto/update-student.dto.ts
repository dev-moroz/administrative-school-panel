import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { EnglishLevel } from '../../generated/prisma/enums.js';
import { MAX_LESSON_PRICE, stripAt, trim } from './create-student.dto.js';

// Every field is optional; null clears the nullable ones. fullName and isActive cannot be null.
export class UpdateStudentDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(stripAt)
  @Matches(/^[A-Za-z0-9_]{5,32}$/)
  telegramUsername?: string | null;

  @IsOptional()
  @IsEnum(EnglishLevel)
  englishLevel?: EnglishLevel | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  defaultCurrencyCode?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_LESSON_PRICE)
  lessonPrice?: number | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
