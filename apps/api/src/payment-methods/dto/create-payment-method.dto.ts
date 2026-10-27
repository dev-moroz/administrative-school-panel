import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PAYMENT_METHOD_ICONS } from '../payment-method-icons.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePaymentMethodDto {
  @Transform(upper)
  @Matches(/^[A-Z0-9_]{2,20}$/)
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsIn(PAYMENT_METHOD_ICONS)
  icon!: string;
}
