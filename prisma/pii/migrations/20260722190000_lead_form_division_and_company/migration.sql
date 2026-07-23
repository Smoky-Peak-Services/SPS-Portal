-- Align Lead with standardized marketing forms:
--   division = form inquiry-type / site Division dropdown (text)
--   company  = submitter company name (blank → "Residential" at ingest)
--   budget / timeline / closedAt = optional qualification fields
--
-- Production may already have renamed company → division; this is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead' AND column_name = 'company'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lead' AND column_name = 'division'
  ) THEN
    ALTER TABLE "lead" RENAME COLUMN "company" TO "division";
  END IF;
END $$;

ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "division" TEXT;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "budget" TEXT;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "timeline" TEXT;
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
