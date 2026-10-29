import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BASE_TIME_ZONE } from '../common/base-time-zone.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fromYmd, toYmd } from '../lesson-series/lesson-series.mapper.js';
import { LessonSeriesService, type SeriesWarning } from '../lesson-series/lesson-series.service.js';
import { addDays, localDate } from '../lesson-series/series-slots.js';
import { findOverlaps } from '../lessons/overlaps.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { absenceBounds } from './absence-range.js';
import { findCoveringAbsence } from './absence-queries.js';
import { ABSENCE_SELECT, toAbsenceDto } from './absences.mapper.js';
import { CreateAbsenceDto } from './dto/create-absence.dto.js';
import { ListAbsencesQueryDto } from './dto/list-absences-query.dto.js';
import { UpdateAbsenceDto } from './dto/update-absence.dto.js';

type Tx = Prisma.TransactionClient;
type Absence = Prisma.AbsenceGetPayload<object>;
type Owner = { studentId: string | null; teacherId: string | null };
type DayRange = { startsOn: string; endsOn: string };

export type AbsenceWarning =
  | { code: 'ABSENCE_LESSON_NOT_RESTORED'; lessonId: string; reason: 'OVERLAP' | 'ABSENCE' | 'MANUAL' }
  | SeriesWarning;

const REASON_BY_KIND = { STUDENT_FREEZE: 'STUDENT_FREEZE', TEACHER_VACATION: 'TEACHER_VACATION' } as const;

@Injectable()
export class AbsencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly series: LessonSeriesService,
  ) {}

  async create(dto: CreateAbsenceDto, actorId: string) {
    const owner = await this.resolveOwner(dto);
    const now = new Date();
    const today = localDate(now, BASE_TIME_ZONE);
    if (dto.startsOn < today) throw new BadRequestException('startsOn must not be before today');
    if (dto.endsOn < dto.startsOn) throw new BadRequestException('endsOn must not be before startsOn');

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoAbsenceOverlap(tx, owner, dto);
      const absence = await tx.absence.create({
        data: {
          kind: dto.kind,
          ...owner,
          startsOn: fromYmd(dto.startsOn),
          endsOn: fromYmd(dto.endsOn),
          comment: dto.comment || null,
          createdById: actorId,
        },
      });
      await this.cancelRange(tx, absence, dto, now);
      return { ...(await this.getTx(tx, absence.id)), warnings: [] };
    });
  }

  async list(query: ListAbsencesQueryDto) {
    if (!query.studentId === !query.teacherId) throw new BadRequestException('Pass exactly one of studentId, teacherId');
    const rows = await this.prisma.absence.findMany({
      where: query.studentId ? { studentId: query.studentId } : { teacherId: query.teacherId },
      select: ABSENCE_SELECT,
      orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toAbsenceDto);
  }

  get(id: string) {
    return this.getTx(this.prisma, id);
  }

  async update(id: string, dto: UpdateAbsenceDto) {
    const now = new Date();
    const today = localDate(now, BASE_TIME_ZONE);
    return this.prisma.$transaction(async (tx) => {
      const absence = await this.lock(tx, id);
      const old = { startsOn: toYmd(absence.startsOn), endsOn: toYmd(absence.endsOn) };
      const next = { startsOn: dto.startsOn ?? old.startsOn, endsOn: dto.endsOn ?? old.endsOn };
      const started = old.startsOn <= today;

      if (next.startsOn !== old.startsOn) {
        if (started) throw new ConflictException('The start of a started absence cannot move');
        if (next.startsOn < today) throw new BadRequestException('startsOn must not be before today');
      }
      if (next.endsOn < next.startsOn) throw new BadRequestException('endsOn must not be before startsOn');
      if (next.endsOn < today) throw new BadRequestException('endsOn must not be before today');
      await this.assertNoAbsenceOverlap(tx, absence, next, id);

      await tx.absence.update({
        where: { id },
        data: {
          startsOn: fromYmd(next.startsOn),
          endsOn: fromYmd(next.endsOn),
          ...(dto.comment !== undefined && { comment: dto.comment || null }),
        },
      });

      const removed: DayRange[] = [];
      if (next.startsOn > old.startsOn) removed.push({ startsOn: old.startsOn, endsOn: addDays(next.startsOn, -1) });
      if (next.endsOn < old.endsOn) removed.push({ startsOn: addDays(next.endsOn, 1), endsOn: old.endsOn });
      if (next.startsOn < old.startsOn) await this.cancelRange(tx, absence, { startsOn: next.startsOn, endsOn: addDays(old.startsOn, -1) }, now);
      if (next.endsOn > old.endsOn) await this.cancelRange(tx, absence, { startsOn: addDays(old.endsOn, 1), endsOn: next.endsOn }, now);

      const inRemoved = removed.map((r) => {
        const { from, to } = absenceBounds(r.startsOn, r.endsOn);
        return { startsAt: { gte: from, lt: to } };
      });
      const warnings = removed.length
        ? await this.restoreAndRefill(tx, absence, { absenceId: id, status: 'CANCELLED', OR: inRemoved }, now)
        : [];
      return { ...(await this.getTx(tx, id)), warnings };
    });
  }

  async remove(id: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const absence = await this.lock(tx, id);
      if (toYmd(absence.startsOn) <= localDate(now, BASE_TIME_ZONE)) {
        throw new ConflictException('A started absence cannot be deleted, shorten its end instead');
      }
      const linked = await tx.lesson.findMany({ where: { absenceId: id, status: 'CANCELLED' }, select: { id: true } });
      await tx.absence.delete({ where: { id } });
      const warnings = await this.restoreAndRefill(tx, absence, { id: { in: linked.map((l) => l.id) } }, now);
      return { warnings };
    });
  }

  private async resolveOwner(dto: CreateAbsenceDto): Promise<Owner> {
    if (dto.kind === 'STUDENT_FREEZE') {
      if (!dto.studentId || dto.teacherId) throw new BadRequestException('A student freeze needs studentId only');
      if (!(await this.prisma.student.findUnique({ where: { id: dto.studentId }, select: { id: true } }))) {
        throw new NotFoundException('Student not found');
      }
      return { studentId: dto.studentId, teacherId: null };
    }
    if (!dto.teacherId || dto.studentId) throw new BadRequestException('A teacher vacation needs teacherId only');
    if (!(await this.prisma.teacher.findUnique({ where: { id: dto.teacherId }, select: { id: true } }))) {
      throw new NotFoundException('Teacher not found');
    }
    return { studentId: null, teacherId: dto.teacherId };
  }

  private async assertNoAbsenceOverlap(tx: Tx, owner: Owner, range: DayRange, excludeId?: string) {
    const clash = await tx.absence.findFirst({
      where: {
        ...(owner.studentId ? { studentId: owner.studentId } : { teacherId: owner.teacherId }),
        startsOn: { lte: fromYmd(range.endsOn) },
        endsOn: { gte: fromYmd(range.startsOn) },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: ABSENCE_SELECT,
    });
    if (clash) {
      throw new ConflictException({ code: 'ABSENCE_OVERLAP', message: 'Overlaps another absence', absence: toAbsenceDto(clash) });
    }
  }

  // Future scheduled lessons of the owner inside the range become cancelled by this absence.
  private async cancelRange(tx: Tx, absence: Absence, range: DayRange, now: Date) {
    const { from, to } = absenceBounds(range.startsOn, range.endsOn);
    const since = from > now ? from : now;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT l.id FROM lessons l
      WHERE l.status = 'SCHEDULED' AND l.starts_at > ${since} AND l.starts_at < ${to}
        AND (
          l.teacher_id = ${absence.teacherId}::uuid
          OR EXISTS (SELECT 1 FROM lesson_participants p WHERE p.lesson_id = l.id AND p.student_id = ${absence.studentId}::uuid)
        )
      FOR UPDATE OF l`;
    if (!rows.length) return;
    await tx.lesson.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: 'SCHEDULED' },
      data: {
        status: 'CANCELLED',
        charged: false,
        cancelledAt: now,
        cancelReasonCode: REASON_BY_KIND[absence.kind],
        absenceId: absence.id,
      },
    });
  }

  // Restore rule: back to scheduled only if not started, untouched by hand, outside other absences and free.
  private async restoreAndRefill(tx: Tx, absence: Absence, where: Prisma.LessonWhereInput, now: Date) {
    const warnings: AbsenceWarning[] = [];
    const lessons = await tx.lesson.findMany({
      where,
      include: { participants: { select: { studentId: true } } },
      orderBy: { startsAt: 'asc' },
    });

    for (const lesson of lessons) {
      if (lesson.startsAt <= now) continue;
      if (lesson.manuallyChanged) {
        warnings.push({ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: lesson.id, reason: 'MANUAL' });
        continue;
      }
      const other = await findCoveringAbsence(
        tx,
        { startsAt: lesson.startsAt, teacherId: lesson.teacherId, studentIds: lesson.participants.map((p) => p.studentId) },
        absence.id,
      );
      if (other) {
        await tx.lesson.update({ where: { id: lesson.id }, data: { absenceId: other.id } });
        warnings.push({ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: lesson.id, reason: 'ABSENCE' });
        continue;
      }
      const overlaps = await findOverlaps(tx, { teacherId: lesson.teacherId, startsAt: lesson.startsAt, durationMin: lesson.durationMin });
      if (overlaps.length) {
        warnings.push({ code: 'ABSENCE_LESSON_NOT_RESTORED', lessonId: lesson.id, reason: 'OVERLAP' });
        continue;
      }
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { status: 'SCHEDULED', cancelReasonCode: null, cancelledAt: null, absenceId: null },
      });
    }

    const today = fromYmd(localDate(now, BASE_TIME_ZONE));
    const seriesList = await tx.lessonSeries.findMany({
      where: { ...this.ownerFilterSeries(absence), OR: [{ endsOn: null }, { endsOn: { gte: today } }] },
      orderBy: { id: 'asc' },
    });
    for (const s of seriesList) warnings.push(...(await this.series.generateInTx(tx, s, now)));
    return warnings;
  }

  private ownerFilterSeries(absence: Owner): Prisma.LessonSeriesWhereInput {
    return absence.studentId ? { studentId: absence.studentId } : { teacherId: absence.teacherId! };
  }

  private async getTx(tx: Tx | PrismaService, id: string) {
    const row = await tx.absence.findUnique({ where: { id }, select: ABSENCE_SELECT });
    if (!row) throw new NotFoundException('Absence not found');
    return toAbsenceDto(row);
  }

  private async lock(tx: Tx, id: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM absences WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length) throw new NotFoundException('Absence not found');
    return tx.absence.findUniqueOrThrow({ where: { id } });
  }
}
