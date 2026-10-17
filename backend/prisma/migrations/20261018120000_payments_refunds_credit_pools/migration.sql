-- 2026-10-18 payments and credit accounting (specs 05, 09, 19). Additive only: new nullable columns or
-- columns with constant defaults (metadata-only in PostgreSQL 11+), one backfill, new indexes, one new table.
-- No existing value is changed except the backfilled "completedAt" of already completed payments.

-- Spec 19, AC-MON-009: the column default matches production (FREE_CREDITS_LIMIT=5). The code always sets the
-- value at sign-up; existing accounts keep the pool stored on them (10 or 5).
ALTER TABLE "users" ALTER COLUMN "freeCreditsLimit" SET DEFAULT 5;

-- Spec 05, AC-GEN-027/028: pool of the current charge (free | paid | none; NULL = charged before this change,
-- refunded the legacy way) and the reference image of a custom style / rework, so a retry reuses it.
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "creditPool" TEXT;
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "referenceKey" TEXT;
ALTER TABLE "generations" ADD COLUMN IF NOT EXISTS "isRework" BOOLEAN NOT NULL DEFAULT false;

-- Spec 09, AC-PAY-016..022 and spec 19, AC-MON-008: refunds, disputes and the welcome pack.
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "packageId" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "amountRefunded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "disputeAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "creditsReversed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "creditsShortfall" INTEGER NOT NULL DEFAULT 0;

-- Completed payments were fulfilled when they were recorded – the closest timestamp we have.
UPDATE "payment_transactions" SET "completedAt" = "createdAt" WHERE "status" = 'completed' AND "completedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_stripePaymentIntentId_key"
  ON "payment_transactions"("stripePaymentIntentId");

-- One live welcome pack per account: parallel checkouts cannot create a second row, and a failed or expired
-- attempt does not block a new one. Rows before this change have packageId NULL and are not affected.
-- (Partial index – not expressible in schema.prisma, kept here.)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_welcome_once"
  ON "payment_transactions"("userId")
  WHERE "packageId" = 'welcome_5' AND "status" NOT IN ('failed', 'expired');

-- Idempotency of refund / dispute webhooks (one row per processed Stripe event id).
CREATE TABLE IF NOT EXISTS "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
