-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('ANNUAL', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurringFeeUnit" AS ENUM ('YEAR', 'MONTH');

-- CreateEnum
CREATE TYPE "RecurringFeeType" AS ENUM ('SMA_BASE_TIER', 'SMA_SVM', 'SMA_BANK_OF_HOURS', 'MONTHLY_SERVICE');

-- CreateEnum
CREATE TYPE "RateValueType" AS ENUM ('CURRENCY', 'PERCENT');

-- CreateTable
CREATE TABLE "recurring_fee_item" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" "RecurringFeeUnit" NOT NULL,
    "baseCost" DECIMAL(12,4) NOT NULL,
    "directPurchaseRate" DECIMAL(12,4) NOT NULL,
    "smaBundledRate" DECIMAL(12,4) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "feeType" "RecurringFeeType" NOT NULL,
    "valueType" "RateValueType" NOT NULL,
    "systemValueMin" DECIMAL(12,2),
    "systemValueMax" DECIMAL(12,2),
    "notes" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_fee_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_fee_item_divisionId_idx" ON "recurring_fee_item"("divisionId");

-- CreateIndex
CREATE INDEX "recurring_fee_item_divisionId_segment_feeType_idx" ON "recurring_fee_item"("divisionId", "segment", "feeType");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_fee_item_divisionId_segment_sku_key" ON "recurring_fee_item"("divisionId", "segment", "sku");

-- AddForeignKey
ALTER TABLE "recurring_fee_item" ADD CONSTRAINT "recurring_fee_item_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
