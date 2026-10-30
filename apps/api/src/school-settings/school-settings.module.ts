import { Module } from '@nestjs/common';
import { SchoolSettingsController } from './school-settings.controller.js';
import { SchoolSettingsService } from './school-settings.service.js';

@Module({
  controllers: [SchoolSettingsController],
  providers: [SchoolSettingsService],
})
export class SchoolSettingsModule {}
