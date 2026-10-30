import { IsInt, Max, Min } from 'class-validator';

export class UpdateSchoolSettingsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  lowBalanceThreshold!: number;
}
