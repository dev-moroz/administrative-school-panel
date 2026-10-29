import { Module } from '@nestjs/common';
import { LessonSeriesModule } from '../lesson-series/lesson-series.module.js';
import { AbsencesController } from './absences.controller.js';
import { AbsencesService } from './absences.service.js';

@Module({
  imports: [LessonSeriesModule],
  controllers: [AbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
