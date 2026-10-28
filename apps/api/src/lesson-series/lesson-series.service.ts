import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSeriesDto } from './dto/create-series.dto.js';
import { EndSeriesDto } from './dto/end-series.dto.js';
import { SplitSeriesDto } from './dto/split-series.dto.js';
import { fromYmd, SERIES_SELECT, toSeriesDto, toYmd } from './lesson-series.mapper.js';
import { addDays, localDate, slotDates, zonedToUtc } from './series-slots.js';

type Tx = Prisma.TransactionClient;
type Series = Prisma.LessonSeriesGetPayload<object>;

export const HORIZON_DAYS = 28;

@Injectable()
export class LessonSeriesService {
  private readonly logger = new Logger(LessonSeriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeriesDto) {
    if (dto.endsOn && dto.endsOn < dto.startsOn) throw new BadRequestException('endsOn must not be before startsOn');
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, isActive: true, teachers: { select: { teacher: true }, take: 1 } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.isActive) throw new BadRequestException('Student is inactive');
    const teacher = student.teachers[0]?.teacher;
    if (!teacher) throw new BadRequestException('Student has no teacher');

    return this.prisma.$transaction(async (tx) => {
      const series = await tx.lessonSeries.create({
        data: {
          teacherId: teacher.id,
          studentId: student.id,
          weekday: dto.weekday,
          startTime: dto.startTime,
          durationMin: dto.durationMin,
          timeZone: teacher.timeZone,
          startsOn: fromYmd(dto.startsOn),
          endsOn: dto.endsOn ? fromYmd(dto.endsOn) : null,
        },
      });
      await this.generateTx(tx, series, new Date());
      return this.getTx(tx, series.id);
    });
  }

  async list(studentId: string) {
    const rows = await this.prisma.lessonSeries.findMany({
      where: { studentId },
      select: SERIES_SELECT,
      orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toSeriesDto);
  }

  get(id: string) {
    return this.getTx(this.prisma, id);
  }

  async generate(id: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      await this.generateTx(tx, await this.lock(tx, id), now);
    });
  }

  async generateAll(now: Date) {
    const active = await this.prisma.lessonSeries.findMany({
      where: { student: { isActive: true }, OR: [{ endsOn: null }, { endsOn: { gte: fromYmd(addDays(toYmd(now), -1)) } }] },
      select: { id: true },
    });
    for (const { id } of active) {
      try {
        await this.generate(id, now);
      } catch (error) {
        this.logger.error(`Generation failed for series ${id}`, error as Error);
      }
    }
  }

  // "This and following": the old series ends before the slot, a new one starts at it.
  async split(id: string, dto: SplitSeriesDto) {
    return this.prisma.$transaction(async (tx) => {
      const old = await this.lock(tx, id);
      const pivot = await tx.lesson.findUnique({ where: { id: dto.fromLessonId } });
      if (!pivot || pivot.seriesId !== id || !pivot.originalDate) {
        throw new BadRequestException('Lesson does not belong to this series');
      }
      if (pivot.status !== 'SCHEDULED') throw new ConflictException('Only a scheduled lesson can start a new series');

      const pivotDate = toYmd(pivot.originalDate);
      await tx.lessonSeries.update({ where: { id }, data: { endsOn: fromYmd(addDays(pivotDate, -1)) } });
      const next = await tx.lessonSeries.create({
        data: {
          teacherId: old.teacherId,
          studentId: old.studentId,
          weekday: dto.weekday ?? old.weekday,
          startTime: dto.startTime ?? old.startTime,
          durationMin: dto.durationMin ?? old.durationMin,
          timeZone: old.timeZone,
          startsOn: pivot.originalDate,
          endsOn: old.endsOn,
        },
      });

      await this.deleteUntouched(tx, old, pivotDate);
      // Changed lessons keep their state and block regeneration of their slot.
      await tx.lesson.updateMany({
        where: { seriesId: id, originalDate: { gte: pivot.originalDate } },
        data: { seriesId: next.id },
      });
      await this.generateTx(tx, next, new Date());
      return this.getTx(tx, next.id);
    });
  }

  async end(id: string, dto: EndSeriesDto) {
    return this.prisma.$transaction(async (tx) => {
      const series = await this.lock(tx, id);
      if (dto.endsOn < toYmd(series.startsOn)) throw new BadRequestException('endsOn must not be before startsOn');
      await this.closeTx(tx, series, dto.endsOn);
      return this.getTx(tx, id);
    });
  }

  countFutureLessons(tx: Tx, studentId: string, now: Date) {
    return tx.lesson.count({ where: this.futureWhere(studentId, now) });
  }

  // Deactivation: every series of the student ends today, future scheduled lessons are deleted.
  async dropStudentFuture(tx: Tx, studentId: string, now: Date) {
    const series = await tx.lessonSeries.findMany({ where: { studentId } });
    for (const s of series) {
      const today = localDate(now, s.timeZone);
      if (!s.endsOn || toYmd(s.endsOn) > today) {
        await tx.lessonSeries.update({ where: { id: s.id }, data: { endsOn: fromYmd(today) } });
      }
    }
    await tx.lesson.deleteMany({ where: this.futureWhere(studentId, now) });
  }

  private futureWhere(studentId: string, now: Date): Prisma.LessonWhereInput {
    return {
      status: 'SCHEDULED',
      startsAt: { gt: now },
      participants: { some: { studentId } },
      ledgerEntries: { none: {} },
    };
  }

  private async closeTx(tx: Tx, series: Series, endsOn: string) {
    await tx.lessonSeries.update({ where: { id: series.id }, data: { endsOn: fromYmd(endsOn) } });
    await this.deleteUntouched(tx, series, addDays(endsOn, 1));
  }

  // Deletes lessons of the series from the given slot date that still match the series slot.
  private async deleteUntouched(tx: Tx, series: Series, fromDate: string) {
    const lessons = await tx.lesson.findMany({
      where: {
        seriesId: series.id,
        originalDate: { gte: fromYmd(fromDate) },
        status: 'SCHEDULED',
        durationMin: series.durationMin,
        ledgerEntries: { none: {} },
      },
      select: { id: true, startsAt: true, originalDate: true },
    });
    const untouched = lessons.filter(
      (l) => l.startsAt.getTime() === zonedToUtc(toYmd(l.originalDate!), series.startTime, series.timeZone).getTime(),
    );
    if (untouched.length) await tx.lesson.deleteMany({ where: { id: { in: untouched.map((l) => l.id) } } });
  }

  private async generateTx(tx: Tx, series: Series, now: Date) {
    const student = await tx.student.findUniqueOrThrow({ where: { id: series.studentId }, select: { isActive: true } });
    if (!student.isActive) return;

    const today = localDate(now, series.timeZone);
    const until = addDays(today, HORIZON_DAYS);
    const slots = slotDates(
      { weekday: series.weekday, startsOn: toYmd(series.startsOn), endsOn: series.endsOn && toYmd(series.endsOn) },
      today,
      until,
    );
    const existing = new Set(
      (
        await tx.lesson.findMany({
          where: { seriesId: series.id, originalDate: { in: slots.map(fromYmd) } },
          select: { originalDate: true },
        })
      ).map((l) => toYmd(l.originalDate!)),
    );

    for (const date of slots) {
      const startsAt = zonedToUtc(date, series.startTime, series.timeZone);
      if (existing.has(date) || startsAt <= now) continue;
      await tx.lesson.create({
        data: {
          teacherId: series.teacherId,
          startsAt,
          durationMin: series.durationMin,
          seriesId: series.id,
          originalDate: fromYmd(date),
          participants: { create: { studentId: series.studentId } },
        },
      });
    }
    await tx.lessonSeries.update({ where: { id: series.id }, data: { generatedUntil: fromYmd(until) } });
  }

  private async getTx(tx: Tx | PrismaService, id: string) {
    const row = await tx.lessonSeries.findUnique({ where: { id }, select: SERIES_SELECT });
    if (!row) throw new NotFoundException('Series not found');
    return toSeriesDto(row);
  }

  private async lock(tx: Tx, id: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM lesson_series WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundException('Series not found');
    return tx.lessonSeries.findUniqueOrThrow({ where: { id } });
  }
}
