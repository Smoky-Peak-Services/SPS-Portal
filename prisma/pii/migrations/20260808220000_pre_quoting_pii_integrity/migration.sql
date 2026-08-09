-- Prompt 25: Activity.leadId SetNull (preserve customer history after lead purge),
-- list indexes, Lead.externalId for ingest idempotency.

-- Activity.leadId: Cascade → SetNull
ALTER TABLE "activity" DROP CONSTRAINT IF EXISTS "activity_leadId_fkey";
ALTER TABLE "activity" ADD CONSTRAINT "activity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lead.externalId
ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "lead_externalId_key" ON "lead"("externalId");

-- List / Call Log indexes
CREATE INDEX IF NOT EXISTS "lead_status_updatedAt_idx" ON "lead"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "customer_archivedAt_displayName_idx" ON "customer"("archivedAt", "displayName");
CREATE INDEX IF NOT EXISTS "phone_event_dismissed_occurredAt_idx" ON "phone_event"("dismissed", "occurredAt");
