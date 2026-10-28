import { Module } from '@nestjs/common';
import { LessonSeriesModule } from '../lesson-series/lesson-series.module.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [LessonSeriesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
