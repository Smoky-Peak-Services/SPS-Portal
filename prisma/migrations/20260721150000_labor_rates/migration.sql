-- CreateEnum
CREATE TYPE "LaborRateType" AS ENUM ('STANDARD', 'AFTER_HOURS', 'HOLIDAY');

-- CreateTable
CREATE TABLE "labor_rate_config" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "burdenMultiplier" DECIMAL(6,4) NOT NULL,
    "commercialBillingMultiplier" DECIMAL(6,4) NOT NULL,
    "afterHoursMultiplier" DECIMAL(6,4) NOT NULL,
    "holidayMultiplier" DECIMAL(6,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_rate_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_position" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "baseHourlyRate" DECIMAL(12,2) NOT NULL,
    "actualCostOfLabor" DECIMAL(12,2) NOT NULL,
    "standardBillingRate" DECIMAL(12,2) NOT NULL,
    "afterHoursRate" DECIMAL(12,2) NOT NULL,
    "holidayRate" DECIMAL(12,2) NOT NULL,
    "quotedAllocationPct" DECIMAL(5,2) NOT NULL,
    "context" "WorkContext" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labor_rate_config_divisionId_idx" ON "labor_rate_config"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "labor_rate_config_divisionId_segment_key" ON "labor_rate_config"("divisionId", "segment");

-- CreateIndex
CREATE INDEX "labor_position_divisionId_idx" ON "labor_position"("divisionId");

-- CreateIndex
CREATE INDEX "labor_position_divisionId_segment_context_idx" ON "labor_position"("divisionId", "segment", "context");

-- CreateIndex
CREATE UNIQUE INDEX "labor_position_divisionId_segment_sku_key" ON "labor_position"("divisionId", "segment", "sku");

-- AddForeignKey
ALTER TABLE "labor_rate_config" ADD CONSTRAINT "labor_rate_config_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_position" ADD CONSTRAINT "labor_position_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
