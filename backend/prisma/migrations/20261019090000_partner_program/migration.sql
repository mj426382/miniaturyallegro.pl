-- 2026-10-19 partner (affiliate) programme (spec 24). Additive only: new tables and NULL columns (metadata-only in
-- PostgreSQL 11+). No existing value is changed – existing accounts, codes and payments have no partner.

-- Spec 24, AC-PRT-001..003: partners managed in the admin panel.
CREATE TABLE IF NOT EXISTS "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "companyName" TEXT,
    "nip" TEXT,
    "customerDiscountPercent" INTEGER NOT NULL DEFAULT 10,
    "commissionPercent" INTEGER NOT NULL DEFAULT 20,
    "commissionMonths" INTEGER NOT NULL DEFAULT 12,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partners_createdAt_idx" ON "partners"("createdAt");

-- Spec 24, AC-PRT-004: a discount code may belong to a partner.
ALTER TABLE "discount_codes" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
CREATE INDEX IF NOT EXISTS "discount_codes_partnerId_idx" ON "discount_codes"("partnerId");
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Spec 24, AC-PRT-005/006: the first partner whose code the customer paid with, when, and until when it earns commission.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partnerAttributedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "partnerCommissionUntil" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "users_partnerId_idx" ON "users"("partnerId");
ALTER TABLE "users" ADD CONSTRAINT "users_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Spec 24, AC-PRT-008: the partner a payment earns commission for and the rate fixed at payment time.
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "partnerCommissionPercent" INTEGER;
CREATE INDEX IF NOT EXISTS "payment_transactions_partnerId_idx" ON "payment_transactions"("partnerId");
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Spec 24, AC-PRT-009..011: commission ledger. One "payment" entry per order and "adjustment" entries for refunds and
-- disputes, booked when they happen. Entries outlive a deleted customer account (transactionId is set to NULL; the
-- customer is only a short hash), so closed statements and the partner balance never change.
CREATE TABLE IF NOT EXISTS "partner_commissions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "transactionId" TEXT,
    "customerRef" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productKind" TEXT NOT NULL,
    "packageId" TEXT,
    "netPaidGrosze" INTEGER NOT NULL,
    "commissionGrosze" INTEGER NOT NULL,
    "commissionPercent" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_commissions_partnerId_occurredAt_idx" ON "partner_commissions"("partnerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "partner_commissions_transactionId_idx" ON "partner_commissions"("transactionId");
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Spec 24, AC-PRT-012: payouts recorded by the administrator.
CREATE TABLE IF NOT EXISTS "partner_payouts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountGrosze" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_payouts_partnerId_paidOn_idx" ON "partner_payouts"("partnerId", "paidOn");
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
