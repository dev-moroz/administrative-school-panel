import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto.js';

const SETTINGS_ID = 1;
const SELECT = { lowBalanceThreshold: true, dayStartsAt: true, eveningStartsAt: true, lateWindowMin: true };

@Injectable()
export class SchoolSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.schoolSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID }, select: SELECT });
  }

  async update(dto: UpdateSchoolSettingsDto) {
    const data = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as UpdateSchoolSettingsDto;
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update');

    const current = await this.get();
    // "HH:MM" strings compare correctly as text.
    if ((data.eveningStartsAt ?? current.eveningStartsAt) <= (data.dayStartsAt ?? current.dayStartsAt)) {
      throw new BadRequestException('The evening must start after the day');
    }

    return this.prisma.schoolSettings.update({ where: { id: SETTINGS_ID }, data, select: SELECT });
  }
}
