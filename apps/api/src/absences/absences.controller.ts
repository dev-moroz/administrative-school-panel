import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AbsencesService } from './absences.service.js';
import { CreateAbsenceDto } from './dto/create-absence.dto.js';
import { ListAbsencesQueryDto } from './dto/list-absences-query.dto.js';
import { UpdateAbsenceDto } from './dto/update-absence.dto.js';

@RequirePermission('absences.manage')
@Controller('absences')
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAbsenceDto) {
    return this.absences.create(dto, user.id);
  }

  @Get()
  list(@Query() query: ListAbsencesQueryDto) {
    return this.absences.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.absences.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAbsenceDto) {
    return this.absences.update(id, dto);
  }

  // 200 with a body: the response lists lessons that were not restored.
  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.absences.remove(id);
  }
}
