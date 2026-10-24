import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrenciesService } from './currencies.service.js';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currencies: CurrenciesService) {}

  @RequirePermission('currencies.read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.currencies.list(user);
  }
}
