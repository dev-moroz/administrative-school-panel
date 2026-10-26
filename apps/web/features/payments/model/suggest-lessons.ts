import { MAX_LESSONS_GRANTED } from "./payment-schema";

const SCALE = 8;

// Exact decimal parsing: money must not go through floats.
function toScaled(value: string, maxFraction: number): bigint | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > maxFraction) return null;
  return BigInt(match[1] + fraction.padEnd(SCALE, "0"));
}

type Input = {
  amount: string;
  price: string | null;
  paymentCurrency: string;
  priceCurrency: string | null;
  decimals: number;
};

export function suggestLessons({ amount, price, paymentCurrency, priceCurrency, decimals }: Input): number | null {
  if (price === null || priceCurrency === null || paymentCurrency !== priceCurrency) return null;
  const paid = toScaled(amount, decimals);
  const perLesson = toScaled(price, SCALE);
  if (paid === null || perLesson === null || perLesson === BigInt(0)) return null;
  const lessons = Number(paid / perLesson);
  return lessons >= 1 && lessons <= MAX_LESSONS_GRANTED ? lessons : null;
}
