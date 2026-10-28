import { isAllowedTransition, ledgerChange } from './lesson-rules.js';

type S = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

describe('isAllowedTransition', () => {
  const cases: [S, S, boolean, boolean][] = [
    // from, to, lessonEnded, allowed
    ['SCHEDULED', 'CANCELLED', false, true],
    ['SCHEDULED', 'NO_SHOW', false, true],
    ['SCHEDULED', 'COMPLETED', false, false],
    ['SCHEDULED', 'COMPLETED', true, false],
    ['SCHEDULED', 'SCHEDULED', false, false],
    ['COMPLETED', 'CANCELLED', true, true],
    ['COMPLETED', 'NO_SHOW', true, true],
    ['COMPLETED', 'COMPLETED', true, false],
    ['COMPLETED', 'SCHEDULED', true, false],
    ['CANCELLED', 'CANCELLED', true, true],
    ['CANCELLED', 'NO_SHOW', true, true],
    ['CANCELLED', 'SCHEDULED', false, true],
    ['CANCELLED', 'SCHEDULED', true, false],
    ['CANCELLED', 'COMPLETED', true, false],
    ['NO_SHOW', 'NO_SHOW', true, true],
    ['NO_SHOW', 'CANCELLED', true, true],
    ['NO_SHOW', 'SCHEDULED', false, true],
    ['NO_SHOW', 'SCHEDULED', true, false],
    ['NO_SHOW', 'COMPLETED', true, false],
  ];

  it.each(cases)('%s -> %s (ended: %s) is %s', (from, to, ended, allowed) => {
    expect(isAllowedTransition(from, to, ended)).toBe(allowed);
  });
});

describe('ledgerChange', () => {
  it('writes nothing when charged does not change', () => {
    expect(ledgerChange(false, false)).toBeNull();
    expect(ledgerChange(true, true)).toBeNull();
  });

  it('charges -1 on false -> true', () => {
    expect(ledgerChange(false, true)).toEqual({ type: 'LESSON_CHARGE', delta: -1 });
  });

  it('reverses +1 on true -> false', () => {
    expect(ledgerChange(true, false)).toEqual({ type: 'LESSON_REVERSAL', delta: 1 });
  });
});
