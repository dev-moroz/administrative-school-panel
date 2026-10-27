import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { detectFileType, extForMime, sanitizeFileName } from '../files/file-type.js';
import { FileStorageService } from '../files/file-storage.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseAmount } from './amount.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import type { UploadedProof } from './payments.controller.js';
import { PAID_AT_SKEW_MS, PROOF_FOLDER } from './payments.constants.js';
import { PAYMENT_SELECT, toPaymentDto } from './payments.mapper.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly storage: FileStorageService,
  ) {}

  async create(dto: CreatePaymentDto, actorId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');

    const currency = await this.prisma.currency.findUnique({ where: { code: dto.currencyCode } });
    if (!currency || !currency.isActive) throw new BadRequestException('Unknown or inactive currency');

    const method = await this.prisma.paymentMethod.findUnique({ where: { code: dto.method } });
    if (!method || !method.isActive) throw new BadRequestException('Unknown or inactive payment method');

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
          methodCode: method.code,
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

  async attachProof(paymentId: string, file: UploadedProof | undefined, actorId: string) {
    if (!file) throw new BadRequestException('file is required');
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, proofUrl: true, proofFile: { select: { id: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.proofUrl || payment.proofFile) throw new ConflictException('Payment already has a proof');

    const type = detectFileType(file.buffer);
    if (!type) throw new BadRequestException('Only png, jpg, webp and pdf files are allowed');

    const id = randomUUID();
    const name = `${id}.${type.ext}`;
    await this.storage.save(PROOF_FOLDER, name, file.buffer);
    try {
      await this.prisma.paymentProofFile.create({
        data: {
          id,
          paymentId: payment.id,
          originalName: sanitizeFileName(file.originalname),
          mimeType: type.mime,
          size: file.buffer.length,
          uploadedById: actorId,
        },
      });
    } catch (error) {
      await this.storage.remove(PROOF_FOLDER, name);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Payment already has a proof');
      }
      throw error;
    }
    const row = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: PAYMENT_SELECT });
    return toPaymentDto(row);
  }

  async openProof(paymentId: string) {
    const proof = await this.prisma.paymentProofFile.findUnique({ where: { paymentId } });
    const ext = proof && extForMime(proof.mimeType);
    if (!proof || !ext) throw new NotFoundException('Proof not found');
    const stream = await this.storage.open(PROOF_FOLDER, `${proof.id}.${ext}`);
    if (!stream) throw new NotFoundException('Proof not found');
    return { stream, mimeType: proof.mimeType, fileName: `proof-${paymentId}.${ext}` };
  }
}
