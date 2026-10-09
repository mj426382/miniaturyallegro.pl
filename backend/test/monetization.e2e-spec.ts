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
import { AuthService } from '../src/auth/auth.service';
import { AdminGuard } from '../src/admin/admin.guard';
import { freeCreditsForNewAccounts } from '../src/generation/credits.service';
import { TRANSACTION_STATUS } from '../src/payments/payments.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

/** Spec 19: per-account free pool, welcome pack, admin credit grants. */
describe('monetization (spec 19)', () => {
  let ctx: TestContext;
  let sessions: any[];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    const stripe = new Stripe('sk_test_fake_key_for_tests', { apiVersion: '2026-03-25.dahlia' });
    stripe.checkout = {
      sessions: {
        create: async (params: any) => {
          const session = {
            id: `cs_test_m_${sessions.length + 1}`,
            url: 'https://checkout.stripe.com/test',
            ...params,
          };
          sessions.push(session);
          return session;
        },
      },
    };
    stripe.customers = { create: async (params: any) => ({ id: `cus_m_${Date.now()}`, ...params }) };
    ctx.payments.setStripeClient(stripe);
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    sessions = [];
    (ctx.app.get(AuthService) as any).freeCreditsLimit = 10;
  });

  describe('free pool per account', () => {
    it('[AC-MON-001] FREE_CREDITS_LIMIT is read as an integer, default 5', () => {
      expect(freeCreditsForNewAccounts('5')).toBe(5);
      expect(freeCreditsForNewAccounts('10')).toBe(10);
      expect(freeCreditsForNewAccounts(undefined)).toBe(5);
      expect(freeCreditsForNewAccounts('')).toBe(5);
      expect(freeCreditsForNewAccounts('abc')).toBe(5);
    });

    it('[AC-MON-001] new accounts get the configured pool; older accounts keep 10', async () => {
      const older = await registerUser(ctx, uniqueEmail('older'));
      (ctx.app.get(AuthService) as any).freeCreditsLimit = 5;
      const newer = await registerUser(ctx, uniqueEmail('newer'));

      expect((await ctx.http().get('/api/users/me').set(auth(older.token)).expect(200)).body.freeCreditsLimit).toBe(10);
      expect((await ctx.http().get('/api/users/me').set(auth(newer.token)).expect(200)).body.freeCreditsLimit).toBe(5);

      // Six graphics: free for the older account, the newer one runs out after five.
      for (const account of [older, newer]) {
        await ctx.prisma.user.update({ where: { id: account.userId }, data: { freeCreditsUsed: 0, credits: 0 } });
      }
      const styles = ['white-bg', 'dark-luxury', 'lifestyle-home', 'gradient-bg', 'in-action', 'multi-angle'];
      const olderImage = await uploadImage(ctx, older.token);
      await ctx
        .http()
        .post(`/api/generation/${olderImage.id}/start`)
        .set(auth(older.token))
        .send({ styles })
        .expect(201);
      await waitForGenerations(ctx, olderImage.id);
      expect(await getCredits(ctx, older.userId)).toEqual({ credits: 0, freeCreditsUsed: 6 });

      const newerImage = await uploadImage(ctx, newer.token);
      const refused = await ctx
        .http()
        .post(`/api/generation/${newerImage.id}/start`)
        .set(auth(newer.token))
        .send({ styles })
        .expect(402);
      expect(refused.body).toMatchObject({ creditsRequired: 1, freeLeft: 5 });
      expect(await getCredits(ctx, newer.userId)).toEqual({ credits: 0, freeCreditsUsed: 0 });
    });
  });

  describe('welcome pack', () => {
    it('[AC-MON-002] is offered until the first paid transaction and is not in the public catalogue', async () => {
      const { token, userId } = await registerUser(ctx);
      const offer = await ctx.http().get('/api/payments/welcome-offer').set(auth(token)).expect(200);
      expect(offer.body).toEqual({
        available: true,
        package: expect.objectContaining({ id: 'welcome_5', credits: 5, priceGrosze: 500, priceLabel: '5 zł' }),
      });
      const catalogue = await ctx.http().get('/api/payments/packages').expect(200);
      expect(catalogue.body.map((p: any) => p.id)).not.toContain('welcome_5');

      await ctx
        .http()
        .post('/api/payments/checkout')
        .set(auth(token))
        .send({ packageId: 'welcome_5', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].line_items[0].price_data.unit_amount).toBe(500);
      expect(sessions[0].metadata).toMatchObject({ packageId: 'welcome_5', credits: '5' });
      const pending = await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } });
      expect(pending).toMatchObject({ amountPln: 500, creditsAdded: 5, status: TRANSACTION_STATUS.pending });

      // After a paid transaction the offer disappears and the server refuses the pack.
      await ctx.prisma.paymentTransaction.update({
        where: { id: pending.id },
        data: { status: TRANSACTION_STATUS.completed },
      });
      expect((await ctx.http().get('/api/payments/welcome-offer').set(auth(token)).expect(200)).body).toEqual({
        available: false,
        package: null,
      });
      const refused = await ctx
        .http()
        .post('/api/payments/checkout')
        .set(auth(token))
        .send({ packageId: 'welcome_5', acceptedWithdrawalWaiver: true })
        .expect(400);
      expect(refused.body.message).toContain('pierwszym zakupie');
      expect(sessions).toHaveLength(1);
    });

    it('[AC-MON-002] needs a session', async () => {
      await ctx.http().get('/api/payments/welcome-offer').expect(401);
    });
  });

  describe('admin credit grants', () => {
    it('[AC-MON-006] the admin adds credits with a reason; it is recorded and shown in the account history', async () => {
      const admin = await registerUser(ctx, uniqueEmail('owner'));
      (ctx.app.get(AdminGuard) as any).admins = new Set([admin.email.toLowerCase()]);
      const user = await registerUser(ctx);

      const res = await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/credits`)
        .set(auth(admin.token))
        .send({ amount: 5, reason: 'Prezent – 5 grafik gratis' })
        .expect(201);
      expect(res.body).toMatchObject({
        credits: 5,
        grant: { amount: 5, reason: 'Prezent – 5 grafik gratis', grantedBy: admin.email },
      });
      expect((await getCredits(ctx, user.userId)).credits).toBe(5);

      const detail = await ctx.http().get(`/api/admin/users/${user.userId}`).set(auth(admin.token)).expect(200);
      expect(detail.body.creditGrants).toEqual([expect.objectContaining({ amount: 5, grantedBy: admin.email })]);

      for (const bad of [
        { amount: 0, reason: 'x prezent' },
        { amount: 101, reason: 'za dużo' },
        { amount: 5, reason: '' },
        { amount: 2.5, reason: 'ułamek' },
      ]) {
        await ctx.http().post(`/api/admin/users/${user.userId}/credits`).set(auth(admin.token)).send(bad).expect(400);
      }
      await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/credits`)
        .set(auth(user.token))
        .send({ amount: 5, reason: 'sam sobie' })
        .expect(403);
      expect((await getCredits(ctx, user.userId)).credits).toBe(5);
    });
  });
});
