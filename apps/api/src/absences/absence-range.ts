import { BASE_TIME_ZONE } from '../common/base-time-zone.js';
import { addDays, zonedToUtc } from '../lesson-series/series-slots.js';

// [first day 00:00, day after the last 00:00) in Moscow time.
export function absenceBounds(startsOn: string, endsOn: string) {
  return {
    from: zonedToUtc(startsOn, '00:00', BASE_TIME_ZONE),
    to: zonedToUtc(addDays(endsOn, 1), '00:00', BASE_TIME_ZONE),
  };
}

// A lesson belongs to an absence by its start.
export function isInsideAbsence(startsAt: Date, absence: { startsOn: string; endsOn: string }) {
  const { from, to } = absenceBounds(absence.startsOn, absence.endsOn);
  return startsAt >= from && startsAt < to;
}
