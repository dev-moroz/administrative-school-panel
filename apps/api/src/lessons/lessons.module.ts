import { Module } from '@nestjs/common';
import { CancellationPolicyModule } from '../cancellation-policy/cancellation-policy.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { CancelReasonsController } from './cancel-reasons.controller.js';
import { LessonsController } from './lessons.controller.js';
import { LessonsScheduler } from './lessons.scheduler.js';
import { LessonsService } from './lessons.service.js';

@Module({
  imports: [LedgerModule, CancellationPolicyModule],
  controllers: [LessonsController, CancelReasonsController],
  providers: [LessonsService, LessonsScheduler],
})
export class LessonsModule {}
