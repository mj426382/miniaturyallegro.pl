-- Security & privacy review 2026-10-17. Additive only: two new tables, no change to existing rows.

-- Spec 03: keyed hash (HMAC-SHA256) of a deleted account's canonical e-mail + deletion date.
-- No foreign key – the account no longer exists. Purged after 12 months by the application.
CREATE TABLE "account_tombstones" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_tombstones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_tombstones_emailHash_key" ON "account_tombstones"("emailHash");
CREATE INDEX "account_tombstones_deletedAt_idx" ON "account_tombstones"("deletedAt");

-- Spec 04: one row per accepted upload; the upload limits count these under the user row lock.
CREATE TABLE "upload_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "upload_log_userId_createdAt_idx" ON "upload_log"("userId", "createdAt");

ALTER TABLE "upload_log" ADD CONSTRAINT "upload_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill, so the limits hold from the first minute after deployment: every photo of a still unconfirmed
-- account (they count in total) and every photo uploaded in the last 24 hours (rolling daily limit).
-- Ids are derived from the image id, so the statement is deterministic and cannot collide.
INSERT INTO "upload_log" ("id", "userId", "createdAt")
SELECT 'bf_' || i."id", i."userId", i."createdAt"
FROM "images" i
JOIN "users" u ON u."id" = i."userId"
WHERE u."emailVerifiedAt" IS NULL OR i."createdAt" > NOW() - INTERVAL '24 hours';
