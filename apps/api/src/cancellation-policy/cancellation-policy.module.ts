import { Module } from '@nestjs/common';
import { CancellationRulesProvider } from './cancellation-rules.provider.js';

@Module({
  providers: [CancellationRulesProvider],
  exports: [CancellationRulesProvider],
})
export class CancellationPolicyModule {}
