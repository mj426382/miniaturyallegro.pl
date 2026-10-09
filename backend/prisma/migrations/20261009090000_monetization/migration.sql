-- Spec 19: the free pool is stored per account. Existing accounts keep the 10 free graphics they were
-- promised (DEFAULT 10 fills every current row); new accounts get FREE_CREDITS_LIMIT at sign-up.
ALTER TABLE "users" ADD COLUMN "freeCreditsLimit" INTEGER NOT NULL DEFAULT 10;

-- Spec 19: credits given by an administrator (gift, support), with the operator for accountability.
CREATE TABLE "credit_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_grants_userId_createdAt_idx" ON "credit_grants"("userId", "createdAt");

ALTER TABLE "credit_grants" ADD CONSTRAINT "credit_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
