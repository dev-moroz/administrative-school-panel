import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AdjustBalanceDto } from './dto/adjust-balance.dto.js';
import { ListLedgerQueryDto } from './dto/list-ledger-query.dto.js';
import { LedgerService } from './ledger.service.js';

@Controller('students/:id')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @RequirePermission('balance.read')
  @Get('balance')
  balance(@Param('id', ParseUUIDPipe) id: string) {
    return this.ledger.getBalanceDto(id);
  }

  @RequirePermission('balance.read')
  @Get('ledger')
  list(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListLedgerQueryDto) {
    return this.ledger.listEntries(id, query);
  }

  @RequirePermission('balance.adjust')
  @Post('ledger/adjustments')
  adjust(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: AdjustBalanceDto) {
    return this.ledger.adjust(id, dto.delta, dto.comment, user.id);
  }
}
