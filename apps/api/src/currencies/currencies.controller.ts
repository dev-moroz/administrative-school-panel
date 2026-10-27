import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrenciesService } from './currencies.service.js';
import { CreateCurrencyDto } from './dto/create-currency.dto.js';
import { UpdateCurrencyDto } from './dto/update-currency.dto.js';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currencies: CurrenciesService) {}

  @RequirePermission('currencies.read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.currencies.list(user);
  }

  @RequirePermission('currencies.create')
  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencies.create(dto);
  }

  @RequirePermission('currencies.update')
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateCurrencyDto) {
    return this.currencies.update(code, dto);
  }
}
