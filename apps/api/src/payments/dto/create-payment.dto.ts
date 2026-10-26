import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums.js';
import { trim } from '../../students/dto/create-student.dto.js';
import { MAX_LESSONS_GRANTED, MAX_PAYMENT_COMMENT_LENGTH } from '../payments.constants.js';

export class CreatePaymentDto {
  @IsUUID()
  studentId!: string;

  // A string on purpose: a JSON number would go through a float. Parsed against the currency decimals in the service.
  @IsString()
  @MaxLength(40)
  amount!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10)
  currencyCode!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsInt()
  @Min(1)
  @Max(MAX_LESSONS_GRANTED)
  lessonsGranted!: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  paidAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_PAYMENT_COMMENT_LENGTH)
  comment?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  proofUrl?: string;
}
