import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessonSeriesService } from './lesson-series.service.js';

@Injectable()
export class LessonSeriesScheduler {
  constructor(private readonly series: LessonSeriesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async topUp() {
    await this.series.generateAll(new Date());
  }
}
