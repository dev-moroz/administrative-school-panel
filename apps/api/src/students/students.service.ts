import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { LessonSeriesService } from '../lesson-series/lesson-series.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { STUDENT_INCLUDE, STUDENT_LIST_SELECT, toStudentDto, type StudentListItem } from './student.mapper.js';

const ASSIGN_TEACHER = 'students.assign-teacher';
const BALANCE_READ = 'balance.read';

function isRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function isForeignKeyViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly series: LessonSeriesService,
  ) {}

  async list(user: AuthUser, query: ListStudentsQueryDto) {
    const where: Prisma.StudentWhereInput = {};
    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { telegramUsername: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: STUDENT_LIST_SELECT,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    const items = user.permissions.has(BALANCE_READ) ? await this.withBalances(students) : students;
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  // One grouped query for the whole page instead of a balance request per student.
  private async withBalances(students: StudentListItem[]) {
    const sums = await this.prisma.ledgerEntry.groupBy({
      by: ['studentId'],
      where: { studentId: { in: students.map((s) => s.id) } },
      _sum: { delta: true },
    });
    const byId = new Map(sums.map((row) => [row.studentId, row._sum.delta ?? 0]));
    return students.map((s) => ({ ...s, balance: byId.get(s.id) ?? 0 }));
  }

  async get(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id }, include: STUDENT_INCLUDE });
    if (!student) throw new NotFoundException('Student not found');
    return toStudentDto(student);
  }

  async create(user: AuthUser, dto: CreateStudentDto) {
    // Choosing a teacher explicitly is a separate permission (the admin has it, the teacher does not).
    if (dto.teacherId !== undefined && !user.permissions.has(ASSIGN_TEACHER)) {
      throw new ForbiddenException('You cannot choose the teacher');
    }

    const teacherId = await this.resolveTeacherId(user, dto.teacherId);
    await this.assertCurrencyUsable(dto.defaultCurrencyCode);
    await this.assertPaymentMethodUsable(dto.defaultPaymentMethodCode);

    const { teacherId: _ignored, ...fields } = dto;
    const student = await this.prisma.student.create({
      data: { ...fields, teachers: { create: { teacherId } } },
      include: STUDENT_INCLUDE,
    });
    return toStudentDto(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.assertCurrencyUsable(dto.defaultCurrencyCode);
    await this.assertPaymentMethodUsable(dto.defaultPaymentMethodCode);

    const { deleteFutureLessons, ...data } = dto;
    try {
      const student = await this.prisma.$transaction(async (tx) => {
        if (data.isActive === false) {
          const now = new Date();
          const counts = await this.series.countFutureLessons(tx, id, now);
          if (counts.futureLessons && !deleteFutureLessons) {
            throw new ConflictException({
              code: 'STUDENT_HAS_FUTURE_LESSONS',
              message: 'Student has future lessons',
              ...counts,
            });
          }
          await this.series.dropStudentFuture(tx, id, now);
        }
        return tx.student.update({ where: { id }, data, include: STUDENT_INCLUDE });
      });
      return toStudentDto(student);
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException('Student not found');
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.student.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundException('Student not found');
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Student has history, deactivate instead');
      }
      throw error;
    }
  }

  private async resolveTeacherId(user: AuthUser, requested?: string) {
    if (requested !== undefined) {
      const teacher = await this.prisma.teacher.findUnique({ where: { id: requested } });
      if (!teacher) throw new BadRequestException('Unknown teacherId');
      return teacher.id;
    }

    const own = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!own) throw new BadRequestException('teacherId is required');
    return own.id;
  }

  // null/undefined means "no currency"; a given code must exist and be active.
  private async assertCurrencyUsable(code?: string | null) {
    if (code === undefined || code === null) return;
    const currency = await this.prisma.currency.findFirst({ where: { code, isActive: true } });
    if (!currency) throw new BadRequestException('Unknown or inactive currency');
  }

  // Same rule as for the currency: null/undefined means "no method"; a given code must exist and be active.
  private async assertPaymentMethodUsable(code?: string | null) {
    if (code === undefined || code === null) return;
    const method = await this.prisma.paymentMethod.findFirst({ where: { code, isActive: true } });
    if (!method) throw new BadRequestException('Unknown or inactive payment method');
  }
}
