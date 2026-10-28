import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('cancel-reasons')
export class CancelReasonsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('lessons.read')
  @Get()
  list() {
    return this.prisma.cancelReason.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
