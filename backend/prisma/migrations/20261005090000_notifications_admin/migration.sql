-- Spec 16: marketing consent, batch-done notifications, e-mail log (automatic + admin messages).
-- Existing accounts: no marketing consent (it must be given explicitly), batch notifications on.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "notifyBatchDone" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "notification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_log_kind_createdAt_idx" ON "email_log"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_log_userId_key_key" ON "email_log"("userId", "key");

-- CreateIndex
CREATE INDEX "notification_batches_closedAt_idx" ON "notification_batches"("closedAt");

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_batches" ADD CONSTRAINT "notification_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
