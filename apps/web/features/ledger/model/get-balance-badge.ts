export type BalanceBadge = "debt" | "low" | null;

// Debt shows for everyone; Low balance only for active students and once the school threshold is known.
export function getBalanceBadge(balance: number, threshold: number | undefined, isActive: boolean): BalanceBadge {
  if (balance < 0) return "debt";
  if (isActive && threshold !== undefined && balance <= threshold) return "low";
  return null;
}
