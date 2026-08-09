-- DropIndex (replaced by unique)
DROP INDEX IF EXISTS "lead_customerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "lead_customerId_key" ON "lead"("customerId");
