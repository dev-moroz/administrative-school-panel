import type { Payment } from "../model/types";

export function makePayment(patch: Partial<Payment> = {}): Payment {
  return {
    id: "p1",
    amount: "400.00",
    currencyCode: "EUR",
    method: "TRANSFER",
    paidAt: new Date(2026, 9, 26, 14, 32).toISOString(),
    comment: null,
    proofUrl: null,
    proofFile: null,
    lessonsGranted: 8,
    createdAt: new Date(2026, 9, 26, 14, 33).toISOString(),
    student: { id: "s1", fullName: "Anna Petrova" },
    createdBy: { id: "u1", email: "admin@school.test", name: "Olga Smirnova" },
    ...patch,
  };
}
