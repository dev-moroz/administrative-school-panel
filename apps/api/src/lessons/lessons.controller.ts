import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { LessonsService } from './lessons.service.js';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @RequirePermission('lessons.create')
  @Post()
  create(@Body() dto: CreateLessonDto) {
    return this.lessons.create(dto);
  }

  @RequirePermission('lessons.read')
  @Get()
  list(@Query() query: ListLessonsQueryDto) {
    return this.lessons.list(query);
  }

  @RequirePermission('lessons.read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.get(id);
  }

  @RequirePermission('lessons.update')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLessonDto) {
    return this.lessons.update(id, dto);
  }

  @RequirePermission('lessons.update')
  @Post(':id/status')
  @HttpCode(200)
  changeStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto) {
    return this.lessons.changeStatus(id, dto, user.id);
  }

  @RequirePermission('lessons.read')
  @Get(':id/cancel-preview')
  cancelPreview(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.cancelPreview(id);
  }

  @RequirePermission('lessons.delete')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.remove(id);
  }
}
