import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCurrencyDto } from './dto/create-currency.dto.js';
import type { UpdateCurrencyDto } from './dto/update-currency.dto.js';

const CURRENCY_SELECT = { code: true, name: true, decimals: true, isActive: true } as const;

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  // Inactive currencies are only for those who manage them; everyone else gets the active ones.
  list(user: AuthUser) {
    const canManage = user.permissions.has('currencies.update');
    return this.prisma.currency.findMany({
      where: canManage ? {} : { isActive: true },
      select: CURRENCY_SELECT,
      orderBy: { code: 'asc' },
    });
  }

  async create(dto: CreateCurrencyDto) {
    try {
      return await this.prisma.currency.create({ data: dto, select: CURRENCY_SELECT });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Currency already exists');
      }
      throw error;
    }
  }

  async update(code: string, dto: UpdateCurrencyDto) {
    if (dto.name === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    const key = code.toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.currency.findUnique({ where: { code: key } });
      if (!current) throw new NotFoundException('Currency not found');

      if (dto.isActive === false && current.isActive) {
        const [students, payments] = await Promise.all([
          tx.student.count({ where: { defaultCurrencyCode: key } }),
          tx.payment.count({ where: { currencyCode: key } }),
        ]);
        if (students + payments > 0) {
          throw new ConflictException('this currency is in use, it cannot be deactivated');
        }
      }

      return tx.currency.update({ where: { code: key }, data: dto, select: CURRENCY_SELECT });
    });
  }
}
