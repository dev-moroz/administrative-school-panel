import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MAX_PROOF_FILE_SIZE } from '../src/payments/payments.constants.js';
import { createTestApp, ensureTeacher, ensureUser, loginAs, TEST_ORIGIN } from './helpers.js';

type Actor = 'anonymous' | 'student' | 'teacher' | 'admin';
const ACTORS: Actor[] = ['anonymous', 'student', 'teacher', 'admin'];

const TAG = `e2eproof${Date.now().toString(36)}`;
const ADMIN_EMAIL = 'proofs-admin@e2e.test';
const TEACHER_EMAIL = 'proofs-teacher@e2e.test';
const STUDENT_EMAIL = 'proofs-student@e2e.test';
const PROOFS_DIR = join(process.env.UPLOADS_DIR!, 'payment-proofs');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.from('webp-body')]);
const PDF = Buffer.from('%PDF-1.7\nbody\n%%EOF');

const FORMATS = [
  { name: 'png', buffer: PNG, mime: 'image/png', ext: 'png' },
  { name: 'jpeg', buffer: JPEG, mime: 'image/jpeg', ext: 'jpg' },
  { name: 'webp', buffer: WEBP, mime: 'image/webp', ext: 'webp' },
  { name: 'pdf', buffer: PDF, mime: 'application/pdf', ext: 'pdf' },
];

function padded(head: Buffer, size: number) {
  return Buffer.concat([head, Buffer.alloc(size - head.length)]);
}

describe('payment proof files (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;
  let teacher: { id: string };
  const cookies: Partial<Record<Actor, string>> = {};
  let counter = 0;

  async function diskFiles() {
    try {
      return (await readdir(PROOFS_DIR)).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async function seedPayment(over: Record<string, unknown> = {}) {
    counter += 1;
    const student = await prisma.student.create({
      data: { fullName: `${TAG} seed ${counter}`, teachers: { create: { teacherId: teacher.id } } },
    });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: '400',
        currencyCode: 'EUR',
        paidAt: new Date(),
        methodCode: 'TRANSFER',
        lessonsGranted: 8,
        createdById: admin.id,
        ...over,
      },
    });
    return { student, payment };
  }

  function upload(actor: Actor, paymentId: string, file?: { buffer: Buffer; filename?: string; contentType?: string }, field = 'file') {
    const req = request(server).post(`/payments/${paymentId}/proof`).set('Origin', TEST_ORIGIN);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    if (file) req.attach(field, file.buffer, { filename: file.filename ?? 'proof.png', contentType: file.contentType ?? 'image/png' });
    return req;
  }

  function download(actor: Actor, paymentId: string) {
    const req = request(server).get(`/payments/${paymentId}/proof`);
    if (actor !== 'anonymous') req.set('Cookie', cookies[actor]!);
    return req.buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    teacher = await ensureTeacher(app, TEACHER_EMAIL, 'Proofs Teacher');
    await ensureUser(app, STUDENT_EMAIL, 'student');
    await ensureUser(app, ADMIN_EMAIL, 'admin');
    cookies.teacher = await loginAs(app, TEACHER_EMAIL);
    cookies.student = await loginAs(app, STUDENT_EMAIL);
    cookies.admin = await loginAs(app, ADMIN_EMAIL);
  });

  afterAll(async () => {
    const students = { student: { fullName: { startsWith: TAG } } };
    const proofs = await prisma.paymentProofFile.findMany({ where: { payment: students } });
    for (const proof of proofs) await rm(join(PROOFS_DIR, `${proof.id}.${proof.mimeType === 'application/pdf' ? 'pdf' : proof.mimeType === 'image/jpeg' ? 'jpg' : proof.mimeType.split('/')[1]}`), { force: true });
    await prisma.paymentProofFile.deleteMany({ where: { payment: students } });
    await prisma.ledgerEntry.deleteMany({ where: { OR: [students, { payment: students }] } });
    await prisma.payment.deleteMany({ where: students });
    await prisma.student.deleteMany({ where: { fullName: { startsWith: TAG } } });
    await app.close();
  });

  describe('role x endpoint matrix', () => {
    it.each(ACTORS)('POST /payments/:id/proof as %s', async (actor) => {
      const { payment } = await seedPayment();
      const expected = { anonymous: 401, student: 403, teacher: 201, admin: 201 }[actor];
      const res = await upload(actor, payment.id, { buffer: PNG });
      expect(res.status).toBe(expected);
    });

    it.each(ACTORS)('GET /payments/:id/proof as %s', async (actor) => {
      const { payment } = await seedPayment();
      await upload('admin', payment.id, { buffer: PNG }).expect(201);
      const expected = { anonymous: 401, student: 403, teacher: 200, admin: 200 }[actor];
      const res = await download(actor, payment.id);
      expect(res.status).toBe(expected);
    });

    it('a forbidden upload writes nothing to the disk or the database', async () => {
      const { payment } = await seedPayment();
      const before = await diskFiles();
      await upload('student', payment.id, { buffer: PNG }).expect(403);
      await upload('anonymous', payment.id, { buffer: PNG }).expect(401);
      expect(await diskFiles()).toEqual(before);
      expect(await prisma.paymentProofFile.count({ where: { paymentId: payment.id } })).toBe(0);
    });

    it('checks permissions before looking up the payment (401/403 before 404)', async () => {
      const id = randomUUID();
      await upload('anonymous', id, { buffer: PNG }).expect(401);
      await upload('student', id, { buffer: PNG }).expect(403);
      await upload('teacher', id, { buffer: PNG }).expect(404);
      await download('anonymous', id).expect(401);
      await download('student', id).expect(403);
      await download('teacher', id).expect(404);
    });
  });

  describe('upload', () => {
    it.each(FORMATS)('accepts $name, stores it under a generated name and returns the payment with proofFile', async ({ buffer, mime, ext }) => {
      const { payment } = await seedPayment();
      const before = await diskFiles();

      const res = await upload('teacher', payment.id, { buffer, filename: 'my receipt.' + ext, contentType: mime }).expect(201);

      expect(res.body.id).toBe(payment.id);
      expect(res.body.proofUrl).toBeNull();
      expect(res.body.proofFile).toEqual({ originalName: `my receipt.${ext}`, mimeType: mime, size: buffer.length });
      expect(Object.keys(res.body.proofFile).sort()).toEqual(['mimeType', 'originalName', 'size']);

      const row = await prisma.paymentProofFile.findUniqueOrThrow({ where: { paymentId: payment.id } });
      expect(row).toMatchObject({ mimeType: mime, size: buffer.length });
      const created = (await diskFiles()).filter((f) => !before.includes(f));
      expect(created).toEqual([`${row.id}.${ext}`]);
      expect(await readFile(join(PROOFS_DIR, created[0]))).toEqual(buffer);
    });

    it('records who uploaded the file', async () => {
      const { payment } = await seedPayment();
      await upload('teacher', payment.id, { buffer: PNG }).expect(201);
      const row = await prisma.paymentProofFile.findUniqueOrThrow({ where: { paymentId: payment.id }, include: { uploadedBy: true } });
      expect(row.uploadedBy.email).toBe(TEACHER_EMAIL);
    });

    it('trusts the signature, not the declared type or the extension (a png sent as a pdf is stored as png)', async () => {
      const { payment } = await seedPayment();
      const res = await upload('admin', payment.id, { buffer: PNG, filename: 'scan.pdf', contentType: 'application/pdf' }).expect(201);
      expect(res.body.proofFile.mimeType).toBe('image/png');
      const downloaded = await download('admin', payment.id).expect(200);
      expect(downloaded.headers['content-type']).toMatch(/^image\/png/);
    });

    it('the original name never reaches the file path', async () => {
      const { payment } = await seedPayment();
      const before = await diskFiles();
      const res = await upload('admin', payment.id, { buffer: PNG, filename: '../../evil.png' }).expect(201);
      expect(res.body.proofFile.originalName).toBe('evil.png');
      const created = (await diskFiles()).filter((f) => !before.includes(f));
      expect(created).toHaveLength(1);
      expect(created[0]).toMatch(/^[0-9a-f-]{36}\.png$/);
    });

    it('does not change the student balance', async () => {
      const { student, payment } = await seedPayment();
      await upload('admin', payment.id, { buffer: PNG }).expect(201);
      expect(await prisma.ledgerEntry.count({ where: { studentId: student.id } })).toBe(0);
    });
  });

  describe('rejected uploads leave no trace', () => {
    async function expectRejected(payment: { id: string }, status: number, file?: Parameters<typeof upload>[2], field?: string) {
      const before = await diskFiles();
      await upload('admin', payment.id, file, field).expect(status);
      expect(await diskFiles()).toEqual(before);
      expect(await prisma.paymentProofFile.count({ where: { paymentId: payment.id } })).toBe(0);
    }

    it.each([
      ['html declared as png', Buffer.from('<html><script>alert(1)</script></html>'), 'proof.png', 'image/png'],
      ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'proof.svg', 'image/svg+xml'],
      ['gif', Buffer.from('GIF89a\x01\x00\x01\x00'), 'proof.gif', 'image/gif'],
      ['executable declared as pdf', Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'proof.pdf', 'application/pdf'],
      ['empty file', Buffer.alloc(0), 'proof.png', 'image/png'],
    ])('400 for %s', async (_name, buffer, filename, contentType) => {
      const { payment } = await seedPayment();
      await expectRejected(payment, 400, { buffer, filename, contentType });
    });

    it('400 without a file', async () => {
      const { payment } = await seedPayment();
      await expectRejected(payment, 400);
    });

    it('400 when the file is in a field with another name', async () => {
      const { payment } = await seedPayment();
      await expectRejected(payment, 400, { buffer: PNG }, 'document');
    });

    it('413 above the size limit', async () => {
      const { payment } = await seedPayment();
      await expectRejected(payment, 413, { buffer: padded(PNG, MAX_PROOF_FILE_SIZE + 1) });
    });

    it('accepts a file exactly at the size limit', async () => {
      const { payment } = await seedPayment();
      const res = await upload('admin', payment.id, { buffer: padded(PNG, MAX_PROOF_FILE_SIZE) }).expect(201);
      expect(res.body.proofFile.size).toBe(MAX_PROOF_FILE_SIZE);
    });

    it('400 for a malformed payment id, 404 for an unknown one', async () => {
      await upload('admin', 'not-a-uuid', { buffer: PNG }).expect(400);
      await upload('admin', randomUUID(), { buffer: PNG }).expect(404);
    });
  });

  describe('one proof per payment', () => {
    it('409 on a second upload, the first file stays intact and no extra file appears', async () => {
      const { payment } = await seedPayment();
      await upload('admin', payment.id, { buffer: PNG }).expect(201);
      const afterFirst = await diskFiles();

      await upload('admin', payment.id, { buffer: JPEG, contentType: 'image/jpeg' }).expect(409);

      expect(await diskFiles()).toEqual(afterFirst);
      const downloaded = await download('admin', payment.id).expect(200);
      expect(downloaded.body).toEqual(PNG);
    });

    it('409 when the payment already has a proof link, nothing is written', async () => {
      const { payment } = await seedPayment({ proofUrl: 'https://example.com/receipt.png' });
      const before = await diskFiles();
      await upload('admin', payment.id, { buffer: PNG }).expect(409);
      expect(await diskFiles()).toEqual(before);
      expect(await prisma.paymentProofFile.count({ where: { paymentId: payment.id } })).toBe(0);
    });

    it('two parallel uploads: one wins with 201, the other gets 409, one file stays on the disk', async () => {
      const { payment } = await seedPayment();
      const before = await diskFiles();
      const results = await Promise.all([
        upload('admin', payment.id, { buffer: PNG }),
        upload('teacher', payment.id, { buffer: JPEG, contentType: 'image/jpeg' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect((await diskFiles()).filter((f) => !before.includes(f))).toHaveLength(1);
    });
  });

  describe('download', () => {
    it.each(FORMATS)('returns the exact bytes of $name with safe headers', async ({ buffer, mime, ext }) => {
      const { payment } = await seedPayment();
      await upload('admin', payment.id, { buffer, filename: 'evil;name.' + ext, contentType: mime }).expect(201);

      const res = await download('teacher', payment.id).expect(200);

      expect(res.body).toEqual(buffer);
      expect(res.headers['content-type']).toMatch(new RegExp(`^${mime}`));
      expect(res.headers['content-disposition']).toBe(`inline; filename="proof-${payment.id}.${ext}"`);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('404 for a payment without a proof file', async () => {
      const { payment } = await seedPayment();
      await download('admin', payment.id).expect(404);
    });

    it('404 for a payment that only has a proof link', async () => {
      const { payment } = await seedPayment({ proofUrl: 'https://example.com/receipt.png' });
      await download('admin', payment.id).expect(404);
    });

    it('404 when the row exists but the file is gone from the disk', async () => {
      const { payment } = await seedPayment();
      await upload('admin', payment.id, { buffer: PNG }).expect(201);
      const row = await prisma.paymentProofFile.findUniqueOrThrow({ where: { paymentId: payment.id } });
      await rm(join(PROOFS_DIR, `${row.id}.png`));
      await download('admin', payment.id).expect(404);
    });

    it('400 for a malformed payment id', async () => {
      await download('admin', 'not-a-uuid').expect(400);
    });
  });

  describe('payment responses', () => {
    it('proofFile is null for a new payment and set after the upload, in POST /payments, GET /payments and the upload response', async () => {
      const student = (await seedPayment()).student;
      const created = await request(server)
        .post('/payments')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', cookies.admin!)
        .send({ studentId: student.id, amount: '100.00', currencyCode: 'EUR', method: 'CASH', lessonsGranted: 2 })
        .expect(201);
      expect(created.body.proofFile).toBeNull();

      await upload('admin', created.body.id, { buffer: PDF, filename: 'r.pdf', contentType: 'application/pdf' }).expect(201);

      const list = await request(server).get(`/payments?studentId=${student.id}&pageSize=100`).set('Cookie', cookies.admin!).expect(200);
      const item = list.body.items.find((p: { id: string }) => p.id === created.body.id);
      expect(item.proofFile).toEqual({ originalName: 'r.pdf', mimeType: 'application/pdf', size: PDF.length });
      const other = list.body.items.find((p: { id: string }) => p.id !== created.body.id);
      expect(other.proofFile).toBeNull();
    });
  });
});
