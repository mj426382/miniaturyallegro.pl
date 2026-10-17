import * as fs from 'fs';
import * as path from 'path';
import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uploadImage,
  waitFor,
  waitForGenerations,
} from './test-app';
import { makePng } from './fakes';
import { expectBalanceMatchesLedger } from './ledger';
import { CreditsService } from '../src/generation/credits.service';
import { GenerationService } from '../src/generation/generation.service';

/**
 * Spec 05 (AC-GEN-027..029): every generation remembers the pool its credit came from and a failure
 * refunds exactly that pool; custom-style / rework references survive a retry; parallel charges and
 * refunds keep the balance equal to the ledger.
 */
describe('credit pools and reference images (integration)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const uploadsDir = () => process.env.LOCAL_UPLOAD_DIR!;
  const stored = (key: string) => fs.existsSync(path.join(uploadsDir(), key.replace(/^\/api\/uploads\//, '')));

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gemini.failStyles.clear();
    ctx.gemini.failDescription = false;
    ctx.gemini.delayMs = 0;
    (ctx.app.get(CreditsService) as any).admins = new Set();
    jest.restoreAllMocks();
  });

  async function account(freeCreditsUsed: number, credits: number) {
    const user = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { freeCreditsUsed, credits } });
    const image = await uploadImage(ctx, user.token);
    return { ...user, image, base: { freeUsed: freeCreditsUsed, paid: credits } };
  }

  const start = (token: string, imageId: string, styles: string[]) =>
    ctx.http().post(`/api/generation/${imageId}/start`).set(auth(token)).send({ styles });

  function custom(token: string, imageId: string, prompt: string, reference?: Buffer, rework = false) {
    const req = ctx.http().post(`/api/generation/${imageId}/custom`).set(auth(token)).field('userPrompt', prompt);
    if (rework) req.field('isRework', 'true');
    if (reference) req.attach('reference', reference, { filename: 'ref.png', contentType: 'image/png' });
    return req;
  }

  const poolsOfImage = async (imageId: string) =>
    (await ctx.prisma.generation.findMany({ where: { imageId }, orderBy: { createdAt: 'asc' } })).map((g) => [
      g.style,
      g.creditPool,
      g.status,
    ]);

  it('[AC-GEN-027] a batch charged from both pools refunds each failed graphic to its own pool', async () => {
    const user = await account(9, 5); // 1 free credit left, 5 purchased
    ctx.gemini.failStyles = new Set(['white-bg', 'dark-luxury']);
    await start(user.token, user.image.id, ['white-bg', 'dark-luxury']).expect(201);
    await waitForGenerations(ctx, user.image.id);
    expect(await poolsOfImage(user.image.id)).toEqual([
      ['white-bg', 'free', 'FAILED'],
      ['dark-luxury', 'paid', 'FAILED'],
    ]);
    // The old rule (free first) would have ended at 8 free used / 4 purchased.
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 9, credits: 5 });

    // Only the paid graphic fails: the purchased credit comes back, the free one stays spent.
    ctx.gemini.failStyles = new Set(['dark-luxury']);
    const second = await uploadImage(ctx, user.token);
    await start(user.token, second.id, ['white-bg', 'dark-luxury']).expect(201);
    await waitForGenerations(ctx, second.id);
    expect(await poolsOfImage(second.id)).toEqual([
      ['white-bg', 'free', 'COMPLETED'],
      ['dark-luxury', 'paid', 'FAILED'],
    ]);
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 5 });
    await expectBalanceMatchesLedger(ctx, user.userId, user.base);
  });

  it('[AC-GEN-027] custom style, rework and a failed product analysis refund to the charged pool', async () => {
    const user = await account(10, 3); // only purchased credits
    ctx.gemini.failStyles = new Set(['FAILME']);
    const res = await custom(user.token, user.image.id, 'Scena FAILME na plaży').expect(201);
    await waitForGenerations(ctx, user.image.id);
    expect(await ctx.prisma.generation.findUniqueOrThrow({ where: { id: res.body.generationId } })).toMatchObject({
      creditPool: 'paid',
      status: 'FAILED',
    });
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 3 });

    const rework = await custom(
      user.token,
      user.image.id,
      'Popraw FAILME tło',
      await makePng({ r: 9, g: 9, b: 9 }, 128),
      true,
    ).expect(201);
    await waitFor(
      async () =>
        (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: rework.body.generationId } })).status ===
        'FAILED',
    );
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 3 });

    // Analysis failure fails the whole batch – mixed pools, each refunded to its own.
    const mixed = await account(9, 2);
    ctx.gemini.failDescription = true;
    await start(mixed.token, mixed.image.id, ['white-bg', 'dark-luxury']).expect(201);
    await waitForGenerations(ctx, mixed.image.id);
    expect((await poolsOfImage(mixed.image.id)).map((r) => r[1])).toEqual(['free', 'paid']);
    expect(await getCredits(ctx, mixed.userId)).toEqual({ freeCreditsUsed: 9, credits: 2 });
    await expectBalanceMatchesLedger(ctx, user.userId, user.base);
    await expectBalanceMatchesLedger(ctx, mixed.userId, mixed.base);
  });

  it('[AC-GEN-027] the reconciler refunds stale rows to their pool and legacy rows the old way', async () => {
    const user = await account(2, 0);
    const rows = await Promise.all(
      [
        { creditPool: 'paid', status: 'PROCESSING' as const },
        { creditPool: 'free', status: 'PENDING' as const },
        { creditPool: null, status: 'PROCESSING' as const }, // charged before 2026-10-18
      ].map((data) => ctx.prisma.generation.create({ data: { imageId: user.image.id, style: 'white-bg', ...data } })),
    );
    await ctx.prisma.$executeRaw`UPDATE "generations" SET "updatedAt" = NOW() - INTERVAL '1 hour'`;
    // The paid row was charged from purchased credits that are no longer on the balance (0 now).
    const service = ctx.app.get(GenerationService);
    expect(await service.reconcileStaleGenerations()).toBe(3);
    expect(await getCredits(ctx, user.userId)).toEqual({ credits: 1, freeCreditsUsed: 0 });
    expect(await service.reconcileStaleGenerations()).toBe(0);
    for (const row of rows) {
      expect((await ctx.prisma.generation.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('FAILED');
    }
  });

  it('[AC-GEN-027] a retry is charged anew from the current pool and refunded there; admins have pool "none"', async () => {
    const user = await account(9, 3);
    ctx.gemini.failStyles = new Set(['dark-luxury']);
    await start(user.token, user.image.id, ['dark-luxury']).expect(201);
    const [failed] = await waitForGenerations(ctx, user.image.id);
    expect(failed).toMatchObject({ creditPool: 'free', status: 'FAILED' });

    // The last free credit goes to another graphic, so the retry has to use a purchased one.
    const other = await uploadImage(ctx, user.token);
    await start(user.token, other.id, ['white-bg']).expect(201);
    await waitForGenerations(ctx, other.id);
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 3 });

    await ctx.http().post(`/api/generation/retry/${failed.id}`).set(auth(user.token)).expect(201);
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: failed.id } })).status === 'FAILED',
    );
    expect(await ctx.prisma.generation.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({
      creditPool: 'paid',
    });
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 3 });

    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${failed.id}`).set(auth(user.token)).expect(201);
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: failed.id } })).status === 'COMPLETED',
    );
    expect(await getCredits(ctx, user.userId)).toEqual({ freeCreditsUsed: 10, credits: 2 });
    await expectBalanceMatchesLedger(ctx, user.userId, user.base);

    const admin = await account(10, 0);
    (ctx.app.get(CreditsService) as any).admins = new Set([admin.email.toLowerCase()]);
    ctx.gemini.failStyles = new Set(['white-bg']);
    await start(admin.token, admin.image.id, ['white-bg']).expect(201);
    const [adminRow] = await waitForGenerations(ctx, admin.image.id);
    expect(adminRow).toMatchObject({ creditPool: 'none', status: 'FAILED' });
    expect(await getCredits(ctx, admin.userId)).toEqual({ freeCreditsUsed: 10, credits: 0 });
  });

  it('[AC-GEN-028] a retried custom style and rework reuse the stored reference; it is deleted after success', async () => {
    const user = await account(0, 0);
    const reference = await makePng({ r: 250, g: 250, b: 0 }, 128);
    // The real GeminiService also receives the reference (args 3–4); the fake just ignores them.
    const image = jest.spyOn(ctx.gemini, 'generateImage') as unknown as jest.SpyInstance<unknown, unknown[]>;
    ctx.gemini.failStyles = new Set(['FAILME']);

    const res = await custom(user.token, user.image.id, 'Na stole FAILME', reference).expect(201);
    const id = res.body.generationId as string;
    await waitFor(async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id } })).status === 'FAILED');
    const failed = await ctx.prisma.generation.findUniqueOrThrow({ where: { id } });
    expect(failed).toMatchObject({ isRework: false, referenceKey: expect.stringContaining('references/') });
    expect(stored(failed.referenceKey!)).toBe(true);
    const firstRef = image.mock.calls[0][3];
    expect(firstRef).toBeTruthy();

    // The API never exposes the storage key.
    const results = await ctx.http().get(`/api/generation/${user.image.id}/results`).set(auth(user.token)).expect(200);
    expect(results.body[0]).not.toHaveProperty('referenceKey');
    const single = await ctx.http().get(`/api/generation/result/${id}`).set(auth(user.token)).expect(200);
    expect(single.body).not.toHaveProperty('referenceKey');

    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${id}`).set(auth(user.token)).expect(201);
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id } })).status === 'COMPLETED',
    );
    expect(image.mock.calls.at(-1)![3]).toBe(firstRef); // same reference as the first attempt
    expect((await ctx.prisma.generation.findUniqueOrThrow({ where: { id } })).referenceKey).toBeNull();
    expect(stored(failed.referenceKey!)).toBe(false);

    // Rework: the stored graphic is the base image of the retry too, with the rework prompt.
    ctx.gemini.failStyles = new Set(['FAILME']);
    const rework = await custom(user.token, user.image.id, 'Jaśniejsze FAILME tło', reference, true).expect(201);
    const reworkId = rework.body.generationId as string;
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: reworkId } })).status === 'FAILED',
    );
    const reworkFirst = image.mock.calls.at(-1)!;
    expect(await ctx.prisma.generation.findUniqueOrThrow({ where: { id: reworkId } })).toMatchObject({
      isRework: true,
    });
    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${reworkId}`).set(auth(user.token)).expect(201);
    await waitFor(
      async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: reworkId } })).status === 'COMPLETED',
    );
    const reworkRetry = image.mock.calls.at(-1)!;
    expect(reworkRetry[0]).toBe(reworkFirst[0]); // primary image = the stored reference
    expect(reworkRetry[2]).toBe('rework:Jaśniejsze FAILME tło');
    expect(reworkRetry[3]).toBe(reworkFirst[3]); // the original photo as identity reference
  });

  it('[AC-GEN-028] a rework whose reference is gone fails again and refunds; photo and account deletion remove references', async () => {
    const user = await account(10, 5);
    ctx.gemini.failStyles = new Set(['FAILME']);
    const reference = await makePng({ r: 0, g: 0, b: 250 }, 128);
    const res = await custom(user.token, user.image.id, 'Inne FAILME tło', reference, true).expect(201);
    const id = res.body.generationId as string;
    await waitFor(async () => (await ctx.prisma.generation.findUniqueOrThrow({ where: { id } })).status === 'FAILED');
    const { referenceKey } = await ctx.prisma.generation.findUniqueOrThrow({ where: { id } });
    fs.unlinkSync(path.join(uploadsDir(), referenceKey!.replace(/^\/api\/uploads\//, '')));

    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${id}`).set(auth(user.token)).expect(201);
    await waitFor(async () => (await getCredits(ctx, user.userId)).credits === 5);
    expect((await ctx.prisma.generation.findUniqueOrThrow({ where: { id } })).status).toBe('FAILED');

    // Deleting the photo removes the reference of its failed custom graphic.
    ctx.gemini.failStyles = new Set(['FAILME']);
    const second = await custom(user.token, user.image.id, 'Kolejne FAILME tło', reference).expect(201);
    await waitFor(
      async () =>
        (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: second.body.generationId } })).status ===
        'FAILED',
    );
    const key = (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: second.body.generationId } }))
      .referenceKey!;
    expect(stored(key)).toBe(true);
    await ctx.http().delete(`/api/images/${user.image.id}`).set(auth(user.token)).expect(200);
    expect(stored(key)).toBe(false);

    // Deleting the account removes them too (spec 03).
    const leaving = await account(0, 0);
    const third = await custom(leaving.token, leaving.image.id, 'Ostatnie FAILME tło', reference).expect(201);
    await waitFor(
      async () =>
        (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: third.body.generationId } })).status === 'FAILED',
    );
    const leavingKey = (await ctx.prisma.generation.findUniqueOrThrow({ where: { id: third.body.generationId } }))
      .referenceKey!;
    await ctx.http().delete('/api/users/me').set(auth(leaving.token)).send({ confirmEmail: leaving.email }).expect(200);
    expect(stored(leavingKey)).toBe(false);

    // A refused charge (402) does not leave the uploaded reference behind.
    const broke = await account(10, 0);
    const before = fs.existsSync(path.join(uploadsDir(), 'references'))
      ? fs.readdirSync(path.join(uploadsDir(), 'references')).length
      : 0;
    await custom(broke.token, broke.image.id, 'Bez kredytów', reference).expect(402);
    expect(fs.readdirSync(path.join(uploadsDir(), 'references')).length).toBe(before);
  });

  it('[AC-GEN-029] parallel starts, retries and failures of one account keep the balance equal to the ledger', async () => {
    const user = await account(6, 6); // 4 free + 6 purchased
    ctx.gemini.failStyles = new Set(['dark-luxury']);
    ctx.gemini.delayMs = 20;
    const images = [user.image, await uploadImage(ctx, user.token)];

    const starts = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        start(user.token, images[i % 2].id, [i % 3 === 0 ? 'dark-luxury' : 'white-bg']),
      ),
    );
    // 10 credits for 12 requests: at least 10 start (more only if an early failure was already refunded).
    expect(starts.every((r) => r.status === 201 || r.status === 402)).toBe(true);
    expect(starts.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(10);
    for (const img of images) await waitForGenerations(ctx, img.id);
    await expectBalanceMatchesLedger(ctx, user.userId, user.base);

    // Every failed graphic is retried several times in parallel: one retry per row wins (409 for the rest).
    const failed = await ctx.prisma.generation.findMany({
      where: { image: { userId: user.userId }, status: 'FAILED' },
    });
    expect(failed.length).toBeGreaterThan(0);
    const retries = await Promise.all(
      failed.flatMap((g) =>
        Array.from({ length: 3 }, () => ctx.http().post(`/api/generation/retry/${g.id}`).set(auth(user.token))),
      ),
    );
    const accepted = retries.filter((r) => r.status === 201).length;
    expect(accepted).toBeLessThanOrEqual(failed.length);
    expect(retries.every((r) => [201, 402, 409].includes(r.status))).toBe(true);
    await waitFor(
      async () =>
        (await ctx.prisma.generation.count({
          where: { image: { userId: user.userId }, status: { in: ['PENDING', 'PROCESSING'] } },
        })) === 0,
    );
    const after = await expectBalanceMatchesLedger(ctx, user.userId, user.base);
    // Failed ones were all refunded: what is left + finished graphics = the 10 credits the account had.
    const completed = await ctx.prisma.generation.count({
      where: { image: { userId: user.userId }, status: 'COMPLETED' },
    });
    expect(after.credits + (10 - after.freeCreditsUsed) + completed).toBe(10);
  });
});
