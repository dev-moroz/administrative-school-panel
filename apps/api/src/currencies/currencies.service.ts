import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  // Inactive currencies are only for those who manage them; everyone else gets the active ones.
  list(user: AuthUser) {
    const canManage = user.permissions.has('currencies.update');
    return this.prisma.currency.findMany({
      where: canManage ? {} : { isActive: true },
      select: { code: true, name: true, decimals: true, isActive: true },
      orderBy: { code: 'asc' },
    });
  }
}
