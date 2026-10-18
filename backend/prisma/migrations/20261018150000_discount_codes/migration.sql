-- 2026-10-18 discount codes for credit packs (specs 09 and 16). Additive only: two columns with a constant default
-- or NULL (metadata-only in PostgreSQL 11+) and one new table. No existing value is changed.

-- Spec 09, AC-PAY-027: what the buyer really paid is in "amountPln" (session amount_total); the discount and the
-- human-readable promotion code are kept next to it.
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "amountDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "promotionCode" TEXT;

-- Spec 16, AC-ADM-017/018: codes created from the admin panel. The Stripe account is shared with the JAN-MAT shop,
-- so the panel lists only the codes recorded here.
CREATE TABLE IF NOT EXISTS "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountOffGrosze" INTEGER,
    "maxRedemptions" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "stripeCouponId" TEXT NOT NULL,
    "stripePromotionCodeId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_code_key" ON "discount_codes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "discount_codes_stripePromotionCodeId_key" ON "discount_codes"("stripePromotionCodeId");
CREATE INDEX IF NOT EXISTS "discount_codes_createdAt_idx" ON "discount_codes"("createdAt");
