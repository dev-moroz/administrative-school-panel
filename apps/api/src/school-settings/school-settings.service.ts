import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto.js';

const SETTINGS_ID = 1;
const SELECT = { lowBalanceThreshold: true };

@Injectable()
export class SchoolSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.schoolSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID }, select: SELECT });
  }

  update(dto: UpdateSchoolSettingsDto) {
    return this.prisma.schoolSettings.update({
      where: { id: SETTINGS_ID },
      data: { lowBalanceThreshold: dto.lowBalanceThreshold },
      select: SELECT,
    });
  }
}
