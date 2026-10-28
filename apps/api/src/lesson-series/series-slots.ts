const DAY_MS = 86_400_000;

export interface SlotSeries {
  weekday: number;
  startsOn: string;
  endsOn: string | null;
}

export function addDays(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function localDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const isoWeekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay() || 7;

// Slot dates (YYYY-MM-DD) of a weekly series in [from, to).
export function slotDates(series: SlotSeries, from: string, to: string) {
  let day = from > series.startsOn ? from : series.startsOn;
  day = addDays(day, (series.weekday - isoWeekday(day) + 7) % 7);
  const dates: string[] = [];
  for (; day < to && (!series.endsOn || day <= series.endsOn); day = addDays(day, 7)) dates.push(day);
  return dates;
}

function offsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// Local wall time in a zone -> UTC instant; the second pass fixes the offset across a DST change.
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string) {
  const wall = Date.parse(`${ymd}T${hhmm}:00Z`);
  let utc = wall - offsetMs(wall, timeZone);
  utc = wall - offsetMs(utc, timeZone);
  return new Date(utc);
}
