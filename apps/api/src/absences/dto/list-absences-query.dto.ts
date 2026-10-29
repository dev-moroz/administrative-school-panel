import { IsOptional, IsUUID } from 'class-validator';

export class ListAbsencesQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
