import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS, WELCOME_PACKAGE, formatPln, perGraphicGrosze } from './plans';
import { creditsToReverse } from './payments.service';

describe('pricing catalogue (spec 02)', () => {
  it('[AC-PRC-010] plans cost 19 zł / 40 credits (Start) and 59 zł / 150 credits (Pro) per month', () => {
    expect(SUBSCRIPTION_PLANS.map((p) => [p.id, p.name, p.credits, p.priceGrosze, p.priceLabel])).toEqual([
      ['sub_start', 'Start', 40, 1900, '19 zł / mies.'],
      ['sub_pro', 'Pro', 150, 5900, '59 zł / mies.'],
    ]);
  });

  it('[AC-PRC-010] a graphic in every plan is cheaper than in every pack (exact fractions, no rounding)', () => {
    const packs = [...CREDIT_PACKAGES, WELCOME_PACKAGE];
    const cheapestPack = packs.reduce((best, p) => (perGraphicGrosze(p) < perGraphicGrosze(best) ? p : best));
    expect(cheapestPack.id).toBe('credits_200');
    expect(formatPln(perGraphicGrosze(cheapestPack))).toBe('0,50 zł');
    for (const plan of SUBSCRIPTION_PLANS) {
      for (const pack of packs) {
        // plan.price / plan.credits < pack.price / pack.credits, compared without floating point
        expect(plan.priceGrosze * pack.credits).toBeLessThan(pack.priceGrosze * plan.credits);
      }
    }
  });

  it('[AC-PRC-010] labels and descriptions show the computed per-graphic price', () => {
    const expected: Record<string, string> = { sub_start: '0,48 zł', sub_pro: '0,39 zł' };
    for (const plan of SUBSCRIPTION_PLANS) {
      const perGraphic = formatPln(perGraphicGrosze(plan));
      expect(perGraphic).toBe(expected[plan.id]);
      expect(plan.description).toContain(`${plan.credits} grafik miesięcznie (${perGraphic} / grafikę)`);
      expect(plan.priceLabel).toBe(`${plan.priceGrosze / 100} zł / mies.`);
    }
    for (const pack of CREDIT_PACKAGES) {
      expect(pack.priceLabel).toBe(`${pack.priceGrosze / 100} zł`);
      expect(pack.label).toBe(`${pack.credits} kredytów`);
    }
    expect(CREDIT_PACKAGES.find((p) => p.id === 'credits_200')!.savingLabel).toContain(
      formatPln(perGraphicGrosze({ priceGrosze: 9900, credits: 200 })),
    );
  });

  it('[AC-PRC-010] formats grosze the Polish way, rounding half up', () => {
    expect(formatPln(47.5)).toBe('0,48 zł');
    expect(formatPln(5900 / 150)).toBe('0,39 zł');
    expect(formatPln(49.5)).toBe('0,50 zł');
    expect(formatPln(1900)).toBe('19,00 zł');
  });
});

describe('credits taken back for a refund or dispute (spec 09)', () => {
  const pack = { amountPln: 2800, creditsAdded: 15, amountRefunded: 0, disputeAmount: 0 };

  it('[AC-PAY-017] are proportional to the money returned, rounded, and never more than the pack', () => {
    expect(creditsToReverse(pack)).toBe(0);
    expect(creditsToReverse({ ...pack, amountRefunded: 1400 })).toBe(8); // 7.5 → 8
    expect(creditsToReverse({ ...pack, amountRefunded: 1000 })).toBe(5); // 5.36 → 5
    expect(creditsToReverse({ ...pack, amountRefunded: 2800 })).toBe(15);
    expect(creditsToReverse({ ...pack, amountRefunded: 2000, disputeAmount: 2800 })).toBe(15);
    expect(creditsToReverse({ ...pack, amountRefunded: 1, disputeAmount: 0 })).toBe(0);
    expect(creditsToReverse({ ...pack, amountRefunded: -50 })).toBe(0);
  });

  it('[AC-PAY-019] count an open or lost dispute like a refund of the disputed amount', () => {
    expect(creditsToReverse({ ...pack, disputeAmount: 2800 })).toBe(15);
    expect(creditsToReverse({ ...pack, disputeAmount: 700 })).toBe(4); // 3.75 → 4
  });

  it('[AC-PAY-020] work for a free (100% promo) invoice without dividing by zero', () => {
    expect(creditsToReverse({ amountPln: 0, creditsAdded: 40, amountRefunded: 0, disputeAmount: 0 })).toBe(0);
  });
});
