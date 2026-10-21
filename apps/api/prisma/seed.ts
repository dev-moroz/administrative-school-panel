import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import argon2 from "argon2";

const PERMISSIONS = [
    "students.read.all",
    "students.read.own",
    "students.create",
    "students.update",
    "students.delete",
    "users.manage",
    "roles.manage"
];

const ROLES: Record<string, string[]> = {
    admin: PERMISSIONS,
    student: ["students.read.own"],
};

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

        await prisma.rolePermission.createMany({
            data: permissions.map((p) => ({
                roleId: role.id,
                permissionId: p.id,
            })),
            skipDuplicates: true,
        });
    }

    const email = process.env.ADMIN_EMAIL;
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
        create: { email, passwordHash, roleId: adminRole.id },
    });
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

