-- Owner decision 2026-10-17 (spec 08): the Allegro integration is removed and its user data deleted.
-- Only drops Allegro objects; IF EXISTS keeps the migration safe where they are already gone.

-- Encrypted OAuth tokens of connected Allegro seller accounts (its FK to users goes with the table).
DROP TABLE IF EXISTS "allegro_connections";

-- Offer id of photos imported from an Allegro offer.
ALTER TABLE "images" DROP COLUMN IF EXISTS "allegroOfferId";
