import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { BASE_TIME_ZONE } from "../src/common/base-time-zone.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { addDays, localDate, slotDates, zonedToUtc } from "../src/lesson-series/series-slots.js";

const HISTORY_DAYS = 42;
const HORIZON_DAYS = 28;
const DURATION_MIN = 60;
const PACKAGE_SIZE = 8;
const ONE_OFF_TIME = "20:30";
const VACATION = { from: 14, to: 18 };
const FREEZE = { from: -5, to: 9 };

type Outcome = "done" | "ill" | "late" | "noshow";
const OUTCOMES: Outcome[] = ["done", "done", "ill", "done", "late", "done", "done", "noshow"];

interface DemoStudent {
    fullName: string;
    level: "A2" | "B1" | "B2" | "C1";
    currency: string;
    method: string;
    price: number;
    targetBalance: number;
    slots: { weekday: number; time: string }[];
    comment?: string;
    frozen?: boolean;
    inactive?: boolean;
    adjustment?: number;
    oneOffInDays?: number;
}

const DEMO_STUDENTS: DemoStudent[] = [
    { fullName: "Emma Carter", level: "B2", currency: "EUR", method: "CARD", price: 30, targetBalance: 6, slots: [{ weekday: 1, time: "10:00" }, { weekday: 4, time: "10:00" }], comment: "Preparing for IELTS" },
    { fullName: "Lucas Meyer", level: "B1", currency: "EUR", method: "TRANSFER", price: 28, targetBalance: 2, slots: [{ weekday: 2, time: "11:30" }], comment: "Business English" },
    { fullName: "Mila Sokolova", level: "A2", currency: "EUR", method: "TRANSFER", price: 22, targetBalance: 1, slots: [{ weekday: 1, time: "12:00" }, { weekday: 3, time: "12:00" }] },
    { fullName: "Daniel Novak", level: "C1", currency: "USDT", method: "CRYPTO", price: 35, targetBalance: 11, slots: [{ weekday: 3, time: "17:00" }], adjustment: 1, oneOffInDays: 3 },
    { fullName: "Anna Petrovich", level: "B1", currency: "USDT", method: "CASH", price: 30, targetBalance: -2, slots: [{ weekday: 2, time: "18:30" }, { weekday: 5, time: "18:30" }], comment: "Pays after the lesson" },
    { fullName: "Oliver Hayes", level: "B2", currency: "USDC", method: "CRYPTO", price: 32, targetBalance: 4, slots: [{ weekday: 5, time: "15:00" }], oneOffInDays: 10 },
    { fullName: "Sofia Romero", level: "A2", currency: "EUR", method: "CARD", price: 25, targetBalance: 5, slots: [{ weekday: 4, time: "16:00" }], comment: "Travelling, back in two weeks", frozen: true },
    { fullName: "Mark Ivanov", level: "B1", currency: "EUR", method: "CASH", price: 20, targetBalance: 0, slots: [], comment: "Finished the course", inactive: true },
];

const fromYmd = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export async function seedDemo(prisma: PrismaClient, now: Date) {
    const teacher = await prisma.teacher.findFirstOrThrow();
    const admin = await prisma.user.findFirstOrThrow({ where: { role: { name: "admin" } } });
    const today = localDate(now, BASE_TIME_ZONE);
    const until = addDays(today, HORIZON_DAYS);
    const historyFrom = addDays(today, -HISTORY_DAYS);

    const vacationFrom = addDays(today, VACATION.from);
    const vacationTo = addDays(today, VACATION.to);
    await prisma.absence.create({
        data: {
            kind: "TEACHER_VACATION",
            teacherId: teacher.id,
            startsOn: fromYmd(vacationFrom),
            endsOn: fromYmd(vacationTo),
            comment: "Summer break",
            createdById: teacher.userId,
        },
    });

    for (const [index, spec] of DEMO_STUDENTS.entries()) {
        const student = await prisma.student.create({
            data: {
                fullName: spec.fullName,
                englishLevel: spec.level,
                comment: spec.comment,
                defaultCurrencyCode: spec.currency,
                defaultPaymentMethodCode: spec.method,
                lessonPrice: spec.price,
                isActive: !spec.inactive,
                teachers: { create: { teacherId: teacher.id } },
            },
        });

        const freezeFrom = addDays(today, FREEZE.from);
        const freezeTo = addDays(today, FREEZE.to);
        const freeze = spec.frozen
            ? await prisma.absence.create({
                  data: {
                      kind: "STUDENT_FREEZE",
                      studentId: student.id,
                      startsOn: fromYmd(freezeFrom),
                      endsOn: fromYmd(freezeTo),
                      comment: spec.comment,
                      createdById: teacher.userId,
                  },
              })
            : null;
        const blocked = (date: string) =>
            (date >= vacationFrom && date <= vacationTo) ||
            (spec.frozen === true && date >= freezeFrom && date <= freezeTo);

        let chargedCount = 0;
        let position = index;

        const addPast = async (startsAt: Date, seriesId: string | null, date: string, frozenSlot: boolean) => {
            const outcome: Outcome = frozenSlot ? "ill" : OUTCOMES[position++ % OUTCOMES.length];
            const charged = outcome === "done" || outcome === "late" || outcome === "noshow";
            const cancelled = frozenSlot || outcome === "ill" || outcome === "late";
            const lesson = await prisma.lesson.create({
                data: {
                    teacherId: teacher.id,
                    startsAt,
                    durationMin: DURATION_MIN,
                    status: cancelled ? "CANCELLED" : outcome === "noshow" ? "NO_SHOW" : "COMPLETED",
                    charged,
                    cancelledAt: cancelled ? new Date(startsAt.getTime() - 30 * 60_000) : null,
                    cancelReasonCode: frozenSlot ? "STUDENT_FREEZE" : outcome === "ill" ? "STUDENT_ILL" : outcome === "late" ? "STUDENT_REQUEST" : null,
                    absenceId: frozenSlot ? freeze?.id : null,
                    seriesId,
                    originalDate: seriesId ? fromYmd(date) : null,
                    participants: { create: { studentId: student.id } },
                },
            });
            if (charged) {
                chargedCount++;
                await prisma.ledgerEntry.create({
                    data: { studentId: student.id, delta: -1, type: "LESSON_CHARGE", lessonId: lesson.id, createdAt: startsAt },
                });
            }
        };

        for (const slot of spec.slots) {
            const series = await prisma.lessonSeries.create({
                data: {
                    teacherId: teacher.id,
                    studentId: student.id,
                    weekday: slot.weekday,
                    startTime: slot.time,
                    durationMin: DURATION_MIN,
                    startsOn: fromYmd(historyFrom),
                    generatedUntil: fromYmd(until),
                },
            });
            const dates = slotDates({ weekday: slot.weekday, startsOn: historyFrom, endsOn: null }, historyFrom, until);
            for (const date of dates) {
                const startsAt = zonedToUtc(date, slot.time, BASE_TIME_ZONE);
                if (startsAt.getTime() + DURATION_MIN * 60_000 <= now.getTime()) {
                    await addPast(startsAt, series.id, date, spec.frozen === true && blocked(date));
                } else if (startsAt > now && !blocked(date)) {
                    await prisma.lesson.create({
                        data: {
                            teacherId: teacher.id,
                            startsAt,
                            durationMin: DURATION_MIN,
                            seriesId: series.id,
                            originalDate: fromYmd(date),
                            participants: { create: { studentId: student.id } },
                        },
                    });
                }
            }
        }

        if (spec.inactive) {
            for (const daysAgo of [40, 33, 26, 19]) {
                const date = addDays(today, -daysAgo);
                await addPast(zonedToUtc(date, ONE_OFF_TIME, BASE_TIME_ZONE), null, date, false);
            }
        }

        if (spec.oneOffInDays) {
            await prisma.lesson.create({
                data: {
                    teacherId: teacher.id,
                    startsAt: zonedToUtc(addDays(today, spec.oneOffInDays), ONE_OFF_TIME, BASE_TIME_ZONE),
                    durationMin: DURATION_MIN,
                    comment: "Extra speaking practice",
                    participants: { create: { studentId: student.id } },
                },
            });
        }

        if (spec.adjustment) {
            await prisma.ledgerEntry.create({
                data: {
                    studentId: student.id,
                    delta: spec.adjustment,
                    type: "MANUAL_ADJUSTMENT",
                    comment: "Compensation for a lesson moved by the teacher",
                    createdById: admin.id,
                    createdAt: fromYmd(addDays(today, -10)),
                },
            });
        }

        // Packages of 8 plus a smaller first one, so the ledger lands exactly on the target balance.
        let remaining = chargedCount + spec.targetBalance - (spec.adjustment ?? 0);
        let daysAgo = 3 + index;
        while (remaining > 0) {
            const lessons = remaining > PACKAGE_SIZE ? PACKAGE_SIZE : remaining;
            remaining -= lessons;
            const paidAt = zonedToUtc(addDays(today, -daysAgo), "09:00", BASE_TIME_ZONE);
            await prisma.payment.create({
                data: {
                    studentId: student.id,
                    amount: lessons * spec.price,
                    currencyCode: spec.currency,
                    paidAt,
                    methodCode: spec.method,
                    lessonsGranted: lessons,
                    createdById: teacher.userId,
                    createdAt: paidAt,
                    ledgerEntry: {
                        create: { studentId: student.id, delta: lessons, type: "PURCHASE", createdById: teacher.userId, createdAt: paidAt },
                    },
                },
            });
            daysAgo += 14;
        }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    seedDemo(prisma, new Date())
        .catch((e) => { console.error(e); process.exit(1); })
        .finally(() => prisma.$disconnect());
}
