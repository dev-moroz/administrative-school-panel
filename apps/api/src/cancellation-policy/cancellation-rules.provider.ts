import { Injectable } from '@nestjs/common';
import { DEFAULT_CANCELLATION_RULES, type CancellationRules } from './suggest-charged.js';

// Defaults for now; later read from settings (per teacher or school).
@Injectable()
export class CancellationRulesProvider {
  getRules(_teacherId: string): Promise<CancellationRules> {
    return Promise.resolve(DEFAULT_CANCELLATION_RULES);
  }
}
