import { createTestApp, registerUser, resetDatabase, TestContext, uploadImage, waitFor } from './test-app';
import { completedEvent, deliver, disputeEvent, FakeStripe, refundEvent } from './stripe-fake';
import { expectBalanceMatchesLedger } from './ledger';

/** Small deterministic PRNG (mulberry32) – a failing seed can be replayed exactly. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

const PACKS: Record<string, { amount: number }> = {
  credits_5: { amount: 1000 },
  credits_15: { amount: 2800 },
  credits_40: { amount: 7000 },
};

interface Purchase {
  sessionId: string;
  pi: string;
  amount: number;
  refunded: number;
  dispute: 'none' | 'open' | 'won' | 'lost';
  paid: boolean;
}

interface Account {
  userId: string;
  token: string;
  imageId: string;
  customer: string | null;
  freeUsedAtStart: number;
  purchases: Purchase[];
}

/**
 * Spec 09, AC-PAY-025 – accounting invariant. A random but reproducible sequence of everything that moves
 * credits (purchases with duplicate and late deliveries, graphics that succeed or fail, retries, partial and
 * full Stripe refunds – also before fulfilment – disputes won and lost, replayed events) runs for three
 * accounts. After EVERY step each account's free and purchased balance must equal the ledger recomputed from
 * the rows (payments and charged generations) and never be negative.
 */
describe('credit ledger invariant (property test)', () => {
  let ctx: TestContext;
  const stripe = new FakeStripe();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.payments.setStripeClient(stripe.client());
  });
  afterAll(async () => ctx.close());

  async function settle(account: Account) {
    await waitFor(
      async () =>
        (await ctx.prisma.generation.count({
          where: { image: { userId: account.userId }, status: { in: ['PENDING', 'PROCESSING'] } },
        })) === 0,
      15_000,
    );
  }

  async function run(seed: number, steps: number) {
    await resetDatabase(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE "stripe_events"');
    stripe.reset();
    ctx.gemini.failStyles = new Set(['dark-luxury']);
    const rnd = prng(seed);
    const sent: object[] = [];
    const send = async (event: object, allowed = [200]) => {
      sent.push(event);
      const res = await deliver(ctx, stripe, event);
      expect(allowed).toContain(res.status);
    };

    const accounts: Account[] = [];
    for (let i = 0; i < 3; i++) {
      const user = await registerUser(ctx);
      const freeUsedAtStart = rnd.int(7, 10); // reach the paid pool quickly
      await ctx.prisma.user.update({ where: { id: user.userId }, data: { freeCreditsUsed: freeUsedAtStart } });
      const image = await uploadImage(ctx, user.token);
      accounts.push({ ...user, imageId: image.id, customer: null, freeUsedAtStart, purchases: [] });
    }

    const log: string[] = [];
    for (let step = 0; step < steps; step++) {
      const account = rnd.pick(accounts);
      const roll = rnd.next();
      let op: string;

      if (roll < 0.2 || account.purchases.length === 0) {
        op = 'buy';
        const packageId = rnd.pick(Object.keys(PACKS));
        await ctx
          .http()
          .post('/api/payments/checkout')
          .set(auth(account.token))
          .send({ packageId, acceptedWithdrawalWaiver: true })
          .expect(201);
        const session = stripe.sessions.at(-1);
        const purchase: Purchase = {
          sessionId: session.id,
          pi: `pi_${session.id}`,
          amount: PACKS[packageId].amount,
          refunded: 0,
          dispute: 'none',
          paid: false,
        };
        stripe.sessionPaymentIntents.set(purchase.sessionId, purchase.pi);
        account.customer = session.customer;
        account.purchases.push(purchase);
        if (rnd.chance(0.15)) {
          // a refund overtakes the completion
          purchase.refunded = rnd.int(1, purchase.amount);
          await send(refundEvent(purchase.pi, purchase.amount, purchase.refunded, { customer: account.customer }));
          op += '+early-refund';
        }
        if (rnd.chance(0.85)) {
          const completion = completedEvent(purchase.sessionId, purchase.pi);
          await send(completion);
          if (rnd.chance(0.3)) await send(completion); // Stripe retry
          purchase.paid = true;
        }
      } else if (roll < 0.45) {
        op = 'generate';
        const styles = rnd.chance(0.5)
          ? [rnd.pick(['white-bg', 'dark-luxury', 'lifestyle-home'])]
          : ['white-bg', 'dark-luxury'];
        if (rnd.chance(0.3)) ctx.gemini.failStyles.add('lifestyle-home');
        else ctx.gemini.failStyles.delete('lifestyle-home');
        const res = await ctx
          .http()
          .post(`/api/generation/${account.imageId}/start`)
          .set(auth(account.token))
          .send({ styles });
        expect([201, 402]).toContain(res.status);
        op += `(${styles.join(',')}):${res.status}`;
      } else if (roll < 0.6) {
        op = 'retry';
        const failed = await ctx.prisma.generation.findMany({ where: { imageId: account.imageId, status: 'FAILED' } });
        if (failed.length) {
          const target = rnd.pick(failed);
          if (rnd.chance(0.5)) ctx.gemini.failStyles.delete('lifestyle-home');
          const res = await ctx.http().post(`/api/generation/retry/${target.id}`).set(auth(account.token));
          expect([201, 402]).toContain(res.status);
          op += `:${res.status}`;
        }
      } else if (roll < 0.78) {
        op = 'refund';
        const purchase = rnd.pick(account.purchases);
        if (purchase.refunded < purchase.amount) {
          purchase.refunded = rnd.chance(0.4) ? purchase.amount : rnd.int(purchase.refunded + 1, purchase.amount);
          await send(refundEvent(purchase.pi, purchase.amount, purchase.refunded, { customer: account.customer }));
          op += `:${purchase.refunded}/${purchase.amount}`;
        }
      } else if (roll < 0.9) {
        op = 'dispute';
        const purchase = rnd.pick(account.purchases);
        if (purchase.dispute === 'none') {
          purchase.dispute = 'open';
          await send(disputeEvent('charge.dispute.created', purchase.pi, purchase.amount, 'needs_response'));
        } else if (purchase.dispute === 'open') {
          purchase.dispute = rnd.chance(0.5) ? 'won' : 'lost';
          await send(disputeEvent('charge.dispute.closed', purchase.pi, purchase.amount, purchase.dispute));
        }
        op += `:${purchase.dispute}`;
      } else {
        op = 'replay';
        if (sent.length) await send(rnd.pick(sent)); // duplicate or out-of-order old event
      }

      for (const a of accounts) await settle(a);
      log.push(`${step}:${op}`);
      for (const a of accounts) {
        try {
          await expectBalanceMatchesLedger(ctx, a.userId, { freeUsed: a.freeUsedAtStart });
        } catch (err) {
          throw new Error(`seed ${seed}, after steps ${log.join(' ')}: ${(err as Error).message}`);
        }
      }
      // Credits taken back never exceed what a payment added.
      const rows = await ctx.prisma.paymentTransaction.findMany({ where: { userId: account.userId } });
      for (const t of rows) {
        expect(t.creditsReversed).toBeLessThanOrEqual(t.creditsAdded);
        expect(t.creditsShortfall).toBeLessThanOrEqual(t.creditsReversed);
        expect(t.creditsShortfall).toBeGreaterThanOrEqual(0);
      }
    }
    return log;
  }

  for (const seed of [20261017, 7, 4242]) {
    it(`[AC-PAY-025] balances equal the ledger after every step (seed ${seed})`, async () => {
      const log = await run(seed, 40);
      expect(log).toHaveLength(40);
    }, 240_000);
  }
});
