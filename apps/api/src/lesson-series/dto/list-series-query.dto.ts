import { IsUUID } from 'class-validator';

export class ListSeriesQueryDto {
  @IsUUID()
  studentId!: string;
}
