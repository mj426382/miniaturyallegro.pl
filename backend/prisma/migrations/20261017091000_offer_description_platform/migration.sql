-- Spec 07/08: the offer copy is written for a chosen sales platform. Additive only: existing
-- descriptions get 'generic' (constant default, a metadata-only change in PostgreSQL 11+).
ALTER TABLE "offer_descriptions" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'generic';
