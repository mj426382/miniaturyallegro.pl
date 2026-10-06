import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uniqueEmail,
  uploadImage,
  waitForGenerations,
} from './test-app';
import { makePng } from './fakes';
import { CreditsService } from '../src/generation/credits.service';
import { UsersService } from '../src/users/users.service';

/** Spec 16, AC-ADM-010..012: accounts from ADMIN_EMAILS generate without a credit limit. */
describe('admin without a credit limit (spec 16)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gemini.failStyles.clear();
  });

  /** An admin whose free pool is used up and whose paid balance is zero. */
  async function brokeAdmin() {
    const admin = await registerUser(ctx, uniqueEmail('owner'));
    (ctx.app.get(CreditsService) as any).admins = new Set([admin.email.toLowerCase()]);
    (ctx.app.get(UsersService) as any).admins = new Set([admin.email.toLowerCase()]);
    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { credits: 0, freeCreditsUsed: 10 } });
    return admin;
  }

  async function brokeUser() {
    const user = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { credits: 0, freeCreditsUsed: 10 } });
    return user;
  }

  it('[AC-ADM-010] the admin generates styles, a custom scene, a rework and buys an edit pack without spending credits', async () => {
    const admin = await brokeAdmin();
    const image = await uploadImage(ctx, admin.token);

    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(admin.token))
      .send({ styles: ['white-bg', 'dark-luxury', 'lifestyle-home'] })
      .expect(201);
    await waitForGenerations(ctx, image.id);

    const reference = await makePng({ r: 1, g: 2, b: 3 }, 128);
    for (const isRework of [false, true]) {
      const req = ctx
        .http()
        .post(`/api/generation/${image.id}/custom`)
        .set(auth(admin.token))
        .field('userPrompt', isRework ? 'jaśniejsze tło' : 'na drewnianym stole')
        .attach('reference', reference, { filename: 'ref.png', contentType: 'image/png' });
      if (isRework) req.field('isRework', 'true');
      await req.expect(201);
    }
    await waitForGenerations(ctx, image.id);

    await ctx
      .http()
      .post(`/api/descriptions/${image.id}`)
      .set(auth(admin.token))
      .send({ notes: 'kubek 350 ml' })
      .expect(201);
    await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(admin.token)).expect(201);

    const completed = await ctx.prisma.generation.count({ where: { imageId: image.id, status: 'COMPLETED' } });
    expect(completed).toBe(5);
    expect(await getCredits(ctx, admin.userId)).toMatchObject({ credits: 0, freeCreditsUsed: 10 });
  });

  it('[AC-ADM-010] a regular account in the same situation gets 402', async () => {
    const user = await brokeUser();
    const image = await uploadImage(ctx, user.token);
    const res = await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(user.token))
      .send({ styles: ['white-bg'] })
      .expect(402);
    expect(res.body.creditsRequired).toBe(1);
  });

  it('[AC-ADM-011] a failed admin graphic refunds nothing; verification still applies', async () => {
    const admin = await brokeAdmin();
    const image = await uploadImage(ctx, admin.token);
    ctx.gemini.failStyles.add('dark-luxury');
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(admin.token))
      .send({ styles: ['white-bg', 'dark-luxury'] })
      .expect(201);
    const rows = await waitForGenerations(ctx, image.id);
    expect(rows.filter((g) => g.status === 'FAILED')).toHaveLength(1);
    // Give an asynchronous refund the chance to (wrongly) happen before checking.
    await new Promise((r) => setTimeout(r, 300));
    expect(await getCredits(ctx, admin.userId)).toMatchObject({ credits: 0, freeCreditsUsed: 10 });

    await ctx.prisma.user.update({ where: { id: admin.userId }, data: { emailVerifiedAt: null } });
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(admin.token))
      .send({ styles: ['gradient-bg'] })
      .expect(403);
  });

  it('[AC-ADM-011] the in-flight cap still applies to the admin', async () => {
    const admin = await brokeAdmin();
    const credits = ctx.app.get(CreditsService);
    await expect(credits.deduct(admin.userId, 31, { maxActive: 30 })).rejects.toMatchObject({ status: 429 });
  });

  it('[AC-ADM-012] /users/me reports unlimitedCredits only for the admin', async () => {
    const admin = await brokeAdmin();
    const user = await registerUser(ctx);
    expect((await ctx.http().get('/api/users/me').set(auth(admin.token)).expect(200)).body.unlimitedCredits).toBe(true);
    expect((await ctx.http().get('/api/users/me').set(auth(user.token)).expect(200)).body.unlimitedCredits).toBe(false);
  });
});
