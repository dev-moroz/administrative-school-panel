import { absenceBounds, isInsideAbsence } from './absence-range.js';

describe('absenceBounds', () => {
  it('covers whole Moscow days, end day inclusive', () => {
    expect(absenceBounds('2026-11-01', '2026-11-03')).toEqual({
      from: new Date('2026-10-31T21:00:00Z'),
      to: new Date('2026-11-03T21:00:00Z'),
    });
  });

  it('a one-day absence is 24 hours', () => {
    const { from, to } = absenceBounds('2026-11-10', '2026-11-10');
    expect(to.getTime() - from.getTime()).toBe(24 * 3_600_000);
  });
});

describe('isInsideAbsence', () => {
  const absence = { startsOn: '2026-11-01', endsOn: '2026-11-03' };

  it('a lesson at Moscow midnight of the first day is inside', () => {
    expect(isInsideAbsence(new Date('2026-10-31T21:00:00Z'), absence)).toBe(true);
  });

  it('a lesson one minute before the first day is outside', () => {
    expect(isInsideAbsence(new Date('2026-10-31T20:59:00Z'), absence)).toBe(false);
  });

  it('a lesson late on the last day is inside', () => {
    expect(isInsideAbsence(new Date('2026-11-03T20:59:00Z'), absence)).toBe(true);
  });

  it('a lesson at Moscow midnight after the last day is outside', () => {
    expect(isInsideAbsence(new Date('2026-11-03T21:00:00Z'), absence)).toBe(false);
  });

  it('only the start counts: a lesson starting on the last day and ending after it is inside', () => {
    expect(isInsideAbsence(new Date('2026-11-03T20:30:00Z'), absence)).toBe(true);
  });
});
