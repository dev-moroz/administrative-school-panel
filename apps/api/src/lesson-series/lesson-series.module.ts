import { Module } from '@nestjs/common';
import { LessonSeriesController } from './lesson-series.controller.js';
import { LessonSeriesScheduler } from './lesson-series.scheduler.js';
import { LessonSeriesService } from './lesson-series.service.js';

@Module({
  controllers: [LessonSeriesController],
  providers: [LessonSeriesService, LessonSeriesScheduler],
  exports: [LessonSeriesService],
})
export class LessonSeriesModule {}
