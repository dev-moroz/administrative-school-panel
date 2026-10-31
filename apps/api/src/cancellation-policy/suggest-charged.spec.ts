import { DEFAULT_CANCELLATION_RULES, suggestCharged } from './suggest-charged.js';

// 2026-11-10 is outside DST: Europe/Belgrade = UTC+1, Asia/Tokyo = UTC+9.
const TZ = 'Europe/Belgrade';
const rules = DEFAULT_CANCELLATION_RULES;
const lesson = (startsAt: string, durationMin = 60) => ({ startsAt: new Date(startsAt), durationMin });
const at = (iso: string) => new Date(iso);

describe('suggestCharged', () => {
  it('has the confirmed defaults', () => {
    expect(DEFAULT_CANCELLATION_RULES).toEqual({ dayStartsAt: '12:00', eveningStartsAt: '17:00', lateWindowMin: 60 });
  });

  describe('morning lesson (10:00 local): free only until the morning starts', () => {
    const morning = lesson('2026-11-10T09:00:00Z');

    it('is not charged the evening before', () => {
      expect(suggestCharged(morning, at('2026-11-09T22:59:00Z'), TZ, rules)).toBe(false);
    });

    it('is charged from local midnight of the lesson day', () => {
      expect(suggestCharged(morning, at('2026-11-09T23:00:00Z'), TZ, rules)).toBe(true);
      expect(suggestCharged(morning, at('2026-11-10T06:00:00Z'), TZ, rules)).toBe(true);
    });

    it('11:59 local still counts as morning', () => {
      expect(suggestCharged(lesson('2026-11-10T10:59:00Z'), at('2026-11-10T06:00:00Z'), TZ, rules)).toBe(true);
    });
  });

  describe('daytime lesson (14:00 local): free until an hour before the day slot (11:00)', () => {
    const day = lesson('2026-11-10T13:00:00Z');

    it('is not charged before 11:00 local', () => {
      expect(suggestCharged(day, at('2026-11-10T09:59:00Z'), TZ, rules)).toBe(false);
    });

    it('is charged from 11:00 local, even hours before the lesson', () => {
      expect(suggestCharged(day, at('2026-11-10T10:00:00Z'), TZ, rules)).toBe(true);
      expect(suggestCharged(day, at('2026-11-10T11:30:00Z'), TZ, rules)).toBe(true);
    });

    it('12:00 local is daytime, not morning: free in the early morning', () => {
      expect(suggestCharged(lesson('2026-11-10T11:00:00Z'), at('2026-11-10T07:00:00Z'), TZ, rules)).toBe(false);
    });
  });

  describe('evening lesson (19:00 local): free until an hour before the evening slot (16:00)', () => {
    const evening = lesson('2026-11-10T18:00:00Z');

    it('is not charged the same morning or before 16:00 local', () => {
      expect(suggestCharged(evening, at('2026-11-10T08:00:00Z'), TZ, rules)).toBe(false);
      expect(suggestCharged(evening, at('2026-11-10T14:59:00Z'), TZ, rules)).toBe(false);
    });

    it('is charged from 16:00 local, even more than an hour before the lesson', () => {
      expect(suggestCharged(evening, at('2026-11-10T15:00:00Z'), TZ, rules)).toBe(true);
      expect(suggestCharged(evening, at('2026-11-10T16:30:00Z'), TZ, rules)).toBe(true);
    });

    it('17:00 local is evening, 16:59 is daytime', () => {
      const cancelledAt = at('2026-11-10T11:00:00Z'); // 12:00 local
      expect(suggestCharged(lesson('2026-11-10T16:00:00Z'), cancelledAt, TZ, rules)).toBe(false);
      expect(suggestCharged(lesson('2026-11-10T15:59:00Z'), cancelledAt, TZ, rules)).toBe(true);
    });
  });

  it('is charged when cancelled after the start', () => {
    expect(suggestCharged(lesson('2026-11-10T13:00:00Z'), at('2026-11-10T13:10:00Z'), TZ, rules)).toBe(true);
    expect(suggestCharged(lesson('2026-11-10T09:00:00Z'), at('2026-11-10T09:30:00Z'), TZ, rules)).toBe(true);
  });

  it('is not charged days ahead', () => {
    expect(suggestCharged(lesson('2026-11-10T18:00:00Z'), at('2026-11-07T18:00:00Z'), TZ, rules)).toBe(false);
  });

  it('uses the given time zone', () => {
    // 09:00Z is 10:00 in Belgrade (morning) but 18:00 in Tokyo (evening, free until 16:00 Tokyo = 07:00Z).
    const l = lesson('2026-11-10T09:00:00Z');
    const cancelledAt = at('2026-11-10T06:00:00Z');
    expect(suggestCharged(l, cancelledAt, 'Europe/Belgrade', rules)).toBe(true);
    expect(suggestCharged(l, cancelledAt, 'Asia/Tokyo', rules)).toBe(false);
  });

  describe('custom rules', () => {
    it('dayStartsAt moves the morning/day boundary', () => {
      const l = lesson('2026-11-10T10:30:00Z'); // 11:30 local
      const cancelledAt = at('2026-11-10T06:00:00Z'); // 07:00 local
      expect(suggestCharged(l, cancelledAt, TZ, rules)).toBe(true);
      expect(suggestCharged(l, cancelledAt, TZ, { ...rules, dayStartsAt: '11:00' })).toBe(false);
    });

    it('eveningStartsAt moves the day/evening boundary', () => {
      const l = lesson('2026-11-10T16:30:00Z'); // 17:30 local
      const cancelledAt = at('2026-11-10T14:00:00Z'); // 15:00 local
      expect(suggestCharged(l, cancelledAt, TZ, rules)).toBe(false);
      expect(suggestCharged(l, cancelledAt, TZ, { ...rules, eveningStartsAt: '18:00' })).toBe(true);
    });

    it('lateWindowMin changes how long before the slot the free cancellation ends', () => {
      const day = lesson('2026-11-10T13:00:00Z'); // 14:00 local
      expect(suggestCharged(day, at('2026-11-10T09:30:00Z'), TZ, { ...rules, lateWindowMin: 120 })).toBe(true);
      expect(suggestCharged(day, at('2026-11-10T10:30:00Z'), TZ, { ...rules, lateWindowMin: 0 })).toBe(false);
    });
  });
});
