import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { LedgerEntryType } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListLedgerQueryDto } from './dto/list-ledger-query.dto.js';
import { MAX_ADJUSTMENT } from './ledger.constants.js';
import { LEDGER_ENTRY_SELECT } from './ledger.mapper.js';

export interface NewLedgerEntry {
  studentId: string;
  delta: number;
  type: LedgerEntryType;
  comment?: string | null;
  createdById: string;
}

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(studentId: string, db: Db = this.prisma) {
    const result = await db.ledgerEntry.aggregate({ where: { studentId }, _sum: { delta: true } });
    return result._sum.delta ?? 0;
  }

  // For payments and lessons: they pass their own transaction, so the entry and the business change commit together.
  async addEntry(tx: Prisma.TransactionClient, entry: NewLedgerEntry) {
    if (!Number.isInteger(entry.delta) || entry.delta === 0) {
      throw new BadRequestException('delta must be a non-zero integer');
    }
    return tx.ledgerEntry.create({
      data: {
        studentId: entry.studentId,
        delta: entry.delta,
        type: entry.type,
        comment: entry.comment ?? null,
        createdById: entry.createdById,
      },
      select: LEDGER_ENTRY_SELECT,
    });
  }

  async adjust(studentId: string, delta: number, comment: string, actorId: string) {
    const trimmed = comment.trim();
    if (!trimmed) throw new BadRequestException('comment is required');
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUSTMENT) {
      throw new BadRequestException(`delta must be a non-zero integer, at most ${MAX_ADJUSTMENT} in absolute value`);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertStudentExists(studentId, tx);
      return this.addEntry(tx, { studentId, delta, type: 'MANUAL_ADJUSTMENT', comment: trimmed, createdById: actorId });
    });
  }

  async getBalanceDto(studentId: string) {
    await this.assertStudentExists(studentId, this.prisma);
    const balance = await this.getBalance(studentId);
    return { balance, isDebt: balance < 0 };
  }

  async listEntries(studentId: string, query: ListLedgerQueryDto) {
    await this.assertStudentExists(studentId, this.prisma);
    const where = { studentId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where,
        select: LEDGER_ENTRY_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  private async assertStudentExists(studentId: string, db: Db) {
    const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');
  }
}
