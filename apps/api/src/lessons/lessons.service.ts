import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CancellationRulesProvider } from '../cancellation-policy/cancellation-rules.provider.js';
import { suggestCharged } from '../cancellation-policy/suggest-charged.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { LessonStatus } from '../generated/prisma/enums.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChangeStatusDto } from './dto/change-status.dto.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { isAllowedTransition, ledgerChange } from './lesson-rules.js';
import { MAX_RANGE_DAYS } from './lessons.constants.js';
import { LESSON_SELECT, toLessonDto } from './lessons.mapper.js';

type Tx = Prisma.TransactionClient;

const endsAt = (lesson: { startsAt: Date; durationMin: number }) =>
  new Date(lesson.startsAt.getTime() + lesson.durationMin * 60_000);

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly rules: CancellationRulesProvider,
  ) {}

  async create(dto: CreateLessonDto) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, isActive: true, teachers: { select: { teacherId: true }, take: 1 } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.isActive) throw new BadRequestException('Student is inactive');
    const teacherId = student.teachers[0]?.teacherId;
    if (!teacherId) throw new BadRequestException('Student has no teacher');

    const row = await this.prisma.lesson.create({
      data: {
        teacherId,
        startsAt: new Date(dto.startsAt),
        durationMin: dto.durationMin,
        notes: dto.notes || null,
        participants: { create: { studentId: student.id } },
      },
      select: LESSON_SELECT,
    });
    return toLessonDto(row);
  }

  async list(query: ListLessonsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) throw new BadRequestException('to must be after from');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`Range must be at most ${MAX_RANGE_DAYS} days`);
    }
    const rows = await this.prisma.lesson.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        ...(query.studentId && { participants: { some: { studentId: query.studentId } } }),
      },
      select: LESSON_SELECT,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toLessonDto);
  }

  async get(id: string) {
    const row = await this.prisma.lesson.findUnique({ where: { id }, select: LESSON_SELECT });
    if (!row) throw new NotFoundException('Lesson not found');
    return toLessonDto(row);
  }

  async update(id: string, dto: UpdateLessonDto) {
    return this.prisma.$transaction(async (tx) => {
      const lesson = await this.lock(tx, id);
      if ((dto.startsAt !== undefined || dto.durationMin !== undefined) && lesson.status !== 'SCHEDULED') {
        throw new ConflictException('Only a scheduled lesson can be moved');
      }
      const row = await tx.lesson.update({
        where: { id },
        data: {
          ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
          ...(dto.durationMin !== undefined && { durationMin: dto.durationMin }),
          ...(dto.notes !== undefined && { notes: dto.notes || null }),
        },
        select: LESSON_SELECT,
      });
      return toLessonDto(row);
    });
  }

  async changeStatus(id: string, dto: ChangeStatusDto, actorId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const lesson = await this.lock(tx, id);
      if (!isAllowedTransition(lesson.status, dto.status, endsAt(lesson) <= now)) {
        throw new ConflictException(`Cannot change status from ${lesson.status} to ${dto.status}`);
      }

      if (dto.status === 'CANCELLED' && !dto.reason) throw new BadRequestException('reason is required');
      if (dto.reason && dto.status !== 'SCHEDULED') {
        const reason = await tx.cancelReason.findFirst({ where: { code: dto.reason, isActive: true } });
        if (!reason) throw new BadRequestException('Unknown or inactive cancel reason');
      }

      const cancelledAt = dto.status === 'CANCELLED' ? (lesson.cancelledAt ?? now) : null;
      const charged =
        dto.status === 'SCHEDULED'
          ? false
          : (dto.charged ?? (await this.suggest(lesson, dto.status, cancelledAt ?? now)));

      await tx.lesson.update({
        where: { id },
        data: {
          status: dto.status,
          charged,
          cancelledAt,
          cancelReasonCode: dto.status === 'SCHEDULED' ? null : (dto.reason ?? null),
          ...(dto.comment !== undefined && { comment: dto.comment || null }),
        },
      });
      await this.writeLedger(tx, lesson, lesson.charged, charged, actorId);

      return toLessonDto(await tx.lesson.findUniqueOrThrow({ where: { id }, select: LESSON_SELECT }));
    });
  }

  async cancelPreview(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { status: true, startsAt: true, durationMin: true, teacherId: true, teacher: { select: { timeZone: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return { suggestedCharged: await this.suggest(lesson, 'CANCELLED', new Date()) };
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const lesson = await this.lock(tx, id);
      if (lesson.status !== 'SCHEDULED') throw new ConflictException('Only a scheduled lesson can be deleted');
      if (await tx.ledgerEntry.count({ where: { lessonId: id } })) {
        throw new ConflictException('Lesson has balance entries');
      }
      await tx.lesson.delete({ where: { id } });
    });
  }

  // Marks ended scheduled lessons COMPLETED and charges them, by System.
  async completeDue(now: Date) {
    const due = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM lessons
      WHERE status = 'SCHEDULED' AND starts_at + duration_min * interval '1 minute' <= ${now}`;

    let completed = 0;
    for (const { id } of due) {
      try {
        const done = await this.prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM lessons WHERE id = ${id}::uuid AND status = 'SCHEDULED' FOR UPDATE SKIP LOCKED`;
          if (!locked.length) return false;
          const lesson = await this.load(tx, id);
          await tx.lesson.update({ where: { id }, data: { status: 'COMPLETED', charged: true } });
          await this.writeLedger(tx, lesson, lesson.charged, true, null);
          return true;
        });
        if (done) completed += 1;
      } catch (error) {
        this.logger.error(`Automatic charge failed for lesson ${id}`, error as Error);
      }
    }
    return completed;
  }

  private async suggest(
    lesson: { status: LessonStatus; startsAt: Date; durationMin: number; teacherId: string; teacher: { timeZone: string } },
    to: LessonStatus,
    cancelledAt: Date,
  ) {
    if (to === 'NO_SHOW') return true;
    // Retroactive cancel: the lesson did not happen, the charge goes back.
    if (lesson.status === 'COMPLETED') return false;
    const rules = await this.rules.getRules(lesson.teacherId);
    return suggestCharged(lesson, cancelledAt, lesson.teacher.timeZone, rules);
  }

  private async lock(tx: Tx, id: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM lessons WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundException('Lesson not found');
    return this.load(tx, id);
  }

  private load(tx: Tx, id: string) {
    return tx.lesson.findUniqueOrThrow({
      where: { id },
      include: { teacher: { select: { timeZone: true } }, participants: { select: { studentId: true } } },
    });
  }

  private async writeLedger(
    tx: Tx,
    lesson: { id: string; participants: { studentId: string }[] },
    oldCharged: boolean,
    newCharged: boolean,
    actorId: string | null,
  ) {
    const change = ledgerChange(oldCharged, newCharged);
    if (!change) return;
    for (const { studentId } of lesson.participants) {
      await this.ledger.addEntry(tx, { studentId, ...change, lessonId: lesson.id, createdById: actorId });
    }
  }
}
