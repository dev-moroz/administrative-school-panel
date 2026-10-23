import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import argon2 from "argon2";
import { normalizeEmail } from "../src/helper/index.js";

const STUDENTS = [
    "students.read.all",
    "students.read.own",
    "students.create",
    "students.update",
    "students.delete",
    "students.assign-teacher"
]

const LESSONS = [
    "lessons.read",
    "lessons.create",
    "lessons.update",
    "lessons.delete",

    "lesson-series.manage",
    "freezes.manage",
    "schedule-rules.manage"
];

const PAYMENTS = [
    "payments.read",
    "payments.create"
]

const BALANCE = [
    "balance.read",
    "balance.adjust"
]

const CURRENCIES = [
    "currencies.read",
    "currencies.create",
    "currencies.update"
]

const AUDIT = [
    "audit.read.business",
    "audit.read.system"
]

const SYSTEM = [
    "users.manage",
    "roles.manage",
    "settings.manage",
]

const PERMISSIONS = [
    ...STUDENTS,
    ...LESSONS,
    ...PAYMENTS,
    ...BALANCE,
    ...CURRENCIES,
    ...AUDIT,
    ...SYSTEM,
];

const ROLES: Record<string, string[]> = {
    admin: PERMISSIONS,
    student: ["students.read.own"],
    teacher: [
        "students.read.all", "students.create", "students.update",
        ...LESSONS,
        ...PAYMENTS,
        ...BALANCE,
        "currencies.read",
        "audit.read.business",
    ],
};

const CURRENCIES_SEED = [
    { code: "EUR", name: "Euro" },
    { code: "USDT", name: "Tether" },
    { code: "USDC", name: "USD Coin" },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    for (const key of PERMISSIONS){
        await prisma.permission.upsert({
            where: { key },
            update: {},
            create: { key },
        });
    }
    for (const [name, keys] of Object.entries(ROLES)){
        const role = await prisma.role.upsert({
            where: { name },
            update: {},
            create: { name, isSystem: true },
        })

        const permissions = await prisma.permission.findMany({
            where: { key:{ in: keys } },
        })

        if (permissions.length !== keys.length) {
            throw new Error(`Unknown permission key in role "${name}"`);
        }

        const ids = permissions.map((p) => p.id)

        await prisma.$transaction([
            prisma.rolePermission.createMany({
                data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
                skipDuplicates: true,
            }),
            prisma.rolePermission.deleteMany({
                where: {roleId: role.id, permissionId: { notIn: ids }}
            })
        ])
    }

    for (const { code, name } of CURRENCIES_SEED) {
        await prisma.currency.upsert({
            where: { code },
            update: {},
            create: { code, name, decimals: 2 },
        });
    }

    const email = normalizeEmail(process.env.ADMIN_EMAIL as string);
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD are not set");
    }

    const adminRole = await prisma.role.findUniqueOrThrow({
        where: { name: "admin" },
    });
    const passwordHash = await argon2.hash(password);

    await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email: email, passwordHash, roleId: adminRole.id },
    });

    // Temporary bootstrap until the Users module can create teachers.
    const teacherEmail = process.env.TEACHER_EMAIL ? normalizeEmail(process.env.TEACHER_EMAIL) : "";
    const teacherPassword = process.env.TEACHER_PASSWORD;
    if (teacherEmail && teacherPassword) {
        const teacherRole = await prisma.role.findUniqueOrThrow({
            where: { name: "teacher" },
        });
        const teacherUser = await prisma.user.upsert({
            where: { email: teacherEmail },
            update: {},
            create: {
                email: teacherEmail,
                passwordHash: await argon2.hash(teacherPassword),
                roleId: teacherRole.id,
            },
        });
        await prisma.teacher.upsert({
            where: { userId: teacherUser.id },
            update: {},
            create: {
                userId: teacherUser.id,
                fullName: process.env.TEACHER_NAME || teacherEmail,
            },
        });
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

