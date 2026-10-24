import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../auth/auth.decorators.js';
import { TeachersService } from './teachers.service.js';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  // The list exists to pick a teacher when creating a student, hence the same permission.
  @RequirePermission('students.assign-teacher')
  @Get()
  list() {
    return this.teachers.list();
  }
}
