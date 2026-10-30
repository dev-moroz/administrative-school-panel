import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BASE_TIME_ZONE } from '../common/base-time-zone.js';
import type { Prisma } from '../generated/prisma/client.js';
import { chargedLessonIds } from '../lessons/charged-lessons.js';
import { findOverlaps } from '../lessons/overlaps.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSeriesDto } from './dto/create-series.dto.js';
import { EndSeriesDto } from './dto/end-series.dto.js';
import { SplitSeriesDto } from './dto/split-series.dto.js';
import { fromYmd, SERIES_SELECT, toSeriesDto, toYmd } from './lesson-series.mapper.js';
import { addDays, localDate, slotDates, zonedToUtc } from './series-slots.js';

type Tx = Prisma.TransactionClient;
type Series = Prisma.LessonSeriesGetPayload<object>;

export const HORIZON_DAYS = 28;

export type SeriesWarning = { code: 'SERIES_SLOT_SKIPPED'; date: string; reason: 'OVERLAP' };

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
          startsOn: fromYmd(dto.startsOn),
          endsOn: dto.endsOn ? fromYmd(dto.endsOn) : null,
        },
      });
      const warnings = await this.generateTx(tx, series, new Date());
      return { ...(await this.getTx(tx, series.id)), warnings };
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
      const warnings = await this.generateTx(tx, next, new Date());
      return { ...(await this.getTx(tx, next.id)), warnings };
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

  // Charged lessons are money history: they are kept and counted separately.
  async countFutureLessons(tx: Tx, studentId: string, now: Date) {
    const { dropped, kept } = await this.splitFuture(tx, studentId, now);
    return { futureLessons: dropped.length, keptLessons: kept.length };
  }

  // Deactivation: series end today, future solo lessons are deleted, the student leaves future group lessons,
  // not started absences are deleted and a running one ends today.
  async dropStudentFuture(tx: Tx, studentId: string, now: Date) {
    const today = localDate(now, BASE_TIME_ZONE);
    const series = await tx.lessonSeries.findMany({ where: { studentId } });
    for (const s of series) {
      if (!s.endsOn || toYmd(s.endsOn) > today) {
        await tx.lessonSeries.update({ where: { id: s.id }, data: { endsOn: fromYmd(today) } });
      }
    }

    const { dropped } = await this.splitFuture(tx, studentId, now);
    const solo = dropped.filter((l) => l._count.participants === 1).map((l) => l.id);
    const group = dropped.filter((l) => l._count.participants > 1).map((l) => l.id);
    await tx.lesson.deleteMany({ where: { id: { in: solo } } });
    await tx.lessonParticipant.deleteMany({ where: { studentId, lessonId: { in: group } } });

    await tx.absence.deleteMany({ where: { studentId, startsOn: { gt: fromYmd(today) } } });
    await tx.absence.updateMany({
      where: { studentId, endsOn: { gt: fromYmd(today) } },
      data: { endsOn: fromYmd(today) },
    });
  }

  private async splitFuture(tx: Tx, studentId: string, now: Date) {
    const lessons = await tx.lesson.findMany({
      where: { startsAt: { gt: now }, participants: { some: { studentId } } },
      select: { id: true, _count: { select: { participants: true } } },
    });
    const charged = await chargedLessonIds(tx, lessons.map((l) => l.id));
    return {
      dropped: lessons.filter((l) => !charged.has(l.id)),
      kept: lessons.filter((l) => charged.has(l.id)),
    };
  }

  private async closeTx(tx: Tx, series: Series, endsOn: string) {
    await tx.lessonSeries.update({ where: { id: series.id }, data: { endsOn: fromYmd(endsOn) } });
    await this.deleteUntouched(tx, series, addDays(endsOn, 1));
  }

  // Deletes lessons of the series from the given slot date that were never changed by hand.
  private async deleteUntouched(tx: Tx, series: Series, fromDate: string) {
    await tx.lesson.deleteMany({
      where: {
        seriesId: series.id,
        originalDate: { gte: fromYmd(fromDate) },
        status: 'SCHEDULED',
        manuallyChanged: false,
        ledgerEntries: { none: {} },
      },
    });
  }

  // Busy slots are never overlapped: each gets one SeriesSkip row and is not retried.
  generateInTx(tx: Tx, series: Series, now: Date) {
    return this.generateTx(tx, series, now);
  }

  private async generateTx(tx: Tx, series: Series, now: Date): Promise<SeriesWarning[]> {
    const student = await tx.student.findUniqueOrThrow({ where: { id: series.studentId }, select: { isActive: true } });
    if (!student.isActive) return [];

    const today = localDate(now, BASE_TIME_ZONE);
    const until = addDays(today, HORIZON_DAYS);
    const slots = slotDates(
      { weekday: series.weekday, startsOn: toYmd(series.startsOn), endsOn: series.endsOn && toYmd(series.endsOn) },
      today,
      until,
    );
    const inSlots = { seriesId: series.id, originalDate: { in: slots.map(fromYmd) } };
    const lessons = await tx.lesson.findMany({ where: inSlots, select: { originalDate: true } });
    const skips = await tx.seriesSkip.findMany({ where: inSlots, select: { originalDate: true } });
    const existing = new Set([...lessons, ...skips].map((l) => toYmd(l.originalDate!)));
    // Dates inside an absence of the student or the teacher are not generated and not recorded.
    const absences = await tx.absence.findMany({
      where: {
        OR: [{ studentId: series.studentId }, { teacherId: series.teacherId }],
        startsOn: { lt: fromYmd(until) },
        endsOn: { gte: fromYmd(today) },
      },
      select: { startsOn: true, endsOn: true },
    });
    const inAbsence = (date: string) => absences.some((a) => toYmd(a.startsOn) <= date && date <= toYmd(a.endsOn));

    const warnings: SeriesWarning[] = [];
    for (const date of slots) {
      const startsAt = zonedToUtc(date, series.startTime, BASE_TIME_ZONE);
      if (existing.has(date) || startsAt <= now || inAbsence(date)) continue;
      const [conflict] = await findOverlaps(tx, { teacherId: series.teacherId, startsAt, durationMin: series.durationMin });
      if (conflict) {
        await tx.seriesSkip.create({
          data: { seriesId: series.id, originalDate: fromYmd(date), reason: 'OVERLAP', conflictLessonId: conflict.id },
        });
        this.logger.warn(`Series ${series.id}: slot ${date} skipped, overlaps lesson ${conflict.id}`);
        warnings.push({ code: 'SERIES_SLOT_SKIPPED', date, reason: 'OVERLAP' });
        continue;
      }
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
    return warnings;
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
