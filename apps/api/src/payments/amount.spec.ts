import { parseAmount } from './amount.js';

describe('parseAmount', () => {
  it.each([
    ['1500', 2, '1500.00'],
    ['1500.5', 2, '1500.50'],
    ['1500.50', 2, '1500.50'],
    ['0.01', 2, '0.01'],
    ['100', 0, '100'],
    ['0.123456', 6, '0.123456'],
  ])('accepts %s with %i decimals as %s', (raw, decimals, expected) => {
    expect(parseAmount(raw, decimals)).toBe(expected);
  });

  it.each([
    ['0', 2],
    ['0.00', 2],
    ['-1', 2],
    ['+1', 2],
    ['abc', 2],
    ['', 2],
    [' 10', 2],
    ['10 ', 2],
    ['1e3', 2],
    ['1,5', 2],
    ['1.', 2],
    ['.5', 2],
    ['NaN', 2],
    ['Infinity', 2],
    ['1500.555', 2],
    ['10.5', 0],
    ['1234567890123456', 2],
  ])('rejects %j with %i decimals', (raw, decimals) => {
    expect(parseAmount(raw, decimals)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseAmount(100 as unknown as string, 2)).toBeNull();
    expect(parseAmount(undefined as unknown as string, 2)).toBeNull();
  });
});
