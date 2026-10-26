// numeric(28,8) leaves 20 integer digits; 15 is far beyond any real lesson payment.
const MAX_INTEGER_DIGITS = 15;

// Returns the amount as a fixed string with exactly `decimals` digits, or null when it is not a valid positive amount.
export function parseAmount(raw: unknown, decimals: number): string | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;

  const integer = match[1].replace(/^0+(?=\d)/, '');
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) return null;
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  if (/^0*$/.test(integer + fraction)) return null;

  return decimals === 0 ? integer : `${integer}.${fraction.padEnd(decimals, '0')}`;
}
