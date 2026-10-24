import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.teacher.findMany({
      select: { id: true, fullName: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }
}
