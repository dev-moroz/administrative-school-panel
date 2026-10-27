import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PAYMENT_METHOD_ICONS } from '../payment-method-icons.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// code is fixed after creation.
export class UpdatePaymentMethodDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHOD_ICONS)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
