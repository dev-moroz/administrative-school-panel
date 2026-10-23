import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @RequirePermission('students.read.all')
  @Get()
  list(@Query() query: ListStudentsQueryDto) {
    return this.students.list(query);
  }

  @RequirePermission('students.read.all')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.get(id);
  }

  @RequirePermission('students.create')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @RequirePermission('students.update')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @RequirePermission('students.delete')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.remove(id);
  }
}
