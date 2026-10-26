import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [LedgerModule, FilesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
