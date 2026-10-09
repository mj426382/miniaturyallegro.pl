/**
 * Pricing catalogue.
 *
 * One-time packs are the entry point; monthly plans are for shops with many SKUs.
 * Stripe Price IDs for plans come from env (created in the Stripe dashboard), so a
 * plan is only offered when its price is configured.
 */
export interface CreditPackage {
  id: string;
  credits: number;
  priceGrosze: number;
  label: string;
  priceLabel: string;
  savingLabel: string | null;
  /** Spec 19: one-time welcome offer – only for accounts without a paid transaction. */
  welcome?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'credits_5', credits: 5, priceGrosze: 1000, label: '5 kredytów', priceLabel: '10 zł', savingLabel: null },
  {
    id: 'credits_15',
    credits: 15,
    priceGrosze: 2800,
    label: '15 kredytów',
    priceLabel: '28 zł',
    savingLabel: 'Oszczędzasz 2 zł',
  },
  {
    id: 'credits_40',
    credits: 40,
    priceGrosze: 7000,
    label: '40 kredytów',
    priceLabel: '70 zł',
    savingLabel: 'Oszczędzasz 10 zł',
  },
];

/**
 * Spec 19: first-purchase offer (usually 10 zł). Not part of the public catalogue – the server
 * decides eligibility (`GET /payments/welcome-offer`, checked again when the session is created).
 */
export const WELCOME_PACKAGE: CreditPackage = {
  id: 'welcome_5',
  credits: 5,
  priceGrosze: 500,
  label: 'Pakiet powitalny – 5 kredytów',
  priceLabel: '5 zł',
  savingLabel: 'Pierwszy zakup -50%',
  welcome: true,
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  /** Credits granted on every paid invoice (monthly). */
  credits: number;
  priceGrosze: number;
  priceLabel: string;
  /** Name of the env variable holding the Stripe Price ID. */
  priceEnv: string;
  description: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'sub_start',
    name: 'Start',
    credits: 40,
    priceGrosze: 4900,
    priceLabel: '49 zł / mies.',
    priceEnv: 'STRIPE_PRICE_SUB_START',
    description: '40 grafik miesięcznie (1,23 zł / grafikę). Dla sklepów dodających kilka produktów tygodniowo.',
  },
  {
    id: 'sub_pro',
    name: 'Pro',
    credits: 150,
    priceGrosze: 14900,
    priceLabel: '149 zł / mies.',
    priceEnv: 'STRIPE_PRICE_SUB_PRO',
    description: '150 grafik miesięcznie (0,99 zł / grafikę). Dla sklepów z setkami SKU i hurtowym przesyłaniem.',
  },
];

export function findPackage(id: string): CreditPackage | undefined {
  return [...CREDIT_PACKAGES, WELCOME_PACKAGE].find((p) => p.id === id);
}

export function findPlan(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}
