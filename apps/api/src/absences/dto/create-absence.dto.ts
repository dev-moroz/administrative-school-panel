import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { AbsenceKind } from '../../generated/prisma/enums.js';
import { YMD } from '../../lesson-series/dto/create-series.dto.js';
import { MAX_COMMENT_LENGTH } from '../../lessons/lessons.constants.js';
import { trim } from '../../students/dto/create-student.dto.js';

export class CreateAbsenceDto {
  @IsIn(['STUDENT_FREEZE', 'TEACHER_VACATION'])
  kind!: AbsenceKind;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @Matches(YMD)
  startsOn!: string;

  @Matches(YMD)
  endsOn!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
