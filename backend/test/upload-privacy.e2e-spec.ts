import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { HttpException } from '@nestjs/common';
import { createTestApp, registerUser, resetDatabase, TestContext } from './test-app';
import { makePng } from './fakes';
import { hasGpsTag, photoWithMetadata, pixel } from './metadata-fixtures';
import { StorageService } from '../src/images/storage.service';
import { UploadQuotaService } from '../src/images/upload-quota.service';

const HOUR = 60 * 60 * 1000;

/** Spec 04: metadata stripping of stored originals and upload limits. */
describe('upload privacy and limits (spec 04)', () => {
  let ctx: TestContext;
  let storage: StorageService;
  let quota: UploadQuotaService;
  let png: Buffer;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    storage = ctx.app.get(StorageService);
    quota = ctx.app.get(UploadQuotaService);
    png = await makePng({ r: 40, g: 160, b: 90 }, 128);
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    (quota as any).verificationRequired = true;
  });

  function upload(token: string, file: Buffer = png, name = 'p.png', type = 'image/png') {
    return ctx
      .http()
      .post('/api/images/upload')
      .set(auth(token))
      .attach('file', file, { filename: name, contentType: type });
  }

  function originalsOnDisk(): number {
    const dir = path.join(storage.getLocalUploadDir(), 'originals');
    return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  }

  /** Pretends the user already uploaded `count` photos at the given times (ledger rows only). */
  async function pastUploads(userId: string, count: number, at: Date) {
    await ctx.prisma.uploadLog.createMany({ data: Array.from({ length: count }, () => ({ userId, createdAt: at })) });
  }

  describe('metadata', () => {
    it('[AC-UPL-019] a phone JPEG is stored without EXIF/GPS/XMP/IPTC, upright and with its ICC profile', async () => {
      const { token } = await registerUser(ctx);
      const photo = await photoWithMetadata('jpeg');
      const before = await sharp(photo).metadata();
      expect(hasGpsTag(before.exif)).toBe(true);
      expect(before.iptc).toBeDefined();

      const res = await upload(token, photo, 'IMG_0001.jpg', 'image/jpeg').expect(201);
      expect(res.body.filename).toMatch(/\.jpg$/);
      const { buffer } = await storage.getFileBuffer(res.body.filename);
      const meta = await sharp(buffer).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(buffer.includes(Buffer.from('Jan Kowalski'))).toBe(false);
      expect(buffer.includes(Buffer.from('TestCam'))).toBe(false);
      // Orientation 6 applied: 300×200 sensor image → 200×300 upright, red half on top.
      expect([meta.width, meta.height]).toEqual([200, 300]);
      expect((await pixel(buffer, 100, 30))[0]).toBeGreaterThan(150);
      expect((await pixel(buffer, 100, 270))[2]).toBeGreaterThan(150);
      expect(meta.icc!.equals(before.icc!)).toBe(true);

      // What the API serves back is the same clean file.
      const detail = await ctx.http().get(`/api/images/${res.body.id}`).set(auth(token)).expect(200);
      expect(detail.body.originalUrl).toContain(res.body.filename);
    });

    it.each([
      ['png', 'image/png'],
      ['webp', 'image/webp'],
    ] as const)('[AC-UPL-019] a %s upload is stored without EXIF/GPS/XMP in the same format', async (format, type) => {
      const { token } = await registerUser(ctx);
      const res = await upload(token, await photoWithMetadata(format), `x.${format}`, type).expect(201);
      const { buffer } = await storage.getFileBuffer(res.body.filename);
      const meta = await sharp(buffer).metadata();
      expect([meta.format, meta.exif, meta.xmp]).toEqual([format, undefined, undefined]);
      expect(meta.icc?.length).toBeGreaterThan(0);
      expect(buffer.includes(Buffer.from('Jan Kowalski'))).toBe(false);
    });

    it('[AC-UPL-019] the landing demo stores the photo without metadata too', async () => {
      const res = await ctx
        .http()
        .post('/api/demo')
        .field('email', 'demo-exif@example.com')
        .attach('file', await photoWithMetadata('jpeg'), { filename: 'IMG.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const row = await ctx.prisma.demoRequest.findUniqueOrThrow({ where: { id: res.body.id } });
      const { buffer } = await storage.getFileBuffer(row.imageKey);
      const meta = await sharp(buffer).metadata();
      expect([meta.exif, meta.xmp, meta.iptc, meta.orientation]).toEqual([undefined, undefined, undefined, undefined]);
      expect([meta.width, meta.height]).toEqual([200, 300]);
      expect(hasGpsTag(meta.exif)).toBe(false);
      // Let the background generation finish before the next test truncates the tables.
      for (let i = 0; i < 100; i++) {
        const { status } = await ctx.prisma.demoRequest.findUniqueOrThrow({ where: { id: row.id } });
        if (status === 'COMPLETED' || status === 'FAILED') break;
        await new Promise((r) => setTimeout(r, 50));
      }
    });
  });

  describe('limits', () => {
    it('[AC-UPL-020] an unconfirmed account uploads 5 photos in total; deleting one does not free the limit', async () => {
      const { token, userId } = await registerUser(ctx, undefined, { verified: false });
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) ids.push((await upload(token).expect(201)).body.id);

      const sixth = await upload(token).expect(403);
      expect(sixth.body.code).toBe('UPLOAD_LIMIT_UNVERIFIED');
      expect(sixth.body.limit).toBe(5);
      expect(sixth.body.message).toBe(
        'Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej 5 zdjęć. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji (możesz wysłać go ponownie z banera u góry strony), a potem prześlesz kolejne.',
      );

      await ctx.http().delete(`/api/images/${ids[0]}`).set(auth(token)).expect(200);
      expect((await upload(token).expect(403)).body.code).toBe('UPLOAD_LIMIT_UNVERIFIED');
      expect(await ctx.prisma.image.count({ where: { userId } })).toBe(4);

      // Confirming the address switches to the daily limit (5 of 200 used).
      await ctx.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      await upload(token).expect(201);
    });

    it('[AC-UPL-020] with EMAIL_VERIFICATION_REQUIRED=false an unconfirmed account gets the daily limit', async () => {
      (quota as any).verificationRequired = false;
      const { token, userId } = await registerUser(ctx, undefined, { verified: false });
      await pastUploads(userId, 199, new Date(Date.now() - HOUR));
      await upload(token).expect(201);
      expect((await upload(token).expect(429)).body.code).toBe('UPLOAD_LIMIT_DAILY');
    });

    it('[AC-UPL-021] a confirmed account: 200 per rolling 24 h with Retry-After; older uploads and rejected files do not count', async () => {
      const { token, userId } = await registerUser(ctx);
      expect(quota.dailyLimit).toBe(200);
      const now = Date.now();
      // Just outside the window: these never count.
      await pastUploads(userId, 50, new Date(now - 24 * HOUR - 60_000));
      // Inside the window: the oldest frees its slot in ~1 hour.
      await pastUploads(userId, 100, new Date(now - 23 * HOUR));
      await pastUploads(userId, 98, new Date(now - HOUR));

      // An invalid file is rejected before the quota is touched.
      await upload(token, Buffer.from('<html></html>'), 'x.png').expect(400);
      await upload(token).expect(201);
      await upload(token).expect(201);

      const over = await upload(token).expect(429);
      expect(over.body).toMatchObject({ code: 'UPLOAD_LIMIT_DAILY', limit: 200 });
      expect(over.body.retryAfterSeconds).toBeGreaterThan(55 * 60);
      expect(over.body.retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
      expect(over.headers['retry-after']).toBe(String(over.body.retryAfterSeconds));
      expect(over.body.message).toBe(
        'Osiągnięto dzienny limit 200 przesłanych zdjęć. Kolejne prześlesz za około 1 godzinę.',
      );

      // Time travel past the oldest in-window uploads: the window rolls and slots free up.
      await quota.reserve(userId, new Date(now + HOUR + 60_000)).then((id) => quota.release(id));
      const stillFull = await quota.reserve(userId, new Date(now + 5 * 60_000)).catch((err) => err);
      expect(stillFull).toBeInstanceOf(HttpException);
      expect((stillFull as HttpException).getStatus()).toBe(429);
    });

    it('[AC-UPL-022] 20 parallel uploads at the boundary: exactly the remaining quota succeeds (confirmed account)', async () => {
      const { token, userId } = await registerUser(ctx);
      await pastUploads(userId, 195, new Date(Date.now() - HOUR));
      const filesBefore = originalsOnDisk();

      const results = await Promise.all(Array.from({ length: 20 }, () => upload(token)));
      const ok = results.filter((r) => r.status === 201);
      const limited = results.filter((r) => r.status === 429);
      expect(ok).toHaveLength(5);
      expect(limited).toHaveLength(15);
      for (const r of limited) expect(r.body.code).toBe('UPLOAD_LIMIT_DAILY');
      expect(await ctx.prisma.image.count({ where: { userId } })).toBe(5);
      expect(await ctx.prisma.uploadLog.count({ where: { userId } })).toBe(200);
      expect(originalsOnDisk() - filesBefore).toBe(5);
    });

    it('[AC-UPL-022] 20 parallel uploads of an unconfirmed account: exactly 5 in total succeed', async () => {
      const { token, userId } = await registerUser(ctx, undefined, { verified: false });
      await upload(token).expect(201);
      await upload(token).expect(201);
      const results = await Promise.all(Array.from({ length: 20 }, () => upload(token)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      const rejected = results.filter((r) => r.status === 403);
      expect(rejected).toHaveLength(17);
      for (const r of rejected) expect(r.body.code).toBe('UPLOAD_LIMIT_UNVERIFIED');
      expect(await ctx.prisma.image.count({ where: { userId } })).toBe(5);
    });

    it('[AC-UPL-022] bulk upload partially over the limit: a clear result per file; storage errors give the slot back', async () => {
      const { token, userId } = await registerUser(ctx, undefined, { verified: false });
      const bad = Buffer.from('not an image');
      const files = [png, bad, png, png, png, png, png, png];
      // The app uploads a batch file by file and shows each file's outcome.
      const outcome: Array<{ file: number; status: number; code?: string }> = [];
      for (const [i, file] of files.entries()) {
        const res = await upload(token, file, `plik-${i + 1}.png`);
        outcome.push({ file: i + 1, status: res.status, ...(res.body.code ? { code: res.body.code } : {}) });
      }
      expect(outcome).toEqual([
        { file: 1, status: 201 },
        { file: 2, status: 400 },
        { file: 3, status: 201 },
        { file: 4, status: 201 },
        { file: 5, status: 201 },
        { file: 6, status: 201 },
        { file: 7, status: 403, code: 'UPLOAD_LIMIT_UNVERIFIED' },
        { file: 8, status: 403, code: 'UPLOAD_LIMIT_UNVERIFIED' },
      ]);

      // A storage failure after the reservation releases it.
      const second = await registerUser(ctx);
      const spy = jest.spyOn(storage, 'uploadFile').mockRejectedValueOnce(new Error('B2 down'));
      await upload(second.token).expect(500);
      expect(await ctx.prisma.uploadLog.count({ where: { userId: second.userId } })).toBe(0);
      spy.mockRestore();
      await upload(second.token).expect(201);
      expect(await ctx.prisma.uploadLog.count({ where: { userId: second.userId } })).toBe(1);
      expect(await ctx.prisma.uploadLog.count({ where: { userId } })).toBe(5);
    });

    it('[AC-UPL-021] the clean-up job drops ledger rows no limit needs (confirmed accounts, older than 48 h)', async () => {
      const verified = await registerUser(ctx);
      const unverified = await registerUser(ctx, undefined, { verified: false });
      const old = new Date(Date.now() - 72 * HOUR);
      await pastUploads(verified.userId, 3, old);
      await pastUploads(verified.userId, 2, new Date(Date.now() - HOUR));
      await pastUploads(unverified.userId, 3, old);
      expect(await quota.cleanup()).toBe(3);
      expect(await ctx.prisma.uploadLog.count({ where: { userId: verified.userId } })).toBe(2);
      // Unconfirmed accounts keep every row – their limit is a lifetime total.
      expect(await ctx.prisma.uploadLog.count({ where: { userId: unverified.userId } })).toBe(3);
    });
  });
});
