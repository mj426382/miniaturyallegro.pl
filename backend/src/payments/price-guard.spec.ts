import { BadRequestException, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * Spec 09, AC-PAY-023 – plan price guard with a mocked Stripe: a plan is offered only when its Stripe
 * Price is an active monthly PLN price equal to priceGrosze; anything else (or a Stripe error) hides it.
 */
describe('subscription plan price guard', () => {
  const env: Record<string, string | undefined> = {};
  const config = { get: (key: string) => env[key] } as any;
  let warn: jest.SpyInstance;
  let prices: Record<string, any>;
  let retrieve: jest.Mock;
  let service: PaymentsService;

  const monthly = (unitAmount: number, overrides: Record<string, unknown> = {}) => ({
    active: true,
    currency: 'pln',
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1 },
    unit_amount: unitAmount,
    ...overrides,
  });
  const available = async () => Object.fromEntries((await service.getPlans()).map((p) => [p.id, p.available]));

  beforeEach(() => {
    jest.restoreAllMocks();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    env.STRIPE_PRICE_SUB_START = 'price_start';
    env.STRIPE_PRICE_SUB_PRO = 'price_pro';
    prices = { price_start: monthly(1900), price_pro: monthly(5900) };
    retrieve = jest.fn(async (id: string) => {
      if (!prices[id]) throw Object.assign(new Error(`No such price: '${id}'`), { statusCode: 404 });
      return { id, ...prices[id] };
    });
    service = new PaymentsService(config, {} as any, { send: jest.fn() } as any);
    service.setStripeClient({ prices: { retrieve } });
  });

  it('[AC-PAY-023] offers plans whose Stripe price matches plans.ts', async () => {
    expect(await available()).toEqual({ sub_start: true, sub_pro: true });
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('hidden'));
  });

  it.each([
    ['another amount (the old 149 zł)', monthly(14900)],
    ['another currency', monthly(5900, { currency: 'eur' })],
    ['a yearly price', monthly(5900, { recurring: { interval: 'year', interval_count: 1 } })],
    ['every 3 months', monthly(5900, { recurring: { interval: 'month', interval_count: 3 } })],
    ['a one-time price', monthly(5900, { type: 'one_time', recurring: null })],
    ['an archived price', monthly(5900, { active: false })],
    ['a tiered price without unit_amount', monthly(5900, { unit_amount: null, billing_scheme: 'tiered' })],
  ])('[AC-PAY-023] hides a plan whose Stripe price is %s and logs why', async (_case, price) => {
    prices.price_pro = price;
    expect(await available()).toEqual({ sub_start: true, sub_pro: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Plan sub_pro hidden'));
  });

  it('[AC-PAY-023] hides plans without a configured price (without asking Stripe) or with a missing price', async () => {
    env.STRIPE_PRICE_SUB_START = undefined;
    env.STRIPE_PRICE_SUB_PRO = 'price_deleted';
    expect(await available()).toEqual({ sub_start: false, sub_pro: false });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledWith('price_deleted');
  });

  it('[AC-PAY-023] fails closed on a Stripe error and asks again after a minute', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    retrieve.mockRejectedValueOnce(new Error('Stripe is down')).mockRejectedValueOnce(new Error('Stripe is down'));
    expect(await available()).toEqual({ sub_start: false, sub_pro: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not verify'));

    now += 30_000;
    expect(await available()).toEqual({ sub_start: false, sub_pro: false });
    expect(retrieve).toHaveBeenCalledTimes(2);

    now += 31_000;
    expect(await available()).toEqual({ sub_start: true, sub_pro: true });
    expect(retrieve).toHaveBeenCalledTimes(4);
  });

  it('[AC-PAY-023] caches a verdict for five minutes', async () => {
    let now = 5_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await available();
    await available();
    now += 4 * 60_000;
    await available();
    expect(retrieve).toHaveBeenCalledTimes(2);
    now += 2 * 60_000;
    await available();
    expect(retrieve).toHaveBeenCalledTimes(4);
  });

  it('[AC-PAY-023] refuses to start a subscription for a mismatched plan', async () => {
    prices.price_start = monthly(4900); // Stripe still at the old 49 zł
    await expect(service.createSubscriptionSession('user-1', 'sub_start')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createSubscriptionSession('user-1', 'sub_unknown')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
