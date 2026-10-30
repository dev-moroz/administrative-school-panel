import type { Prisma } from '../generated/prisma/client.js';

// A lesson carries money only when its ledger entries do not sum to 0 (a charge and its reversal cancel out).
export async function chargedLessonIds(tx: Prisma.TransactionClient, lessonIds: string[]) {
  if (!lessonIds.length) return new Set<string>();
  const sums = await tx.ledgerEntry.groupBy({
    by: ['lessonId'],
    where: { lessonId: { in: lessonIds } },
    _sum: { delta: true },
  });
  return new Set(sums.filter((s) => s._sum.delta).map((s) => s.lessonId!));
}
