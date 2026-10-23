import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { ListStudentsQueryDto } from './dto/list-students-query.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { STUDENT_INCLUDE, STUDENT_LIST_SELECT, toStudentDto } from './student.mapper.js';

const ASSIGN_TEACHER = 'students.assign-teacher';

function isRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStudentsQueryDto) {
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

    return { items: students, total, page: query.page, pageSize: query.pageSize };
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

    const { teacherId: _ignored, ...fields } = dto;
    const student = await this.prisma.student.create({
      data: { ...fields, teachers: { create: { teacherId } } },
      include: STUDENT_INCLUDE,
    });
    return toStudentDto(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.assertCurrencyUsable(dto.defaultCurrencyCode);

    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: dto,
        include: STUDENT_INCLUDE,
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
}
