-- Repack lead columns to the canonical form order:
-- id, divisionId, division, name, company, email, phone, message,
-- timeline, budget, source, status, createdAt, updatedAt, closedAt

ALTER TABLE "activity" DROP CONSTRAINT IF EXISTS "activity_leadId_fkey";

CREATE TABLE "lead_repack" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "division" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "timeline" TEXT,
    "budget" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
    "status" "LeadStatus" NOT NULL DEFAULT 'INQUIRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "lead_repack_pkey" PRIMARY KEY ("id")
);

INSERT INTO "lead_repack" (
    "id",
    "divisionId",
    "division",
    "name",
    "company",
    "email",
    "phone",
    "message",
    "timeline",
    "budget",
    "source",
    "status",
    "createdAt",
    "updatedAt",
    "closedAt"
)
SELECT
    "id",
    "divisionId",
    "division",
    "name",
    "company",
    "email",
    "phone",
    "message",
    "timeline",
    "budget",
    "source",
    "status",
    "createdAt",
    "updatedAt",
    "closedAt"
FROM "lead";

DROP TABLE "lead";

ALTER TABLE "lead_repack" RENAME TO "lead";

ALTER TABLE "lead" RENAME CONSTRAINT "lead_repack_pkey" TO "lead_pkey";

ALTER TABLE "lead"
    ADD CONSTRAINT "lead_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "division"("id")
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX "lead_divisionId_idx" ON "lead"("divisionId");
CREATE INDEX "lead_status_idx" ON "lead"("status");
CREATE INDEX "lead_email_idx" ON "lead"("email");

ALTER TABLE "activity"
    ADD CONSTRAINT "activity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id")
    ON UPDATE CASCADE ON DELETE CASCADE;
