import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CancellationRules } from './suggest-charged.js';

// School-wide rules; the teacher only contributes the time zone.
@Injectable()
export class CancellationRulesProvider {
  constructor(private readonly prisma: PrismaService) {}

  getRules(_teacherId: string): Promise<CancellationRules> {
    return this.prisma.schoolSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { dayStartsAt: true, eveningStartsAt: true, lateWindowMin: true },
    });
  }
}
