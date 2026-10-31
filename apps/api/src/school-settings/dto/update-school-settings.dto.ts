import { IsInt, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const sent = (_: object, value: unknown) => value !== undefined;

export class UpdateSchoolSettingsDto {
  @ValidateIf(sent)
  @IsInt()
  @Min(0)
  @Max(100)
  lowBalanceThreshold?: number;

  @ValidateIf(sent)
  @IsString()
  @Matches(HHMM)
  dayStartsAt?: string;

  @ValidateIf(sent)
  @IsString()
  @Matches(HHMM)
  eveningStartsAt?: string;

  @ValidateIf(sent)
  @IsInt()
  @Min(0)
  @Max(1440)
  lateWindowMin?: number;
}
