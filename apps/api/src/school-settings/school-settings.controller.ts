import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto.js';
import { SchoolSettingsService } from './school-settings.service.js';

@Controller('settings/school')
export class SchoolSettingsController {
  constructor(private readonly settings: SchoolSettingsService) {}

  @RequirePermission('school-settings.read')
  @Get()
  get() {
    return this.settings.get();
  }

  @RequirePermission('school-settings.update')
  @Patch()
  update(@Body() dto: UpdateSchoolSettingsDto) {
    return this.settings.update(dto);
  }
}
