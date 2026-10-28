-- Spec 27: saved user styles + the style name on generations made from them.
ALTER TABLE "generations" ADD COLUMN "styleLabel" TEXT;

CREATE TABLE "user_styles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "referenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_styles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_styles_userId_createdAt_idx" ON "user_styles"("userId", "createdAt");

ALTER TABLE "user_styles" ADD CONSTRAINT "user_styles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
