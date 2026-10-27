import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto.js';
import { PaymentMethodsService } from './payment-methods.service.js';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  @RequirePermission('payment-methods.read')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.methods.list(user);
  }

  @RequirePermission('payment-methods.create')
  @Post()
  create(@Body() dto: CreatePaymentMethodDto) {
    return this.methods.create(dto);
  }

  @RequirePermission('payment-methods.update')
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdatePaymentMethodDto) {
    return this.methods.update(code, dto);
  }
}
