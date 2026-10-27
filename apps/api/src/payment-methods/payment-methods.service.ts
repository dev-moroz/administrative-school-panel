import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';
import type { UpdatePaymentMethodDto } from './dto/update-payment-method.dto.js';

const METHOD_SELECT = { code: true, name: true, icon: true, isActive: true } as const;

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  // Inactive methods are only for those who manage them; everyone else gets the active ones.
  list(user: AuthUser) {
    const canManage = user.permissions.has('payment-methods.update');
    return this.prisma.paymentMethod.findMany({
      where: canManage ? {} : { isActive: true },
      select: METHOD_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreatePaymentMethodDto) {
    try {
      return await this.prisma.paymentMethod.create({ data: dto, select: METHOD_SELECT });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Payment method already exists');
      }
      throw error;
    }
  }

  async update(code: string, dto: UpdatePaymentMethodDto) {
    if (dto.name === undefined && dto.icon === undefined && dto.isActive === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    try {
      return await this.prisma.paymentMethod.update({
        where: { code: code.toUpperCase() },
        data: dto,
        select: METHOD_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Payment method not found');
      }
      throw error;
    }
  }
}
