export interface CancellationRules {
  // Local "HH:MM"; lessons starting before it are morning lessons.
  morningEndsAt: string;
  sameDayMorningCharged: boolean;
  lateWindowMin: number;
}

export const DEFAULT_CANCELLATION_RULES: CancellationRules = {
  morningEndsAt: '12:00',
  sameDayMorningCharged: true,
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

export function suggestCharged(
  lesson: { startsAt: Date; durationMin: number },
  cancelledAt: Date,
  timeZone: string,
  rules: CancellationRules,
): boolean {
  const msBefore = lesson.startsAt.getTime() - cancelledAt.getTime();
  if (msBefore < rules.lateWindowMin * 60_000) return true;

  if (!rules.sameDayMorningCharged) return false;
  const start = localParts(lesson.startsAt, timeZone);
  if (start.minutes >= toMinutes(rules.morningEndsAt)) return false;
  return localParts(cancelledAt, timeZone).day === start.day;
}
