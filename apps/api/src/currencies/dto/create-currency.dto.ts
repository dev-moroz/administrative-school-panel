import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateCurrencyDto {
  @Transform(upper)
  @Matches(/^[A-Z0-9]{2,10}$/)
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(8)
  decimals!: number;
}
