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

describe('Generation & credits (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gemini.failStyles.clear();
    ctx.gemini.failDescription = false;
    ctx.gemini.delayMs = 0;
    ctx.gemini.calls = { description: 0, prompts: 0, image: 0, custom: 0, rework: 0, offerCopy: 0 };
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('[AC-GEN-001] exposes the style catalogue with a 3-style starter batch', async () => {
    const { token } = await registerUser(ctx);
    const res = await ctx.http().get('/api/generation/styles').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.styles).toHaveLength(19);
    expect(res.body.defaultStyleIds).toEqual(['white-bg', 'lifestyle-home', 'dark-luxury']);
    expect(res.body.styles[0]).not.toHaveProperty('prompt');
    expect(res.body.styles[0]).not.toHaveProperty('season');
    const christmas = res.body.styles.find((s: any) => s.id === 'christmas');
    expect(christmas).toMatchObject({ category: 'seasonal', inSeason: expect.any(Boolean) });
    expect(new Set(res.body.styles.map((s: any) => s.category))).toEqual(
      new Set(['universal', 'seasonal', 'industry']),
    );
  });

  it('[AC-GEN-002, AC-PRC-002] generates the starter batch (3 styles) by default and charges 3 free credits', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);

    const res = await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(res.body.count).toBe(3);
    expect(res.body.styles).toEqual(['white-bg', 'lifestyle-home', 'dark-luxury']);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 3 });

    const rows = await waitForGenerations(ctx, image.id);
    expect(rows.every((g) => g.status === 'COMPLETED' && g.url)).toBe(true);
    expect(rows.map((g) => g.prompt)).toEqual(expect.arrayContaining(['prompt-for-white-bg']));

    // Product description generated once and cached on the image.
    expect(ctx.gemini.calls.description).toBe(1);
    const dbImage = await ctx.prisma.image.findUniqueOrThrow({ where: { id: image.id } });
    expect(dbImage.description).toContain('red cube');

    const results = await ctx
      .http()
      .get(`/api/generation/${image.id}/results`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(results.body).toHaveLength(3);
    expect(results.body[0].url).toContain('/api/uploads/generated/');
  });

  it('[AC-GEN-003] lets the user add the remaining styles later without re-describing the product', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    await waitForGenerations(ctx, image.id);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ styles: ['gradient-bg', 'in-action', 'multi-angle'], basePrompt: 'ciepłe kolory' })
      .expect(201);
    const rows = await waitForGenerations(ctx, image.id);

    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((g) => g.style)).size).toBe(6);
    expect(ctx.gemini.calls.description).toBe(1);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 6 });
  });

  it('[AC-GEN-005] validates style ids and prompt length', async () => {
    const { token } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ styles: ['not-a-style'] })
      .expect(400);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ styles: [] })
      .expect(400);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ basePrompt: 'x'.repeat(401) })
      .expect(400);
    expect(await ctx.prisma.generation.count()).toBe(0);
  });

  it('[AC-GEN-006, AC-PRC-003] returns 402 when credits are insufficient and creates nothing', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 10, credits: 2 } });

    const res = await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(402);
    expect(res.body).toMatchObject({ creditsRequired: 3, creditsAvailable: 2 });
    expect(await ctx.prisma.generation.count()).toBe(0);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 2, freeCreditsUsed: 10 });

    // Mixed free + paid works when the paid part is covered.
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 9, credits: 2 } });
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 10 });
    await waitForGenerations(ctx, image.id);
  });

  it('never over-spends when requests arrive concurrently', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    // 8 free credits left: only two of the three 3-credit batches may succeed.
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 2, credits: 0 } });

    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        ctx.http().post(`/api/generation/${image.id}/start`).set('Authorization', `Bearer ${token}`).send({}),
      ),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 402]);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 8 });
    await waitForGenerations(ctx, image.id);
  });

  it('refunds the credit of a failed style and allows a retry', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    ctx.gemini.failStyles.add('dark-luxury');

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const rows = await waitForGenerations(ctx, image.id);

    const failed = rows.find((g) => g.style === 'dark-luxury')!;
    expect(failed.status).toBe('FAILED');
    expect(rows.filter((g) => g.status === 'COMPLETED')).toHaveLength(2);
    await waitFor(async () => (await getCredits(ctx, userId)).freeCreditsUsed === 2);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 2 });

    // Retry is only allowed for FAILED rows and costs a credit again.
    const completed = rows.find((g) => g.status === 'COMPLETED')!;
    await ctx.http().post(`/api/generation/retry/${completed.id}`).set('Authorization', `Bearer ${token}`).expect(400);

    ctx.gemini.failStyles.clear();
    await ctx.http().post(`/api/generation/retry/${failed.id}`).set('Authorization', `Bearer ${token}`).expect(201);
    const after = await waitForGenerations(ctx, image.id);
    expect(after.find((g) => g.id === failed.id)!.status).toBe('COMPLETED');
    await waitFor(async () => (await getCredits(ctx, userId)).freeCreditsUsed === 3);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 3 });
  });

  it('[AC-GEN-007, AC-PRC-004] fails the whole batch and refunds everything when the product analysis fails', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    ctx.gemini.failDescription = true;

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const rows = await waitForGenerations(ctx, image.id);
    expect(rows.every((g) => g.status === 'FAILED')).toBe(true);
    await waitFor(async () => (await getCredits(ctx, userId)).freeCreditsUsed === 0);
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 0 });
  });

  it('[AC-GEN-008] generates a custom graphic from a prompt with an optional reference image', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    const reference = await makePng({ r: 0, g: 0, b: 255 }, 128);

    const res = await ctx
      .http()
      .post(`/api/generation/${image.id}/custom`)
      .set('Authorization', `Bearer ${token}`)
      .field('userPrompt', 'na drewnianym stole w plenerze')
      .attach('reference', reference, { filename: 'ref.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.generationId).toEqual(expect.any(String));

    const rows = await waitForGenerations(ctx, image.id);
    expect(rows[0]).toMatchObject({
      style: 'custom',
      status: 'COMPLETED',
      prompt: 'custom:na drewnianym stole w plenerze',
    });
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 1 });

    // Rework mode uses the rework prompt builder.
    await ctx
      .http()
      .post(`/api/generation/${image.id}/custom`)
      .set('Authorization', `Bearer ${token}`)
      .field('userPrompt', 'jaśniejsze tło')
      .field('isRework', 'true')
      .attach('reference', reference, { filename: 'ref.png', contentType: 'image/png' })
      .expect(201);
    const after = await waitForGenerations(ctx, image.id);
    expect(after.some((g) => g.prompt === 'rework:jaśniejsze tło')).toBe(true);
    expect(ctx.gemini.calls.rework).toBe(1);
  });

  it('[AC-GEN-009] rejects too short custom prompts and invalid reference files without charging', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/custom`)
      .set('Authorization', `Bearer ${token}`)
      .field('userPrompt', 'ab')
      .expect(400);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/custom`)
      .set('Authorization', `Bearer ${token}`)
      .field('userPrompt', 'valid prompt here')
      .attach('reference', Buffer.from('not an image'), { filename: 'ref.png', contentType: 'image/png' })
      .expect(400);

    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 0 });
    expect(await ctx.prisma.generation.count()).toBe(0);
  });

  it('[AC-UPL-006] downloads a generated file through the proxy endpoint', async () => {
    const { token } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ styles: ['white-bg'] })
      .expect(201);
    const [gen] = await waitForGenerations(ctx, image.id);

    const res = await ctx
      .http()
      .get(`/api/generation/download/${gen.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toContain('grafika-white-bg.png');
    expect(res.body.length).toBeGreaterThan(50);
  });

  it('[AC-GEN-011] reconciles generations stuck after a crash and refunds them', async () => {
    const { token, userId } = await registerUser(ctx);
    const image = await uploadImage(ctx, token);
    await ctx.prisma.user.update({ where: { id: userId }, data: { freeCreditsUsed: 2 } });
    const stale = await ctx.prisma.generation.create({
      data: { imageId: image.id, style: 'white-bg', status: 'PROCESSING' },
    });
    await ctx.prisma
      .$executeRaw`UPDATE "generations" SET "updatedAt" = NOW() - INTERVAL '1 hour' WHERE "id" = ${stale.id}`;

    const { GenerationService } = await import('../src/generation/generation.service');
    const service = ctx.app.get(GenerationService);
    expect(await service.reconcileStaleGenerations()).toBe(1);
    expect((await ctx.prisma.generation.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe('FAILED');
    expect(await getCredits(ctx, userId)).toEqual({ credits: 0, freeCreditsUsed: 1 });
    // Second run is a no-op.
    expect(await service.reconcileStaleGenerations()).toBe(0);
  });
});
