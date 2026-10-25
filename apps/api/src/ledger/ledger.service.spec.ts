import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';

const STUDENT_ID = 'student-1';
const ACTOR_ID = 'admin-1';

function setup() {
  const tx = {
    student: { findUnique: vi.fn().mockResolvedValue({ id: STUDENT_ID }) },
    ledgerEntry: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'entry-1', ...data })),
      aggregate: vi.fn(),
    },
  };
  const prisma = {
    ...tx,
    ledgerEntry: { create: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn().mockImplementation((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const service = new LedgerService(prisma as never);
  return { service, prisma, tx };
}

describe('LedgerService', () => {
  describe('getBalance', () => {
    it('is 0 when the student has no entries', async () => {
      const { service, prisma } = setup();
      prisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { delta: null } });

      expect(await service.getBalance(STUDENT_ID)).toBe(0);
    });

    it('returns SUM(delta) for the student, including a negative sum', async () => {
      const { service, prisma } = setup();
      prisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { delta: -3 } });

      expect(await service.getBalance(STUDENT_ID)).toBe(-3);
      expect(prisma.ledgerEntry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: STUDENT_ID } }),
      );
    });

    it('uses the given transaction client instead of the default one', async () => {
      const { service, prisma, tx } = setup();
      tx.ledgerEntry.aggregate.mockResolvedValue({ _sum: { delta: 5 } });

      expect(await service.getBalance(STUDENT_ID, tx as never)).toBe(5);
      expect(prisma.ledgerEntry.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('addEntry', () => {
    it.each([0, 1.5, Number.NaN])('rejects delta %s and writes nothing', async (delta) => {
      const { service, tx } = setup();

      await expect(
        service.addEntry(tx as never, { studentId: STUDENT_ID, delta, type: 'LESSON_CHARGE', createdById: ACTOR_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it.each(['', '   ', '\n\t'])('rejects an empty comment %j and writes nothing', async (comment) => {
      const { service, tx } = setup();

      await expect(service.adjust(STUDENT_ID, 1, comment, ACTOR_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it.each([0, 1.5])('rejects delta %s', async (delta) => {
      const { service, tx } = setup();

      await expect(service.adjust(STUDENT_ID, delta, 'reason', ACTOR_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('accepts the limit (+50 and -50) and rejects 51 and -51', async () => {
      const { service, tx } = setup();

      await service.adjust(STUDENT_ID, 50, 'reason', ACTOR_ID);
      await service.adjust(STUDENT_ID, -50, 'reason', ACTOR_ID);
      expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2);

      await expect(service.adjust(STUDENT_ID, 51, 'reason', ACTOR_ID)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.adjust(STUDENT_ID, -51, 'reason', ACTOR_ID)).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2);
    });

    it('404 when the student does not exist, nothing is written', async () => {
      const { service, tx } = setup();
      tx.student.findUnique.mockResolvedValue(null);

      await expect(service.adjust(STUDENT_ID, 1, 'reason', ACTOR_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  it('has no method that updates or deletes an entry', () => {
    const { service } = setup();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service));

    expect(methods.filter((m) => /update|delete|remove|edit/i.test(m))).toEqual([]);
  });
});
