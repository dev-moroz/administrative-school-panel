export interface CancellationRules {
  // Local "HH:MM": lessons before dayStartsAt are morning, from eveningStartsAt evening.
  dayStartsAt: string;
  eveningStartsAt: string;
  // Free cancellation of a day/evening lesson ends this long before its slot starts.
  lateWindowMin: number;
}

export const DEFAULT_CANCELLATION_RULES: CancellationRules = {
  dayStartsAt: '12:00',
  eveningStartsAt: '17:00',
  lateWindowMin: 60,
};

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// The instant of a local wall time `minutes` after midnight of `day` in `timeZone`.
function zonedTime(day: string, minutes: number, timeZone: string) {
  const guess = Date.parse(`${day}T00:00:00Z`) + minutes * 60_000;
  const local = localParts(new Date(guess), timeZone);
  const offset = Date.parse(`${local.day}T00:00:00Z`) + local.minutes * 60_000 - guess;
  return guess - offset;
}

export function suggestCharged(
  lesson: { startsAt: Date; durationMin: number },
  cancelledAt: Date,
  timeZone: string,
  rules: CancellationRules,
): boolean {
  const start = localParts(lesson.startsAt, timeZone);
  const day = toMinutes(rules.dayStartsAt);
  const evening = toMinutes(rules.eveningStartsAt);

  let deadline: number;
  if (start.minutes < day) deadline = zonedTime(start.day, 0, timeZone);
  else if (start.minutes < evening) deadline = zonedTime(start.day, day - rules.lateWindowMin, timeZone);
  else deadline = zonedTime(start.day, evening - rules.lateWindowMin, timeZone);

  return cancelledAt.getTime() >= Math.min(deadline, lesson.startsAt.getTime());
}
