import { Controller, Get } from '@nestjs/common';
import { Authenticated, Public, RequirePermission } from '../src/auth/auth.decorators.js';

// Test-only endpoints, one per kind of guard mark. They exercise the global guard
// without depending on which real endpoints exist yet.
@Controller('probe')
export class ProbeController {
  @Public()
  @Get('public')
  open() {
    return { ok: true };
  }

  @Get('unmarked')
  unmarked() {
    return { ok: true };
  }

  @Authenticated()
  @Get('authenticated')
  authenticated() {
    return { ok: true };
  }

  @RequirePermission('students.read.all')
  @Get('students-read')
  studentsRead() {
    return { ok: true };
  }

  @RequirePermission('students.delete')
  @Get('students-delete')
  studentsDelete() {
    return { ok: true };
  }
}
