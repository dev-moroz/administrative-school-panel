import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { EnglishLevel } from '../../generated/prisma/enums.js';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const stripAt = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/^@/, '') : value;

// numeric(12,2): at most 10 integer digits.
export const MAX_LESSON_PRICE = 9_999_999_999.99;

export class CreateStudentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @Transform(stripAt)
  @Matches(/^[A-Za-z0-9_]{5,32}$/)
  telegramUsername?: string;

  @IsOptional()
  @IsEnum(EnglishLevel)
  englishLevel?: EnglishLevel;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  defaultPaymentMethodCode?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_LESSON_PRICE)
  lessonPrice?: number;

  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
