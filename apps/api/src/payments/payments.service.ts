import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseAmount } from './amount.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { PAID_AT_SKEW_MS } from './payments.constants.js';
import { PAYMENT_SELECT, toPaymentDto } from './payments.mapper.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async create(dto: CreatePaymentDto, actorId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');

    const currency = await this.prisma.currency.findUnique({ where: { code: dto.currencyCode } });
    if (!currency || !currency.isActive) throw new BadRequestException('Unknown or inactive currency');

    const amount = parseAmount(dto.amount, currency.decimals);
    if (amount === null) {
      throw new BadRequestException(`amount must be a positive number with at most ${currency.decimals} decimal places`);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + PAID_AT_SKEW_MS) throw new BadRequestException('paidAt cannot be in the future');

    // The payment and its PURCHASE entry commit together or not at all.
    const row = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          studentId: student.id,
          amount,
          currencyCode: currency.code,
          paidAt,
          method: dto.method,
          comment: dto.comment || null,
          proofUrl: dto.proofUrl ?? null,
          lessonsGranted: dto.lessonsGranted,
          createdById: actorId,
        },
        select: PAYMENT_SELECT,
      });
      await this.ledger.addEntry(tx, {
        studentId: student.id,
        delta: dto.lessonsGranted,
        type: 'PURCHASE',
        paymentId: payment.id,
        createdById: actorId,
      });
      return payment;
    });
    return toPaymentDto(row);
  }

  async list(query: ListPaymentsQueryDto) {
    const where = query.studentId ? { studentId: query.studentId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: items.map(toPaymentDto), total, page: query.page, pageSize: query.pageSize };
  }
}
