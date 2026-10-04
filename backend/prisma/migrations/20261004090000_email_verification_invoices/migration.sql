-- Spec 13: canonical e-mail + e-mail verification. Spec 09: Stripe invoice id on transactions.
-- Safe on existing production data: nothing is deleted, existing accounts stay usable.

-- Canonical form of an address. Mirror of backend/src/auth/email-canonical.ts – change both together.
CREATE OR REPLACE FUNCTION allgrafika_email_canonical(raw TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  e TEXT := lower(btrim(raw));
  local_part TEXT;
  domain_part TEXT;
  without_dots TEXT;
BEGIN
  IF e IS NULL OR position('@' IN e) = 0 THEN
    RETURN e;
  END IF;
  local_part := substring(e FROM '^(.*)@[^@]*$');
  domain_part := substring(e FROM '@([^@]*)$');
  IF local_part = '' OR domain_part = '' THEN
    RETURN e;
  END IF;
  IF domain_part = 'googlemail.com' THEN
    domain_part := 'gmail.com';
  END IF;
  IF position('+' IN local_part) > 1 THEN
    local_part := split_part(local_part, '+', 1);
  END IF;
  IF domain_part = 'gmail.com' THEN
    without_dots := replace(local_part, '.', '');
    IF without_dots <> '' THEN
      local_part := without_dots;
    END IF;
  END IF;
  RETURN local_part || '@' || domain_part;
END
$$;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "emailCanonical" TEXT;
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- backfill:start
-- 1. Lower-case stored addresses, unless two accounts differ only by letter case (then both stay as they are).
UPDATE "users" u
SET "email" = lower(btrim(u."email"))
WHERE u."email" <> lower(btrim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" o
    WHERE o."id" <> u."id" AND lower(btrim(o."email")) = lower(btrim(u."email"))
  );

-- 2. The oldest account of a mailbox gets the canonical form; later duplicates get a unique legacy marker
--    (they keep logging in with their exact address).
WITH ranked AS (
  SELECT
    "id",
    allgrafika_email_canonical("email") AS canon,
    row_number() OVER (PARTITION BY allgrafika_email_canonical("email") ORDER BY "createdAt", "id") AS rn
  FROM "users"
)
UPDATE "users" u
SET "emailCanonical" = CASE WHEN r.rn = 1 THEN r.canon ELSE lower(u."email") || '#legacy:' || u."id" END
FROM ranked r
WHERE r."id" = u."id";

-- 3. Accounts created before verification existed are trusted.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
-- backfill:end

ALTER TABLE "users" ALTER COLUMN "emailCanonical" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_emailCanonical_key" ON "users"("emailCanonical");

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Demo: per-mailbox limit
ALTER TABLE "demo_requests" ADD COLUMN "emailCanonical" TEXT;
UPDATE "demo_requests" SET "emailCanonical" = allgrafika_email_canonical("email");

-- CreateIndex
CREATE INDEX "demo_requests_emailCanonical_idx" ON "demo_requests"("emailCanonical");

-- Invoices (Stripe) attached to payments
ALTER TABLE "payment_transactions" ADD COLUMN "stripeInvoiceId" TEXT;
