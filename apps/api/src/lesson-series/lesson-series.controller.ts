import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { CreateSeriesDto } from './dto/create-series.dto.js';
import { EndSeriesDto } from './dto/end-series.dto.js';
import { ListSeriesQueryDto } from './dto/list-series-query.dto.js';
import { SplitSeriesDto } from './dto/split-series.dto.js';
import { LessonSeriesService } from './lesson-series.service.js';

@RequirePermission('lesson-series.manage')
@Controller('lesson-series')
export class LessonSeriesController {
  constructor(private readonly series: LessonSeriesService) {}

  @Post()
  create(@Body() dto: CreateSeriesDto) {
    return this.series.create(dto);
  }

  @Get()
  list(@Query() query: ListSeriesQueryDto) {
    return this.series.list(query.studentId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.series.get(id);
  }

  @Post(':id/split')
  split(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SplitSeriesDto) {
    return this.series.split(id, dto);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndSeriesDto) {
    return this.series.end(id, dto);
  }
}
