import { createTestApp, getCredits, registerUser, resetDatabase, TestContext } from './test-app';
import { completedEvent, deliver, FakeStripe, refundEvent } from './stripe-fake';

/** Spec 19 (AC-MON-008, AC-MON-009): the welcome pack is bought at most once per account, atomically. */
describe('welcome pack – one per account under concurrency (spec 19)', () => {
  let ctx: TestContext;
  const stripe = new FakeStripe();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const checkout = (token: string, packageId = 'welcome_5') =>
    ctx.http().post('/api/payments/checkout').set(auth(token)).send({ packageId, acceptedWithdrawalWaiver: true });

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.payments.setStripeClient(stripe.client());
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE "stripe_events"');
    stripe.reset();
  });

  it('[AC-MON-008] 15 parallel welcome checkouts create exactly one Stripe session and one transaction', async () => {
    const { token, userId } = await registerUser(ctx);
    stripe.createDelayMs = 40; // keep the Stripe call slow so the requests really overlap

    const responses = await Promise.all(Array.from({ length: 15 }, () => checkout(token)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
    expect(statuses.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);

    expect(stripe.calls.sessionCreate).toBe(1);
    expect(stripe.customers).toHaveLength(1);
    const rows = await ctx.prisma.paymentTransaction.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ packageId: 'welcome_5', status: 'pending', amountPln: 500, creditsAdded: 5 });
    expect(rows[0].stripeSessionId).toBe(stripe.sessions[0].id);
    // Every successful response points at the one session.
    for (const res of responses.filter((r) => r.status === 201)) expect(res.body.url).toBe(stripe.sessions[0].url);
  });

  it('[AC-MON-008] a new attempt reuses the open session, starts again after expiry, and fulfilment grants the pack once', async () => {
    const { token, userId } = await registerUser(ctx);
    const first = await checkout(token).expect(201);
    const again = await checkout(token).expect(201);
    expect(again.body.url).toBe(first.body.url);
    expect(stripe.calls.sessionCreate).toBe(1);

    // The session expired in Stripe (webhook not received yet): the old row is closed, a new session starts.
    stripe.sessions[0].status = 'expired';
    const third = await checkout(token).expect(201);
    expect(third.body.url).not.toBe(first.body.url);
    const rows = await ctx.prisma.paymentTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.status)).toEqual(['expired', 'pending']);

    // The database itself refuses a second live welcome row.
    await expect(
      ctx.prisma.paymentTransaction.create({
        data: { userId, stripeSessionId: 'cs_sneaky', amountPln: 500, creditsAdded: 5, packageId: 'welcome_5' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // Parallel deliveries of the completion add 5 credits once.
    const live = stripe.sessions[1];
    const done = completedEvent(live.id, `pi_${live.id}`);
    await Promise.all(Array.from({ length: 8 }, () => deliver(ctx, stripe, done).expect(200)));
    expect((await getCredits(ctx, userId)).credits).toBe(5);

    // A paid (even refunded) welcome pack never makes the account eligible again.
    await deliver(ctx, stripe, refundEvent(`pi_${live.id}`, 500, 500)).expect(200);
    expect((await getCredits(ctx, userId)).credits).toBe(0);
    expect((await ctx.http().get('/api/payments/welcome-offer').set(auth(token)).expect(200)).body).toEqual({
      available: false,
      package: null,
    });
    await checkout(token).expect(400);
    expect(stripe.calls.sessionCreate).toBe(2);
  });

  it('[AC-MON-008] a paid-but-unprocessed session refuses a new one; an abandoned reservation is cleaned up', async () => {
    const { token, userId } = await registerUser(ctx);
    await checkout(token).expect(201);
    stripe.sessions[0].status = 'complete';
    const refused = await checkout(token).expect(400);
    expect(refused.body.message).toContain('już opłacony');

    // A session Stripe no longer knows (404) cannot be paid: it is closed and a new one starts.
    const forgotten = await registerUser(ctx);
    await checkout(forgotten.token).expect(201);
    stripe.sessions.splice(stripe.sessions.length - 1, 1);
    await checkout(forgotten.token).expect(201);
    expect(
      (await ctx.prisma.paymentTransaction.findMany({ where: { userId: forgotten.userId } }))
        .map((r) => r.status)
        .sort(),
    ).toEqual(['expired', 'pending']);

    // A crash between the reservation and the Stripe call leaves a placeholder row behind.
    const other = await registerUser(ctx);
    await ctx.prisma.paymentTransaction.create({
      data: {
        userId: other.userId,
        stripeSessionId: 'reserved:crashed',
        amountPln: 500,
        creditsAdded: 5,
        packageId: 'welcome_5',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });
    await checkout(other.token).expect(201);
    const rows = await ctx.prisma.paymentTransaction.findMany({
      where: { userId: other.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.status)).toEqual(['expired', 'pending']);
    // A placeholder younger than two minutes means "in progress": 409, no second session.
    const third = await registerUser(ctx);
    await ctx.prisma.paymentTransaction.create({
      data: {
        userId: third.userId,
        stripeSessionId: 'reserved:now',
        amountPln: 500,
        creditsAdded: 5,
        packageId: 'welcome_5',
      },
    });
    const sessionsBefore = stripe.calls.sessionCreate;
    await checkout(third.token).expect(409);
    expect(stripe.calls.sessionCreate).toBe(sessionsBefore);
    // History never shows reservations.
    const history = await ctx.http().get('/api/payments/history').set(auth(third.token)).expect(200);
    expect(history.body).toEqual([]);
    expect((await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } })).status).toBe('pending');
  });

  it('[AC-MON-008] ordinary packs are not limited and record their package id; a failed Stripe call leaves no row', async () => {
    const { token, userId } = await registerUser(ctx);
    await Promise.all([checkout(token, 'credits_5').expect(201), checkout(token, 'credits_5').expect(201)]);
    const rows = await ctx.prisma.paymentTransaction.findMany({ where: { userId } });
    expect(rows.map((r) => r.packageId)).toEqual(['credits_5', 'credits_5']);
    // two parallel first purchases keep ONE Stripe customer on the account; an extra one is deleted
    expect(stripe.customers.length - stripe.deletedCustomers.length).toBe(1);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(stripe.sessions.map((s) => s.customer)).toEqual([user.stripeCustomerId, user.stripeCustomerId]);

    const broken = await registerUser(ctx);
    const create = stripe.checkout.sessions.create;
    stripe.checkout.sessions.create = async () => {
      throw new Error('stripe down');
    };
    try {
      await checkout(broken.token).expect(500);
    } finally {
      stripe.checkout.sessions.create = create;
    }
    expect(await ctx.prisma.paymentTransaction.count({ where: { userId: broken.userId } })).toBe(0);
    await checkout(broken.token).expect(201);
  });

  it('[AC-MON-009] the database default of freeCreditsLimit is 5; existing values are kept', async () => {
    const [column] = await ctx.prisma.$queryRaw<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'freeCreditsLimit'`;
    expect(column.column_default).toBe('5');

    await ctx.prisma.$executeRaw`
      INSERT INTO "users" ("id", "email", "emailCanonical", "updatedAt")
      VALUES ('raw-user', 'raw@test.allgrafika.pl', 'raw@test.allgrafika.pl', NOW())`;
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: 'raw-user' } })).freeCreditsLimit).toBe(5);

    const { userId } = await registerUser(ctx); // FREE_CREDITS_LIMIT=10 in the test environment
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } })).freeCreditsLimit).toBe(10);
  });
});
