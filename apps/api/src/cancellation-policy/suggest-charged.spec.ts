import { DEFAULT_CANCELLATION_RULES, suggestCharged } from './suggest-charged.js';

// 2026-11-10 is outside DST: Europe/Belgrade = UTC+1, Asia/Tokyo = UTC+9.
const TZ = 'Europe/Belgrade';
const rules = DEFAULT_CANCELLATION_RULES;
const lesson = (startsAt: string, durationMin = 60) => ({ startsAt: new Date(startsAt), durationMin });
const at = (iso: string) => new Date(iso);

describe('suggestCharged', () => {
  it('has the recorded defaults', () => {
    expect(DEFAULT_CANCELLATION_RULES).toEqual({ morningEndsAt: '12:00', sameDayMorningCharged: true, lateWindowMin: 60 });
  });

  describe('morning lesson (10:00 local)', () => {
    const morning = lesson('2026-11-10T09:00:00Z');

    it('is charged when cancelled earlier the same day', () => {
      expect(suggestCharged(morning, at('2026-11-10T06:00:00Z'), TZ, rules)).toBe(true);
    });

    it('is charged at local midnight of the same day', () => {
      expect(suggestCharged(morning, at('2026-11-09T23:00:00Z'), TZ, rules)).toBe(true);
    });

    it('is not charged when cancelled the day before', () => {
      expect(suggestCharged(morning, at('2026-11-09T22:59:00Z'), TZ, rules)).toBe(false);
    });

    it('11:59 local still counts as morning', () => {
      expect(suggestCharged(lesson('2026-11-10T10:59:00Z'), at('2026-11-10T06:00:00Z'), TZ, rules)).toBe(true);
    });
  });

  describe('daytime/evening lesson', () => {
    const day = lesson('2026-11-10T13:00:00Z'); // 14:00 local
    const evening = lesson('2026-11-10T18:00:00Z'); // 19:00 local

    it('12:00 local is daytime: same-day cancellation hours before is not charged', () => {
      expect(suggestCharged(lesson('2026-11-10T11:00:00Z'), at('2026-11-10T07:00:00Z'), TZ, rules)).toBe(false);
    });

    it('is charged less than an hour before', () => {
      expect(suggestCharged(day, at('2026-11-10T12:01:00Z'), TZ, rules)).toBe(true);
      expect(suggestCharged(evening, at('2026-11-10T17:30:00Z'), TZ, rules)).toBe(true);
    });

    it('is not charged exactly one hour before', () => {
      expect(suggestCharged(day, at('2026-11-10T12:00:00Z'), TZ, rules)).toBe(false);
    });

    it('is not charged the same morning', () => {
      expect(suggestCharged(evening, at('2026-11-10T08:00:00Z'), TZ, rules)).toBe(false);
    });
  });

  it('is charged when cancelled after the start', () => {
    expect(suggestCharged(lesson('2026-11-10T13:00:00Z'), at('2026-11-10T13:10:00Z'), TZ, rules)).toBe(true);
    expect(suggestCharged(lesson('2026-11-10T09:00:00Z'), at('2026-11-10T09:30:00Z'), TZ, rules)).toBe(true);
  });

  it('uses the given time zone', () => {
    // 09:00Z is 10:00 in Belgrade (morning) but 18:00 in Tokyo (evening).
    const l = lesson('2026-11-10T09:00:00Z');
    const cancelledAt = at('2026-11-10T06:00:00Z');
    expect(suggestCharged(l, cancelledAt, 'Europe/Belgrade', rules)).toBe(true);
    expect(suggestCharged(l, cancelledAt, 'Asia/Tokyo', rules)).toBe(false);
  });

  describe('custom rules', () => {
    it('morningEndsAt moves the morning boundary', () => {
      const l = lesson('2026-11-10T10:30:00Z'); // 11:30 local
      const cancelledAt = at('2026-11-10T06:00:00Z');
      expect(suggestCharged(l, cancelledAt, TZ, rules)).toBe(true);
      expect(suggestCharged(l, cancelledAt, TZ, { ...rules, morningEndsAt: '11:00' })).toBe(false);
    });

    it('sameDayMorningCharged=false applies only the late window to morning lessons', () => {
      const custom = { ...rules, sameDayMorningCharged: false };
      const l = lesson('2026-11-10T09:00:00Z');
      expect(suggestCharged(l, at('2026-11-10T06:00:00Z'), TZ, custom)).toBe(false);
      expect(suggestCharged(l, at('2026-11-10T08:30:00Z'), TZ, custom)).toBe(true);
    });

    it('lateWindowMin changes the late window', () => {
      const l = lesson('2026-11-10T13:00:00Z');
      const cancelledAt = at('2026-11-10T11:30:00Z');
      expect(suggestCharged(l, cancelledAt, TZ, rules)).toBe(false);
      expect(suggestCharged(l, cancelledAt, TZ, { ...rules, lateWindowMin: 120 })).toBe(true);
    });
  });
});
