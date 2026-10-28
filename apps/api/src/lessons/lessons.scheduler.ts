import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessonsService } from './lessons.service.js';

@Injectable()
export class LessonsScheduler {
  constructor(private readonly lessons: LessonsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async completeDue() {
    await this.lessons.completeDue(new Date());
  }
}
