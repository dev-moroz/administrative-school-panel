import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class ListLessonsQueryDto {
  @IsISO8601({ strict: true })
  from!: string;

  // `to` may be omitted only for "next N lessons of a student".
  @ValidateIf((o: ListLessonsQueryDto) => o.to !== undefined || o.studentId === undefined || o.limit === undefined)
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
