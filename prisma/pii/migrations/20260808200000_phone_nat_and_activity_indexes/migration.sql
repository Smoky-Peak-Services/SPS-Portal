-- AlterTable
ALTER TABLE "contact" ADD COLUMN "directPhoneNat" TEXT;

-- AlterTable
ALTER TABLE "lead" ADD COLUMN "phoneNat" TEXT;

-- CreateIndex
CREATE INDEX "contact_directPhoneNat_idx" ON "contact"("directPhoneNat");

-- CreateIndex
CREATE INDEX "lead_phoneNat_idx" ON "lead"("phoneNat");

-- CreateIndex
CREATE INDEX "activity_customerId_createdAt_idx" ON "activity"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_leadId_createdAt_idx" ON "activity"("leadId", "createdAt");
