import type { LessonStatus } from '../generated/prisma/enums.js';

export function isAllowedTransition(from: LessonStatus, to: LessonStatus, ended: boolean): boolean {
  if (to === 'COMPLETED') return false;
  if (to === 'SCHEDULED') return (from === 'CANCELLED' || from === 'NO_SHOW') && !ended;
  return true;
}

export function ledgerChange(oldCharged: boolean, newCharged: boolean) {
  if (oldCharged === newCharged) return null;
  return newCharged
    ? ({ type: 'LESSON_CHARGE', delta: -1 } as const)
    : ({ type: 'LESSON_REVERSAL', delta: 1 } as const);
}
