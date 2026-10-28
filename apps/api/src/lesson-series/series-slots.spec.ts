import { slotDates, zonedToUtc } from './series-slots.js';

describe('slotDates', () => {
  // 2026-11-02 is a Monday (ISO weekday 1)
  it('returns every matching weekday in [from, to)', () => {
    expect(slotDates({ weekday: 1, startsOn: '2026-11-01', endsOn: null }, '2026-11-01', '2026-11-23')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ]);
  });

  it('excludes the upper bound', () => {
    expect(slotDates({ weekday: 1, startsOn: '2026-11-01', endsOn: null }, '2026-11-01', '2026-11-09')).toEqual([
      '2026-11-02',
    ]);
  });

  it('does not start before startsOn', () => {
    expect(slotDates({ weekday: 1, startsOn: '2026-11-10', endsOn: null }, '2026-11-01', '2026-11-24')).toEqual([
      '2026-11-16',
      '2026-11-23',
    ]);
  });

  it('includes endsOn and nothing after it', () => {
    expect(slotDates({ weekday: 1, startsOn: '2026-11-01', endsOn: '2026-11-09' }, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-02',
      '2026-11-09',
    ]);
  });

  it('handles Sunday as weekday 7', () => {
    expect(slotDates({ weekday: 7, startsOn: '2026-11-01', endsOn: null }, '2026-11-01', '2026-11-09')).toEqual([
      '2026-11-01',
      '2026-11-08',
    ]);
  });

  it('returns nothing when the series ended before the range', () => {
    expect(slotDates({ weekday: 1, startsOn: '2026-10-01', endsOn: '2026-10-31' }, '2026-11-01', '2026-12-01')).toEqual([]);
  });
});

describe('zonedToUtc', () => {
  it('converts local wall time in winter (CET, UTC+1)', () => {
    expect(zonedToUtc('2026-03-27', '18:00', 'Europe/Belgrade').toISOString()).toBe('2026-03-27T17:00:00.000Z');
  });

  it('keeps the wall time after the DST change (CEST, UTC+2)', () => {
    expect(zonedToUtc('2026-03-30', '18:00', 'Europe/Belgrade').toISOString()).toBe('2026-03-30T16:00:00.000Z');
  });

  it('uses the given zone, not the server zone', () => {
    expect(zonedToUtc('2026-11-02', '10:00', 'Asia/Tokyo').toISOString()).toBe('2026-11-02T01:00:00.000Z');
  });

  it('handles a time that crosses the UTC date', () => {
    expect(zonedToUtc('2026-11-02', '00:30', 'Europe/Belgrade').toISOString()).toBe('2026-11-01T23:30:00.000Z');
  });
});
